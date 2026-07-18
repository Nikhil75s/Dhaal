import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ChevronDown, AlertTriangle, Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { fetchPredictions } from '../data/api';
import type { PredictionPoint } from '../data/schemas';

/**
 * PredictiveDash — AI risk forecast charts.
 * Renders as an in-page tab alongside the network graph (not a top-level route).
 * Backed by mock data until Backend Dev 2's /api/v1/ai/predictions is ready.
 */
export default function PredictiveDash() {
  const [predictions, setPredictions] = useState<PredictionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Bengaluru Urban');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPredictions()
      .then((data) => {
        if (!cancelled) {
          setPredictions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load predictions');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // Get unique districts
  const districts = useMemo(
    () => [...new Set(predictions.map((p) => p.district))],
    [predictions]
  );

  // Filter by selected district
  const chartData = useMemo(
    () =>
      predictions
        .filter((p) => p.district === selectedDistrict)
        .map((p) => ({
          ...p,
          // Short date label for x-axis
          dateLabel: p.date.slice(5), // "MM-DD"
        })),
    [predictions, selectedDistrict]
  );

  // Compute stats for the selected district
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latestRisk = chartData[chartData.length - 1].predictedRisk;
    const avgRisk = Math.round(
      chartData.reduce((sum, d) => sum + d.predictedRisk, 0) / chartData.length
    );
    const maxRisk = Math.max(...chartData.map((d) => d.predictedRisk));
    const historicalAvg = chartData[0].historicalAverage;
    const trend = latestRisk - chartData[0].predictedRisk;
    return { latestRisk, avgRisk, maxRisk, historicalAvg, trend };
  }, [chartData]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <Activity size={20} strokeWidth={1.5} className="animate-pulse" />
          <span className="text-sm">Loading predictive analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-critical/10">
          <AlertTriangle size={20} strokeWidth={1.5} className="text-critical" />
          <span className="text-sm text-critical">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp size={20} strokeWidth={1.5} className="text-accent-gold" />
            Predictive Risk Forecast
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            AI-generated 14-day crime risk projections by district
          </p>
        </div>

        {/* District selector */}
        <div className="relative">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="appearance-none bg-surface text-text-primary text-sm pl-3 pr-8 py-2 rounded-lg border border-slate-700 focus:border-accent-blue focus:outline-none cursor-pointer"
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Latest Risk</p>
            <p className={`text-2xl font-bold ${stats.latestRisk >= 70 ? 'text-critical' : stats.latestRisk >= 40 ? 'text-warning' : 'text-clear'}`}>
              {stats.latestRisk}
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">14-Day Avg</p>
            <p className="text-2xl font-bold text-text-primary">{stats.avgRisk}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Peak Risk</p>
            <p className="text-2xl font-bold text-warning">{stats.maxRisk}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Trend</p>
            <p className={`text-2xl font-bold ${stats.trend > 0 ? 'text-critical' : stats.trend < 0 ? 'text-clear' : 'text-text-secondary'}`}>
              {stats.trend > 0 ? '+' : ''}{stats.trend}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl bg-surface border border-slate-800 p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">
          Risk Score vs Historical Average &mdash; {selectedDistrict}
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="dateLabel"
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#9CA3AF"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1f2937' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#F3F4F6',
              }}
              labelStyle={{ color: '#9CA3AF' }}
            />
            {stats && (
              <ReferenceLine
                y={stats.historicalAvg}
                stroke="#3B82F6"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: `Hist. Avg: ${stats.historicalAvg}`,
                  position: 'insideTopRight',
                  fill: '#9CA3AF',
                  fontSize: 10,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="historicalAverage"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#avgGradient)"
              name="Historical Average"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="predictedRisk"
              stroke="#EF4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#riskGradient)"
              name="Predicted Risk"
              dot={false}
              activeDot={{ r: 4, fill: '#EF4444', stroke: '#111827', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-accent-blue/5 border border-accent-blue/20 px-4 py-3">
        <p className="text-xs text-text-secondary">
          <span className="text-accent-blue font-medium">Note:</span> Predictions are generated by the AI risk model and should be interpreted alongside field intelligence.
          Data source confirmation pending from Backend Dev 2.
        </p>
      </div>
    </div>
  );
}
