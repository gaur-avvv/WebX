/**
 * @file lib/api-client.ts
 * @description Typed API client for all Zenith backend services.
 * Built on the native Fetch API with error handling and request ID propagation.
 */

import type {
  ApiResponse,
  ISSPosition,
  TLEData,
  SatellitePositionGeodetic,
  SatellitePass,
  OrbitPathPoint,
  PlanetaryEphemeris,
} from '@zenith/shared-types';

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const SATELLITE_API = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:4001';
const PLANETARY_API = process.env['NEXT_PUBLIC_PLANETARY_API_URL'] ?? 'http://localhost:4002';

// ─────────────────────────────────────────────
// Base fetch wrapper
// ─────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
    public readonly type?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!resp.ok) {
    let errorBody: { title?: string; detail?: string; type?: string } = {};
    try {
      errorBody = (await resp.json()) as typeof errorBody;
    } catch {
      // Ignore JSON parse errors on error responses
    }
    throw new ApiError(
      resp.status,
      errorBody.title ?? 'Request Failed',
      errorBody.detail ?? `HTTP ${resp.status}: ${resp.statusText}`,
      errorBody.type,
    );
  }

  return resp.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Satellite Service API
// ─────────────────────────────────────────────

/** Fetches the real-time ISS position and crew information */
export async function fetchISSPosition(): Promise<ISSPosition> {
  const res = await fetchJson<ApiResponse<ISSPosition>>(`${SATELLITE_API}/api/v1/iss/position`);
  return res.data;
}

/** Fetches TLE data for a satellite by NORAD ID */
export async function fetchSatelliteTLE(noradId: number): Promise<TLEData> {
  const res = await fetchJson<ApiResponse<TLEData>>(
    `${SATELLITE_API}/api/v1/satellites/${noradId}/tle`,
  );
  return res.data;
}

/** Fetches the real-time propagated position of a satellite */
export async function fetchSatellitePosition(noradId: number): Promise<SatellitePositionGeodetic> {
  const res = await fetchJson<ApiResponse<SatellitePositionGeodetic>>(
    `${SATELLITE_API}/api/v1/satellites/${noradId}/position`,
  );
  return res.data;
}

/** Predicts passes for an observer location */
export async function fetchSatellitePasses(
  noradId: number,
  params: {
    latitude: number;
    longitude: number;
    altitude?: number;
    days?: number;
    minElevation?: number;
  },
): Promise<SatellitePass[]> {
  const qs = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    ...(params.altitude !== undefined && { altitude: String(params.altitude) }),
    ...(params.days !== undefined && { days: String(params.days) }),
    ...(params.minElevation !== undefined && { minElevation: String(params.minElevation) }),
  });
  const res = await fetchJson<{ success: true; data: SatellitePass[] }>(
    `${SATELLITE_API}/api/v1/satellites/${noradId}/passes?${qs}`,
  );
  return res.data;
}

/** Fetches the ground-track orbit path */
export async function fetchOrbitPath(
  noradId: number,
  params?: { minutesAhead?: number; minutesBehind?: number; stepSeconds?: number },
): Promise<OrbitPathPoint[]> {
  const qs = new URLSearchParams({
    ...(params?.minutesAhead !== undefined && { minutesAhead: String(params.minutesAhead) }),
    ...(params?.minutesBehind !== undefined && { minutesBehind: String(params.minutesBehind) }),
    ...(params?.stepSeconds !== undefined && { stepSeconds: String(params.stepSeconds) }),
  });
  const res = await fetchJson<{ success: true; data: OrbitPathPoint[] }>(
    `${SATELLITE_API}/api/v1/satellites/${noradId}/orbit-path?${qs}`,
  );
  return res.data;
}

/** Fetches the curated visual satellite list */
export async function fetchVisualSatellites(): Promise<TLEData[]> {
  const res = await fetchJson<{ success: true; data: TLEData[] }>(
    `${SATELLITE_API}/api/v1/satellites/visual`,
  );
  return res.data;
}

// ─────────────────────────────────────────────
// Planetary Service API
// ─────────────────────────────────────────────

/** Fetches ephemeris for all solar system bodies */
export async function fetchAllPlanets(): Promise<PlanetaryEphemeris[]> {
  const res = await fetchJson<{ success: true; data: PlanetaryEphemeris[] }>(
    `${PLANETARY_API}/api/v1/planets`,
  );
  return res.data;
}

/** Fetches ephemeris for a single solar system body */
export async function fetchPlanetEphemeris(bodyId: string): Promise<PlanetaryEphemeris> {
  const res = await fetchJson<{ success: true; data: PlanetaryEphemeris }>(
    `${PLANETARY_API}/api/v1/planets/${bodyId}/ephemeris`,
  );
  return res.data;
}

export { ApiError };
