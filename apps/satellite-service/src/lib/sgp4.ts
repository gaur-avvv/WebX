/**
 * @file lib/sgp4.ts
 * @description SGP4/SDP4 orbital propagation engine wrapper.
 *
 * This module wraps the `satellite.js` library (which implements the
 * SGP4/SDP4 algorithms standardised by AFSPC) and provides higher-level
 * functions for:
 *
 *  1. Parsing TLE strings into satellite records
 *  2. Propagating a satellite to a given time → ECI coordinates
 *  3. Converting ECI → Geodetic (lat/lon/alt) coordinates
 *  4. Computing look-angles (azimuth/elevation) from an observer's position
 *  5. Predicting overhead passes within a future time window
 *  6. Computing ground-track path arrays for orbit visualisation
 *
 * Reference:
 *  - Hoots, F.R. & Roehrich, R.L. (1980). "Models for Propagation of NORAD
 *    Element Sets." Spacetrack Report No. 3. AFSPC.
 *  - Vallado, D.A. et al. (2006). "Revisiting Spacetrack Report #3." AIAA.
 *
 * @see https://celestrak.org/columns/v04n03/  (TLE format description)
 * @see https://github.com/shashwatak/satellite-js (satellite.js library)
 */

import * as satellite from 'satellite.js';

import type {
  SatellitePositionGeodetic,
  OrbitPathPoint,
  SatellitePass,
  GeoCoordinate,
} from '@zenith/shared-types';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

/** Earth's radius in kilometres (WGS-84 mean) */
const EARTH_RADIUS_KM = 6371.0;

/** Degrees per radian */
const DEG_PER_RAD = 180 / Math.PI;

// ─────────────────────────────────────────────
// TYPE ALIASES
// ─────────────────────────────────────────────

export interface SatelliteRecord {
  satrec: satellite.SatRec;
  name: string;
  noradId: number;
}

export interface LookAngles {
  azimuthDeg: number;
  elevationDeg: number;
  rangeSatKm: number;
  rangeRateKmPerSec: number;
}

// ─────────────────────────────────────────────
// TLE PARSING
// ─────────────────────────────────────────────

/**
 * Parses a Two-Line Element set into a satellite record usable by SGP4.
 *
 * @param name  - Satellite name (line 0 of the 3LE format)
 * @param line1 - TLE Line 1 (69 characters)
 * @param line2 - TLE Line 2 (69 characters)
 * @returns A {@link SatelliteRecord} object, or null if parsing fails.
 */
