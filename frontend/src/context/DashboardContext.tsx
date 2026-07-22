import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  districtId: string | null;
  replayDate: string | null;
  selectedCaseId: string | null;
}

interface DashboardContextProps {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  activeView: 'map' | 'network' | 'data' | 'reports' | 'settings';
  setActiveView: React.Dispatch<React.SetStateAction<'map' | 'network' | 'data' | 'reports' | 'settings'>>;
}

const defaultFilters: DashboardFilters = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
  endDate: new Date().toISOString().split('T')[0], // today
  districtId: null,
  replayDate: null,
  selectedCaseId: null,
};

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [activeView, setActiveView] = useState<'map' | 'network' | 'data' | 'reports' | 'settings'>('map');

  return (
    <DashboardContext.Provider value={{ filters, setFilters, activeView, setActiveView }}>
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
