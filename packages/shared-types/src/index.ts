/**
 * @file Shared TypeScript types and DTOs for Project Zenith
 * @description Central type definitions used across all services (frontend, backend, Go).
 *              These types represent the API contracts between microservices.
 */

// ─────────────────────────────────────────────
// COMMON / PRIMITIVES
// ─────────────────────────────────────────────

/** ISO 8601 datetime string */
export type ISODateString = string;

/** UNIX epoch timestamp in milliseconds */
export type EpochMs = number;

/** WGS-84 geographic coordinate */
export interface GeoCoordinate {
  /** Latitude in decimal degrees (-90 to +90) */
  latitude: number;
  /** Longitude in decimal degrees (-180 to +180) */
  longitude: number;
  /** Altitude in meters above mean sea level (optional) */
  altitude?: number;
}

/** RFC 7807 Problem Details for HTTP APIs */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  /** Additional extension members */
  [key: string]: unknown;
}

/** Generic paginated response envelope */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/** Generic API success response envelope */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: ISODateString;
  requestId: string;
}

/** Generic API error response envelope */
export interface ApiErrorResponse {
  success: false;
  error: ProblemDetails;
  timestamp: ISODateString;
  requestId: string;
}

// ─────────────────────────────────────────────
// TWO-LINE ELEMENT (TLE) DATA
// ─────────────────────────────────────────────

/** Raw Two-Line Element set as fetched from CelesTrak */
export interface TLEData {
  /** Satellite catalog number (NORAD ID) */
  noradId: number;
  /** International Designator (e.g., "1998-067A" for ISS) */
  internationalDesignator: string;
  /** Human-readable satellite name */
  name: string;
  /** TLE Line 1 (69 characters) */
  line1: string;
  /** TLE Line 2 (69 characters) */
  line2: string;
  /** Epoch of the TLE data */
  epoch: ISODateString;
  /** When this TLE was fetched/cached */
  fetchedAt: ISODateString;
}

// ─────────────────────────────────────────────
// SATELLITE POSITION & PASS DATA
// ─────────────────────────────────────────────

/** Real-time satellite position in Earth-Centered Inertial (ECI) coordinates */
export interface SatellitePositionECI {
  /** Position vector in kilometers */
  position: { x: number; y: number; z: number };
  /** Velocity vector in km/s */
  velocity: { x: number; y: number; z: number };
}

/** Satellite position in geodetic coordinates (observer-friendly) */
export interface SatellitePositionGeodetic {
  noradId: number;
  name: string;
  /** Geographic position */
  coordinate: GeoCoordinate;
  /** Altitude in km above the WGS-84 ellipsoid */
  altitudeKm: number;
  /** Velocity magnitude in km/s */
  velocityKmPerSec: number;
  /** Orbital period in minutes */
  orbitalPeriodMin: number;
  /** Timestamp of this position fix */
  timestamp: ISODateString;
}

/** A single point along a satellite's predicted ground track */
export interface OrbitPathPoint {
  coordinate: GeoCoordinate;
  timestamp: ISODateString;
}

/** Predicted overhead pass of a satellite over an observer location */
export interface SatellitePass {
  noradId: number;
  satelliteName: string;
  observerLocation: GeoCoordinate;
  /** Rise time above the horizon */
  riseTime: ISODateString;
  /** Time of maximum elevation */
  maxElevationTime: ISODateString;
  /** Set time below the horizon */
  setTime: ISODateString;
  /** Maximum elevation angle in degrees */
  maxElevationDeg: number;
  /** Azimuth at rise in degrees */
  riseAzimuthDeg: number;
  /** Azimuth at set in degrees */
  setAzimuthDeg: number;
  /** Duration of pass in seconds */
  durationSec: number;
  /** Minimum elevation threshold used (degrees) */
  minElevationDeg: number;
}

// ─────────────────────────────────────────────
// ISS (INTERNATIONAL SPACE STATION)
// ─────────────────────────────────────────────

/** Real-time ISS position from OpenNotify API */
export interface ISSPosition {
  coordinate: GeoCoordinate;
  timestamp: ISODateString;
  /** Number of astronauts currently on board */
  crewCount?: number;
  /** Names of crew members on board */
  crew?: AstronautInfo[];
}

/** Information about an astronaut currently in space */
export interface AstronautInfo {
  name: string;
  craft: string;
}

// ─────────────────────────────────────────────
// PLANETARY DATA
// ─────────────────────────────────────────────

