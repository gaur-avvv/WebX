/**
 * @file lib/redis.ts
 * @description IORedis client singleton with connection health check.
 *
 * All external API responses are cached here to respect rate limits:
 *  - ISS position: 5-second TTL (OpenNotify updates every ~5s)
 *  - TLE data: 2-hour TTL (CelesTrak updates every few hours)
 *  - Planetary ephemeris: 5-minute TTL
 */

import { Redis } from 'ioredis';

import logger from './logger';

let redisClient: Redis | null = null;

/**
 * Creates and connects the Redis client singleton.
 * Call once during server startup; then use `getRedis()` everywhere else.
 */
export async function connectRedis(): Promise<Redis> {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) throw new Error('REDIS_URL environment variable is not set');

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis: max retries exceeded');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 3000); // Exponential back-off up to 3s
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect for READONLY errors (replica failover)
        return true;
      }
      return false;
    },
  });

  redisClient.on('connect', () => logger.debug('Redis: connecting...'));
  redisClient.on('ready', () => logger.info('Redis: connection ready'));
  redisClient.on('error', (err) => logger.error(err, 'Redis: connection error'));
  redisClient.on('close', () => logger.warn('Redis: connection closed'));
  redisClient.on('reconnecting', () => logger.info('Redis: reconnecting...'));

  // Verify connectivity
  await redisClient.ping();

  return redisClient;
}

/**
 * Returns the Redis client singleton.
 * @throws {Error} if `connectRedis()` has not been called yet.
 */
export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
}

// ─────────────────────────────────────────────
// Cache helpers with typed TTL constants
// ─────────────────────────────────────────────

export const CACHE_TTL = {
  /** ISS position from OpenNotify (~5s update frequency) */
  ISS_POSITION: parseInt(process.env['ISS_CACHE_TTL_SECONDS'] ?? '5', 10),
  /** TLE data from CelesTrak (updates every few hours) */
  TLE_DATA: parseInt(process.env['TLE_CACHE_TTL_SECONDS'] ?? '7200', 10),
  /** Satellite pass predictions (valid for ~1 hour) */
  SATELLITE_PASSES: 3600,
  /** Orbit path calculation */
  ORBIT_PATH: 300,
  /** Curated satellite list (rarely changes) */
  SATELLITE_LIST: 86400,
} as const;

/**
 * Gets a JSON-parsed value from Redis cache.
 * Returns null if the key does not exist or JSON parsing fails.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ key, err }, 'Cache read error — treating as cache miss');
    return null;
  }
}

/**
 * Stores a JSON-serialised value in Redis with a TTL.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn({ key, err }, 'Cache write error — continuing without caching');
  }
}
