import { create } from 'zustand';
import { subDays } from 'date-fns';

/**
 * Global dashboard state — the public API contract for the entire frontend team.
 * Frontend Dev 2's <NetworkGraph /> consumes `selectedDistrict` directly from this store.
 * Do NOT let any component read from another component's internals — only from here.
 */
export interface DashboardFilters {
  dateRange: { start: Date; end: Date };
  crimeCategory?: string;
}

export type ActiveView = 'map' | 'archive' | 'network' | 'settings';

export interface DashboardState {
  filters: DashboardFilters;
  selectedDistrict: string | null;
  currentDate: Date;
  isSplitScreen: boolean;
  activeView: ActiveView;
  isTimeLapsePlaying: boolean;

  // Actions
  setFilters: (f: Partial<DashboardFilters>) => void;
  setSelectedDistrict: (d: string | null) => void;
  setCurrentDate: (d: Date) => void;
  toggleSplitScreen: () => void;
  setActiveView: (v: ActiveView) => void;
  setIsTimeLapsePlaying: (p: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  filters: {
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date(),
    },
    crimeCategory: undefined,
  },
  selectedDistrict: null,
  currentDate: subDays(new Date(), 30),
  isSplitScreen: false,
  activeView: 'map',
  isTimeLapsePlaying: false,

  setFilters: (f) =>
    set((state) => ({
      filters: { ...state.filters, ...f },
    })),

  setSelectedDistrict: (d) => set({ selectedDistrict: d }),
  setCurrentDate: (d) => set({ currentDate: d }),
  toggleSplitScreen: () => set((state) => ({ isSplitScreen: !state.isSplitScreen })),
  setActiveView: (v) => set({ activeView: v }),
  setIsTimeLapsePlaying: (p) => set({ isTimeLapsePlaying: p }),
}));
