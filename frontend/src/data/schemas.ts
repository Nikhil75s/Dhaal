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

// ── AI Predictions (GET /api/v1/ai/predictions) — shape is a best guess, confirm with Backend Dev 2 ──
export const PredictionPointSchema = z.object({
  district: z.string(),
  date: z.string(),
  predictedRisk: z.number(), // 0–100
  historicalAverage: z.number(),
});
export const PredictionResponseSchema = z.array(PredictionPointSchema);
export type PredictionPoint = z.infer<typeof PredictionPointSchema>;
