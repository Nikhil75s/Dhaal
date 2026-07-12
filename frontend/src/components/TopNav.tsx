import { Columns, Filter, X } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore';
import { format } from 'date-fns';
import { useState } from 'react';

const CRIME_CATEGORIES = [
  'All Categories',
  'Theft', 'Burglary', 'Assault', 'Robbery', 'Cybercrime',
  'Drug Offense', 'Fraud', 'Murder', 'Kidnapping', 'Extortion',
];

export default function TopNav() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);
  const isSplitScreen = useDashboardStore((s) => s.isSplitScreen);
  const toggleSplitScreen = useDashboardStore((s) => s.toggleSplitScreen);
  const selectedDistrict = useDashboardStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useDashboardStore((s) => s.setSelectedDistrict);
  const activeView = useDashboardStore((s) => s.activeView);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Only show on map view
  if (activeView !== 'map') return null;

  return (
    <div className="fixed top-0 left-16 right-0 z-40 flex items-center gap-4 px-5 py-3 glass">
      {/* Title */}
      <h1 className="text-base font-semibold text-text-primary whitespace-nowrap">
        Strategic Intelligence Hub
      </h1>

      {/* Active district tag */}
      {selectedDistrict && (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-accent-gold/15 text-accent-gold">
          {selectedDistrict}
          <button
            onClick={() => setSelectedDistrict(null)}
            className="hover:text-text-primary transition-colors cursor-pointer"
          >
            <X size={12} strokeWidth={2} />
          </button>
        </span>
      )}

      <div className="flex-1" />

      {/* Filter toggle */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        title="Toggle filters"
        className={`
          p-2 rounded-lg transition-colors cursor-pointer
          ${filtersOpen ? 'text-accent-gold' : 'text-text-secondary hover:text-text-primary'}
        `}
      >
        <Filter size={18} strokeWidth={1.5} />
      </button>

      {/* Split-screen toggle */}
      <button
        onClick={toggleSplitScreen}
        title={isSplitScreen ? 'Exit split screen' : 'Split-screen correlation'}
        className={`
          p-2 rounded-lg transition-colors cursor-pointer
          ${isSplitScreen ? 'text-accent-gold' : 'text-text-secondary hover:text-text-primary'}
        `}
      >
        <Columns size={18} strokeWidth={1.5} />
      </button>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="absolute top-full right-5 mt-2 p-4 rounded-xl glass flex items-center gap-4">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary">From</label>
            <input
              type="date"
              value={format(filters.dateRange.start, 'yyyy-MM-dd')}
              onChange={(e) =>
                setFilters({
                  dateRange: { ...filters.dateRange, start: new Date(e.target.value) },
                })
              }
              className="bg-background text-text-primary text-xs px-2 py-1.5 rounded-lg border border-text-secondary/20 focus:border-accent-blue focus:outline-none"
            />
            <label className="text-xs text-text-secondary">To</label>
            <input
              type="date"
              value={format(filters.dateRange.end, 'yyyy-MM-dd')}
              onChange={(e) =>
                setFilters({
                  dateRange: { ...filters.dateRange, end: new Date(e.target.value) },
                })
              }
              className="bg-background text-text-primary text-xs px-2 py-1.5 rounded-lg border border-text-secondary/20 focus:border-accent-blue focus:outline-none"
            />
          </div>

          {/* Crime category */}
          <select
            value={filters.crimeCategory || 'All Categories'}
            onChange={(e) =>
              setFilters({
                crimeCategory: e.target.value === 'All Categories' ? undefined : e.target.value,
              })
            }
            className="bg-background text-text-primary text-xs px-2 py-1.5 rounded-lg border border-text-secondary/20 focus:border-accent-blue focus:outline-none cursor-pointer"
          >
            {CRIME_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
