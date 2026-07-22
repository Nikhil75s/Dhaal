import { useState, useRef, useEffect } from 'react';
import { Search, Building, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

export const PoliceStationDropdown = () => {
  const { filters, setFilters, availableStations } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const filteredStations = availableStations.filter(station =>
    station.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStation = availableStations.find(s => s.id === filters.policeStationId);
  const selectedName = selectedStation ? selectedStation.name : 'All Stations';

  const handleSelect = (id: string | null) => {
    setFilters(prev => ({ ...prev, policeStationId: id }));
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#1E293B] px-5 py-2 rounded-full hover:bg-slate-700 transition-colors text-sm cursor-pointer w-64 justify-between shadow-md shadow-black/30 border border-white/5"
      >
        <div className="flex items-center overflow-hidden">
          <Building size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 truncate pr-2">{selectedName}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden border border-white/10">
          <div className="p-3 flex items-center bg-[#0F172A]">
            <Search size={14} className="text-gray-400 mx-2 shrink-0" />
            <input
              type="text"
              placeholder="Search station..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500 py-1"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <div 
              onClick={() => handleSelect(null)}
              className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors ${!filters.policeStationId ? 'text-khaki bg-[#0F172A] font-medium' : 'text-gray-300'}`}
            >
              All Stations
            </div>
            {filteredStations.map((station) => (
              <div
                key={station.id}
                onClick={() => handleSelect(station.id)}
                className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors truncate ${filters.policeStationId === station.id ? 'text-khaki bg-[#0F172A] font-medium' : 'text-gray-300'}`}
                title={station.name}
              >
                {station.name}
              </div>
            ))}
            {filteredStations.length === 0 && (
              <div className="px-5 py-4 text-sm text-gray-500 text-center bg-transparent">
                {availableStations.length === 0 ? 'Loading stations...' : 'No stations found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
