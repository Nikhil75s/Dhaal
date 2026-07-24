import { X, FileText, User } from 'lucide-react';
import type { NetworkNode, NetworkLink } from '../data/schemas';

interface CasePanelProps {
  caseNode: NetworkNode;
  allNodes: NetworkNode[];
  allLinks: NetworkLink[];
  onClose: () => void;
}

export default function CasePanel({ caseNode, allNodes, allLinks, onClose }: CasePanelProps) {
  // Find all links involving this case
  const caseLinks = allLinks.filter(
    (l) => {
      const src = typeof l.source === 'object' ? (l.source as unknown as NetworkNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as unknown as NetworkNode).id : l.target;
      return src === caseNode.id || tgt === caseNode.id;
    }
  );

  const connectedNodeIds = new Set<string>();
  for (const link of caseLinks) {
    const src = typeof link.source === 'object' ? (link.source as unknown as NetworkNode).id : link.source;
    const tgt = typeof link.target === 'object' ? (link.target as unknown as NetworkNode).id : link.target;
    if (src !== caseNode.id) connectedNodeIds.add(src);
    if (tgt !== caseNode.id) connectedNodeIds.add(tgt);
  }

  const linkedSuspects = allNodes.filter(
    (n) => n.group === 'accused' && connectedNodeIds.has(n.id)
  );

  const linkedVictims = allNodes.filter(
    (n) => n.group === 'victim' && connectedNodeIds.has(n.id)
  );

  return (
    <div
      className="absolute top-0 right-0 h-full w-[26rem] bg-[#1E293B] shadow-2xl border-l border-white/5 z-10 flex flex-col animate-slide-in"
      style={{ animation: 'slideInRight 0.3s ease-out forwards' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{caseNode.label}</h2>
            <span className="text-xs text-gray-400 uppercase tracking-wider">
              {caseNode.date ? `Registered on ${caseNode.date}` : 'FIR Profile'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Case Details */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Incident Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-gray-400">Jurisdiction</span>
              <span className="text-gray-200">{caseNode.jurisdiction || 'Unknown Station'}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-400">Classification</span>
              <span className="text-khaki font-medium">{caseNode.mo || 'Unknown MO'}</span>
            </div>
          </div>
          {caseNode.briefFacts && (
            <div className="mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-800">
              <p className="text-[11.5px] text-gray-300 leading-relaxed">
                {caseNode.briefFacts}
              </p>
            </div>
          )}
        </div>

        {/* Linked Suspects */}
        {linkedSuspects.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Accused Individuals
              <span className="ml-2 px-2 py-0.5 rounded-full bg-critical/15 text-critical text-xs font-medium">
                {linkedSuspects.length}
              </span>
            </h3>
            <div className="space-y-3">
              {linkedSuspects.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-start gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-slate-700 transition-colors">
                    <User size={16} strokeWidth={1.5} className="text-critical" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-sm text-gray-100 font-medium truncate pr-3">{s.label}</span>
                      <span className="text-[10.5px] text-gray-400 whitespace-nowrap font-medium">
                        {s.age && s.gender ? `${s.age} y/o ${s.gender}` : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Victims */}
        {linkedVictims.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Associated Victims
              <span className="ml-2 px-2 py-0.5 rounded-full bg-police-blue/15 text-police-blue text-xs font-medium">
                {linkedVictims.length}
              </span>
            </h3>
            <div className="space-y-3">
              {linkedVictims.map((v) => (
                <div
                  key={v.id}
                  className="group flex items-start gap-4 py-3 px-3 -mx-3 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-slate-700 transition-colors">
                    <User size={16} strokeWidth={1.5} className="text-police-blue" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-sm text-gray-100 font-medium truncate pr-3">{v.label}</span>
                      <span className="text-[10.5px] text-gray-400 whitespace-nowrap font-medium">
                        {v.age && v.gender ? `${v.age} y/o ${v.gender}` : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
