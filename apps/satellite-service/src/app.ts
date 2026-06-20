/**
 * @file app.ts
 * @description Express application factory.
 *
 * Creates and configures the Express application with all middleware,
 * routes, and error handlers. Exported as a factory so it can be
 * instantiated independently for testing.
 */

import express, { type Application, type Request, type Response } from 'express';

import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';

import logger from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { issRouter } from './routes/iss';
import { satelliteRouter } from './routes/satellites';
import { healthRouter } from './routes/health';

/**
 * Creates and returns a fully configured Express application.
 *
 * @returns {Application} Configured Express app ready to be attached to an HTTP server
 */
export function createApp(): Application {
  const app = express();

  // ─────────────────────────────────────────────
  // Trust proxy (for Kubernetes / reverse proxy)
  // ─────────────────────────────────────────────
  app.set('trust proxy', 1);

  // ─────────────────────────────────────────────
  // Security middleware
  // ─────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // CORS — allow frontend origins
  const allowedOrigins = (process.env['CORS_ORIGINS'] ?? 'http://localhost:3000').split(',');
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    }),
  );

  // ─────────────────────────────────────────────
  // Performance middleware
  // ─────────────────────────────────────────────
  app.use(compression());

  // ─────────────────────────────────────────────
  // Request parsing
  // ─────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─────────────────────────────────────────────
  // Request ID (for distributed tracing)
  // ─────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ─────────────────────────────────────────────
  // Structured HTTP request logging (Pino)
  // ─────────────────────────────────────────────
  app.use(
    pinoHttp({
      logger,
      // Don't log health check noise
      autoLogging: {
        ignore: (req: Request) => req.url === '/health',
      },
      customLogLevel: (_req, res, err) => {
        if (err ?? res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          requestId: (req as Request & { id?: string }).id,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    }),
  );

  // ─────────────────────────────────────────────
  // Global rate limiter (per IP)
  // ─────────────────────────────────────────────
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,                  // max 500 requests per window per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      type: 'https://zenith.api/errors/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: 'You have exceeded the rate limit. Please retry after the window expires.',
    },
  });
  app.use(globalLimiter);

  // ─────────────────────────────────────────────
  // Routes
  // ─────────────────────────────────────────────
  app.use('/health', healthRouter);
  app.use('/api/v1/iss', issRouter);
  app.use('/api/v1/satellites', satelliteRouter);

  // 404 handler for unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      type: 'https://zenith.api/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist.',
    });
  });

  // ─────────────────────────────────────────────
  // Global error handler (must be last)
  // ─────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
