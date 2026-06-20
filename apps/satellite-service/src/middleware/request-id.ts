/**
 * @file middleware/request-id.ts
 * @description Injects a unique request ID into each request for distributed tracing.
 * Checks for an incoming X-Request-Id header (set by load balancer/ingress) first,
 * then generates a UUID v4 if absent. The ID is echoed back in the response header.
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  // Augment Express Request type to include the requestId
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Express middleware that ensures every request has a unique ID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' ? incomingId : uuidv4();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
