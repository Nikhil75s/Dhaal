import React from 'react';

interface HexTooltipProps {
  x: number;
  y: number;
  count: number;
  crimeTypes: Record<string, number>;
  zScore?: number;
  confidence?: string;
}

export const HexTooltip: React.FC<HexTooltipProps> = ({ x, y, count, crimeTypes, zScore, confidence }) => {
  return (
    <div 
      className="absolute bg-[#0B1120]/95 backdrop-blur-md p-3 rounded-lg border border-white/10 text-sm z-[1000] shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px]"
      style={{ left: x, top: y }}
    >
      <div className="font-semibold text-khaki mb-2 border-b border-white/10 pb-1 flex justify-between items-center gap-4">
        <span>Crime Cluster</span>
        {confidence && (
          <span className="text-[10px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50">
            {confidence}
          </span>
        )}
      </div>
      <div className="text-gray-300 space-y-1">
        <div className="flex justify-between items-center gap-4">
          <span>Total Incidents:</span>
          <span className="font-bold text-white">{count}</span>
        </div>
        
        {Object.keys(crimeTypes).length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Breakdown</div>
            {Object.entries(crimeTypes).map(([type, c]) => (
              <div key={type} className="flex justify-between items-center gap-4 text-xs">
                <span className="text-gray-400 truncate max-w-[150px]">{type}</span>
                <span className="text-gray-300 font-medium">{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
