import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, TrendingUp, AlertTriangle, Loader, Route, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { fetchNetworkPath, fetchNetworkExpand, fetchRepeatOffenders } from '../data/api';
import type { NetworkGraphData, NetworkNode } from '../data/schemas';
import MOPanel from './MOPanel';
import PredictiveDash from './PredictiveDash';
import NetworkSearchBar from './network/NetworkSearchBar';
import NetworkTypeFilters from './network/NetworkTypeFilters';
import type { NetworkFilters } from './network/NetworkTypeFilters';
import { nodeColor } from '../utils/networkStyles';

/**
 * NetworkGraph — replaces NetworkGraphSlot.tsx.
 * Force-directed suspect/case/victim graph with:
 *   - In-page tab switcher (Graph / Predictive Risk)
 *   - Shift-click two-node shortest-path highlighting
 *   - Click-to-open MO side panel for accused nodes
 *   - District awareness (visual de-emphasis fallback)
 */

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
  const [graphData, setGraphData] = useState<NetworkGraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initial Fetch (Repeat Offenders) ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    fetchRepeatOffenders(selectedDistrict)
      .then(data => {
        if (!cancelled) {
          setGraphData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error("Failed to fetch repeat offenders:", err);
          setError(err.message);
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [selectedDistrict]);

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<TabId>('graph');
  const [selectedSuspect, setSelectedSuspect] = useState<NetworkNode | null>(null);
  const [typeFilters, setTypeFilters] = useState<NetworkFilters>({
    case: true,
    accused: true,
    victim: true,
  });

  // ── Shortest-path state ──
  const [pathSelection, setPathSelection] = useState<string[]>([]);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  
  // ── Expand State ──
  const [isExpanding, setIsExpanding] = useState(false);

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

  // ── Graph merging utility ──
  const mergeGraphData = useCallback((newData: NetworkGraphData) => {
    setGraphData(prev => {
      if (!prev) return newData;
      
      const newNodesMap = new Map(prev.nodes.map(n => [n.id, n]));
      newData.nodes.forEach(n => newNodesMap.set(n.id, n));
      
      const newLinksMap = new Map(prev.links.map(l => {
        const sid = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tid = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return [`${sid}-${tid}`, l];
      }));
      newData.links.forEach(l => {
        const sid = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tid = typeof l.target === 'object' ? (l.target as any).id : l.target;
        newLinksMap.set(`${sid}-${tid}`, l);
      });
      
      return {
        nodes: Array.from(newNodesMap.values()),
        links: Array.from(newLinksMap.values()),
      };
    });
  }, []);

  const handleExpandNode = useCallback(async (nodeId: string) => {
    if (isExpanding) return;
    setIsExpanding(true);
    try {
      const data = await fetchNetworkExpand(nodeId, 1);
      mergeGraphData(data);
    } catch (e) {
      console.error('Failed to expand node', e);
    } finally {
      setIsExpanding(false);
    }
  }, [isExpanding, mergeGraphData]);


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
  const lastClickRef = useRef<{ time: number; nodeId: string | null }>({ time: 0, nodeId: null });

  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      // Shift-click = path selection mode
      if (event.shiftKey) {
        handlePathSelect(node.id);
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastClickRef.current.time;
      const isDoubleClick = timeDiff < 400 && lastClickRef.current.nodeId === node.id;
      
      lastClickRef.current = { time: now, nodeId: node.id };

      if (isDoubleClick) {
        // Expand node on double click
        handleExpandNode(node.id);
        return;
      }

      // Regular click on accused node = open MO panel
      if (node.group === 'accused') {
        setSelectedSuspect(node);
      }
    },
    [handlePathSelect, handleExpandNode]
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

      // Label (always show for better readability)
      ctx.globalAlpha = isPathMode ? (isInPath ? 0.9 : 0.08) : 0.9;
      // Adjust font size based on zoom, but keep a minimum legible size
      const fontSize = Math.max(12 / globalScale, 3);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#F3F4F6';
      ctx.fillText(node.label, x, y + size + 2);

      ctx.globalAlpha = 1;
    },
    [highlightNodes, pathSelection]
  );

  // ── Link styling ──
  const getLinkColor = useCallback(
    (link: GraphLink) => {
      if (highlightLinks.size === 0) return 'rgba(255, 255, 255, 0.4)'; // Increased visibility
      const linkId = makeLinkId(getLinkSourceId(link), getLinkTargetId(link));
      return highlightLinks.has(linkId) ? '#3B82F6' : 'rgba(255, 255, 255, 0.08)';
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
    
    // Apply client-side filters
    const filteredNodes = graphData.nodes.filter(n => {
      if (n.group === 'case' && !typeFilters.case) return false;
      if (n.group === 'accused' && !typeFilters.accused) return false;
      if (n.group === 'victim' && !typeFilters.victim) return false;
      return true;
    });
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    const filteredLinks = graphData.links.filter(l => {
      const sid = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const tid = typeof l.target === 'object' ? (l.target as any).id : l.target;
      return filteredNodeIds.has(sid) && filteredNodeIds.has(tid);
    });

    return {
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: filteredLinks.map((l) => ({ ...l })),
    };
  }, [graphData, typeFilters]);

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

              {/* Top controls: Search and Filters */}
              <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
                <NetworkSearchBar 
                  onSelect={(node) => {
                    // Seed node and expand, replacing existing graph
                    setGraphData({ nodes: [node], links: [] });
                    handleExpandNode(node.id);
                  }} 
                />
                <NetworkTypeFilters 
                  filters={typeFilters} 
                  onChange={setTypeFilters} 
                />
              </div>

              {/* Legend is replaced by interactive filters, but keeping this if needed. Let's remove the static legend since we have filters */}


              {/* Path mode controls */}
              <div className="absolute bottom-4 left-4 z-10 space-y-2">

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

          {!loading && !error && graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Network size={36} strokeWidth={1} className="text-text-secondary opacity-40 mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No repeat offenders found for this district. Try searching for a specific case.</p>
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
