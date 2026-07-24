import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { getISTDateString } from '../utils/dateUtils';

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
  activeView: 'map' | 'network' | 'data' | 'reports' | 'settings';
  setActiveView: React.Dispatch<React.SetStateAction<'map' | 'network' | 'data' | 'reports' | 'settings'>>;
  availableStations: { id: string; name: string }[];
  setAvailableStations: React.Dispatch<React.SetStateAction<{ id: string; name: string }[]>>;
  availableCrimeTypes: string[];
  setAvailableCrimeTypes: React.Dispatch<React.SetStateAction<string[]>>;
  isMoreFiltersOpen: boolean;
  setIsMoreFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showAnomalies: boolean;
  setShowAnomalies: React.Dispatch<React.SetStateAction<boolean>>;
  targetLocation: { lat: number, lng: number, zoom?: number } | null;
  setTargetLocation: React.Dispatch<React.SetStateAction<{ lat: number, lng: number, zoom?: number } | null>>;
}

const defaultFilters: DashboardFilters = {
  startDate: getISTDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago
  endDate: getISTDateString(new Date()), // today
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
  const [activeView, setActiveView] = useState<'map' | 'network' | 'data' | 'reports' | 'settings'>('map');
  const [availableStations, setAvailableStations] = useState<{ id: string; name: string }[]>([]);
  const [availableCrimeTypes, setAvailableCrimeTypes] = useState<string[]>([]);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [targetLocation, setTargetLocation] = useState<{ lat: number, lng: number, zoom?: number } | null>(null);

  return (
    <DashboardContext.Provider value={{ 
      filters, setFilters, 
      activeView, setActiveView,
      availableStations, setAvailableStations,
      availableCrimeTypes, setAvailableCrimeTypes,
      isMoreFiltersOpen, setIsMoreFiltersOpen,
      showAnomalies, setShowAnomalies,
      targetLocation, setTargetLocation
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
