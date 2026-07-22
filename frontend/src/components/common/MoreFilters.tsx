import { useState, useRef, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MoreFilters = () => {
  const { 
    filters, setFilters, 
    availableCrimeTypes 
  } = useDashboard();
  
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

  const activeFiltersCount = (filters.crimeGroup ? 1 : 0) + (filters.dayOfWeek ? 1 : 0);

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-5 py-2 rounded-full font-semibold text-sm transition-colors flex items-center shadow-md shadow-black/30 whitespace-nowrap shrink-0 border border-white/5 ${activeFiltersCount > 0 ? 'bg-[#C29B27] text-navy-900 border-[#C29B27]' : 'bg-khaki text-navy-900 hover:bg-[#C29B27] border-khaki'}`}
      >
        <Filter size={16} className="mr-2 shrink-0" />
        More Filters
        {activeFiltersCount > 0 && (
          <span className="ml-2 bg-navy-900 text-khaki text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-80 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0F172A]">
            <h3 className="text-sm font-semibold text-gray-200">Additional Filters</h3>
            {activeFiltersCount > 0 && (
              <button 
                onClick={() => setFilters(prev => ({ ...prev, crimeGroup: null, dayOfWeek: null }))}
                className="text-xs text-khaki hover:text-white transition-colors flex items-center"
              >
                <X size={12} className="mr-1" /> Clear All
              </button>
            )}
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Crime Category */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Crime Category</div>
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, crimeGroup: null }))}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${!filters.crimeGroup ? 'bg-[#0F172A] text-khaki font-medium' : 'text-gray-300 hover:bg-slate-700'}`}
                >
                  All Categories
                </button>
                {availableCrimeTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setFilters(prev => ({ ...prev, crimeGroup: type }))}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${filters.crimeGroup === type ? 'bg-[#0F172A] text-khaki font-medium' : 'text-gray-300 hover:bg-slate-700'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Day of the Week */}
            <div className="space-y-2">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Day of the Week</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, dayOfWeek: null }))}
                  className={`text-center px-2 py-2 rounded-lg text-sm transition-colors col-span-2 ${!filters.dayOfWeek ? 'bg-[#0F172A] text-khaki font-medium' : 'text-gray-300 hover:bg-slate-700'}`}
                >
                  All Days
                </button>
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => setFilters(prev => ({ ...prev, dayOfWeek: day }))}
                    className={`text-center px-2 py-2 rounded-lg text-sm transition-colors ${filters.dayOfWeek === day ? 'bg-[#0F172A] text-khaki font-medium' : 'text-gray-300 hover:bg-slate-700'}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
