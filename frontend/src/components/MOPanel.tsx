import { X, FileText } from 'lucide-react';
import type { NetworkNode, NetworkLink } from '../data/schemas';

interface MOPanelProps {
  suspect: NetworkNode;
  allNodes: NetworkNode[];
  allLinks: NetworkLink[];
  onClose: () => void;
}

/**
 * Modus Operandi side panel — opens on accused-node click.
 * Traverses the graph links to find all cases connected to the clicked suspect,
 * then displays them as "Linked Incidents". MO is derived from the case labels
 * since the API doesn't provide a dedicated MO field.
 *
 * Note: district field is intentionally omitted from incident rows — case nodes
 * carry only id/label/group, no district. See build brief Section 3 re: join-key gap.
 */
export default function MOPanel({ suspect, allNodes, allLinks, onClose }: MOPanelProps) {
  // Find all links involving this suspect
  const suspectLinks = allLinks.filter(
    (l) => {
      const src = typeof l.source === 'object' ? (l.source as unknown as NetworkNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as unknown as NetworkNode).id : l.target;
      return src === suspect.id || tgt === suspect.id;
    }
  );

  // Collect connected node IDs
  const connectedNodeIds = new Set<string>();
  for (const link of suspectLinks) {
    const src = typeof link.source === 'object' ? (link.source as unknown as NetworkNode).id : link.source;
    const tgt = typeof link.target === 'object' ? (link.target as unknown as NetworkNode).id : link.target;
    if (src !== suspect.id) connectedNodeIds.add(src);
    if (tgt !== suspect.id) connectedNodeIds.add(tgt);
  }

  // Get linked case nodes
  const linkedCases = allNodes.filter(
    (n) => n.group === 'case' && connectedNodeIds.has(n.id)
  );

  // Get linked victim nodes
  const linkedVictims = allNodes.filter(
    (n) => n.group === 'victim' && connectedNodeIds.has(n.id)
  );

  // Derive a primary MO from the connected cases (backend now provides 'mo')
  const moLabels = linkedCases
    .map((c) => c.mo)
    .filter(Boolean);
  const primaryMO = moLabels.length > 0
    ? [...new Set(moLabels)].join(' | ')
    : 'Unknown';

  return (
    <div
      className="absolute top-0 right-0 h-full w-[26rem] bg-[#1E293B] shadow-2xl border-l border-white/5 z-10 flex flex-col animate-slide-in"
      style={{
        animation: 'slideInRight 0.3s ease-out forwards',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{suspect.label}</h2>
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              {suspect.age && suspect.gender ? `${suspect.age} yr old ${suspect.gender}` : 'Suspect Profile'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-slate-800/50 transition-colors cursor-pointer"
          title="Close panel"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Modus Operandi */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Modus Operandi (MO)
          </h3>
          <p className="text-base text-khaki font-medium">{primaryMO}</p>
        </div>

        {/* Linked Cases */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Linked Incidents
            <span className="ml-2 px-2 py-0.5 rounded-full bg-khaki/15 text-khaki text-xs font-medium">
              {linkedCases.length}
            </span>
          </h3>
          {linkedCases.length === 0 ? (
            <p className="text-sm text-gray-400">No linked cases found</p>
          ) : (
            <div className="space-y-3">
              {linkedCases.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-start gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-slate-700 transition-colors">
                      <FileText size={16} strokeWidth={1.5} className="text-khaki" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm text-gray-100 font-medium truncate pr-3">{c.label}</span>
                        <span className="text-[10.5px] text-gray-400 whitespace-nowrap font-medium">{c.date || "Unknown Date"}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-gray-400 font-medium tracking-wide truncate">{c.jurisdiction || "Unknown Jurisdiction"}</span>
                        {c.mo && (
                          <span className="text-[10px] bg-slate-800/80 text-gray-300 px-2 py-0.5 rounded truncate ml-2 max-w-[120px]">{c.mo}</span>
                        )}
                      </div>
                      {c.briefFacts && (
                        <p className="text-[11.5px] text-gray-400 line-clamp-2 leading-relaxed">
                          {c.briefFacts}
                        </p>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Victims */}
        {linkedVictims.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Associated Victims
              <span className="ml-2 px-2 py-0.5 rounded-full bg-police-blue/15 text-police-blue text-xs font-medium">
                {linkedVictims.length}
              </span>
            </h3>
            <div className="space-y-1">
              {linkedVictims.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-800/30 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-police-blue shrink-0" />
                  <span className="text-sm text-gray-100">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

