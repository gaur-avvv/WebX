'use client';

import { useSatelliteWebSocket } from '@/hooks/useSatelliteWebSocket';
import dynamic from 'next/dynamic';
import { HUD } from '@/components/HUD';

const GlobeView = dynamic(
  () => import('@/components/GlobeView').then((mod) => mod.GlobeView),
  { ssr: false }
);

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
