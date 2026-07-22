import { parseISO, isWithinInterval } from 'date-fns';
import {
  ClusterResponseSchema,
  AnomalyResponseSchema,
  ReportHistoryResponseSchema,
  NetworkGraphSchema,
  NetworkSearchResultSchema,
  NetworkExpandResponseSchema,
  EnrichedPredictionResponseSchema,
  SocioEconomicResponseSchema,
  LiveAnomalyResponseSchema,
} from './schemas';
import type {
  ClusterPoint,
  Anomaly,
  ReportHistoryItem,
  NetworkGraphData,
  NetworkSearchResult,
  NetworkExpandResponse,
  EnrichedPredictionResponse,
  SocioEconomicRecord,
} from './schemas';
import {
  mockClusters,
  mockAnomalies,
  mockReportHistory,
  mockNetworkGraph,
} from './mockData';
import { districtIdToName } from '../utils/districts';

/**
 * Data layer — per-endpoint toggle to switch between mock and real API data.
 * Set individual flags to false as backend endpoints become available.
 */
const USE_MOCK = {
  clusters: true,        // spatial_api is live, but CrimeMap has its own fetch
  anomalies: false,      // ✅ anomaly_alerts_api is LIVE
  reports: false,        // ✅ reports_api is LIVE (returns [] for now)
  network: true,         // using mocks for F1-F3 since /search is pending
  predictions: false,     // 🔴 ai_predictions_api returns 500 (OAuth error)
  socioEconomic: false,  // ✅ socio_economic_api is LIVE
  pdf: false,            // Backend 2 confirmed it is working properly
};

/** Base URL for Catalyst serverless deployment */
const CATALYST_BASE = '/catalyst/server';

// ── Clusters ──
export async function fetchClusters(
  dateRange?: { start: Date; end: Date },
  crimeCategory?: string
): Promise<ClusterPoint[]> {
  if (USE_MOCK.clusters) {
    let data = mockClusters;
    if (dateRange) {
      data = data.filter((c) =>
        isWithinInterval(parseISO(c.date), {
          start: dateRange.start,
          end: dateRange.end,
        })
      );
    }
    if (crimeCategory) {
      data = data.filter((c) => c.category === crimeCategory);
    }
    return ClusterResponseSchema.parse(data);
  }

  const params = new URLSearchParams();
  if (dateRange) {
    params.set('start', dateRange.start.toISOString());
    params.set('end', dateRange.end.toISOString());
  }
  if (crimeCategory) {
    params.set('category', crimeCategory);
  }

  const res = await fetch(`${CATALYST_BASE}/spatial_api/api/v1/map/clusters?${params}`);
  if (!res.ok) throw new Error(`Cluster fetch failed: ${res.status}`);
  const json = await res.json();
  return ClusterResponseSchema.parse(json);
}

// ── Anomalies (with backend→frontend shape transform) ──
export async function fetchAnomalies(): Promise<Anomaly[]> {
  if (USE_MOCK.anomalies) {
    return AnomalyResponseSchema.parse(mockAnomalies);
  }

  const res = await fetch(`${CATALYST_BASE}/anomaly_alerts_api/api/v1/ai/anomalies`);
  if (!res.ok) throw new Error(`Anomaly fetch failed: ${res.status}`);
  const json = await res.json();

  // Transform live backend shape → frontend Anomaly shape
  const liveResponse = LiveAnomalyResponseSchema.parse(json);
  const transformed: Anomaly[] = liveResponse.alerts.map((a, i) => {
    // Extract spike percentage from message (e.g. "Unusual 55% spike...")
    const percentMatch = a.message.match(/(\d+)%/);
    const spikePercentage = percentMatch ? parseInt(percentMatch[1], 10) : 0;

    return {
      id: `anomaly-${a.districtId}-${i}`,
      district: districtIdToName(a.districtId),
      latitude: a.pulsingZone.lat,
      longitude: a.pulsingZone.lng,
      severity: a.severity.toLowerCase() as 'low' | 'medium' | 'high',
      spikePercentage,
      description: a.message,
      detectedAt: new Date().toISOString(),
    };
  });

  return AnomalyResponseSchema.parse(transformed);
}

