'use client';

import { useEffect } from 'react';
import { useSatelliteStore } from '@/store/satellite.store';
import type { WebSocketEvent, SatellitePositionGeodetic } from '@zenith/shared-types';

/**
 * Custom hook to manage the real-time WebSocket connection to the Notification Service.
 * It listens for celestial updates and synchronizes them with the Zustand store.
 */
export function useSatelliteWebSocket() {
  const updateLivePosition = useSatelliteStore((state) => state.updateLivePosition);
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4003/ws';

  useEffect(() => {
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('📡 Connected to Zenith Notification Service');
    };

    socket.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'SATELLITE_POSITION_UPDATE': {
            const payload = data.payload as { positions: SatellitePositionGeodetic[] };
            payload.positions.forEach((pos) => {
              updateLivePosition(pos);
            });
            break;
          }
          case 'ISS_POSITION_UPDATE': {
            const pos = data.payload as any;
            // Map ISS payload to geodetic if necessary or handle specifically
            updateLivePosition({
              noradId: 25544,
              name: 'ISS (ZARYA)',
              coordinate: pos.coordinate,
              altitudeKm: pos.coordinate.altitude ?? 400,
              velocityKmPerSec: 7.66,
              orbitalPeriodMin: 92.9,
              timestamp: data.timestamp,
            });
            break;
          }
          default:
            console.log(`Unhandled WebSocket event: ${data.type}`);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('📡 Disconnected from Notification Service');
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      socket.close();
    };
  }, [updateLivePosition, wsUrl]);
}
