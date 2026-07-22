import { z } from 'zod';

/**
 * Zod schemas for all API responses.
 * Every external fetch is validated here before touching state.
 * Shapes are best-known-so-far — confirm with backend before hardening.
 */

// ── Cluster data (GET /api/v1/map/clusters) ──
export const ClusterPointSchema = z.object({
  id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string(),
  date: z.string(),
  count: z.number().int().positive(),
  district: z.string(),
  station: z.string().optional(),
});

export type ClusterPoint = z.infer<typeof ClusterPointSchema>;

export const ClusterResponseSchema = z.array(ClusterPointSchema);

// ── Anomaly data (GET /api/v1/ai/anomalies) ──
export const AnomalySchema = z.object({
  id: z.string(),
  district: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  severity: z.enum(['low', 'medium', 'high']),
  spikePercentage: z.number(),
  description: z.string(),
  detectedAt: z.string(),
});

export type Anomaly = z.infer<typeof AnomalySchema>;

export const AnomalyResponseSchema = z.array(AnomalySchema);

// ── Report history (GET /api/v1/reports/history) ──
export const ReportHistoryItemSchema = z.object({
  id: z.string(),
  date: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  district: z.string(),
  title: z.string(),
  pdfUrl: z.string().url(),
});

export type ReportHistoryItem = z.infer<typeof ReportHistoryItemSchema>;

export const ReportHistoryResponseSchema = z.array(ReportHistoryItemSchema);

// ── Network graph (GET /api/v1/network/suspects, /api/v1/network/path) ──
export const NetworkNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string(), // 'case' | 'accused' | 'victim' — kept as string, not enum, since
                      // unrecognized groups should render (blue fallback) not fail validation
  mo: z.string().optional(),
  jurisdiction: z.string().optional(),
});

export const NetworkLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});

export const NetworkGraphSchema = z.object({
  nodes: z.array(NetworkNodeSchema),
  links: z.array(NetworkLinkSchema),
});

export type NetworkNode = z.infer<typeof NetworkNodeSchema>;
export type NetworkLink = z.infer<typeof NetworkLinkSchema>;
export type NetworkGraphData = z.infer<typeof NetworkGraphSchema>;

export const NetworkSearchResultSchema = z.array(NetworkNodeSchema);
export type NetworkSearchResult = z.infer<typeof NetworkSearchResultSchema>;

export const NetworkExpandResponseSchema = NetworkGraphSchema;
export type NetworkExpandResponse = z.infer<typeof NetworkExpandResponseSchema>;

export const PredictionPointSchema = z.object({
  district: z.string(),
  date: z.string(),
  predictedRisk: z.number(), // 0–100
  historicalAverage: z.number(),
});
export type PredictionPoint = z.infer<typeof PredictionPointSchema>;

export const EnrichedPredictionSchema = z.object({
  predictionId: z.string(),
  district: z.object({
    districtId: z.number().or(z.string()),
    name: z.string(),
  }),
  macroRiskAssessment: z.object({
    score: z.number(),
    level: z.string(),
    trendDirection: z.string(),
  }),
  emergingAnomalies: z.array(z.object({
    crimeHeadId: z.number().or(z.string()),
    historicalMonthlyAverage: z.number(),
    predictedIncidentCount: z.number(),
    percentageIncrease: z.number(),
    alertMessage: z.string(),
  })),
  hiddenCorrelations: z.object({
    socioEconomicDrivers: z.object({
      urbanizationIndex: z.number(),
      povertyIndex: z.number(),
      populationDensity: z.number().or(z.string()),
      aiInsight: z.string(),
    }),
  }),
  rawQuickMlExplainability: z.any().optional(),
});
export const EnrichedPredictionResponseSchema = z.object({
  timestamp: z.string(),
  predictions: z.array(EnrichedPredictionSchema),
});
export type EnrichedPredictionResponse = z.infer<typeof EnrichedPredictionResponseSchema>;

// ── Socio-Economic Data (GET /api/v1/data/socio-economic) — LIVE backend shape ──
export const SocioEconomicRecordSchema = z.object({
  districtId: z.string(),
  urbanizationIndex: z.number(),
  povertyIndex: z.number(),
  populationDensity: z.string(), // Backend returns string
});
export const SocioEconomicResponseSchema = z.array(SocioEconomicRecordSchema);
export type SocioEconomicRecord = z.infer<typeof SocioEconomicRecordSchema>;

// ── Live Anomaly Alert (GET /api/v1/ai/anomalies) — LIVE backend shape ──
export const LiveAnomalyAlertSchema = z.object({
  alert: z.boolean(),
  districtId: z.number(),
  message: z.string(),
  severity: z.string(),
  pulsingZone: z.object({
    lat: z.number(),
    lng: z.number(),
    radius: z.number(),
  }),
});
export const LiveAnomalyResponseSchema = z.object({
  status: z.string(),
  analyzedDistricts: z.number(),
  anomaliesDetected: z.number(),
  alerts: z.array(LiveAnomalyAlertSchema),
});
export type LiveAnomalyAlert = z.infer<typeof LiveAnomalyAlertSchema>;
