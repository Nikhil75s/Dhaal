import { parseISO, isWithinInterval } from 'date-fns';
import {
  ClusterResponseSchema,
  AnomalyResponseSchema,
  ReportHistoryResponseSchema,
  NetworkGraphSchema,
  PredictionResponseSchema,
  LiveAnomalyResponseSchema,
  SocioEconomicResponseSchema,
  type ClusterPoint,
  type Anomaly,
  type ReportHistoryItem,
  type NetworkGraphData,
  type PredictionPoint,
  type SocioEconomicRecord,
} from './schemas';
import {
  mockClusters,
  mockAnomalies,
  mockReportHistory,
  mockNetworkGraph,
  mockPredictions,
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
  predictions: true,     // 🔴 ai_predictions_api returns 500 (OAuth error)
  socioEconomic: false,  // ✅ socio_economic_api is LIVE
  pdf: false,            // Backend 2 confirmed it is working properly
};

/** Base URL for Catalyst serverless deployment */
const CATALYST_BASE =
  import.meta.env.VITE_CATALYST_BASE ??
  'https://dhaal-60077679458.development.catalystserverless.in/server';

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

  const res = await fetch(`${CATALYST_BASE}/spatial_api/api/v1/map/clusters?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Cluster fetch failed: ${res.status}`);
  const json = await res.json();
  return ClusterResponseSchema.parse(json);
}

// ── Anomalies (with backend→frontend shape transform) ──
export async function fetchAnomalies(): Promise<Anomaly[]> {
  if (USE_MOCK.anomalies) {
    return AnomalyResponseSchema.parse(mockAnomalies);
  }

  const res = await fetch(`${CATALYST_BASE}/anomaly_alerts_api/api/v1/ai/anomalies`, { credentials: 'include' });
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

  const res = await fetch(`${CATALYST_BASE}/reports_api/api/v1/reports/history`, { credentials: 'include' });
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
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `PDF generation failed: ${res.status}`);
  }
  const json = await res.json();
  return json.pdfUrl;
}

// ── Network Suspects Graph ──
export async function fetchNetworkSuspects(): Promise<NetworkGraphData> {
  if (USE_MOCK.network) {
    return NetworkGraphSchema.parse(mockNetworkGraph);
  }

  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/suspects`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Network suspects fetch failed: ${res.status}`);
  const json = await res.json();
  return NetworkGraphSchema.parse(json);
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
  const res = await fetch(`${CATALYST_BASE}/network_api/api/v1/network/path?${params}`, { credentials: 'include' });
  if (!res.ok) {
    // Backend returns 404 with { error: "No connection found..." } — treat as empty path
    if (res.status === 404) {
      return { nodes: [], links: [] };
    }
    throw new Error(`Network path fetch failed: ${res.status}`);
  }
  const json = await res.json();
  return NetworkGraphSchema.parse(json);
}

// ── AI Predictions ──
export async function fetchPredictions(): Promise<PredictionPoint[]> {
  if (USE_MOCK.predictions) {
    return PredictionResponseSchema.parse(mockPredictions);
  }

  const res = await fetch(`${CATALYST_BASE}/ai_predictions_api/api/v1/ai/predictions`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Predictions fetch failed: ${res.status}`);
  const json = await res.json();
  return PredictionResponseSchema.parse(json);
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

  const res = await fetch(`${CATALYST_BASE}/socio_economic_api/api/v1/data/socio-economic`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Socio-economic fetch failed: ${res.status}`);
  const json = await res.json();
  return SocioEconomicResponseSchema.parse(json);
}