// ── Report History ──
export async function fetchReportHistory(): Promise<ReportHistoryItem[]> {
  if (USE_MOCK.reports) {
    return ReportHistoryResponseSchema.parse(mockReportHistory);
  }

  const res = await fetch(`${CATALYST_BASE}/reports_api/api/v1/reports/history`);
  if (!res.ok) throw new Error(`Report history fetch failed: ${res.status}`);
  const json = await res.json();

  // Backend may return [] when no reports exist — that's valid
  if (Array.isArray(json) && json.length === 0) return [];
  return ReportHistoryResponseSchema.parse(json);
}

// ── PDF Generation (SmartBrowz) ──
export async function generatePdfBrief(payload: {
  districtName: string;
  message: string;
  severity: string;
}): Promise<string> {
  if (USE_MOCK.pdf) {
    // Simulate a 1.5s generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return `https://storage.example.com/reports/brief-${Date.now()}.pdf`;
  }

  const res = await fetch(`${CATALYST_BASE}/pdf_generator_api/api/v1/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `PDF generation failed: ${res.status}`);
  }
  const json = await res.json();
  return json.downloadUrl;
}

export async function fetchNetworkSuspects(districtId?: string): Promise<NetworkGraphData> {
  if (USE_MOCK.network) {
    return NetworkGraphSchema.parse(mockNetworkGraph);
  }

  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/suspects`);
  if (!res.ok) throw new Error(`Network suspects fetch failed: ${res.status}`);
  const json = await res.json();
  
  return NetworkGraphSchema.parse(json);
}

export async function fetchNetworkSearch(q: string, types?: string[]): Promise<NetworkSearchResult> {
  if (USE_MOCK.network) {
    // Basic mock search filter on existing mock nodes
    const lowerQ = q.toLowerCase();
    const results = mockNetworkGraph.nodes.filter(n => n.label.toLowerCase().includes(lowerQ));
    return NetworkSearchResultSchema.parse(results);
  }

  const params = new URLSearchParams();
  params.set('q', q);
  if (types?.length) params.set('types', types.join(','));

  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/search?${params}`);
  if (!res.ok) throw new Error(`Network search failed: ${res.status}`);
  const json = await res.json();
  
  return NetworkSearchResultSchema.parse(json);
}

export async function fetchNetworkExpand(nodeId: string, depth: number = 1): Promise<NetworkExpandResponse> {
  if (USE_MOCK.network) {
    // 1-hop expansion: return only links connected to nodeId, and the nodes on those links
    const connectedLinks = mockNetworkGraph.links.filter(
      l => l.source === nodeId || l.target === nodeId
    );
    const connectedNodeIds = new Set<string>([nodeId]);
    connectedLinks.forEach(l => {
      connectedNodeIds.add(typeof l.source === 'string' ? l.source : '');
      connectedNodeIds.add(typeof l.target === 'string' ? l.target : '');
    });
    const connectedNodes = mockNetworkGraph.nodes.filter(n => connectedNodeIds.has(n.id));
    
    return NetworkExpandResponseSchema.parse({
      nodes: connectedNodes,
      links: connectedLinks
    });
  }

  const params = new URLSearchParams();
  params.set('nodeId', nodeId);
  params.set('depth', depth.toString());

  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/expand?${params}`);
  if (!res.ok) throw new Error(`Network expand failed: ${res.status}`);
  const json = await res.json();
  
  // 🛡️ SAFEGUARD: The live backend /expand endpoint currently has a bug where it returns the ENTIRE database.
  // We must manually filter it to 1-hop here on the frontend so the graph doesn't explode with all nodes.
  const allLinks = json.links || [];
  const allNodes = json.nodes || [];
  
  const connectedLinks = allLinks.filter(
    (l: any) => l.source === nodeId || l.target === nodeId || (l.source?.id === nodeId) || (l.target?.id === nodeId)
  );
  
  const connectedNodeIds = new Set<string>([nodeId]);
  connectedLinks.forEach((l: any) => {
    connectedNodeIds.add(typeof l.source === 'string' ? l.source : (l.source?.id || ''));
    connectedNodeIds.add(typeof l.target === 'string' ? l.target : (l.target?.id || ''));
  });
  
  const connectedNodes = allNodes.filter((n: any) => connectedNodeIds.has(n.id));
  
  return NetworkExpandResponseSchema.parse({
    nodes: connectedNodes,
    links: connectedLinks
  });
}


