import { useState, useRef, useEffect } from 'react';
import { KARNATAKA_DISTRICTS } from '../../utils/districts';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

export const DistrictDropdown = () => {
  const { filters, setFilters } = useDashboard();
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

  const filteredDistricts = Object.entries(KARNATAKA_DISTRICTS).filter(([_, district]) =>
    district.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedName = filters.districtId ? KARNATAKA_DISTRICTS[filters.districtId]?.name : 'All Districts';

  const handleSelect = (id: string | null) => {
    setFilters(prev => ({ ...prev, districtId: id }));
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#151B2B] px-5 py-2 rounded-full border border-white/10 hover:border-khaki/30 transition-colors text-sm cursor-pointer w-56 justify-between shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center overflow-hidden">
          <MapPin size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 truncate pr-2">{selectedName}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-[#0B1120] border border-white/10 rounded-xl shadow-[0_12px_48px_rgba(0,0,0,0.9)] z-50 overflow-hidden">
          <div className="p-3 border-b border-white/10 flex items-center bg-[#151B2B]">
            <Search size={14} className="text-gray-400 mx-2 shrink-0" />
            <input
              type="text"
              placeholder="Search district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-gray-200 w-full placeholder-gray-500 py-1"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <div 
              onClick={() => handleSelect(null)}
              className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-navy-800 transition-colors ${!filters.districtId ? 'text-khaki bg-navy-800/50 font-medium' : 'text-gray-300'}`}
            >
              All Districts
            </div>
            {filteredDistricts.map(([id, district]) => (
              <div
                key={id}
                onClick={() => handleSelect(id)}
                className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-navy-800 transition-colors ${filters.districtId === id ? 'text-khaki bg-navy-800/50 font-medium' : 'text-gray-300'}`}
              >
                {district.name}
              </div>
            ))}
            {filteredDistricts.length === 0 && (
              <div className="px-5 py-4 text-sm text-gray-500 text-center bg-navy-800/10">No districts match your search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
