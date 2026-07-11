import { useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { addDays, format, differenceInDays } from 'date-fns';
import { useDashboardStore } from '../store/dashboardStore';
import { useState } from 'react';

const SPEED_OPTIONS = [
  { label: '0.25x', ms: 1000 },
  { label: '0.5x', ms: 500 },
  { label: '1x', ms: 250 },
  { label: '2x', ms: 125 },
];

export default function TimeLapseScrubber() {
  const filters = useDashboardStore((s) => s.filters);
  const currentDate = useDashboardStore((s) => s.currentDate);
  const setCurrentDate = useDashboardStore((s) => s.setCurrentDate);
  const isPlaying = useDashboardStore((s) => s.isTimeLapsePlaying);
  const setIsPlaying = useDashboardStore((s) => s.setIsTimeLapsePlaying);

  const [speedIndex, setSpeedIndex] = useState(1); // default 500ms
  const [showSpeed, setShowSpeed] = useState(false);

  const startDate = filters.dateRange.start;
  const endDate = filters.dateRange.end;
  const totalDays = differenceInDays(endDate, startDate);
  const currentDay = differenceInDays(currentDate, startDate);
  const progress = totalDays > 0 ? (currentDay / totalDays) * 100 : 0;

  // Time-lapse interval
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentDate(
        (() => {
          const store = useDashboardStore.getState();
          const next = addDays(store.currentDate, 1);
          if (next > endDate) {
            setIsPlaying(false);
            return store.currentDate;
          }
          return next;
        })()
      );
    }, SPEED_OPTIONS[speedIndex].ms);

    return () => clearInterval(interval);
  }, [isPlaying, speedIndex, endDate, setCurrentDate, setIsPlaying]);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    if (currentDate >= endDate) {
      // Reset to start if at end
      setCurrentDate(startDate);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentDate, endDate, startDate, setCurrentDate, setIsPlaying]);

  // Skip back to start
  const handleSkipBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentDate(startDate);
  }, [startDate, setCurrentDate, setIsPlaying]);

  // Skip forward to end
  const handleSkipForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentDate(endDate);
  }, [endDate, setCurrentDate, setIsPlaying]);

  // Manual scrub
  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const day = parseInt(e.target.value, 10);
      setCurrentDate(addDays(startDate, day));
    },
    [startDate, setCurrentDate]
  );

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl glass min-w-[420px]">
      {/* Skip back */}
      <button
        onClick={handleSkipBack}
        className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        title="Reset to start"
      >
        <SkipBack size={16} strokeWidth={1.5} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={handlePlayPause}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors cursor-pointer"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause size={16} strokeWidth={2} />
        ) : (
          <Play size={16} strokeWidth={2} className="ml-0.5" />
        )}
      </button>

      {/* Skip forward */}
      <button
        onClick={handleSkipForward}
        className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        title="Jump to end"
      >
        <SkipForward size={16} strokeWidth={1.5} />
      </button>

      {/* Date display */}
      <span className="text-xs text-accent-gold font-medium tabular-nums min-w-[85px] text-center">
        {format(currentDate, 'dd MMM yyyy')}
      </span>

      {/* Scrubber slider */}
      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={totalDays}
          value={currentDay}
          onChange={handleScrub}
          className="w-full h-1 appearance-none bg-text-secondary/20 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-gold [&::-webkit-slider-thumb]:cursor-pointer"
        />
        {/* Progress fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-accent-gold/40 rounded-full pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Speed control */}
      <div className="relative">
        <button
          onClick={() => setShowSpeed(!showSpeed)}
          className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1"
          title="Playback speed"
        >
          <Gauge size={14} strokeWidth={1.5} />
          <span className="text-xs">{SPEED_OPTIONS[speedIndex].label}</span>
        </button>

        {showSpeed && (
          <div className="absolute bottom-full right-0 mb-2 p-2 rounded-lg glass flex flex-col gap-1">
            {SPEED_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => { setSpeedIndex(i); setShowSpeed(false); }}
                className={`text-xs px-3 py-1 rounded cursor-pointer transition-colors ${
                  i === speedIndex
                    ? 'text-accent-gold bg-accent-gold/10'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
