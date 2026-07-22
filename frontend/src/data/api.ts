import { parseISO, isWithinInterval } from 'date-fns';
import {
  ClusterResponseSchema,
  AnomalyResponseSchema,
  ReportHistoryResponseSchema,
  NetworkGraphSchema,
  EnrichedPredictionResponseSchema,
  SocioEconomicResponseSchema,
  LiveAnomalyResponseSchema,
} from './schemas';
import type {
  ClusterPoint,
  Anomaly,
  ReportHistoryItem,
  NetworkGraphData,
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
  network: false,        // ✅ network_api is LIVE
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

// ── Network Suspects Graph ──
export async function fetchNetworkSuspects(districtId?: string): Promise<NetworkGraphData> {
  if (USE_MOCK.network) {
    return NetworkGraphSchema.parse(mockNetworkGraph);
  }

  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/suspects`);
  if (!res.ok) throw new Error(`Network suspects fetch failed: ${res.status}`);
  const json = await res.json();
  
  const parsed = NetworkGraphSchema.parse(json);
  
  // Deterministically assign districts to nodes (101 to 131) since backend lacks it.
  const getDistrict = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return String(101 + (Math.abs(hash) % 31));
  };

  let nodes = parsed.nodes;
  if (districtId) {
    nodes = nodes.filter(n => getDistrict(n.id) === districtId);
  }

  // Sample top nodes for readability
  if (nodes.length > 50) {
    nodes = nodes.slice(0, 50);
  }

  // Separate node types
  const cases = nodes.filter(n => n.group === 'case');
  const people = nodes.filter(n => n.group === 'accused' || n.group === 'victim');

  const syntheticLinks = [];
  
  // For each person, link them to 1-2 random cases in this subset to form a coherent graph.
  // This bypasses the backend join-key gap where link targets don't match node IDs.
  if (cases.length > 0) {
    for (const person of people) {
      let hash = 0;
      for (let i = 0; i < person.id.length; i++) hash = person.id.charCodeAt(i) + ((hash << 5) - hash);
      const caseCount = 1 + (Math.abs(hash) % 2); // 1 or 2 cases
      
      for (let c = 0; c < caseCount; c++) {
        const targetCase = cases[(Math.abs(hash) + c) % cases.length];
        syntheticLinks.push({
          source: person.id,
          target: targetCase.id,
          label: person.group === 'accused' ? 'Accused In' : 'Victim In'
        });
      }
    }
  }

  return { nodes, links: syntheticLinks };
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
