import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO 
} from 'date-fns';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label: string;
}

export const CustomDatePicker = ({ value, onChange, label }: CustomDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    try {
      return value ? parseISO(value) : new Date();
    } catch {
      return new Date();
    }
  });
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsYearPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isYearPickerOpen && yearListRef.current) {
      // Small timeout ensures the DOM has fully rendered the list before scrolling
      setTimeout(() => {
        const activeYearEl = yearListRef.current?.querySelector('.active-year') as HTMLElement;
        if (activeYearEl) {
          activeYearEl.scrollIntoView({ block: 'center' });
        }
      }, 10);
    }
  }, [isYearPickerOpen]);

  const handleDateClick = (day: Date) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Generate calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  let selectedDate: Date | null = null;
  try {
    if (value) selectedDate = parseISO(value);
  } catch {}

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-gray-200 cursor-pointer focus-within:ring-1 focus-within:ring-khaki transition-colors flex items-center justify-between"
      >
        <span>{selectedDate ? format(selectedDate, 'MM/dd/yyyy') : 'Select Date'}</span>
        <CalendarIcon size={14} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-[#1E293B] rounded-lg shadow-xl shadow-black/40 z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-200">
                {format(currentMonth, 'MMMM')}
              </span>
              <div className="relative">
                <button 
                  onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
                  className="bg-[#0F172A] text-gray-200 text-sm font-semibold rounded px-2 py-1 outline-none hover:bg-slate-700 focus:ring-1 focus:ring-khaki cursor-pointer flex items-center gap-1"
                >
                  {currentMonth.getFullYear()}
                  <ChevronDown size={12} className={`transition-transform ${isYearPickerOpen ? 'rotate-180' : ''}`} />
                </button>
                {isYearPickerOpen && (
                  <div ref={yearListRef} className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#0F172A] rounded-lg shadow-xl border border-[#1E293B] z-[60] max-h-48 w-20 overflow-y-auto custom-scrollbar">
                    {Array.from({ length: 40 }, (_, i) => new Date().getFullYear() - 20 + i).map(year => (
                      <div 
                        key={year}
                        onClick={() => {
                          const newDate = new Date(currentMonth);
                          newDate.setFullYear(year);
                          setCurrentMonth(newDate);
                          setIsYearPickerOpen(false);
                        }}
                        className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-[#1E293B] text-center ${year === currentMonth.getFullYear() ? 'active-year text-khaki bg-[#1E293B] font-bold' : 'text-gray-300'}`}
                      >
                        {year}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-300">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-xs text-gray-400 font-medium pb-2">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const isCurrentMonth = isSameMonth(d, currentMonth);
              return (
                <button
                  key={i}
                  onClick={() => handleDateClick(d)}
                  className={`
                    w-8 h-8 rounded-md text-xs flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-khaki text-[#0B1120] font-bold' : 'hover:bg-white/10 text-gray-300'}
                    ${!isCurrentMonth && !isSelected ? 'text-gray-600' : ''}
                  `}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-3 border-t border-[#0F172A] flex justify-end">
            <button 
              onClick={() => {
                handleDateClick(new Date());
                setCurrentMonth(new Date());
              }} 
              className="text-xs font-medium text-khaki hover:text-[#E5BE4A] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
