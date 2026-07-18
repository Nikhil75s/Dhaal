import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, TrendingUp, AlertTriangle, Loader, Route, X, Info } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { fetchNetworkSuspects, fetchNetworkPath } from '../data/api';
import type { NetworkGraphData, NetworkNode } from '../data/schemas';
import MOPanel from './MOPanel';
import PredictiveDash from './PredictiveDash';

/**
 * NetworkGraph — replaces NetworkGraphSlot.tsx.
 * Force-directed suspect/case/victim graph with:
 *   - In-page tab switcher (Graph / Predictive Risk)
 *   - Shift-click two-node shortest-path highlighting
 *   - Click-to-open MO side panel for accused nodes
 *   - District awareness (visual de-emphasis fallback)
 */

// ── Node color mapping (Section 3 of build brief) ──
const NODE_COLORS: Record<string, string> = {
  case: '#D4AF37',     // accent-gold
  accused: '#EF4444',  // critical (red)
  victim: '#3B82F6',   // accent-blue
};
const nodeColor = (group: string) => NODE_COLORS[group] ?? '#3B82F6';

const GROUP_LABELS: Record<string, string> = {
  accused: 'Suspects',
  case: 'Cases',
  victim: 'Victims',
};

type TabId = 'graph' | 'predictive';

// ── Extended node type for react-force-graph-2d (includes x, y from simulation) ──
interface GraphNode extends NetworkNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  // react-force-graph-2d mutates source/target to node objects at runtime
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
}

function getLinkSourceId(link: GraphLink): string {
  return typeof link.source === 'object' ? link.source.id : link.source;
}
function getLinkTargetId(link: GraphLink): string {
  return typeof link.target === 'object' ? link.target.id : link.target;
}

