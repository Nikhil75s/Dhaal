import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

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

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, startDate: e.target.value }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, endDate: e.target.value }));
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-navy-800/50 px-5 py-2 rounded-full border border-navy-800 hover:border-khaki/30 transition-colors text-sm cursor-pointer shadow-sm"
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
        <div className="absolute top-full mt-2 left-0 w-72 bg-navy-900 border border-navy-800 rounded-xl shadow-2xl z-50 overflow-hidden p-4">
          <div className="flex flex-col space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date</label>
              <input 
                type="date" 
                value={filters.startDate}
                onChange={handleStartDateChange}
                className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-khaki/50 transition-colors"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date</label>
              <input 
                type="date" 
                value={filters.endDate}
                onChange={handleEndDateChange}
                className="w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-khaki/50 transition-colors"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
