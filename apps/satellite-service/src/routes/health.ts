/**
 * @file routes/health.ts
 * @description Health check endpoint.
 * Returns 200 when the service is ready to handle traffic, with
 * sub-system status for readiness probes in Kubernetes.
 */

import { Router, type Request, type Response } from 'express';

import { prisma } from '../server';
import { getRedis } from '../lib/redis';
import logger from '../lib/logger';

export const healthRouter = Router();

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  checks: {
    postgres: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

/**
 * GET /health
 * Liveness probe — always returns 200 if the process is running.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready
 * Readiness probe — checks connectivity to PostgreSQL and Redis.
 * Returns 200 only when all dependencies are healthy.
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const checks: HealthStatus['checks'] = {
    postgres: 'error',
    redis: 'error',
  };

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (err) {
    logger.warn(err, 'Health check: PostgreSQL failed');
  }

  // Check Redis
  try {
    const pong = await getRedis().ping();
    if (pong === 'PONG') checks.redis = 'ok';
  } catch (err) {
    logger.warn(err, 'Health check: Redis failed');
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status: HealthStatus['status'] = allOk ? 'ok' : 'degraded';

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    service: 'satellite-service',
    version: process.env['npm_package_version'] ?? '0.0.0',
    uptime: process.uptime(),
    checks,
  };

  res.status(allOk ? 200 : 503).json(health);
});