export default function NetworkGraph() {
  const { filters } = useDashboard();
  const selectedDistrict = filters.districtId;

  // ── Data state ──
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [selectedSuspect, setSelectedSuspect] = useState<NetworkNode | null>(null);

  // ── Shortest-path state ──
  const [pathSelection, setPathSelection] = useState<string[]>([]);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);

  // ── Container sizing ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Fetch graph data ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchNetworkSuspects()
      .then((data) => {
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load network data');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Build link ID helper (for highlight set) ──
  const makeLinkId = useCallback(
    (source: string, target: string) => `${source}__${target}`,
    []
  );

  // ── Shortest-path logic ──
  const handlePathSelect = useCallback(
    async (nodeId: string) => {
      if (pathSelection.length === 0) {
        setPathSelection([nodeId]);
        setPathError(null);
        return;
      }

      if (pathSelection.length === 1) {
        if (pathSelection[0] === nodeId) {
          // Deselect
          setPathSelection([]);
          return;
        }

        const source = pathSelection[0];
        const target = nodeId;
        setPathSelection([source, target]);
        setPathLoading(true);
        setPathError(null);

        try {
          const pathData = await fetchNetworkPath(source, target);

          if (pathData.nodes.length === 0) {
            setPathError('No connecting path found between selected nodes');
            setHighlightNodes(new Set());
            setHighlightLinks(new Set());
          } else {
            const nodeIds = new Set(pathData.nodes.map((n) => n.id));
            const linkIds = new Set(
              pathData.links.map((l) => {
                const src = typeof l.source === 'string' ? l.source : '';
                const tgt = typeof l.target === 'string' ? l.target : '';
                return makeLinkId(src, tgt);
              })
            );
            setHighlightNodes(nodeIds);
            setHighlightLinks(linkIds);
          }
        } catch {
          setPathError('Failed to compute shortest path');
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
        } finally {
          setPathLoading(false);
        }
      }
    },
    [pathSelection, makeLinkId]
  );

  const clearPath = useCallback(() => {
    setPathSelection([]);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
    setPathError(null);
  }, []);

  // ── Node click handler ──
  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      // Shift-click = path selection mode
      if (event.shiftKey) {
        handlePathSelect(node.id);
        return;
      }

      // Regular click on accused node = open MO panel
      if (node.group === 'accused') {
        setSelectedSuspect(node);
      }
    },
    [handlePathSelect]
  );

  // ── Custom node rendering ──
  const drawNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const size = node.group === 'accused' ? 6 : node.group === 'case' ? 5 : 4;
      const color = nodeColor(node.group);
      const isInPath = highlightNodes.has(node.id);
      const isPathMode = highlightNodes.size > 0;
      const isSelected = pathSelection.includes(node.id);

      // Dim non-path nodes when path is active
      ctx.globalAlpha = isPathMode ? (isInPath ? 1 : 0.12) : 1;

      // Glow effect for selected path nodes
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}33`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = '#0B1120';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label (show when zoomed in enough)
      if (globalScale > 1.2) {
        ctx.globalAlpha = isPathMode ? (isInPath ? 0.9 : 0.08) : 0.9;
        ctx.font = `${Math.max(10 / globalScale, 2.5)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#F3F4F6';
        ctx.fillText(node.label, x, y + size + 2);
      }

      ctx.globalAlpha = 1;
    },
    [highlightNodes, pathSelection]
  );

  // ── Link styling ──
  const getLinkColor = useCallback(
    (link: GraphLink) => {
      if (highlightLinks.size === 0) return 'rgba(255, 255, 255, 0.12)';
      const linkId = makeLinkId(getLinkSourceId(link), getLinkTargetId(link));
      return highlightLinks.has(linkId) ? '#3B82F6' : 'rgba(255, 255, 255, 0.04)';
    },
    [highlightLinks, makeLinkId]
  );

  const getLinkWidth = useCallback(
    (link: GraphLink) => {
      if (highlightLinks.size === 0) return 1;
      const linkId = makeLinkId(getLinkSourceId(link), getLinkTargetId(link));
      return highlightLinks.has(linkId) ? 3 : 0.5;
    },
    [highlightLinks, makeLinkId]
  );

  // Memoize the graph data object to avoid re-triggering force simulation
  const forceGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return {
      nodes: graphData.nodes.map((n) => ({ ...n })),
      links: graphData.links.map((l) => ({ ...l })),
    };
  }, [graphData]);

  // ── Render ──
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Tab bar */}
      <div className="flex items-center gap-6 px-6 pt-4 pb-0 border-b border-slate-800/50">
        <button
          onClick={() => setActiveTab('graph')}
          className={`
            pb-3 text-sm font-medium transition-colors cursor-pointer
            border-b-2 -mb-px
            ${activeTab === 'graph'
              ? 'text-accent-gold border-accent-gold'
              : 'text-text-secondary border-transparent hover:text-text-primary'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <Network size={16} strokeWidth={1.5} />
            Network Graph
          </span>
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`
            pb-3 text-sm font-medium transition-colors cursor-pointer
            border-b-2 -mb-px
            ${activeTab === 'predictive'
              ? 'text-accent-gold border-accent-gold'
              : 'text-text-secondary border-transparent hover:text-text-primary'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <TrendingUp size={16} strokeWidth={1.5} />
            Predictive Risk
          </span>
        </button>

        <div className="flex-1" />

        {/* District badge */}
        {selectedDistrict && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent-gold/15 text-accent-gold mb-3">
            {selectedDistrict}
          </span>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Graph tab — always mounted to preserve simulation state */}
        <div
          className={`absolute inset-0 ${activeTab === 'graph' ? 'visible' : 'invisible pointer-events-none'}`}
          ref={containerRef}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 text-text-secondary">
                <Loader size={20} strokeWidth={1.5} className="animate-spin" />
                <span className="text-sm">Loading network graph...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-critical/10">
                <AlertTriangle size={20} strokeWidth={1.5} className="text-critical" />
                <div>
                  <p className="text-sm text-critical font-medium">Failed to load network data</p>
                  <p className="text-xs text-text-secondary mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && graphData && (
            <>
              <ForceGraph2D
                graphData={forceGraphData}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="#0B1120"
                nodeLabel=""
                nodeCanvasObject={drawNode}
                nodeCanvasObjectMode={() => 'replace'}
                linkColor={getLinkColor}
                linkWidth={getLinkWidth}
                linkDirectionalParticles={(link: GraphLink) => {
                  if (highlightLinks.size === 0) return 0;
                  const linkId = makeLinkId(getLinkSourceId(link), getLinkTargetId(link));
                  return highlightLinks.has(linkId) ? 3 : 0;
                }}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleColor={() => '#3B82F6'}
                onNodeClick={handleNodeClick}
                cooldownTime={3000}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />

              {/* Legend */}
              <div className="absolute bottom-4 left-4 glass rounded-xl px-4 py-3 flex items-center gap-4 z-10">
                {Object.entries(GROUP_LABELS).map(([group, label]) => (
                  <div key={group} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: nodeColor(group) }}
                    />
                    <span className="text-xs text-text-secondary">{label}</span>
                  </div>
                ))}
              </div>

              {/* Path mode controls */}
              <div className="absolute top-4 left-4 z-10 space-y-2">
                {/* District awareness note */}
                {selectedDistrict && (
                  <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 max-w-xs">
                    <Info size={14} strokeWidth={1.5} className="text-accent-blue shrink-0" />
                    <p className="text-xs text-text-secondary">
                      {/* District filtering is a visual cue only — no district field exists on
                          network nodes. See build brief Section 3 re: join-key gap. Once Backend
                          Dev 1 adds a district field to the /network/suspects response, this can
                          become a hard filter. */}
                      Viewing all districts. "{selectedDistrict}" filter pending backend support.
                    </p>
                  </div>
                )}

                {/* Path selection UI */}
                {pathSelection.length > 0 && (
                  <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                    <Route size={14} strokeWidth={1.5} className="text-accent-blue" />
                    <span className="text-xs text-text-primary">
                      {pathSelection.length === 1
                        ? 'Shift-click a second node to find shortest path'
                        : 'Path highlighted'}
                    </span>
                    <button
                      onClick={clearPath}
                      className="ml-2 p-1 rounded hover:bg-slate-800/50 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      title="Clear path"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}

                {pathLoading && (
                  <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader size={14} strokeWidth={1.5} className="text-accent-blue animate-spin" />
                    <span className="text-xs text-text-secondary">Computing path...</span>
                  </div>
                )}

                {pathError && (
                  <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 bg-warning/10">
                    <AlertTriangle size={14} strokeWidth={1.5} className="text-warning" />
                    <span className="text-xs text-warning">{pathError}</span>
                    <button
                      onClick={clearPath}
                      className="ml-1 p-1 rounded hover:bg-slate-800/50 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}

                {/* Shift-click hint */}
                {pathSelection.length === 0 && !pathLoading && (
                  <div className="glass rounded-lg px-3 py-2 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                    <Route size={14} strokeWidth={1.5} className="text-text-secondary" />
                    <span className="text-xs text-text-secondary">
                      Shift-click nodes to find shortest path
                    </span>
                  </div>
                )}
              </div>

              {/* MO Panel */}
              {selectedSuspect && graphData && (
                <MOPanel
                  suspect={selectedSuspect}
                  allNodes={graphData.nodes}
                  allLinks={graphData.links}
                  onClose={() => setSelectedSuspect(null)}
                />
              )}
            </>
          )}

          {!loading && !error && !graphData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Network size={36} strokeWidth={1} className="text-text-secondary opacity-40 mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No network data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Predictive tab */}
        <div
          className={`absolute inset-0 ${activeTab === 'predictive' ? 'visible' : 'invisible pointer-events-none'}`}
        >
          <PredictiveDash />
        </div>
      </div>
    </div>
  );
}
