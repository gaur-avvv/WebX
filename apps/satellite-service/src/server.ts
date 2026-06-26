/**
 * @file server.ts
 * @description Entry point for the Zenith Satellite Service.
 *
 * Bootstraps the Express application, connects to PostgreSQL via Prisma,
 * connects to Redis, initialises the Kafka producer, and starts the ISS
 * polling scheduler. Graceful shutdown on SIGTERM / SIGINT.
 */

import 'dotenv/config';

import http from 'http';

import { PrismaClient } from '@prisma/client';

import { createApp } from './app';
import { connectRedis } from './lib/redis';
import { createKafkaProducer } from './lib/kafka';
import { startISSPoller } from './jobs/iss-poller';
import logger from './lib/logger';

// ─────────────────────────────────────────────
// Validate required environment variables at startup
// ─────────────────────────────────────────────
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS', 'JWT_SECRET'] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error({ key }, `Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = parseInt(process.env['PORT'] ?? '4001', 10);

// ─────────────────────────────────────────────
// Singleton clients (shared across the application)
// ─────────────────────────────────────────────
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Forward Prisma events to Pino
prisma.$on('error', (e: any) => logger.error(e, 'Prisma error'));
prisma.$on('warn', (e: any) => logger.warn(e, 'Prisma warning'));

/**
 * Bootstrap and start the server.
 * Connects to all external services before binding the HTTP port.
 */
async function main(): Promise<void> {
  logger.info('🚀 Starting Zenith Satellite Service...');

  // 1. Connect to PostgreSQL
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error(err, 'Failed to connect to PostgreSQL');
    process.exit(1);
  }

  // 2. Connect to Redis
  try {
    await connectRedis();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.error(err, 'Failed to connect to Redis');
    process.exit(1);
  }

  // 3. Initialise Kafka producer
  let stopKafka: (() => Promise<void>) | undefined;
  try {
    stopKafka = await createKafkaProducer();
    logger.info('✅ Kafka producer ready');
  } catch (err) {
    // Kafka is non-critical for basic REST functionality; log and continue
    logger.warn(err, 'Kafka producer failed to connect — running in degraded mode');
  }

  // 4. Create Express app
  const app = createApp();
  const server = http.createServer(app);

  // 5. Start background jobs
  const stopISSPoller = startISSPoller();
  logger.info('✅ ISS position poller started');

  // 6. Bind HTTP listener
  server.listen(PORT, () => {
    logger.info({ port: PORT }, `✅ HTTP server listening on :${PORT}`);
  });

  // ─────────────────────────────────────────────
  // Graceful shutdown handler
  // ─────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal — draining connections...');

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      // Stop background jobs
      stopISSPoller();

      // Disconnect Kafka producer
      if (stopKafka) await stopKafka();

      // Disconnect from Prisma / PostgreSQL
      await prisma.$disconnect();
      logger.info('PostgreSQL disconnected');

      logger.info('Graceful shutdown complete. Goodbye 🌌');
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
}

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
