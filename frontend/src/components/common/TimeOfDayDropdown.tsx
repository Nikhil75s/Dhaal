import { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

const SHIFTS = {
  all: 'All Shifts',
  morning: 'Morning (06:00 - 14:00)',
  afternoon: 'Afternoon (14:00 - 22:00)',
  night: 'Night (22:00 - 06:00)'
};

export const TimeOfDayDropdown = () => {
  const { filters, setFilters } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#1E293B] px-5 py-2 rounded-full hover:bg-slate-700 transition-colors text-sm cursor-pointer shadow-md shadow-black/30 min-w-[200px] border border-white/5"
      >
        <div className="flex items-center overflow-hidden flex-1">
          <Clock size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 whitespace-nowrap pr-2 truncate">
            {SHIFTS[filters.timeOfDay]}
          </span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-56 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden border border-white/10">
          <div className="flex flex-col max-h-64 overflow-y-auto custom-scrollbar">
            {Object.entries(SHIFTS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setFilters(prev => ({ ...prev, timeOfDay: value as any }));
                  setIsOpen(false);
                }}
                className={`text-left px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors w-full ${
                  filters.timeOfDay === value 
                    ? 'text-khaki bg-[#0F172A] font-medium' 
                    : 'text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
