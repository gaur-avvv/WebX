'use client';

import { useSatelliteWebSocket } from '@/hooks/useSatelliteWebSocket';
import { GlobeView } from '@/components/GlobeView';
import { HUD } from '@/components/HUD';

export default function Page() {
  // Initialize the WebSocket connection and data stream
  useSatelliteWebSocket();

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* The 3D World */}
      <GlobeView />

      {/* The Control Overlay */}
      <HUD />
    </main>
  );
}
