/**
 * @file lib/logger.ts
 * @description Pino structured logger singleton.
 * Uses JSON in production, pretty-print in development.
 */

import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  base: {
    service: 'satellite-service',
    version: process.env['npm_package_version'] ?? '0.0.0',
  },
  redact: {
    // Never log sensitive fields
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
    censor: '[REDACTED]',
  },
});

export default logger;
