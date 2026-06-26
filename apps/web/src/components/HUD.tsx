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
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 text-white font-mono">
      {/* Top Bar: Search and Global State */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-4 rounded-xl flex items-center gap-4">
          <div className="flex items-center gap-2 text-blue-400">
            <Globe size={20} />
            <span className="font-bold tracking-tighter uppercase">Project Zenith</span>
          </div>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search satellite..."
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 pl-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            {isSearching && <span className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin">⏳</span>}
          </form>
        </div>

        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-xl text-right">
          <div className="text-xs text-white/50 uppercase">System Status</div>
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Activity size={14} className="animate-pulse" />
            <span>Cores Active // Stream Healthy</span>
          </div>
        </div>
      </div>

      {/* Middle Left: Tracked List */}
      <div className="flex flex-col gap-4 pointer-events-auto w-72">
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
            <Satellite size={16} className="text-blue-400" />
            <span className="text-sm font-bold uppercase">Tracked Objects</span>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {trackedSatellites.map((sat) => (
              <div
                key={sat.noradId}
                onClick={() => selectSatellite(sat.noradId)}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  selectedNoradId === sat.noradId
                    ? 'bg-blue-500/30 border border-blue-500/50'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium truncate">{sat.name}</span>
                  <span className="text-[10px] text-white/40">NORAD: {sat.noradId}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    untrackSatellite(sat.noradId);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {trackedSatellites.length === 0 && (
              <div className="text-xs text-white/30 text-center py-4 italic">
                No objects currently tracked.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Right: Telemetry Panel */}
      <div className="flex justify-end pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-lg border border-white/20 p-6 rounded-2xl w-80 shadow-2xl">
          {selectedSat && currentPos ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h3 className="text-lg font-bold text-blue-400 truncate">
                  {selectedSat.name}
                </h3>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full uppercase">
                  Live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase">Altitude</span>
                  <span className="text-sm font-medium">{currentPos.altitudeKm.toFixed(2)} km</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase">Velocity</span>
                  <span className="text-sm font-medium">{currentPos.velocityKmPerSec.toFixed(3)} km/s</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase">Latitude</span>
                  <span className="text-sm font-medium">{currentPos.coordinate.latitude.toFixed(4)}°</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/40 uppercase">Longitude</span>
                  <span className="text-sm font-medium">{currentPos.coordinate.longitude.toFixed(4)}°</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <span className="text-[10px] text-white/30">Update Frequency: 1Hz</span>
                <span className="text-[10px] text-white/30">SGP4 Propagation</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-white/30 italic text-sm">
              Select a satellite to view live telemetry
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
