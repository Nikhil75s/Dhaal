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
} from "./schemas";
import type {
  ClusterPoint,
  Anomaly,
  ReportHistoryItem,
  NetworkGraphData,
  NetworkSearchResult,
  NetworkExpandResponse,
  EnrichedPredictionResponse,
  SocioEconomicRecord,
} from "./schemas";
import { districtIdToName } from "../utils/districts";

/** Base URL for Catalyst serverless deployment */
const CATALYST_BASE = "/catalyst/server";

// ── Clusters ──
export async function fetchClusters(
  dateRange?: { start: Date; end: Date },
  crimeCategory?: string,
): Promise<ClusterPoint[]> {
  const params = new URLSearchParams();
  if (dateRange) {
    params.set("start", dateRange.start.toISOString());
    params.set("end", dateRange.end.toISOString());
  }
  if (crimeCategory) {
    params.set("category", crimeCategory);
  }

  const res = await fetch(
    `${CATALYST_BASE}/spatial_api/api/v1/map/clusters?${params}`,
  );
  if (!res.ok) throw new Error(`Cluster fetch failed: ${res.status}`);
  const json = await res.json();
  return ClusterResponseSchema.parse(json);
}

// ── Anomalies (with backend→frontend shape transform) ──
export async function fetchAnomalies(): Promise<Anomaly[]> {
  const res = await fetch(
    `${CATALYST_BASE}/anomaly_alerts_api/api/v1/ai/anomalies`,
  );
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
      severity: a.severity.toLowerCase() as "low" | "medium" | "high",
      spikePercentage,
      description: a.message,
      detectedAt: new Date().toISOString(),
    };
  });

  return AnomalyResponseSchema.parse(transformed);
}



// ── Report History ──
export async function fetchReportHistory(): Promise<ReportHistoryItem[]> {
  const res = await fetch(
    `${CATALYST_BASE}/reports_api/api/v1/reports/history`,
  );
  if (!res.ok) throw new Error(`Report history fetch failed: ${res.status}`);
  const json = await res.json();

  // Backend may return [] when no reports exist — that's valid
  if (Array.isArray(json) && json.length === 0) return [];
  
  const mapped = json.map((r: any) => {
    // GeneratedDate format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
    const dateStr = String(r.date).includes(' ') 
      ? String(r.date).split(' ')[0] 
      : String(r.date).split('T')[0];
      
    return {
      id: String(r.id),
      date: dateStr,
      pdfUrl: r.pdfUrl,
      severity: (r.severity || 'low').toLowerCase(),
      district: r.districtId ? districtIdToName(String(r.districtId)) : 'Unknown',
      title: r.message || `Strategic Brief`,
    };
  });

  return ReportHistoryResponseSchema.parse(mapped);
}

