import { parseISO, isWithinInterval } from 'date-fns';
import {
  ClusterResponseSchema,
  AnomalyResponseSchema,
  ReportHistoryResponseSchema,
  NetworkGraphSchema,
  PredictionResponseSchema,
  type ClusterPoint,
  type Anomaly,
  type ReportHistoryItem,
  type NetworkGraphData,
  type PredictionPoint,
} from './schemas';
import {
  mockClusters,
  mockAnomalies,
  mockReportHistory,
  mockNetworkGraph,
  mockPredictions,
} from './mockData';

/**
 * Data layer — single toggle to switch between mock and real API data.
 * Set USE_MOCK = false when backend endpoints are ready.
 */
const USE_MOCK = true;

/** Base URL for network API — defaults to production Catalyst deployment */
const NETWORK_API_BASE =
  import.meta.env.VITE_NETWORK_API_BASE ??
  'https://dhaal-60077679458.development.catalystserverless.in/server/network_api';

// ── Clusters ──
export async function fetchClusters(
  dateRange?: { start: Date; end: Date },
  crimeCategory?: string
): Promise<ClusterPoint[]> {
  if (USE_MOCK) {
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

  const res = await fetch(`/api/v1/map/clusters?${params}`);
  if (!res.ok) throw new Error(`Cluster fetch failed: ${res.status}`);
  const json = await res.json();
  return ClusterResponseSchema.parse(json);
}

// ── Anomalies ──
export async function fetchAnomalies(): Promise<Anomaly[]> {
  if (USE_MOCK) {
    return AnomalyResponseSchema.parse(mockAnomalies);
  }

  const res = await fetch('/api/v1/ai/anomalies');
  if (!res.ok) throw new Error(`Anomaly fetch failed: ${res.status}`);
  const json = await res.json();
  return AnomalyResponseSchema.parse(json);
}

// ── Report History ──
export async function fetchReportHistory(): Promise<ReportHistoryItem[]> {
  if (USE_MOCK) {
    return ReportHistoryResponseSchema.parse(mockReportHistory);
  }

  const res = await fetch('/api/v1/reports/history');
  if (!res.ok) throw new Error(`Report history fetch failed: ${res.status}`);
  const json = await res.json();
  return ReportHistoryResponseSchema.parse(json);
}

// ── PDF Generation (SmartBrowz — exact endpoint TBD) ──
export async function generatePdfBrief(anomalyId: string): Promise<string> {
  if (USE_MOCK) {
    // Simulate a 1.5s generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return `https://storage.example.com/reports/brief-${anomalyId}.pdf`;
  }

  // TODO: Confirm exact SmartBrowz endpoint with Backend Dev 2
  const res = await fetch('/api/v1/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anomalyId }),
  });
  if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
  const json = await res.json();
  return json.pdfUrl;
}

// ── Network Suspects Graph ──
export async function fetchNetworkSuspects(): Promise<NetworkGraphData> {
  if (USE_MOCK) {
    return NetworkGraphSchema.parse(mockNetworkGraph);
  }

  const res = await fetch(`${NETWORK_API_BASE}/api/v1/network/suspects`);
  if (!res.ok) throw new Error(`Network suspects fetch failed: ${res.status}`);
  const json = await res.json();
  return NetworkGraphSchema.parse(json);
}

// ── Shortest Path ──
export async function fetchNetworkPath(
  source: string,
  target: string
): Promise<NetworkGraphData> {
  if (USE_MOCK) {
    // Simulate path: return a subset of mock data connecting source → shared case → target
    const pathLinks = mockNetworkGraph.links.filter(
      (l) =>
        (l.source === source || l.target === source || l.source === target || l.target === target)
    );
    // Include any intermediate case/victim nodes referenced by those links
    const referencedIds = new Set<string>();
    for (const link of pathLinks) {
      referencedIds.add(typeof link.source === 'string' ? link.source : '');
      referencedIds.add(typeof link.target === 'string' ? link.target : '');
    }
    const allPathNodes = mockNetworkGraph.nodes.filter((n) => referencedIds.has(n.id));
    return NetworkGraphSchema.parse({ nodes: allPathNodes, links: pathLinks });
  }

  const params = new URLSearchParams({ source, target });
  const res = await fetch(`${NETWORK_API_BASE}/api/v1/network/path?${params}`);
  if (!res.ok) throw new Error(`Network path fetch failed: ${res.status}`);
  const json = await res.json();
  return NetworkGraphSchema.parse(json);
}

// ── AI Predictions ──
export async function fetchPredictions(): Promise<PredictionPoint[]> {
  if (USE_MOCK) {
    return PredictionResponseSchema.parse(mockPredictions);
  }

  // TODO: Confirm exact endpoint with Backend Dev 2 — GET /api/v1/ai/predictions
  const res = await fetch('/api/v1/ai/predictions');
  if (!res.ok) throw new Error(`Predictions fetch failed: ${res.status}`);
  const json = await res.json();
  return PredictionResponseSchema.parse(json);
}

