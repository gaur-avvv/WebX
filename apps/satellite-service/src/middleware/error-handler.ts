/**
 * @file middleware/error-handler.ts
 * @description Global Express error handler.
 * Returns RFC 7807 Problem Details responses for all unhandled errors.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

import logger from '../lib/logger';

/** Custom application error with an HTTP status code */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
    public readonly type: string = 'https://zenith.api/errors/application-error',
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** RFC 7807 Problem Details error response */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  requestId?: string;
}

/**
 * Global Express error handler.
 * Must be registered as the LAST middleware (4 arguments).
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const requestId = res.getHeader('X-Request-Id') as string | undefined;

  // Handle known AppError instances
  if (err instanceof AppError) {
    const problem: ProblemDetails = {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail ?? err.message,
      instance: req.path,
      requestId,
    };
    logger.warn({ err, requestId }, `AppError: ${err.message}`);
    res.status(err.status).json(problem);
    return;
  }

  // Handle Zod validation errors (thrown by our validation middleware)
  if (err instanceof Error && err.name === 'ZodError') {
    const problem: ProblemDetails = {
      type: 'https://zenith.api/errors/validation-error',
      title: 'Validation Error',
      status: 422,
      detail: err.message,
      instance: req.path,
      requestId,
    };
    res.status(422).json(problem);
    return;
  }

  // Handle CORS errors
  if (err instanceof Error && err.message.startsWith('Origin')) {
    res.status(403).json({
      type: 'https://zenith.api/errors/cors-forbidden',
      title: 'Forbidden',
      status: 403,
      detail: err.message,
    });
    return;
  }

  // Unknown / unexpected errors — log full stack, return generic 500
  logger.error({ err, requestId, path: req.path }, 'Unhandled error');

  const problem: ProblemDetails = {
    type: 'https://zenith.api/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail:
      process.env['NODE_ENV'] === 'development'
        ? (err instanceof Error ? err.message : String(err))
        : 'An unexpected error occurred. Please try again later.',
    instance: req.path,
    requestId,
  };

  res.status(500).json(problem);
};

// ─────────────────────────────────────────────
// Pre-built common errors
// ─────────────────────────────────────────────

export const Errors = {
  notFound: (resource: string) =>
    new AppError(
      404,
      'Not Found',
      `${resource} was not found`,
      'https://zenith.api/errors/not-found',
    ),

  badRequest: (detail: string) =>
    new AppError(
      400,
      'Bad Request',
      detail,
      'https://zenith.api/errors/bad-request',
      detail,
    ),

  upstream: (service: string, detail: string) =>
    new AppError(
      502,
      'Upstream Service Error',
      `${service}: ${detail}`,
      'https://zenith.api/errors/upstream-error',
      detail,
    ),

  tleParseError: (noradId: number) =>
    new AppError(
      500,
      'TLE Parse Error',
      `Failed to parse TLE data for satellite ${noradId}`,
      'https://zenith.api/errors/tle-parse-error',
    ),
} as const;
