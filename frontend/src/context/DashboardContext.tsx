import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  districtId: string | null;
  policeStationId: string | null;
  crimeGroup: string | null;
  dayOfWeek: string | null;
  replayDate: string | null;
  timeOfDay: 'all' | 'morning' | 'afternoon' | 'night';
}

interface DashboardContextType {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  availableStations: { id: string; name: string }[];
  setAvailableStations: React.Dispatch<React.SetStateAction<{ id: string; name: string }[]>>;
  availableCrimeTypes: string[];
  setAvailableCrimeTypes: React.Dispatch<React.SetStateAction<string[]>>;
  isMoreFiltersOpen: boolean;
  setIsMoreFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const defaultFilters: DashboardFilters = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
  endDate: new Date().toISOString().split('T')[0], // today
  districtId: null,
  policeStationId: null,
  crimeGroup: null,
  dayOfWeek: null,
  replayDate: null,
  timeOfDay: 'all',
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [availableStations, setAvailableStations] = useState<{ id: string; name: string }[]>([]);
  const [availableCrimeTypes, setAvailableCrimeTypes] = useState<string[]>([]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  return (
    <DashboardContext.Provider value={{ 
      filters, setFilters, 
      availableStations, setAvailableStations,
      availableCrimeTypes, setAvailableCrimeTypes,
      isMoreFiltersOpen, setIsMoreFiltersOpen 
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
