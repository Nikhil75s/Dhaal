import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { CustomDatePicker } from './CustomDatePicker';


export const DateRangeDropdown = () => {
  const { filters, setFilters } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close
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
        className="flex items-center bg-[#1E293B] px-5 py-2 rounded-full hover:bg-slate-700 transition-colors text-sm cursor-pointer shadow-md shadow-black/30 border border-white/5"
      >
        <div className="flex items-center overflow-hidden">
          <Calendar size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 whitespace-nowrap pr-2">
            {filters.startDate} <span className="text-gray-500 mx-1">to</span> {filters.endDate}
          </span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 p-4 border border-white/10">
          <div className="flex flex-col space-y-4">
            <CustomDatePicker 
              label="Start Date"
              value={filters.startDate}
              onChange={(val) => setFilters(prev => ({ ...prev, startDate: val }))}
            />
            <CustomDatePicker 
              label="End Date"
              value={filters.endDate}
              onChange={(val) => setFilters(prev => ({ ...prev, endDate: val }))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