// ── Shortest Path ──
export async function fetchNetworkPath(
  source: string,
  target: string
): Promise<NetworkGraphData> {
  if (USE_MOCK.network) {
    // Simulate path: return a subset of mock data connecting source → shared case → target
    const pathLinks = mockNetworkGraph.links.filter(
      (l) =>
        (l.source === source || l.target === source || l.source === target || l.target === target)
    );
    const referencedIds = new Set<string>();
    for (const link of pathLinks) {
      referencedIds.add(typeof link.source === 'string' ? link.source : '');
      referencedIds.add(typeof link.target === 'string' ? link.target : '');
    }
    const allPathNodes = mockNetworkGraph.nodes.filter((n) => referencedIds.has(n.id));
    return NetworkGraphSchema.parse({ nodes: allPathNodes, links: pathLinks });
  }

  const params = new URLSearchParams({ source, target });
  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/path?${params}`);
  if (!res.ok) {
    // Backend returns 404 with { error: "No connection found..." } — treat as empty path
    if (res.status === 404) {
      return { nodes: [], links: [] };
    }
    throw new Error(`Network path fetch failed: ${res.status}`);
  }
  const json = await res.json();
  const parsed = NetworkGraphSchema.parse(json);
  
  const nodeIds = new Set(parsed.nodes.map(n => n.id));
  parsed.links = parsed.links.filter(l => {
    const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
    const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });
  
  return parsed;
}

// ── AI Predictions ──
export async function fetchPredictions(
  districtId: string,
  socioData?: SocioEconomicRecord
): Promise<EnrichedPredictionResponse> {
  if (USE_MOCK.predictions) {
    return { timestamp: new Date().toISOString(), predictions: [] };
  }

  const payload = {
    DistrictID: parseInt(districtId, 10),
    Month: new Date().getMonth() + 1,
    Year: new Date().getFullYear(),
    CrimeHeadID: 3, 
    CrimeMajorHeadID: 52309000000153896,
    PovertyIndex: socioData ? socioData.povertyIndex : 0.5,
    PopulationDensity: socioData ? parseInt(socioData.populationDensity, 10) : 5000,
    UrbanizationIndex: socioData ? socioData.urbanizationIndex : 0.5,
    HistoricalMonthlyAverage: 120
  };

  const res = await fetch(`${CATALYST_BASE}/ai_predictions_api/api/v1/ai/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Predictions fetch failed: ${res.status}`);
  const json = await res.json();
  return EnrichedPredictionResponseSchema.parse(json);
}

// ── Socio-Economic Data (NEW — LIVE) ──
export async function fetchSocioEconomic(): Promise<SocioEconomicRecord[]> {
  if (USE_MOCK.socioEconomic) {
    // Fallback to hardcoded mock if needed
    const { mockSocioEconomicData } = await import('./mockData');
    return Object.entries(mockSocioEconomicData).map(([, data], i) => ({
      districtId: String(101 + i),
      urbanizationIndex: data.urbanization / 100,
      povertyIndex: 1 - data.literacy / 100,
      populationDensity: '0',
    }));
  }

  const res = await fetch(`${CATALYST_BASE}/socio_economic_api/api/v1/data/socio-economic`);
  if (!res.ok) throw new Error(`Socio-economic fetch failed: ${res.status}`);
  const json = await res.json();
  return SocioEconomicResponseSchema.parse(json);
}
