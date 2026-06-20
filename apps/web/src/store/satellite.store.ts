/**
 * @file store/satellite.store.ts
 * @description Zustand store for satellite tracking state.
 * Manages selected satellites, observer location, and real-time positions.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

import type { GeoCoordinate, SatellitePositionGeodetic, SatellitePass, TLEData } from '@zenith/shared-types';

// ─────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────

interface TrackedSatellite {
  noradId: number;
  name: string;
  isTracking: boolean;
}

interface SatelliteState {
  // Selected / tracked satellites
  trackedSatellites: TrackedSatellite[];
  selectedNoradId: number | null;

  // Observer location (set by map click or geolocation)
  observerLocation: GeoCoordinate | null;
  observerLocationName: string;

  // Real-time satellite positions (updated by WebSocket or polling)
  livePositions: Map<number, SatellitePositionGeodetic>;

  // Orbital display settings
  showOrbitPaths: boolean;
  showGroundTrack: boolean;
  orbitPathMinutes: number;

  // Map mode
  mapMode: '3d' | '2d';

  // Actions
  setObserverLocation: (coord: GeoCoordinate, name?: string) => void;
  clearObserverLocation: () => void;
  trackSatellite: (noradId: number, name: string) => void;
  untrackSatellite: (noradId: number) => void;
  selectSatellite: (noradId: number | null) => void;
  updateLivePosition: (position: SatellitePositionGeodetic) => void;
  setShowOrbitPaths: (show: boolean) => void;
  setShowGroundTrack: (show: boolean) => void;
  setOrbitPathMinutes: (minutes: number) => void;
  setMapMode: (mode: '3d' | '2d') => void;
}

// ─────────────────────────────────────────────
// Default tracked satellites (ISS always tracked)
// ─────────────────────────────────────────────

const DEFAULT_TRACKED: TrackedSatellite[] = [
  { noradId: 25544, name: 'ISS (ZARYA)', isTracking: true },
];

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useSatelliteStore = create<SatelliteState>()(
  subscribeWithSelector(
    persist(
      (set, _get) => ({
        // Initial state
        trackedSatellites: DEFAULT_TRACKED,
        selectedNoradId: 25544, // ISS selected by default
        observerLocation: null,
        observerLocationName: '',
        livePositions: new Map(),
        showOrbitPaths: true,
        showGroundTrack: true,
        orbitPathMinutes: 90,
        mapMode: '3d',

        // ── Actions ──

        setObserverLocation: (coord, name = 'Custom Location') =>
          set({ observerLocation: coord, observerLocationName: name }),

        clearObserverLocation: () =>
          set({ observerLocation: null, observerLocationName: '' }),

        trackSatellite: (noradId, name) =>
          set((state) => {
            const exists = state.trackedSatellites.find((s) => s.noradId === noradId);
            if (exists) return state;
            return {
              trackedSatellites: [
                ...state.trackedSatellites,
                { noradId, name, isTracking: true },
              ],
            };
          }),

        untrackSatellite: (noradId) =>
          set((state) => ({
            trackedSatellites: state.trackedSatellites.filter((s) => s.noradId !== noradId),
            selectedNoradId: state.selectedNoradId === noradId ? null : state.selectedNoradId,
          })),

        selectSatellite: (noradId) => set({ selectedNoradId: noradId }),

        updateLivePosition: (position) =>
          set((state) => {
            const next = new Map(state.livePositions);
            next.set(position.noradId, position);
            return { livePositions: next };
          }),

        setShowOrbitPaths: (show) => set({ showOrbitPaths: show }),
        setShowGroundTrack: (show) => set({ showGroundTrack: show }),
        setOrbitPathMinutes: (minutes) => set({ orbitPathMinutes: minutes }),
        setMapMode: (mode) => set({ mapMode: mode }),
      }),
      {
        name: 'zenith-satellite-store',
        // Only persist these fields (not live positions — those are transient)
        partialize: (state) => ({
          trackedSatellites: state.trackedSatellites,
          selectedNoradId: state.selectedNoradId,
          observerLocation: state.observerLocation,
          observerLocationName: state.observerLocationName,
          showOrbitPaths: state.showOrbitPaths,
          showGroundTrack: state.showGroundTrack,
          orbitPathMinutes: state.orbitPathMinutes,
          mapMode: state.mapMode,
        }),
      },
    ),
  ),
);

// ─── Selectors (memoised) ─────────────────────────────────────────────────

export const selectTrackedSatellites = (s: SatelliteState) => s.trackedSatellites;
export const selectSelectedNoradId = (s: SatelliteState) => s.selectedNoradId;
export const selectObserverLocation = (s: SatelliteState) => s.observerLocation;
export const selectLivePositions = (s: SatelliteState) => s.livePositions;
export const selectMapMode = (s: SatelliteState) => s.mapMode;
