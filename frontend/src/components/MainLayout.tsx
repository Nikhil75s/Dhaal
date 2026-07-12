import { useState, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import CrimeMap from './CrimeMap';
import SocioEconomicMap from './SocioEconomicMap';
import TimeLapseScrubber from './TimeLapseScrubber';
import IntelligenceArchive from './IntelligenceArchive';
import NetworkGraphSlot from './NetworkGraphSlot';
import type { ViewStateChangeEvent } from 'react-map-gl/maplibre';

export default function MainLayout() {
  const activeView = useDashboardStore((s) => s.activeView);
  const isSplitScreen = useDashboardStore((s) => s.isSplitScreen);

  // Synced view state for split-screen
  const [syncViewState, setSyncViewState] = useState({
    longitude: 77.5946,
    latitude: 12.9716,
    zoom: 6,
  });

  const handleViewStateChange = useCallback((e: ViewStateChangeEvent) => {
    setSyncViewState({
      longitude: e.viewState.longitude,
      latitude: e.viewState.latitude,
      zoom: e.viewState.zoom,
    });
  }, []);

  return (
    <main className="absolute top-0 left-16 right-0 bottom-0">
      {/* Map View */}
      {activeView === 'map' && (
        <div className="relative w-full h-full">
          {isSplitScreen ? (
            <div className="flex w-full h-full">
              <CrimeMap
                halfWidth
                showAnomalies={false}
                onViewStateChange={handleViewStateChange}
                syncViewState={syncViewState}
              />
              <SocioEconomicMap
                halfWidth
                onViewStateChange={handleViewStateChange}
                syncViewState={syncViewState}
              />
            </div>
          ) : (
            <CrimeMap showAnomalies />
          )}

          {/* Floating time-lapse scrubber — only on map view */}
          <TimeLapseScrubber />
        </div>
      )}

      {/* Archive View */}
      {activeView === 'archive' && <IntelligenceArchive />}

      {/* Network View (FE2 placeholder) */}
      {activeView === 'network' && <NetworkGraphSlot />}

      {/* Settings placeholder */}
      {activeView === 'settings' && (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-text-secondary text-sm">Settings — coming soon</p>
        </div>
      )}
    </main>
  );
}
