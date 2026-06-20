/**
 * @file services/iss.service.ts
 * @description ISS position fetching logic.
 *
 * Fetches real-time ISS position from the OpenNotify API and caches
 * results in Redis to avoid hammering the free public API.
 *
 * OpenNotify API:
 *  - Endpoint: http://api.open-notify.org/iss-now.json
 *  - Update frequency: ~5 seconds
 *  - No authentication required
 *  - Rate limit: ~1 req/sec recommended
 *
 * @see http://open-notify.org/Open-Notify-API/ISS-Location-Now/
 */

import type { ISSPosition, AstronautInfo } from '@zenith/shared-types';

import { cacheGet, cacheSet, CACHE_TTL } from '../lib/redis';
import { publishToKafka, KAFKA_TOPICS } from '../lib/kafka';
import logger from '../lib/logger';
import { Errors } from '../middleware/error-handler';

// ─────────────────────────────────────────────
// OpenNotify API Response Types
// ─────────────────────────────────────────────

interface OpenNotifyISSResponse {
  message: 'success' | 'failure';
  timestamp: number; // UNIX epoch seconds
  iss_position: {
    latitude: string;
    longitude: string;
  };
}

interface OpenNotifyAstronautsResponse {
  message: 'success' | 'failure';
  number: number;
  people: Array<{ name: string; craft: string }>;
}

const ISS_POSITION_URL =
  process.env['OPENNOTIFY_API_URL'] ?? 'http://api.open-notify.org';

const CACHE_KEY_ISS = 'zenith:iss:position';
const CACHE_KEY_CREW = 'zenith:iss:crew';

/**
 * Fetches the current ISS position, using Redis cache when available.
 *
 * @returns The current ISS position with crew information
 * @throws {AppError} If the OpenNotify API is unavailable and cache is empty
 */
export async function getISSPosition(): Promise<ISSPosition> {
  // 1. Check cache first
  const cached = await cacheGet<ISSPosition>(CACHE_KEY_ISS);
  if (cached) return cached;

  // 2. Fetch from OpenNotify
  const [position, crew] = await Promise.all([
    fetchISSPosition(),
    fetchISSCrew(),
  ]);

  const issData: ISSPosition = {
    coordinate: {
      latitude: parseFloat(position.iss_position.latitude),
      longitude: parseFloat(position.iss_position.longitude),
      altitude: 408_000, // ISS mean altitude ~408 km → 408,000 m
    },
    timestamp: new Date(position.timestamp * 1000).toISOString(),
    crewCount: crew.number,
    crew: crew.people.map(
      (p): AstronautInfo => ({ name: p.name, craft: p.craft }),
    ),
  };

  // 3. Cache for 5 seconds (OpenNotify updates ~5s)
  await cacheSet(CACHE_KEY_ISS, issData, CACHE_TTL.ISS_POSITION);

  // 4. Publish to Kafka for real-time WebSocket distribution
  await publishToKafka(KAFKA_TOPICS.ISS_POSITION, [
    {
      key: 'iss',
      value: {
        type: 'ISS_POSITION_UPDATE',
        payload: issData,
        timestamp: new Date().toISOString(),
        source: 'satellite-service',
      },
    },
  ]);

  return issData;
}

// ─────────────────────────────────────────────
// Private fetch helpers
// ─────────────────────────────────────────────

async function fetchISSPosition(): Promise<OpenNotifyISSResponse> {
  const url = `${ISS_POSITION_URL}/iss-now.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Project-Zenith/1.0 (satellite-service)' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw Errors.upstream('OpenNotify', `HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data = (await resp.json()) as OpenNotifyISSResponse;

    if (data.message !== 'success') {
      throw Errors.upstream('OpenNotify', 'API returned non-success status');
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw Errors.upstream('OpenNotify', 'Request timed out after 5 seconds');
    }
    logger.error({ err, url }, 'Failed to fetch ISS position');
    throw err;
  }
}

async function fetchISSCrew(): Promise<OpenNotifyAstronautsResponse> {
  // Cache crew separately — it changes very rarely
  const cached = await cacheGet<OpenNotifyAstronautsResponse>(CACHE_KEY_CREW);
  if (cached) return cached;

  const url = `${ISS_POSITION_URL}/astros.json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Project-Zenith/1.0 (satellite-service)' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      // Non-critical — return empty crew rather than failing the whole request
      logger.warn({ status: resp.status }, 'Failed to fetch ISS crew — returning empty');
      return { message: 'success', number: 0, people: [] };
    }

    const data = (await resp.json()) as OpenNotifyAstronautsResponse;

    // Cache crew for 1 hour (changes very rarely)
    await cacheSet(CACHE_KEY_CREW, data, 3600);

    return data;
  } catch {
    clearTimeout(timeout);
    return { message: 'success', number: 0, people: [] };
  }
}
