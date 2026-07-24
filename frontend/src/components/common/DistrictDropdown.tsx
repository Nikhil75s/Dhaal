import { useState, useRef, useEffect } from 'react';
import { KARNATAKA_DISTRICTS } from '../../utils/districts';
import { Search, MapPin, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

interface DistrictDropdownProps {
  value?: string | null;
  onChange?: (id: string | null) => void;
}

export const DistrictDropdown = ({ value, onChange }: DistrictDropdownProps) => {
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

  const effectiveValue = value !== undefined ? value : filters.districtId;
  const selectedName = effectiveValue ? KARNATAKA_DISTRICTS[effectiveValue]?.name : 'All Districts';

  const handleSelect = (id: string | null) => {
    if (onChange) {
      onChange(id);
    } else {
      setFilters(prev => ({ ...prev, districtId: id, policeStationId: null }));
    }
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#1E293B] px-5 py-2 rounded-full hover:bg-slate-700 transition-colors text-sm cursor-pointer w-56 justify-between shadow-md shadow-black/30 border border-white/5"
      >
        <div className="flex items-center overflow-hidden">
          <MapPin size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 truncate pr-2">{selectedName}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden border border-white/10">
          <div className="p-3 flex items-center bg-[#0F172A]">
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
              className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors ${!effectiveValue ? 'text-khaki bg-[#0F172A] font-medium' : 'text-gray-300'}`}
            >
              All Districts
            </div>
            {filteredDistricts.map(([id, district]) => (
              <div
                key={id}
                onClick={() => handleSelect(id)}
                className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors ${effectiveValue === id ? 'text-khaki bg-[#0F172A] font-medium' : 'text-gray-300'}`}
              >
                {district.name}
              </div>
            ))}
            {filteredDistricts.length === 0 && (
              <div className="px-5 py-4 text-sm text-gray-500 text-center bg-transparent">No districts match your search</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
