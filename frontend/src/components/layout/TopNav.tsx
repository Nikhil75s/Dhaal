import { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { DistrictDropdown } from '../common/DistrictDropdown';
import { DateRangeDropdown } from '../common/DateRangeDropdown';
import { TimeOfDayDropdown } from '../common/TimeOfDayDropdown';
import { PoliceStationDropdown } from '../common/PoliceStationDropdown';
import { MoreFilters } from '../common/MoreFilters';

export const TopNav = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    <header className="h-16 bg-[#0F172A] flex items-center px-6 justify-between z-[10000] relative shadow-md shadow-black/20">
      
      {/* Spacer for left side if logo is in sidebar, or we just push everything right */}
      <div className="flex-1" />

      <div className="flex items-center">
        {/* Primary Geo/Time Filters */}
        <div className="flex items-center space-x-3">
          <DistrictDropdown />
          <PoliceStationDropdown />
          <DateRangeDropdown />
          <TimeOfDayDropdown />
        </div>

        {/* Vertical Divider for Spacing */}
        <div className="w-px h-8 bg-slate-700 mx-5" />

        {/* Secondary Filters & Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          <MoreFilters />
          
          <button 
            onClick={toggleFullscreen}
            className="bg-[#1E293B] text-gray-300 p-2.5 rounded-full hover:bg-slate-700 transition-colors shadow-md shadow-black/30 border border-white/5"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
      
    </header>
  );
};
