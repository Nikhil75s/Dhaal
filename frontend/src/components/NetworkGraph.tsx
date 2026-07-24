import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, TrendingUp, AlertTriangle, Loader, Route, X, Maximize, Minimize } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { fetchNetworkPath, fetchNetworkExpand, fetchRepeatOffenders } from '../data/api';
import type { NetworkGraphData, NetworkNode } from '../data/schemas';
import MOPanel from './MOPanel';
import CasePanel from './CasePanel';
import VictimPanel from './VictimPanel';
import PredictiveDash from './PredictiveDash';
import NetworkSearchBar from './network/NetworkSearchBar';
import NetworkTypeFilters from './network/NetworkTypeFilters';
import type { NetworkFilters } from './network/NetworkTypeFilters';
import { nodeColor } from '../utils/networkStyles';
import { DistrictDropdown } from './common/DistrictDropdown';
import { PoliceStationDropdown } from './common/PoliceStationDropdown';

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
  const { filters, setFilters } = useDashboard();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.getElementById('app-content-area')?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // Use localized state for the Network Graph so that filtering here doesn't "seep" into the Map view globally
  const localDistrict = filters.networkDistrictId;
  const localStation = filters.networkPoliceStationId;

  const setLocalDistrict = (id: string | null) => {
    setFilters(prev => ({ ...prev, networkDistrictId: id, networkPoliceStationId: null }));
  };

  const setLocalStation = (id: string | null) => {
    setFilters(prev => ({ ...prev, networkPoliceStationId: id }));
  };

  // ── Data & History state ──
  const [graphState, setGraphState] = useState<{
    data: NetworkGraphData | null;
    history: NetworkGraphData[];
    index: number;
  }>({
    data: null,
    history: [],
    index: -1,
  });
  const graphData = graphState.data;

  const pushGraphState = useCallback((updater: (prev: NetworkGraphData | null) => NetworkGraphData | null) => {
    setGraphState(prev => {
      const newData = updater(prev.data);
      if (!newData) return prev;
      
      const newHistory = prev.history.slice(0, prev.index + 1);
      newHistory.push(newData);
      return {
        data: newData,
        history: newHistory,
        index: newHistory.length - 1,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setGraphState(prev => {
      if (prev.index > 0) {
        return {
          ...prev,
          data: prev.history[prev.index - 1],
          index: prev.index - 1,
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setGraphState(prev => {
      if (prev.index < prev.history.length - 1) {
        return {
          ...prev,
          data: prev.history[prev.index + 1],
          index: prev.index + 1,
        };
      }
      return prev;
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Initial Fetch (Repeat Offenders) ──
  useEffect(() => {
    let cancelled = false;
    
    // Empty state: don't load graph if no jurisdiction selected
    if (!localDistrict && !localStation) {
      setGraphState({ data: null, history: [], index: -1 });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    fetchRepeatOffenders(localDistrict ?? undefined, localStation ?? undefined)
      .then(data => {
        if (!cancelled) {
          pushGraphState(() => data);
          setLoading(false);
          // Gently auto-fit the new graph after the initial physics settle
          setTimeout(() => {
            fgRef.current?.zoomToFit(800, 50);
          }, 600);
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
  }, [localDistrict, localStation]);

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
  const [explorationMode, setExplorationMode] = useState(false);
  const [selectedCase, setSelectedCase] = useState<NetworkNode | null>(null);
  const [selectedVictim, setSelectedVictim] = useState<NetworkNode | null>(null);

  // ── Graph Ref for Camera Control ──
  const fgRef = useRef<any>(null);

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

  // Configure Physics Engine to keep nodes tight
  useEffect(() => {
    if (fgRef.current) {
      // Restore healthy defaults so the graph can arrange itself properly
      fgRef.current.d3Force('charge').strength(-30);
      fgRef.current.d3Force('link').distance(40);
    }
  }, [graphData]);

  // ── Graph merging utility ──
  const mergeGraphData = useCallback((newData: NetworkGraphData) => {
    pushGraphState((prev) => {
      if (!prev) return newData;
      
      let changed = false;
      const newNodesMap = new Map(prev.nodes.map(n => [n.id, n]));
      // Preserve existing node references to keep their x/y positions and prevent jerking
      newData.nodes.forEach(n => {
        if (!newNodesMap.has(n.id)) {
          newNodesMap.set(n.id, n);
          changed = true;
        }
      });
      
      const newLinksMap = new Map(prev.links.map(l => {
        const sid = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tid = typeof l.target === 'object' ? (l.target as any).id : l.target;
        return [`${sid}-${tid}`, l];
      }));
      newData.links.forEach(l => {
        const sid = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const tid = typeof l.target === 'object' ? (l.target as any).id : l.target;
        if (!newLinksMap.has(`${sid}-${tid}`)) {
          newLinksMap.set(`${sid}-${tid}`, l);
          changed = true;
        }
      });
      
      if (!changed) return prev; // Prevent unnecessary simulation reheats
      
      return {
        nodes: Array.from(newNodesMap.values()),
        links: Array.from(newLinksMap.values()),
      };
    });
  }, [pushGraphState]);

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

      if (pathSelection.length === 2) {
        if (pathSelection.includes(nodeId)) {
          // Deselect the clicked node, keep the other one
          const remainingNode = pathSelection.find(id => id !== nodeId);
          setPathSelection(remainingNode ? [remainingNode] : []);
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
          setPathError(null);
        } else {
          // Clicked a 3rd node: restart selection with this new node
          setPathSelection([nodeId]);
          setHighlightNodes(new Set());
          setHighlightLinks(new Set());
          setPathError(null);
        }
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
                const src = typeof l.source === 'string' ? l.source : typeof l.source === 'object' ? (l.source as any).id : '';
                const tgt = typeof l.target === 'string' ? l.target : typeof l.target === 'object' ? (l.target as any).id : '';
                return makeLinkId(src, tgt);
              })
            );
            
            // Expand the graph to include the hidden nodes and links from the path!
            mergeGraphData(pathData);

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

  // ── Keyboard Listeners ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'x')) {
        redo();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        clearPath();
        setSelectedSuspect(null);
        setSelectedCase(null);
        setSelectedVictim(null);
      } else if (e.key.toLowerCase() === 'e') {
        setExplorationMode((prev) => {
          const next = !prev;
          if (next) {
            setSelectedSuspect(null);
            setSelectedCase(null);
            setSelectedVictim(null);
          }
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearPath, undo, redo]);

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

      if (explorationMode) {
        if (isDoubleClick) {
          handlePathSelect(node.id);
        } else {
          handleExpandNode(node.id);
        }
        return;
      }

      if (isDoubleClick) {
        // Expand node on double click
        handleExpandNode(node.id);
        return;
      }

      // Regular click opens the respective detail panel
      setSelectedSuspect(null);
      setSelectedCase(null);
      setSelectedVictim(null);

      if (node.group === 'accused') {
        setSelectedSuspect(node);
      } else if (node.group === 'case') {
        setSelectedCase(node);
      } else if (node.group === 'victim') {
        setSelectedVictim(node);
      }
    },
    [handlePathSelect, handleExpandNode, explorationMode]
  );

  // ── Custom node rendering ──
  const drawNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      // Reduced node sizes to prevent overlapping with text
      const size = node.group === 'accused' ? 3.5 : node.group === 'case' ? 2.5 : 2;
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

      // Node glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? size * 3 : size;

      // Main node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.shadowBlur = 0; // reset shadow for stroke
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label (always show for better readability)
      ctx.globalAlpha = isPathMode ? (isInPath ? 0.9 : 0.08) : 0.9;
      // Adjust font size based on zoom, but keep a minimum legible size
      const fontSize = Math.max(12 / globalScale, 3);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#F3F4F6';
      // Shift text slightly further down so it doesn't touch the node border
      ctx.fillText(node.label, x, y + size + 1.5);

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

    // Do not clone filteredNodes or filteredLinks; force-graph needs the original object references to persist simulation state without jolting.
    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, typeFilters]);

  // ── Render ──
  return (
    <div className="w-full h-full flex flex-col bg-[#10141f]">
      {/* Header / Tab bar */}
      <div className="h-16 shrink-0 bg-[#0F172A] flex items-center gap-4 px-6 relative z-20">
        <button
          onClick={() => setActiveTab('graph')}
          className={`
            flex items-center px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-black/30 border whitespace-nowrap
            ${activeTab === 'graph'
              ? 'bg-khaki text-navy-900 border-khaki'
              : 'bg-[#1E293B] text-gray-200 hover:bg-slate-700 border-white/5'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <Network size={16} strokeWidth={2} className={activeTab === 'graph' ? 'text-navy-900' : 'text-khaki'} />
            Network Graph
          </span>
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`
            flex items-center px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-black/30 border whitespace-nowrap
            ${activeTab === 'predictive'
              ? 'bg-khaki text-navy-900 border-khaki'
              : 'bg-[#1E293B] text-gray-200 hover:bg-slate-700 border-white/5'
            }
          `}
        >
          <span className="flex items-center gap-2">
            <TrendingUp size={16} strokeWidth={2} className={activeTab === 'predictive' ? 'text-navy-900' : 'text-khaki'} />
            Strategic Intelligence
          </span>
        </button>

        <div className="flex-1" />

        {/* Dynamic Selection Dropdowns */}
        {activeTab === 'graph' && (
          <div className="flex items-center gap-3">
            <DistrictDropdown 
              value={localDistrict} 
              onChange={(id) => {
                setLocalDistrict(id);
                setLocalStation(null); // Reset station when district changes
              }} 
            />
            <PoliceStationDropdown 
              value={localStation} 
              onChange={(id) => setLocalStation(id)} 
            />
          </div>
        )}
        
        <button 
          onClick={toggleFullscreen}
          className="bg-[#1E293B] text-gray-300 p-2.5 rounded-full hover:bg-slate-700 transition-colors shadow-md shadow-black/30 border border-white/5 ml-3"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Graph"}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
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
              <div className="flex items-center gap-3 text-gray-400">
                <Loader size={20} strokeWidth={1.5} className="animate-spin" />
                <span className="text-sm">Loading network graph...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-critical/10 pointer-events-auto">
                <AlertTriangle size={20} strokeWidth={1.5} className="text-critical" />
                <div>
                  <p className="text-sm text-critical font-medium">Failed to load network data</p>
                  <p className="text-xs text-gray-400 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Top controls: Search and Filters (ALWAYS VISIBLE) */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 w-[22rem]">
            <NetworkSearchBar 
              onSelect={(node) => {
                // Seed node and expand, replacing existing graph (push to history)
                pushGraphState(() => ({ nodes: [node], links: [] }));
                handleExpandNode(node.id);
                // Reset camera to center so the user doesn't stare at empty space
                fgRef.current?.centerAt(0, 0, 800);
                fgRef.current?.zoom(2.5, 800);
              }} 
            />
            
            <NetworkTypeFilters 
              filters={typeFilters} 
              onChange={setTypeFilters} 
            />
          </div>

          {/* Undo/Redo Controls (Top Right) */}
          <div className={`absolute top-4 z-20 flex gap-1 bg-[#1E293B] border border-white/5 shadow-md shadow-black/30 rounded-lg p-1 h-[42px] transition-all duration-300 ease-out ${
            (selectedSuspect || selectedCase || selectedVictim) ? 'right-[27.5rem]' : 'right-4'
          }`}>
            <button
              onClick={undo}
              disabled={graphState.index <= 0}
              className="w-10 h-full flex items-center justify-center rounded-md hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-300"
              title="Undo (Ctrl+Z)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <div className="w-px h-full bg-white/10" />
            <button
              onClick={redo}
              disabled={graphState.index >= graphState.history.length - 1}
              className="w-10 h-full flex items-center justify-center rounded-md hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-300"
              title="Redo (Ctrl+X or Ctrl+Y)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
            </button>
          </div>

          {!loading && !error && graphData && (
            <>
              <ForceGraph2D
                ref={fgRef}
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
                onEngineTick={() => {
                  if (fgRef.current) {
                    // Apply a gentle gravitational pull towards the center (0,0)
                    // This pulls disjoint clusters back together and keeps the graph compact
                    if (forceGraphData && forceGraphData.nodes) {
                      forceGraphData.nodes.forEach((node: any) => {
                        if (node.x && node.y && node.vx !== undefined && node.vy !== undefined) {
                          node.vx -= node.x * 0.0015;
                          node.vy -= node.y * 0.0015;
                        }
                      });
                    }
                  }
                }}
                cooldownTime={3000}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.4} // Default smooth sliding
              />

              {/* Exploration Mode Badge */}
              {explorationMode && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 animate-fade-in pointer-events-none">
                  <div className="bg-khaki/20 text-khaki border border-khaki/30 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-khaki animate-pulse" />
                    Exploration Mode
                  </div>
                </div>
              )}

              {/* Path mode controls */}
              <div className="absolute bottom-4 left-4 z-10 space-y-2">

                {/* Path selection UI */}
                {pathSelection.length > 0 && (
                  <div className="bg-[#1E293B] border border-white/5 shadow-md shadow-black/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Route size={14} strokeWidth={1.5} className="text-police-blue" />
                    <span className="text-xs text-gray-100">
                      {pathSelection.length === 1
                        ? 'Shift-click a second node to find shortest path'
                        : 'Path highlighted'}
                    </span>
                    <button
                      onClick={clearPath}
                      className="ml-2 p-1 rounded hover:bg-slate-800/50 text-gray-400 hover:text-gray-100 transition-colors cursor-pointer"
                      title="Clear path"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}

                {pathLoading && (
                  <div className="bg-[#1E293B] border border-white/5 shadow-md shadow-black/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader size={14} strokeWidth={1.5} className="text-police-blue animate-spin" />
                    <span className="text-xs text-gray-400">Computing path...</span>
                  </div>
                )}

                {pathError && (
                  <div className="bg-[#1E293B] border border-white/5 shadow-md shadow-black/30 rounded-lg px-3 py-2 flex items-center gap-2 bg-warning/10">
                    <AlertTriangle size={14} strokeWidth={1.5} className="text-warning" />
                    <span className="text-xs text-warning">{pathError}</span>
                    <button
                      onClick={clearPath}
                      className="ml-1 p-1 rounded hover:bg-slate-800/50 text-gray-400 hover:text-gray-100 transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                )}

                {/* Shift-click hint */}
                {pathSelection.length === 0 && !pathLoading && (
                  <div className="bg-[#1E293B] border border-white/5 shadow-md shadow-black/30 rounded-lg px-3 py-2 flex flex-col gap-1 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <Route size={14} strokeWidth={1.5} className="text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {explorationMode ? 'Double-click nodes to find shortest path' : 'Shift-click nodes to find shortest path'}
                      </span>
                    </div>
                    {!explorationMode && (
                      <span className="text-[10px] text-gray-500 pl-5">Press 'E' to toggle Exploration Mode</span>
                    )}
                  </div>
                )}
              </div>

              {/* Side Panels */}
              {selectedSuspect && graphData && (
                <MOPanel
                  suspect={selectedSuspect}
                  allNodes={graphData.nodes}
                  allLinks={graphData.links}
                  onClose={() => setSelectedSuspect(null)}
                />
              )}
              {selectedCase && graphData && (
                <CasePanel
                  caseNode={selectedCase}
                  allNodes={graphData.nodes}
                  allLinks={graphData.links}
                  onClose={() => setSelectedCase(null)}
                />
              )}
              {selectedVictim && graphData && (
                <VictimPanel
                  victimNode={selectedVictim}
                  allNodes={graphData.nodes}
                  allLinks={graphData.links}
                  onClose={() => setSelectedVictim(null)}
                />
              )}
            </>
          )}

          {!loading && !error && graphData && graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Network size={36} strokeWidth={1} className="text-gray-400 opacity-40 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No repeat offenders found for this district. Try searching for a specific case.</p>
              </div>
            </div>
          )}

          {!loading && !error && graphData === null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-8 bg-[#1E293B]/80 backdrop-blur border border-white/10 rounded-2xl shadow-xl max-w-md">
                <div className="w-16 h-16 bg-[#0F172A] rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Network size={28} className="text-khaki" />
                </div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Select a Jurisdiction</h3>
                <p className="text-sm text-gray-400">
                  Please select a District or Police Station from the top right dropdowns to load repeat offender data.
                </p>
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

