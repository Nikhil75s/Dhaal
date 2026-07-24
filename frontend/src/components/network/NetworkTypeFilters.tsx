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
    <div className="flex items-center gap-2 w-full">
      {(Object.keys(filters) as Array<keyof NetworkFilters>).map((type) => {
        const isActive = filters[type];
        return (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
              ${isActive 
                ? 'bg-[#1E293B] border-white/10 text-gray-100 shadow-md shadow-black/20' 
                : 'bg-[#0B1120]/60 border-transparent text-gray-500 hover:bg-[#1E293B]/60 hover:text-gray-300'}
            `}
          >
            <div
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: nodeColor(type) }}
            />
            {GROUP_LABELS[type] || type}
          </button>
        );
      })}
    </div>
  );
}

