/**
 * @file services/satellite.service.ts
 * @description Satellite data service: TLE fetching, SGP4 propagation,
 * pass prediction, and orbit path computation.
 *
 * External data sources:
 *  - CelesTrak GP API — TLE data in JSON format
 *    Endpoint: https://celestrak.org/SOCRATES/query.php
 *    GP API:   https://celestrak.org/SOCRATES/query.php?FORMAT=JSON
 *
 * @see https://celestrak.org/SOCRATES/
 */

import type {
  TLEData,
  SatellitePositionGeodetic,
  SatellitePass,
  OrbitPathPoint,
  GeoCoordinate,
} from '@zenith/shared-types';

import { prisma } from '../server';
import { cacheGet, cacheSet, CACHE_TTL } from '../lib/redis';
import { publishToKafka, KAFKA_TOPICS } from '../lib/kafka';
import { parseTLE, propagateToGeodetic, predictPasses, computeOrbitPath } from '../lib/sgp4';
import logger from '../lib/logger';
import { Errors } from '../middleware/error-handler';

const CELESTRAK_API_URL =
  process.env['CELESTRAK_API_URL'] ?? 'https://celestrak.org';

// ─────────────────────────────────────────────
// CelesTrak GP API Response Types
// ─────────────────────────────────────────────

interface CelesTrakGPRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  TLE_LINE1: string;
  TLE_LINE2: string;
  EPOCH: string;
}

// ─────────────────────────────────────────────
// TLE FETCH & CACHE
// ─────────────────────────────────────────────

/**
 * Retrieves the current TLE data for a satellite by NORAD ID.
 *
 * Lookup order:
 *  1. Redis cache (TTL: 2 hours)
 *  2. PostgreSQL database (most recent TLE record)
 *  3. CelesTrak GP API (live fetch + persist to DB + cache)
 *
 * @param noradId - NORAD catalog number
 * @returns TLE data object
 * @throws {AppError} If the satellite is not found in any source
 */
export async function getTLEForSatellite(noradId: number): Promise<TLEData> {
  const cacheKey = `zenith:tle:${noradId}`;

  // 1. Redis cache
  const cached = await cacheGet<TLEData>(cacheKey);
  if (cached) return cached;

  // 2. PostgreSQL — most recent TLE record for this satellite
  const dbRecord = await prisma.tLERecord.findFirst({
    where: { noradId },
    orderBy: { fetchedAt: 'desc' },
    include: { satellite: { select: { name: true, internationalDesignator: true } } },
  });

  if (dbRecord) {
    const tleData: TLEData = {
      noradId,
      name: dbRecord.satellite.name,
      internationalDesignator: dbRecord.satellite.internationalDesignator ?? '',
      line1: dbRecord.line1,
      line2: dbRecord.line2,
      epoch: dbRecord.epoch.toISOString(),
      fetchedAt: dbRecord.fetchedAt.toISOString(),
    };

    await cacheSet(cacheKey, tleData, CACHE_TTL.TLE_DATA);
    return tleData;
  }

  // 3. Fetch from CelesTrak
  return fetchAndPersistTLE(noradId);
}

/**
 * Fetches TLE from CelesTrak GP API, persists to PostgreSQL, and caches in Redis.
 */
async function fetchAndPersistTLE(noradId: number): Promise<TLEData> {
  const url = `${CELESTRAK_API_URL}/SOCRATES/query.php?CATNR=${noradId}&FORMAT=JSON`;
  logger.info({ noradId, url }, 'Fetching TLE from CelesTrak');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  let gpRecords: CelesTrakGPRecord[];
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Project-Zenith/1.0 (satellite-service)',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw Errors.upstream('CelesTrak', `HTTP ${resp.status}: ${resp.statusText}`);
    }

    gpRecords = (await resp.json()) as CelesTrakGPRecord[];
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw Errors.upstream('CelesTrak', 'Request timed out after 10 seconds');
    }
    throw err;
  }

  if (!gpRecords.length) {
    throw Errors.notFound(`Satellite with NORAD ID ${noradId}`);
  }

  const gp = gpRecords[0];
  if (!gp) throw Errors.notFound(`Satellite with NORAD ID ${noradId}`);

  const epochDate = new Date(gp.EPOCH);

  // Upsert satellite record and create TLE entry in a transaction
  await prisma.$transaction(async (tx: any) => {
    await tx.satellite.upsert({
      where: { noradId },
      create: {
        noradId,
        name: gp.OBJECT_NAME,
        internationalDesignator: gp.OBJECT_ID,
      },
      update: {
        name: gp.OBJECT_NAME,
        updatedAt: new Date(),
      },
    });

    await tx.tLERecord.create({
      data: {
        noradId,
        line1: gp.TLE_LINE1,
        line2: gp.TLE_LINE2,
        epoch: epochDate,
        source: 'celestrak-gp',
      },
    });
  });

  const tleData: TLEData = {
    noradId,
    name: gp.OBJECT_NAME,
    internationalDesignator: gp.OBJECT_ID,
    line1: gp.TLE_LINE1,
    line2: gp.TLE_LINE2,
    epoch: epochDate.toISOString(),
    fetchedAt: new Date().toISOString(),
  };

  const cacheKey = `zenith:tle:${noradId}`;
  await cacheSet(cacheKey, tleData, CACHE_TTL.TLE_DATA);

  // Publish TLE refresh event
  await publishToKafka(KAFKA_TOPICS.TLE_REFRESH, [
    { key: String(noradId), value: { noradId, name: gp.OBJECT_NAME, epoch: gp.EPOCH } },
  ]);

  return tleData;
}

