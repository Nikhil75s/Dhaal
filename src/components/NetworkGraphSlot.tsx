import { useDashboardStore } from '../store/dashboardStore';
import { Network } from 'lucide-react';

/**
 * Placeholder for Frontend Dev 2's <NetworkGraph /> component.
 * Reads `selectedDistrict` from the Zustand store — the only data contract.
 * FE2 replaces this file with their real implementation via a single import swap.
 */
export default function NetworkGraphSlot() {
  const selectedDistrict = useDashboardStore((s) => s.selectedDistrict);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-surface">
        <Network size={36} strokeWidth={1} className="text-text-secondary opacity-40" />
      </div>

      <div className="text-center">
        <h2 className="text-base font-medium text-text-primary mb-2">
          Suspect Network Graph
        </h2>
        <p className="text-sm text-text-secondary max-w-md">
          This component will be implemented by Frontend Dev 2.
          It reads <code className="text-accent-blue text-xs">selectedDistrict</code> from the Zustand store.
        </p>
      </div>

      {selectedDistrict && (
        <div className="px-4 py-2 rounded-lg bg-accent-gold/10">
          <span className="text-xs text-accent-gold font-medium">
            Active District: {selectedDistrict}
          </span>
        </div>
      )}

      {!selectedDistrict && (
        <p className="text-xs text-text-secondary opacity-60">
          Select a district on the map to filter network data
        </p>
      )}
    </div>
  );
}
