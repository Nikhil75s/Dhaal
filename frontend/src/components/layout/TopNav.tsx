import { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { DistrictDropdown } from '../common/DistrictDropdown';
import { DateRangeDropdown } from '../common/DateRangeDropdown';
import { TimeOfDayDropdown } from '../common/TimeOfDayDropdown';
import { PoliceStationDropdown } from '../common/PoliceStationDropdown';
import { MoreFilters } from '../common/MoreFilters';

import { useDashboard } from '../../context/DashboardContext';

export const TopNav = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { showAnomalies, setShowAnomalies, activeView } = useDashboard();

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.getElementById('app-content-area')?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="h-16 bg-[#0F172A] flex items-center px-6 justify-between z-[10000] relative">
      
      {/* Spacer for left side if logo is in sidebar, or we just push everything right */}
      <div className="flex-1" />

      <div className="flex items-center">
        {/* Primary Geo/Time Filters */}
        {activeView !== 'reports' && (
          <div className="flex items-center space-x-3">
            <DistrictDropdown />
            <PoliceStationDropdown />
            <DateRangeDropdown />
            <TimeOfDayDropdown />
          </div>
        )}

        {/* Vertical Divider for Spacing */}
        {activeView !== 'reports' && <div className="w-px h-8 bg-slate-700 mx-5" />}

        {activeView !== 'reports' && (
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setShowAnomalies(!showAnomalies)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border shadow-md ${
                showAnomalies 
                  ? 'bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/40' 
                  : 'bg-[#1E293B] text-gray-400 border-white/5 hover:bg-slate-700'
              }`}
              title="Toggle Emerging Trend Alerts"
            >
              <div className={`w-2 h-2 rounded-full ${showAnomalies ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              Alerts
            </button>

            <MoreFilters />
          </div>
        )}
          
          <button 
            onClick={toggleFullscreen}
            className="bg-[#1E293B] text-gray-300 p-2.5 rounded-full hover:bg-slate-700 transition-colors shadow-md shadow-black/30 border border-white/5 ml-3"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
    </header>
  );
};
