import { GROUP_LABELS, nodeColor } from '../../utils/networkStyles';

export type NetworkFilters = {
  case: boolean;
  accused: boolean;
  victim: boolean;
};

export default function NetworkTypeFilters({
  filters,
  onChange,
}: {
  filters: NetworkFilters;
  onChange: (filters: NetworkFilters) => void;
}) {
  const toggleFilter = (type: keyof NetworkFilters) => {
    onChange({ ...filters, [type]: !filters[type] });
  };

  return (
    <div className="flex items-center gap-2">
      {(Object.keys(filters) as Array<keyof NetworkFilters>).map((type) => {
        const isActive = filters[type];
        return (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer
              border
              ${isActive 
                ? 'bg-slate-800 border-slate-700 text-text-primary' 
                : 'bg-transparent border-slate-800 text-text-secondary opacity-50 hover:opacity-100'}
            `}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: nodeColor(type) }}
            />
            {GROUP_LABELS[type] || type}
          </button>
        );
      })}
    </div>
  );
}