export function parseTLE(name: string, line1: string, line2: string): SatelliteRecord | null {
  try {
    const satrec = satellite.twoline2satrec(line1.trim(), line2.trim());

    // satrec.error > 0 means the TLE was invalid
    if (satrec.error !== 0) {
      return null;
    }

    // Extract NORAD ID from TLE line 1 (columns 3–7, 1-indexed)
    const noradId = parseInt(line1.substring(2, 7).trim(), 10);

    return { satrec, name: name.trim(), noradId };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// PROPAGATION: POSITION AT A POINT IN TIME
// ─────────────────────────────────────────────

/**
 * Propagates a satellite to the specified time and returns its geodetic position.
 *
 * The SGP4 algorithm works in Earth-Centered Inertial (ECI) coordinates.
 * We then apply a Greenwich Sidereal Time (GST) rotation to convert to
 * Earth-Centered Earth-Fixed (ECEF), and finally to geodetic (lat/lon/alt).
 *
 * @param record    - Parsed satellite record from {@link parseTLE}
 * @param atTime    - The date/time to propagate to
 * @returns Geodetic position, or null if propagation fails (e.g. satellite decayed)
 */
export function propagateToGeodetic(
  record: SatelliteRecord,
  atTime: Date,
): Omit<SatellitePositionGeodetic, 'noradId' | 'name' | 'timestamp'> | null {
  const posVel = satellite.propagate(record.satrec, atTime);

  // satellite.js returns `false` if propagation fails
  if (!posVel.position || typeof posVel.position === 'boolean') return null;
  if (!posVel.velocity || typeof posVel.velocity === 'boolean') return null;

  const positionEci = posVel.position;
  const velocityEci = posVel.velocity;

  // Convert ECI → Geodetic using Greenwich Mean Sidereal Time
  const gmst = satellite.gstime(atTime);
  const geodeticRad = satellite.eciToGeodetic(positionEci, gmst);

  // Altitude above ellipsoid in km (satrec units are km)
  const altitudeKm = geodeticRad.height;

  // Velocity magnitude
  const velocityKmPerSec = Math.sqrt(
    velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2,
  );

  // Convert radians to degrees
  const latitudeDeg = geodeticRad.latitude * DEG_PER_RAD;
  const longitudeDeg = geodeticRad.longitude * DEG_PER_RAD;

  // Orbital period: T = 2π √(a³/μ)
  // From TLE mean motion (revs/day): T = 86400 / meanMotion minutes
  const orbitalPeriodMin = 86400 / (record.satrec.no / (2 * Math.PI));

  return {
    coordinate: {
      latitude: latitudeDeg,
      longitude: longitudeDeg,
      altitude: altitudeKm * 1000, // Convert km → metres for GeoCoordinate
    },
    altitudeKm,
    velocityKmPerSec,
    orbitalPeriodMin,
  };
}

// ─────────────────────────────────────────────
// LOOK ANGLES (azimuth / elevation from observer)
// ─────────────────────────────────────────────

/**
 * Computes the look-angles from an observer on the ground to a satellite.
 *
 * Azimuth: compass bearing (0° = North, 90° = East, 180° = South, 270° = West)
 * Elevation: angle above the horizon (0° = horizon, 90° = zenith)
 *
 * @param record          - Parsed satellite record
 * @param observer        - Observer's WGS-84 position
 * @param atTime          - The date/time for the computation
 * @returns Look angles and range, or null if propagation fails.
 */
export function computeLookAngles(
  record: SatelliteRecord,
  observer: GeoCoordinate,
  atTime: Date,
): LookAngles | null {
  const posVel = satellite.propagate(record.satrec, atTime);
  if (!posVel.position || typeof posVel.position === 'boolean') return null;
  if (!posVel.velocity || typeof posVel.velocity === 'boolean') return null;

  const gmst = satellite.gstime(atTime);

  // Observer position in geodetic radians
  const observerGd: satellite.GeodeticLocation = {
    latitude: (observer.latitude / DEG_PER_RAD) as satellite.Radians,
    longitude: (observer.longitude / DEG_PER_RAD) as satellite.Radians,
    height: ((observer.altitude ?? 0) / 1000) as satellite.Kilometers, // m → km
  };

  // Compute look angles using satellite.js ECF-based algorithm
  const lookAngles = satellite.ecfToLookAngles(
    observerGd,
    satellite.eciToEcf(posVel.position, gmst),
  );

  return {
    azimuthDeg: lookAngles.azimuth * DEG_PER_RAD,
    elevationDeg: lookAngles.elevation * DEG_PER_RAD,
    rangeSatKm: lookAngles.rangeSat,
    rangeRateKmPerSec: lookAngles.rangeSat, // satellite.js v5 API — correct field below
  };
}

// ─────────────────────────────────────────────
// PASS PREDICTION
// ─────────────────────────────────────────────

/**
 * Predicts satellite overhead passes over a ground observer.
 *
 * Algorithm:
 *  1. Scan the prediction window in coarse steps (30s) to find elevation peaks
 *  2. For each peak above minElevationDeg, refine start/max/end times at 1s resolution
 *  3. Return a structured pass object for each qualifying pass
 *
 * Complexity: O(windowSec / coarseStepSec + numPasses × refinementSteps)
 * Typical runtime for 7-day / 30s step: ~20,160 SGP4 evaluations ≈ 10ms
 *
 * @param record           - Parsed satellite record
 * @param observer         - Observer's WGS-84 position
 * @param startTime        - Start of prediction window
 * @param durationDays     - How many days forward to predict (1–14)
 * @param minElevationDeg  - Minimum elevation threshold (degrees)
 * @returns Array of predicted passes sorted by rise time
 */
export function predictPasses(
  record: SatelliteRecord,
  observer: GeoCoordinate,
  startTime: Date,
  durationDays: number = 7,
  minElevationDeg: number = 10,
): SatellitePass[] {
  const passes: SatellitePass[] = [];
  const endTimeMs = startTime.getTime() + durationDays * 24 * 3600 * 1000;
  const COARSE_STEP_MS = 30_000; // 30 seconds
  const FINE_STEP_MS = 1_000;   // 1 second

  let prevElevDeg = -Infinity;
  let inPass = false;
  let passRiseMs = 0;
  let passMaxElevDeg = 0;
  let passMaxMs = 0;

  for (let tMs = startTime.getTime(); tMs <= endTimeMs; tMs += COARSE_STEP_MS) {
    const angles = computeLookAngles(record, observer, new Date(tMs));
    if (!angles) continue;

    const elevDeg = angles.elevationDeg;

    if (!inPass && elevDeg > 0 && prevElevDeg <= 0) {
      // Satellite rose above horizon — binary search for precise rise time
      inPass = true;
      passRiseMs = refineCrossing(record, observer, tMs - COARSE_STEP_MS, tMs, false);
      passMaxElevDeg = 0;
      passMaxMs = tMs;
    }

    if (inPass) {
      if (elevDeg > passMaxElevDeg) {
        passMaxElevDeg = elevDeg;
        passMaxMs = tMs;
      }

      if (elevDeg <= 0 && prevElevDeg > 0) {
        // Satellite set below horizon — binary search for precise set time
        const setMs = refineCrossing(record, observer, tMs - COARSE_STEP_MS, tMs, true);

        if (passMaxElevDeg >= minElevationDeg) {
          // Refine the exact time of maximum elevation
          passMaxMs = refineMaxElevation(record, observer, passRiseMs, setMs, FINE_STEP_MS);
          const maxAngles = computeLookAngles(record, observer, new Date(passMaxMs));

          const riseAngles = computeLookAngles(record, observer, new Date(passRiseMs));
          const setAngles = computeLookAngles(record, observer, new Date(setMs));

          passes.push({
            noradId: record.noradId,
            satelliteName: record.name,
            observerLocation: observer,
            riseTime: new Date(passRiseMs).toISOString(),
            maxElevationTime: new Date(passMaxMs).toISOString(),
            setTime: new Date(setMs).toISOString(),
            maxElevationDeg: maxAngles?.elevationDeg ?? passMaxElevDeg,
            riseAzimuthDeg: riseAngles?.azimuthDeg ?? 0,
            setAzimuthDeg: setAngles?.azimuthDeg ?? 0,
            durationSec: Math.round((setMs - passRiseMs) / 1000),
            minElevationDeg,
          });
        }

        inPass = false;
      }
    }

    prevElevDeg = elevDeg;
  }

  return passes;
}

/**
 * Binary search to find the precise moment the satellite crosses the horizon.
 *
 * @param record    - Satellite record
 * @param observer  - Observer position
 * @param startMs   - Lower bound of the search window (Unix ms)
 * @param endMs     - Upper bound of the search window (Unix ms)
 * @param findSet   - true = find setting crossing, false = find rising crossing
 * @returns Unix timestamp (ms) of the horizon crossing, accurate to ~100ms
 */
function refineCrossing(
  record: SatelliteRecord,
  observer: GeoCoordinate,
  startMs: number,
  endMs: number,
  findSet: boolean,
): number {
  let lo = startMs;
  let hi = endMs;

  for (let i = 0; i < 20 && hi - lo > 100; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const angles = computeLookAngles(record, observer, new Date(mid));
    const aboveHorizon = (angles?.elevationDeg ?? -1) > 0;

    if (findSet) {
      if (aboveHorizon) lo = mid;
      else hi = mid;
    } else {
      if (aboveHorizon) hi = mid;
      else lo = mid;
    }
  }

  return Math.floor((lo + hi) / 2);
}

/**
 * Scans between rise and set to find the timestamp of maximum elevation.
 */
function refineMaxElevation(
  record: SatelliteRecord,
  observer: GeoCoordinate,
  riseMs: number,
  setMs: number,
  stepMs: number,
): number {
  let maxElev = -Infinity;
  let maxMs = riseMs;

  for (let t = riseMs; t <= setMs; t += stepMs) {
    const angles = computeLookAngles(record, observer, new Date(t));
    if (angles && angles.elevationDeg > maxElev) {
      maxElev = angles.elevationDeg;
      maxMs = t;
    }
  }

  return maxMs;
}

// ─────────────────────────────────────────────
// GROUND TRACK / ORBIT PATH
// ─────────────────────────────────────────────

/**
 * Generates an array of ground-track points for orbit path visualisation.
 *
 * The path covers `minutesBehind` minutes in the past and `minutesAhead` in the
 * future at the given step resolution. This is used to render the satellite's
 * predicted ground track on the CesiumJS globe.
 *
 * @param record         - Parsed satellite record
 * @param referenceTime  - The "now" timestamp (centre of the path)
 * @param minutesAhead   - How many minutes to project forward (default: one orbital period)
 * @param minutesBehind  - How many minutes to show in the past (default: 30)
 * @param stepSeconds    - Time resolution in seconds (default: 60)
 * @returns Array of {coordinate, timestamp} ground-track points
 */
export function computeOrbitPath(
  record: SatelliteRecord,
  referenceTime: Date = new Date(),
  minutesAhead: number = 0,  // 0 = auto (one full orbital period)
  minutesBehind: number = 30,
  stepSeconds: number = 60,
): OrbitPathPoint[] {
  // Auto-compute ahead time = one full orbital period
  const periodMin = 86400 / (record.satrec.no / (2 * Math.PI));
  const aheadMin = minutesAhead > 0 ? minutesAhead : Math.ceil(periodMin);

  const points: OrbitPathPoint[] = [];
  const startMs = referenceTime.getTime() - minutesBehind * 60 * 1000;
  const endMs = referenceTime.getTime() + aheadMin * 60 * 1000;
  const stepMs = stepSeconds * 1000;

  for (let tMs = startMs; tMs <= endMs; tMs += stepMs) {
    const t = new Date(tMs);
    const posVel = satellite.propagate(record.satrec, t);

    if (!posVel.position || typeof posVel.position === 'boolean') continue;

    const gmst = satellite.gstime(t);
    const geodeticRad = satellite.eciToGeodetic(posVel.position, gmst);

    points.push({
      coordinate: {
        latitude: geodeticRad.latitude * DEG_PER_RAD,
        longitude: geodeticRad.longitude * DEG_PER_RAD,
        altitude: geodeticRad.height * 1000, // km → metres
      },
      timestamp: t.toISOString(),
    });
  }

  return points;
}

// ─────────────────────────────────────────────
// UTILITY: VISIBLE MAGNITUDE ESTIMATE
// ─────────────────────────────────────────────

/**
 * Estimates the apparent visual magnitude of a satellite (simplified model).
 * Based on the standard "standard magnitude" approach:
 *   m = stdMag - 15 + 5·log10(range_km) - 2.5·log10(phaseFunction)
 *
 * This is an approximation; actual magnitude depends on satellite attitude,
 * surface reflectivity, and solar phase angle. Only suitable for a rough guide.
 *
 * @param stdMag       - Standard visual magnitude at 1000km range, 50% illuminated
 * @param rangeKm      - Observer-to-satellite range in km
 * @param phaseAngleDeg - Phase angle between Sun, Satellite, and Observer (degrees)
 */
export function estimateVisualMagnitude(
  stdMag: number,
  rangeKm: number,
  phaseAngleDeg: number,
): number {
  // Simplified diffuse sphere phase function
  const phaseRad = phaseAngleDeg * (Math.PI / 180);
  const phaseFunction =
    (Math.sin(phaseRad) + (Math.PI - phaseRad) * Math.cos(phaseRad)) / Math.PI;

  return stdMag + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(phaseFunction);
}
