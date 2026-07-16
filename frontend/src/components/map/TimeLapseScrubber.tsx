import { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Rewind } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

export const TimeLapseScrubber = () => {
  const { filters, setFilters } = useDashboard();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setFilters(prev => {
          const startDateMs = new Date(prev.startDate).getTime();
          const endDateMs = new Date(prev.endDate).getTime();
          
          let currentReplayMs = prev.replayDate ? new Date(prev.replayDate).getTime() : startDateMs;
          
          // Advance by 1 day (86400000 ms)
          const nextReplayMs = currentReplayMs + 86400000;
          
          if (nextReplayMs > endDateMs) {
            setIsPlaying(false);
            return { ...prev, replayDate: null }; // Reset to show all data
          }
          
          return { ...prev, replayDate: new Date(nextReplayMs).toISOString().split('T')[0] };
        });
      }, 500 / speed); // Speed adjusts the interval delay
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, setFilters]);

  // Calculate progress percentage
  const startDateMs = new Date(filters.startDate).getTime();
  const endDateMs = new Date(filters.endDate).getTime();
  const currentMs = filters.replayDate ? new Date(filters.replayDate).getTime() : endDateMs;
  
  const totalDuration = endDateMs - startDateMs;
  const currentProgress = totalDuration > 0 ? ((currentMs - startDateMs) / totalDuration) * 100 : 100;

  const handlePlayPause = () => {
    if (!isPlaying && !filters.replayDate) {
      // Start from the beginning if stopped
      setFilters(prev => ({ ...prev, replayDate: prev.startDate }));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setFilters(prev => {
      if (!prev.replayDate) return prev;
      const current = new Date(prev.replayDate).getTime();
      const prevMs = Math.max(startDateMs, current - 86400000);
      return { ...prev, replayDate: new Date(prevMs).toISOString().split('T')[0] };
    });
  };

  const handleSkipForward = () => {
    setFilters(prev => {
      const current = prev.replayDate ? new Date(prev.replayDate).getTime() : startDateMs;
      const nextMs = Math.min(endDateMs, current + 86400000);
      if (nextMs >= endDateMs) {
        setIsPlaying(false);
        return { ...prev, replayDate: null };
      }
      return { ...prev, replayDate: new Date(nextMs).toISOString().split('T')[0] };
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    const newMs = startDateMs + (totalDuration * (newProgress / 100));
    setFilters(prev => ({ ...prev, replayDate: new Date(newMs).toISOString().split('T')[0] }));
  };

  const cycleSpeed = () => {
    setSpeed(prev => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  return (
    <div 
      className={`absolute bottom-8 left-1/2 transform transition-transform duration-300 bg-[#0B1120]/95 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex items-center space-x-6 shadow-[0_12px_48px_rgba(0,0,0,0.9)] z-20 w-[700px] ${
        filters.selectedCaseId ? '-translate-x-[calc(50%+192px)]' : '-translate-x-1/2'
      }`}
    >
      
      {/* Controls */}
      <div className="flex items-center space-x-4">
        <button onClick={handleSkipBack} className="text-gray-400 hover:text-gray-200 transition-colors">
          <Rewind size={18} />
        </button>
        
        <button 
          onClick={handlePlayPause} 
          className="bg-khaki hover:bg-[#E5BE4A] text-navy-900 rounded-full p-2 transition-transform active:scale-95"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>
        
        <button onClick={handleSkipForward} className="text-gray-400 hover:text-gray-200 transition-colors">
          <FastForward size={18} />
        </button>
      </div>
      
      {/* Timeline Scrubber */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex justify-between text-[10px] text-gray-500 font-medium mb-1 px-1 uppercase tracking-wider">
          <span>{filters.startDate}</span>
          <span className="text-khaki font-bold">{filters.replayDate ? filters.replayDate : "LIVE"}</span>
          <span>{filters.endDate}</span>
        </div>
        
        <div className="relative h-2 bg-navy-800 rounded-full flex items-center">
          <div 
            className="absolute top-0 left-0 h-full bg-khaki rounded-full pointer-events-none"
            style={{ width: `${filters.replayDate ? currentProgress : 100}%` }}
          />
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.1"
            value={filters.replayDate ? currentProgress : 100}
            onChange={handleSliderChange}
            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
      
      {/* Speed Control */}
      <div className="flex items-center border-l border-navy-800 pl-4">
        <button 
          onClick={cycleSpeed}
          className="text-xs font-bold text-khaki hover:text-[#E5BE4A] bg-khaki/10 px-2 py-1 rounded transition-colors"
        >
          {speed}x
        </button>
      </div>
      
    </div>
  );
};
