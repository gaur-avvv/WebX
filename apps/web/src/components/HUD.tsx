'use client';

import React, { useState } from 'react';
import { useSatelliteStore } from '@/store/satellite.store';
import { fetchVisualSatellites } from '@/lib/api-client';
import { Search, Satellite, Activity, Globe, X } from 'lucide-react';

/**
 * HUD is the transparent overlay for the Cosmic Radar.
 * It provides real-time telemetry and control over tracked objects.
 */
export function HUD() {
  const {
    selectedNoradId,
    selectSatellite,
    trackedSatellites,
    trackSatellite,
    untrackSatellite,
    livePositions,
  } = useSatelliteStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      // In a real app, we'd search by name. For now, we use the visual list as a fallback
      // or call a specific search API.
      const sats = await fetchVisualSatellites();
      const found = sats.find((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (found) {
        trackSatellite(found.noradId, found.name);
        selectSatellite(found.noradId);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
      setSearchQuery('');
    }
  };

  const selectedSat = trackedSatellites.find((s) => s.noradId === selectedNoradId);
  const currentPos = selectedNoradId ? livePositions.get(selectedNoradId) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 font-mono text-white">
      {/* Top Bar: Search and Global State */}
      <div className="pointer-events-auto flex items-start justify-between">
        <div className="flex items-center gap-4 rounded-xl border border-white/20 bg-black/40 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-blue-400">
            <Globe size={20} />
            <span className="font-bold uppercase tracking-tighter">Project Zenith</span>
          </div>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search satellite..."
              className="w-64 rounded-lg border border-white/20 bg-white/10 px-3 py-1 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            {isSearching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin">⏳</span>
            )}
          </form>
        </div>

        <div className="rounded-xl border border-white/20 bg-black/40 p-3 text-right backdrop-blur-md">
          <div className="text-xs uppercase text-white/50">System Status</div>
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Activity size={14} className="animate-pulse" />
            <span>Cores Active // Stream Healthy</span>
          </div>
        </div>
      </div>

      {/* Middle Left: Tracked List */}
      <div className="pointer-events-auto flex w-72 flex-col gap-4">
        <div className="rounded-xl border border-white/20 bg-black/40 p-4 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
            <Satellite size={16} className="text-blue-400" />
            <span className="text-sm font-bold uppercase">Tracked Objects</span>
          </div>
          <div className="custom-scrollbar flex max-h-64 flex-col gap-2 overflow-y-auto pr-2">
            {trackedSatellites.map((sat) => (
              <div
                key={sat.noradId}
                onClick={() => selectSatellite(sat.noradId)}
                className={`group flex cursor-pointer items-center justify-between rounded-lg p-2 transition-all ${
                  selectedNoradId === sat.noradId
                    ? 'border border-blue-500/50 bg-blue-500/30'
                    : 'border border-transparent bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-medium">{sat.name}</span>
                  <span className="text-[10px] text-white/40">NORAD: {sat.noradId}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    untrackSatellite(sat.noradId);
                  }}
                  className="p-1 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {trackedSatellites.length === 0 && (
              <div className="py-4 text-center text-xs italic text-white/30">
                No objects currently tracked.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Right: Telemetry Panel */}
      <div className="pointer-events-auto flex justify-end">
        <div className="w-80 rounded-2xl border border-white/20 bg-black/60 p-6 shadow-2xl backdrop-blur-lg">
          {selectedSat && currentPos ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="truncate text-lg font-bold text-blue-400">{selectedSat.name}</h3>
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] uppercase text-blue-300">
                  Live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-white/40">Altitude</span>
                  <span className="text-sm font-medium">{currentPos.altitudeKm.toFixed(2)} km</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-white/40">Velocity</span>
                  <span className="text-sm font-medium">
                    {currentPos.velocityKmPerSec.toFixed(3)} km/s
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-white/40">Latitude</span>
                  <span className="text-sm font-medium">
                    {currentPos.coordinate.latitude.toFixed(4)}°
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-white/40">Longitude</span>
                  <span className="text-sm font-medium">
                    {currentPos.coordinate.longitude.toFixed(4)}°
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-[10px] text-white/30">Update Frequency: 1Hz</span>
                <span className="text-[10px] text-white/30">SGP4 Propagation</span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm italic text-white/30">
              Select a satellite to view live telemetry
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
