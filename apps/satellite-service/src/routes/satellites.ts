/**
 * @file routes/satellites.ts
 * @description Satellite data routes.
 *
 * Routes:
 *  GET /api/v1/satellites/visual                    — Curated visual satellite list
 *  GET /api/v1/satellites/:noradId/tle              — Fetch TLE data
 *  GET /api/v1/satellites/:noradId/position         — Real-time position
 *  GET /api/v1/satellites/:noradId/passes           — Pass predictions
 *  GET /api/v1/satellites/:noradId/orbit-path       — Ground track path
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import {
  getTLEForSatellite,
  getSatellitePosition,
  getSatellitePasses,
  getSatelliteOrbitPath,
  getVisualSatellites,
} from '../services/satellite.service';
import type { ApiResponse } from '@zenith/shared-types';
import { Errors } from '../middleware/error-handler';

export const satelliteRouter = Router();

// ─────────────────────────────────────────────
// Zod Validation Schemas
// ─────────────────────────────────────────────

/** Validates the :noradId path parameter */
const NoradIdSchema = z
  .string()
  .regex(/^\d{1,6}$/, 'NORAD ID must be 1-6 digits')
  .transform(Number);

/** Validates query parameters for pass predictions */
const PassQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  altitude: z.coerce.number().min(0).max(8848).optional().default(0),
  days: z.coerce.number().int().min(1).max(14).optional().default(7),
  minElevation: z.coerce.number().min(0).max(90).optional().default(10),
});

/** Validates query parameters for orbit path */
const OrbitPathQuerySchema = z.object({
  minutesAhead: z.coerce.number().int().min(0).max(5760).optional().default(0),
  minutesBehind: z.coerce.number().int().min(0).max(120).optional().default(30),
  stepSeconds: z.coerce.number().int().min(10).max(300).optional().default(60),
});

// ─────────────────────────────────────────────
// Middleware: parse + validate :noradId
// ─────────────────────────────────────────────

function parseNoradId(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const result = NoradIdSchema.safeParse(req.params['noradId']);
  if (!result.success) {
    next(Errors.badRequest(`Invalid NORAD ID: ${result.error.issues[0]?.message ?? 'must be a number'}`));
    return;
  }
  // Store parsed value for downstream handlers
  req.params['parsedNoradId'] = String(result.data);
  next();
}

// ─────────────────────────────────────────────
// GET /api/v1/satellites/visual
// ─────────────────────────────────────────────

/**
 * Returns TLE data for a curated list of bright, easily visible satellites.
 * Cached in Redis for 24 hours.
 */
satelliteRouter.get(
  '/visual',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const satellites = await getVisualSatellites();

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json({
        success: true,
        data: satellites,
        count: satellites.length,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────
// GET /api/v1/satellites/:noradId/tle
// ─────────────────────────────────────────────

/**
 * Returns the current TLE data for a satellite.
 *
 * @param noradId - NORAD Catalog Number (e.g. 25544 for ISS)
 *
 * @example
 * GET /api/v1/satellites/25544/tle
 * {
 *   "success": true,
 *   "data": {
 *     "noradId": 25544,
 *     "name": "ISS (ZARYA)",
 *     "line1": "1 25544U 98067A ...",
 *     "line2": "2 25544 51.6400 ..."
 *   }
 * }
 */
satelliteRouter.get(
  '/:noradId/tle',
  parseNoradId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noradId = parseInt(req.params['parsedNoradId']!, 10);
      const tle = await getTLEForSatellite(noradId);

      const response: ApiResponse<typeof tle> = {
        success: true,
        data: tle,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      };

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────
// GET /api/v1/satellites/:noradId/position
// ─────────────────────────────────────────────

/**
 * Returns the real-time propagated position of a satellite.
 * Position is computed using SGP4 from the latest TLE.
 *
 * @param noradId - NORAD Catalog Number
 */
satelliteRouter.get(
  '/:noradId/position',
  parseNoradId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noradId = parseInt(req.params['parsedNoradId']!, 10);
      const position = await getSatellitePosition(noradId);

      const response: ApiResponse<typeof position> = {
        success: true,
        data: position,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      };

      res.setHeader('Cache-Control', 'no-store'); // Real-time data — never cache at CDN
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────
// GET /api/v1/satellites/:noradId/passes
// ─────────────────────────────────────────────

/**
 * Predicts overhead passes for an observer location.
 *
 * @param noradId - NORAD Catalog Number
 * @query latitude - Observer latitude (-90 to +90) [REQUIRED]
 * @query longitude - Observer longitude (-180 to +180) [REQUIRED]
 * @query altitude - Observer altitude in metres (default: 0)
 * @query days - Prediction window in days (1–14, default: 7)
 * @query minElevation - Minimum elevation threshold in degrees (0–90, default: 10)
 */
satelliteRouter.get(
  '/:noradId/passes',
  parseNoradId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noradId = parseInt(req.params['parsedNoradId']!, 10);

      const queryResult = PassQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        next(Errors.badRequest(queryResult.error.issues[0]?.message ?? 'Invalid query parameters'));
        return;
      }

      const { latitude, longitude, altitude, days, minElevation } = queryResult.data;

      const passes = await getSatellitePasses(
        noradId,
        { latitude, longitude, altitude },
        days,
        minElevation,
      );

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json({
        success: true,
        data: passes,
        count: passes.length,
        observer: { latitude, longitude, altitude },
        predictionDays: days,
        minElevationDeg: minElevation,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────
// GET /api/v1/satellites/:noradId/orbit-path
// ─────────────────────────────────────────────

/**
 * Returns the ground-track path for CesiumJS globe visualisation.
 *
 * @param noradId - NORAD Catalog Number
 * @query minutesAhead - Forward projection in minutes (0 = auto/one period, max: 5760)
 * @query minutesBehind - Past track in minutes (default: 30)
 * @query stepSeconds - Point resolution in seconds (10–300, default: 60)
 */
satelliteRouter.get(
  '/:noradId/orbit-path',
  parseNoradId,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const noradId = parseInt(req.params['parsedNoradId']!, 10);

      const queryResult = OrbitPathQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        next(Errors.badRequest(queryResult.error.issues[0]?.message ?? 'Invalid query parameters'));
        return;
      }

      const { minutesAhead, minutesBehind, stepSeconds } = queryResult.data;

      const path = await getSatelliteOrbitPath(noradId, minutesAhead, minutesBehind, stepSeconds);

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).json({
        success: true,
        data: path,
        count: path.length,
        timestamp: new Date().toISOString(),
        requestId: String(req.id),
      });
    } catch (err) {
      next(err);
    }
  },
);
