import { useState, useRef, useEffect } from 'react';
import { ShieldAlert, ChevronDown } from 'lucide-react';

export const CRIME_MAJOR_HEADS = [
  { id: '52309000000166486', headId: 1, name: 'Crimes Against Body' },
  { id: '52309000000165131', headId: 2, name: 'Property Crimes' },
  { id: '52309000000153893', headId: 3, name: 'Economic Offences' },
  { id: '52309000000159278', headId: 4, name: 'Cyber Crimes' },
];

interface CrimeTypeDropdownProps {
  value: string;
  onChange: (id: string) => void;
}

export const CrimeTypeDropdown = ({ value, onChange }: CrimeTypeDropdownProps) => {
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

  const selectedHead = CRIME_MAJOR_HEADS.find(ch => ch.id === value);
  const selectedName = selectedHead ? selectedHead.name : 'Select Crime Type';

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center bg-[#1E293B] px-5 py-2 rounded-full hover:bg-slate-700 transition-colors text-sm cursor-pointer w-56 justify-between shadow-md shadow-black/30 border border-white/5"
      >
        <div className="flex items-center overflow-hidden">
          <ShieldAlert size={16} className="text-khaki mr-3 shrink-0" />
          <span className="text-gray-200 truncate pr-2">{selectedName}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-[#1E293B] rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden border border-white/10">
          <div className="max-h-64 overflow-y-auto custom-scrollbar py-2">
            {CRIME_MAJOR_HEADS.map(ch => (
              <div
                key={ch.id}
                onClick={() => handleSelect(ch.id)}
                className={`px-5 py-2.5 text-sm cursor-pointer hover:bg-[#0F172A] transition-colors ${value === ch.id ? 'text-khaki bg-[#0F172A] font-medium' : 'text-gray-300'}`}
              >
                {ch.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