// ── PDF Generation (SmartBrowz) ──
export async function generatePdfBrief(payload: {
  districtName: string;
  districtId: number;
  message: string;
  severity: string;
  alertId?: string;
}): Promise<string> {
  const res = await fetch(
    `${CATALYST_BASE}/pdf_generator_api/api/v1/reports/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `PDF generation failed: ${res.status}`);
  }
  const json = await res.json();
  return json.downloadUrl;
}

export async function fetchRepeatOffenders(
  districtId?: string,
  policeStationId?: string,
): Promise<NetworkGraphData> {
  const params = new URLSearchParams();
  if (districtId) {
    params.set("districtIds", districtId);
  }
  if (policeStationId) {
    params.set("policeStationIds", policeStationId);
  }

  const res = await fetch(
    `${CATALYST_BASE}/network_api/api/v1/network/repeat-offenders?${params}`,
  );
  if (!res.ok)
    throw new Error(`Network repeat offenders fetch failed: ${res.status}`);
  const json = await res.json();

  return NetworkGraphSchema.parse(json);
}

export async function fetchNetworkSearch(
  q: string,
  types?: string[],
): Promise<NetworkSearchResult> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (types?.length) params.set("types", types.join(","));

  const res = await fetch(
    `${CATALYST_BASE}/network_api/api/v1/network/search?${params}`,
  );
  if (!res.ok) throw new Error(`Network search failed: ${res.status}`);
  const json = await res.json();

  return NetworkSearchResultSchema.parse(json);
}

export async function fetchNetworkExpand(
  nodeId: string,
  depth: number = 1,
): Promise<NetworkExpandResponse> {
  const params = new URLSearchParams();
  params.set("nodeId", nodeId);
  params.set("depth", depth.toString());

  const res = await fetch(
    `${CATALYST_BASE}/network_api/api/v1/network/expand?${params}`,
  );
  if (!res.ok) throw new Error(`Network expand failed: ${res.status}`);
  const json = await res.json();

  // 🛡️ SAFEGUARD: The live backend /expand endpoint currently has a bug where it returns the ENTIRE database.
  // We must manually filter it to 1-hop here on the frontend so the graph doesn't explode with all nodes.
  const allLinks = json.links || [];
  const allNodes = json.nodes || [];

  const connectedLinks = allLinks.filter(
    (l: any) =>
      l.source === nodeId ||
      l.target === nodeId ||
      l.source?.id === nodeId ||
      l.target?.id === nodeId,
  );

  const connectedNodeIds = new Set<string>([nodeId]);
  connectedLinks.forEach((l: any) => {
    connectedNodeIds.add(
      typeof l.source === "string" ? l.source : l.source?.id || "",
    );
    connectedNodeIds.add(
      typeof l.target === "string" ? l.target : l.target?.id || "",
    );
  });

  const connectedNodes = allNodes.filter((n: any) =>
    connectedNodeIds.has(n.id),
  );

  return NetworkExpandResponseSchema.parse({
    nodes: connectedNodes,
    links: connectedLinks,
  });
}

// ── Shortest Path ──
export async function fetchNetworkPath(
  source: string,
  target: string,
): Promise<NetworkGraphData> {
  const params = new URLSearchParams({ source, target });
  const res = await fetch(
    `${CATALYST_BASE}/network_api/api/v1/network/path?${params}`,
  );
  if (!res.ok) {
    // Backend returns 404 with { error: "No connection found..." } — treat as empty path
    if (res.status === 404) {
      return { nodes: [], links: [] };
    }
    throw new Error(`Network path fetch failed: ${res.status}`);
  }
  const json = await res.json();
  const parsed = NetworkGraphSchema.parse(json);

  const nodeIds = new Set(parsed.nodes.map((n) => n.id));
  parsed.links = parsed.links.filter((l) => {
    const sourceId =
      typeof l.source === "object" ? (l.source as any).id : l.source;
    const targetId =
      typeof l.target === "object" ? (l.target as any).id : l.target;
    return nodeIds.has(sourceId) && nodeIds.has(targetId);
  });

  return parsed;
}

// ── AI Predictions ──
export async function fetchPredictions(districtId: string): Promise<EnrichedPredictionResponse> {
  const payload = {
    DistrictID: districtId,
    Month: (new Date().getMonth() + 1).toString(),
    Year: new Date().getFullYear().toString(),
  };

  const res = await fetch(`${CATALYST_BASE}/ai_predictions_api/api/v1/ai/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Predictions fetch failed: ${res.status}`);
  const json = await res.json();
  return EnrichedPredictionResponseSchema.parse(json);
}

// ── Socio-Economic Data (NEW — LIVE) ──
export async function fetchSocioEconomic(): Promise<SocioEconomicRecord[]> {
  const res = await fetch(
    `${CATALYST_BASE}/socio_economic_api/api/v1/data/socio-economic`,
  );
  if (!res.ok) throw new Error(`Socio-economic fetch failed: ${res.status}`);
  const json = await res.json();
  return SocioEconomicResponseSchema.parse(json);
}