/** Solar system body identifier */
export type SolarSystemBodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto';

/** Planetary ephemeris data from NASA Horizons */
export interface PlanetaryEphemeris {
  bodyId: SolarSystemBodyId;
  bodyName: string;
  /** Right ascension (J2000) in degrees */
  rightAscensionDeg: number;
  /** Declination (J2000) in degrees */
  declinationDeg: number;
  /** Distance from Earth in AU */
  distanceAU: number;
  /** Distance from Earth in km */
  distanceKm: number;
  /** Light travel time from body to Earth in minutes */
  lightTravelTimeMin: number;
  /** Apparent visual magnitude */
  apparentMagnitude?: number;
  /** Angular diameter in arcseconds */
  angularDiameterArcsec?: number;
  /** Phase angle in degrees (illumination fraction) */
  phaseAngleDeg?: number;
  /** Heliocentric Cartesian coordinates (ICRF, AU) */
  heliocentricPosition: { x: number; y: number; z: number };
  /** Timestamp of this ephemeris fix */
  timestamp: ISODateString;
}

// ─────────────────────────────────────────────
// USER & LOCATION
// ─────────────────────────────────────────────

/** User role enum */
export type UserRole = 'GUEST' | 'OBSERVER' | 'ADMIN';

/** User account DTO (safe for API exposure — no password hash) */
export interface UserDTO {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  preferredLocation?: GeoCoordinate;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Saved observer location */
export interface ObserverLocation {
  id: string;
  userId: string;
  name: string;
  coordinate: GeoCoordinate;
  /** Elevation above sea level in meters */
  elevationM: number;
  /** Timezone identifier (IANA format, e.g. "America/New_York") */
  timezone: string;
  isDefault: boolean;
  createdAt: ISODateString;
}

// ─────────────────────────────────────────────
// OBSERVATION RECORDS
// ─────────────────────────────────────────────

/** A logged satellite observation by a user */
export interface ObservationRecord {
  id: string;
  userId: string;
  noradId: number;
  satelliteName: string;
  observerLocation: GeoCoordinate;
  observedAt: ISODateString;
  maxElevationDeg?: number;
  notes?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  conditions?: ObservingConditions;
  createdAt: ISODateString;
}

/** Atmospheric observing conditions */
export interface ObservingConditions {
  /** Sky transparency: 1 (poor) - 5 (excellent) */
  transparency?: 1 | 2 | 3 | 4 | 5;
  /** Seeing: 1 (poor) - 5 (excellent) */
  seeing?: 1 | 2 | 3 | 4 | 5;
  temperatureCelsius?: number;
  windSpeedKph?: number;
  cloudCoverPercent?: number;
}

// ─────────────────────────────────────────────
// REAL-TIME EVENT PAYLOADS (WebSocket / Kafka)
// ─────────────────────────────────────────────

/** Kafka/WebSocket event types */
export type EventType =
  | 'ISS_POSITION_UPDATE'
  | 'SATELLITE_POSITION_UPDATE'
  | 'SATELLITE_PASS_ALERT'
  | 'PLANETARY_DATA_UPDATE'
  | 'TLE_REFRESH';

/** Base WebSocket event envelope */
export interface WebSocketEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: ISODateString;
  source: 'satellite-service' | 'planetary-service' | 'notification-service';
}

/** Real-time ISS position update event */
export type ISSPositionEvent = WebSocketEvent<ISSPosition>;

/** Real-time satellite position update for multiple satellites */
export type SatellitePositionUpdateEvent = WebSocketEvent<{
  positions: SatellitePositionGeodetic[];
}>;

/** Alert when a satellite pass is imminent (< 10 minutes) */
export type SatellitePassAlertEvent = WebSocketEvent<{
  pass: SatellitePass;
  minutesUntilRise: number;
}>;

// ─────────────────────────────────────────────
// API REQUEST TYPES
// ─────────────────────────────────────────────

/** Query parameters for satellite pass prediction */
export interface PassPredictionQuery {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Prediction window in days (1-14) */
  days?: number;
  /** Minimum elevation threshold in degrees (0-90) */
  minElevation?: number;
}

/** Query parameters for orbit path calculation */
export interface OrbitPathQuery {
  /** Number of future orbital minutes to calculate */
  minutesAhead?: number;
  /** Number of past orbital minutes to include */
  minutesBehind?: number;
  /** Time step resolution in seconds */
  stepSeconds?: number;
}
