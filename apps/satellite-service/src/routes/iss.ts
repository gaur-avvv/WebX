/**
 * @file routes/iss.ts
 * @description ISS real-time position route.
 * GET /api/v1/iss/position
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

import { getISSPosition } from '../services/iss.service';
import type { ApiResponse } from '@zenith/shared-types';
import type { ISSPosition } from '@zenith/shared-types';

export const issRouter = Router();

/** Stricter rate limit on ISS endpoint to respect OpenNotify limits */
const issRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 req/min per IP (1/sec)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    type: 'https://zenith.api/errors/rate-limit-exceeded',
    title: 'Too Many Requests',
    status: 429,
    detail: 'ISS position endpoint is limited to 60 requests per minute.',
  },
});

/**
 * GET /api/v1/iss/position
 *
 * Returns the current real-time position of the International Space Station.
 * Results are cached in Redis for 5 seconds to respect OpenNotify rate limits.
 *
 * @returns {ApiResponse<ISSPosition>} Current ISS position with crew info
 *
 * @example
 * GET /api/v1/iss/position
 * {
 *   "success": true,
 *   "data": {
 *     "coordinate": { "latitude": 51.5, "longitude": -0.12, "altitude": 408000 },
 *     "timestamp": "2026-06-20T06:00:00.000Z",
 *     "crewCount": 7,
 *     "crew": [{ "name": "Oleg Kononenko", "craft": "ISS" }]
 *   },
 *   "timestamp": "2026-06-20T06:00:00.000Z",
 *   "requestId": "uuid-v4"
 * }
 */
issRouter.get(
  '/position',
  issRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const position = await getISSPosition();

      const response: ApiResponse<ISSPosition> = {
        success: true,
        data: position,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      };

      // Cache-Control: public for CDN caching (matches Redis TTL of 5s)
      res.setHeader('Cache-Control', 'public, max-age=5');
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);
