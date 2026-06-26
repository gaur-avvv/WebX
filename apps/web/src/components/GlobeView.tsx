'use client';

import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { useSatelliteStore } from '@/store/satellite.store';

/**
 * GlobeView is the primary 3D visualization component.
 * It integrates CesiumJS to render the Earth and real-time satellite entities.
 */
export function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const entitiesRef = useRef<Map<number, Cesium.Entity>>(new Map());

  // Store selectors
  const trackedSatellites = useSatelliteStore((state) => state.trackedSatellites);
  const livePositions = useSatelliteStore((state) => state.livePositions);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Cesium Viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      homeButton: false,
      geocoder: false,
    });

    Cesium.createWorldTerrainAsync()
      .then((terrainProvider) => {
        if (!viewer.isDestroyed()) {
          viewer.terrainProvider = terrainProvider;
        }
      })
      .catch((err) => {
        console.error('Failed to load world terrain', err);
      });

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
    };
  }, []);

  // Update tracked satellites entities
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // Add new tracked satellites
    trackedSatellites.forEach((sat) => {
      if (!entitiesRef.current.has(sat.noradId)) {
        const entity = viewer.entities.add({
          id: `sat-${sat.noradId}`,
          name: sat.name,
          point: {
            pixelSize: 8,
            color: Cesium.Color.YELLOW,
          },
          label: {
            text: sat.name,
            font: '12px sans-serif',
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
          },
        });
        entitiesRef.current.set(sat.noradId, entity);
      }
    });

    // Remove untracked satellites
    const trackedIds = new Set(trackedSatellites.map((s) => s.noradId));
    for (const [id, entity] of entitiesRef.current.entries()) {
      if (!trackedIds.has(id)) {
        viewer.entities.remove(entity);
        entitiesRef.current.delete(id);
      }
    }
  }, [trackedSatellites]);

  // Real-time position update loop
  useEffect(() => {
    if (!viewerRef.current) return;

    let animationId: number;
    const updateLoop = () => {
      livePositions.forEach((pos, noradId) => {
        const entity = entitiesRef.current.get(noradId);
        if (entity) {
          // Convert geodetic to Cartesian3
          const position = Cesium.Cartesian3.fromDegrees(
            pos.coordinate.longitude,
            pos.coordinate.latitude,
            pos.coordinate.altitude ?? pos.altitudeKm * 1000,
          );
          entity.position = new Cesium.ConstantPositionProperty(
            position,
          ) as unknown as Cesium.PositionProperty;
        }
      });
      animationId = requestAnimationFrame(updateLoop);
    };

    animationId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationId);
  }, [livePositions]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full bg-black"
      style={{ zIndex: 0 }}
    />
  );
}
