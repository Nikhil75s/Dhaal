import { useState, useCallback } from 'react';
import { X, AlertTriangle, FileText, Loader, Sparkles, Download, ExternalLink } from 'lucide-react';
import type { NetworkNode, NetworkLink } from '../data/schemas';
import { generatePdfBrief } from '../data/api';

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
  // ── Generate brief state ──
  const [briefState, setBriefState] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [briefUrl, setBriefUrl] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

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

  // Derive a primary MO from the relationship labels
  const moLabels = suspectLinks
    .map((l) => l.label)
    .filter(Boolean);
  const primaryMO = moLabels.length > 0
    ? [...new Set(moLabels)].join(', ')
    : 'Unknown';

  const handleGenerateBrief = useCallback(async () => {
    setBriefState('generating');
    setBriefError(null);
    try {
      const url = await generatePdfBrief({
        districtName: 'Karnataka',
        message: `Intelligence brief for suspect: ${suspect.label}. Linked to ${linkedCases.length} case(s). Primary MO: ${primaryMO}`,
        severity: 'HIGH',
      });
      setBriefUrl(url);
      setBriefState('success');
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Failed to generate brief');
      setBriefState('error');
    }
  }, [suspect.label, linkedCases.length, primaryMO]);

  return (
    <div
      className="absolute top-0 right-0 h-full w-96 glass shadow-2xl border-l border-slate-800 z-30 flex flex-col animate-slide-in"
      style={{
        animation: 'slideInRight 0.3s ease-out forwards',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-critical/20 flex items-center justify-center">
            <AlertTriangle size={20} strokeWidth={1.5} className="text-critical" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{suspect.label}</h2>
            <span className="text-xs text-text-secondary uppercase tracking-wider">Suspect Profile</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-800/50 transition-colors cursor-pointer"
          title="Close panel"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Modus Operandi */}
        <div>
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            Modus Operandi (MO)
          </h3>
          <p className="text-base text-accent-gold font-medium">{primaryMO}</p>
        </div>

        {/* Linked Cases */}
        <div>
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
            Linked Incidents
            <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold text-xs font-medium">
              {linkedCases.length}
            </span>
          </h3>
          {linkedCases.length === 0 ? (
            <p className="text-sm text-text-secondary">No linked cases found</p>
          ) : (
            <div className="space-y-1">
              {linkedCases.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-800/30 transition-colors"
                >
                  <FileText size={14} strokeWidth={1.5} className="text-accent-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-text-primary font-medium">{c.label}</span>
                    <span className="block text-xs text-text-secondary mt-0.5">
                      ID: {c.id}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Victims */}
        {linkedVictims.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
              Associated Victims
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue text-xs font-medium">
                {linkedVictims.length}
              </span>
            </h3>
            <div className="space-y-1">
              {linkedVictims.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-800/30 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
                  <span className="text-sm text-text-primary">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate Intelligence Brief */}
        <div className="pt-4 border-t border-slate-800/50">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
            Intelligence Brief
          </h3>
          <button
            onClick={handleGenerateBrief}
            disabled={briefState === 'generating'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {briefState === 'generating' ? (
              <><Loader size={14} className="animate-spin" /> Generating PDF...</>
            ) : (
              <><Sparkles size={14} /> Generate Intelligence Brief</>
            )}
          </button>

          {briefState === 'success' && briefUrl && (
            <a
              href={briefUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-clear/10 text-clear hover:bg-clear/15 transition-colors"
            >
              <Download size={12} /> Download Brief <ExternalLink size={10} />
            </a>
          )}
          {briefState === 'error' && briefError && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-critical/10 text-xs text-critical">
              <AlertTriangle size={12} /> {briefError}
            </div>
          )}
        </div>

        {/* Node metadata */}
        <div className="pt-4 border-t border-slate-800/50">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
            Node Details
          </h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">Node ID</span>
              <span className="text-text-primary font-mono">{suspect.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Group</span>
              <span className="text-critical font-medium">{suspect.group}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Connections</span>
              <span className="text-text-primary">{suspectLinks.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