// ─────────────────────────────────────────────
// SATELLITE POSITION (real-time propagation)
// ─────────────────────────────────────────────

/**
 * Computes the current real-time position of a satellite using SGP4.
 *
 * @param noradId - NORAD catalog number
 * @returns Current geodetic position
 */
export async function getSatellitePosition(noradId: number): Promise<SatellitePositionGeodetic> {
  const tleData = await getTLEForSatellite(noradId);

  const record = parseTLE(tleData.name, tleData.line1, tleData.line2);
  if (!record) throw Errors.tleParseError(noradId);

  const now = new Date();
  const pos = propagateToGeodetic(record, now);
  if (!pos) {
    throw Errors.tleParseError(noradId);
  }

  return {
    noradId,
    name: tleData.name,
    ...pos,
    timestamp: now.toISOString(),
  };
}

// ─────────────────────────────────────────────
// PASS PREDICTION
// ─────────────────────────────────────────────

/**
 * Predicts satellite passes over an observer location.
 */
export async function getSatellitePasses(
  noradId: number,
  observer: GeoCoordinate,
  days: number = 7,
  minElevationDeg: number = 10,
): Promise<SatellitePass[]> {
  const cacheKey = `zenith:passes:${noradId}:${observer.latitude.toFixed(3)}:${observer.longitude.toFixed(3)}:${days}:${minElevationDeg}`;

  const cached = await cacheGet<SatellitePass[]>(cacheKey);
  if (cached) return cached;

  const tleData = await getTLEForSatellite(noradId);
  const record = parseTLE(tleData.name, tleData.line1, tleData.line2);
  if (!record) throw Errors.tleParseError(noradId);

  const passes = predictPasses(record, observer, new Date(), days, minElevationDeg);

  await cacheSet(cacheKey, passes, CACHE_TTL.SATELLITE_PASSES);

  return passes;
}

// ─────────────────────────────────────────────
// ORBIT PATH
// ─────────────────────────────────────────────

/**
 * Computes the ground-track orbit path for globe visualisation.
 */
export async function getSatelliteOrbitPath(
  noradId: number,
  minutesAhead: number = 0,
  minutesBehind: number = 30,
  stepSeconds: number = 60,
): Promise<OrbitPathPoint[]> {
  const cacheKey = `zenith:orbit:${noradId}:${minutesAhead}:${minutesBehind}:${stepSeconds}`;

  const cached = await cacheGet<OrbitPathPoint[]>(cacheKey);
  if (cached) return cached;

  const tleData = await getTLEForSatellite(noradId);
  const record = parseTLE(tleData.name, tleData.line1, tleData.line2);
  if (!record) throw Errors.tleParseError(noradId);

  const path = computeOrbitPath(record, new Date(), minutesAhead, minutesBehind, stepSeconds);

  await cacheSet(cacheKey, path, CACHE_TTL.ORBIT_PATH);

  return path;
}

// ─────────────────────────────────────────────
// CURATED VISUAL SATELLITE LIST
// ─────────────────────────────────────────────

/**
 * Returns a curated list of the most commonly tracked bright satellites.
 * These NORAD IDs cover the ISS, Hubble, Tiangong, and major Starlink trains.
 *
 * @see https://celestrak.org/SOCRATES/  (visual satellite observer resources)
 */
export async function getVisualSatellites(): Promise<TLEData[]> {
  // Curated list of always-interesting satellites
  const VISUAL_SATELLITE_IDS = [
    25544, // ISS (ZARYA)
    20580, // HST (Hubble Space Telescope)
    48274, // CSS (Tiangong Space Station)
    43226, // STARLINK-1 (first batch)
    45678, // STARLINK representative
    22825, // Envisat
    27386, // AQUA
    39084, // Landsat-8
    43013, // NOAA-20
    28654, // NOAA-19
  ] as const;

  const cacheKey = 'zenith:satellites:visual-list';
  const cached = await cacheGet<TLEData[]>(cacheKey);
  if (cached) return cached;

  // Fetch all TLEs concurrently, skip failures
  const results = await Promise.allSettled(
    VISUAL_SATELLITE_IDS.map((id) => getTLEForSatellite(id)),
  );

  const tleList: TLEData[] = results
    .filter((r): r is PromiseFulfilledResult<TLEData> => r.status === 'fulfilled')
    .map((r) => r.value);

  await cacheSet(cacheKey, tleList, CACHE_TTL.SATELLITE_LIST);

  return tleList;
}
