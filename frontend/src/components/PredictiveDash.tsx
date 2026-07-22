import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  AlertTriangle,
  Activity,
  Shield,
  Siren,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  ReferenceLine,
  Cell,
} from 'recharts';
import { fetchPredictions, fetchSocioEconomic } from '../data/api';
import type { PredictionPoint, SocioEconomicRecord } from '../data/schemas';

import RiskGauge from './RiskGauge';
import AlertMarquee from './AlertMarquee';

/**
 * PredictiveDash — AI Predictive Risk Command Center.
 *
 * Full-featured dashboard with:
 *   1. Alert Marquee (live anomalies)
 *   2. Risk Score Gauge (semi-circle SVG)
 *   3. Trend Direction Indicator (animated arrow)
 *   4. Historical vs Predicted Bar Chart
 *   5. AI Correlation Insights Panel (using live socio-economic data)
 *   6. Radar Chart (socio-economic footprint)
 *   7. "Deploy Patrols" CTA (proactive policing demo)
 *   8. 14-day Risk Forecast Area Chart (existing, improved)
 *
 * Consumes: GET /api/v1/ai/predictions (mock — backend 500 OAuth)
 *           GET /api/v1/data/socio-economic (LIVE)
 */

// ── District ID mapping for socio-economic join ──
const DISTRICT_ID_MAP: Record<string, string> = {
  'Bengaluru Urban': '101',
  'Bengaluru Rural': '102',
  'Mysuru': '103',
  'Mangaluru': '104',
  'Hubli-Dharwad': '105',
  'Belagavi': '106',
  'Kalaburagi': '107',
  'Tumakuru': '108',
  'Davanagere': '109',
  'Shivamogga': '110',
  'Raichur': '111',
  'Ballari': '112',
  'Hassan': '113',
  'Vijayapura': '114',
  'Udupi': '115',
};

// ── Deploy Patrols Toast State ──
interface DeployToast {
  visible: boolean;
  district: string;
}

export default function PredictiveDash() {
  // ── Data states ──
  const [predictions, setPredictions] = useState<PredictionPoint[]>([]);
  const [socioData, setSocioData] = useState<SocioEconomicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Bengaluru Urban');
  const [deployToast, setDeployToast] = useState<DeployToast>({ visible: false, district: '' });

  // ── Fetch both data sources in parallel ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchPredictions(), fetchSocioEconomic()])
      .then(([predData, socData]) => {
        if (!cancelled) {
          setPredictions(predData);
          setSocioData(socData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Derived: unique districts from predictions ──
  const districts = useMemo(
    () => [...new Set(predictions.map((p) => p.district))],
    [predictions]
  );

  // ── Derived: filtered data for selected district ──
  const chartData = useMemo(
    () =>
      predictions
        .filter((p) => p.district === selectedDistrict)
        .map((p) => ({
          ...p,
          dateLabel: p.date.slice(5), // "MM-DD"
        })),
    [predictions, selectedDistrict]
  );

  // ── Derived: stats for the selected district ──
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latestRisk = chartData[chartData.length - 1].predictedRisk;
    const firstRisk = chartData[0].predictedRisk;
    const avgRisk = Math.round(
      chartData.reduce((sum, d) => sum + d.predictedRisk, 0) / chartData.length
    );
    const maxRisk = Math.max(...chartData.map((d) => d.predictedRisk));
    const historicalAvg = chartData[0].historicalAverage;
    const trend = latestRisk - firstRisk;
    const trendDirection = trend > 5 ? 'UPWARD_SPIKE' : trend < -5 ? 'DOWNWARD' : 'STABLE';
    const deviation = historicalAvg > 0
      ? ((latestRisk - historicalAvg) / historicalAvg * 100).toFixed(1)
      : '0';

    return { latestRisk, avgRisk, maxRisk, historicalAvg, trend, trendDirection, deviation, firstRisk };
  }, [chartData]);

  // ── Derived: socio-economic record for selected district ──
  const districtSocioData = useMemo(() => {
    const districtId = DISTRICT_ID_MAP[selectedDistrict];
    if (!districtId) return null;
    return socioData.find((s) => s.districtId === districtId) ?? null;
  }, [socioData, selectedDistrict]);

  // ── Derived: AI Insight text (generated client-side from live socio-economic data) ──
  const aiInsight = useMemo(() => {
    if (!districtSocioData || !stats) return null;
    const urbanIdx = districtSocioData.urbanizationIndex;
    const povertyIdx = districtSocioData.povertyIndex;
    const popDensity = districtSocioData.populationDensity;
    const riskLabel = stats.latestRisk >= 70 ? 'elevated' : stats.latestRisk >= 40 ? 'moderate' : 'low';

    return {
      summary: `Risk ${riskLabel} — evaluated based on urbanization index of ${urbanIdx.toFixed(2)} and population density of ${parseInt(popDensity, 10).toLocaleString()} per km² in ${selectedDistrict}.`,
      factors: [
        { label: 'Urbanization Index', value: urbanIdx, formatted: `${(urbanIdx * 100).toFixed(0)}%` },
        { label: 'Poverty Index', value: povertyIdx, formatted: `${(povertyIdx * 100).toFixed(0)}%` },
        { label: 'Population Density', value: parseInt(popDensity, 10) || 0, formatted: `${parseInt(popDensity, 10).toLocaleString()} / km²` },
      ],
      correlationStrength: urbanIdx > 0.5 ? 'Strong' : urbanIdx > 0.3 ? 'Moderate' : 'Weak',
    };
  }, [districtSocioData, stats, selectedDistrict]);

  // ── Derived: Radar chart data ──
  const radarData = useMemo(() => {
    if (!districtSocioData) return [];
    return [
      {
        axis: 'Urbanization',
        value: districtSocioData.urbanizationIndex * 100,
        fullMark: 100,
      },
      {
        axis: 'Poverty',
        value: districtSocioData.povertyIndex * 100,
        fullMark: 100,
      },
      {
        axis: 'Pop. Density',
        value: Math.min((parseInt(districtSocioData.populationDensity, 10) || 0) / 150 * 100, 100),
        fullMark: 100,
      },
      {
        axis: 'Crime Risk',
        value: stats?.latestRisk ?? 0,
        fullMark: 100,
      },
      {
        axis: 'Hist. Average',
        value: stats?.historicalAvg ?? 0,
        fullMark: 100,
      },
    ];
  }, [districtSocioData, stats]);

  // ── Derived: bar chart data (latest 7 days — historical vs predicted) ──
  const barChartData = useMemo(() => {
    return chartData.slice(-7).map((d) => ({
      date: d.dateLabel,
      historical: d.historicalAverage,
      predicted: d.predictedRisk,
      isHigher: d.predictedRisk > d.historicalAverage,
    }));
  }, [chartData]);

  // ── Deploy Patrols handler ──
  const handleDeployPatrols = useCallback(() => {
    setDeployToast({ visible: true, district: selectedDistrict });
    setTimeout(() => setDeployToast({ visible: false, district: '' }), 4000);
  }, [selectedDistrict]);

  // ── Loading state ──
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

  // ── Error state ──
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
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-5">
        {/* ═══════ 1. ALERT MARQUEE ═══════ */}
        <AlertMarquee />

        {/* ═══════ HEADER ROW ═══════ */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp size={20} strokeWidth={1.5} className="text-accent-gold" />
              Predictive Risk Command Center
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              AI-driven risk assessment with socio-economic correlation analysis
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
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            />
          </div>
        </div>

        {/* ═══════ 2 & 3. GAUGE + TREND + STATS ROW ═══════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* Risk Gauge */}
          <div className="col-span-3 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col items-center justify-center">
            <RiskGauge
              score={stats?.latestRisk ?? 0}
              label="Current Risk Score"
              size={200}
            />
          </div>

          {/* Trend Direction + Key Metrics */}
          <div className="col-span-3 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col justify-between">
            {/* Trend arrow */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${
                stats?.trendDirection === 'UPWARD_SPIKE'
                  ? 'bg-critical/15'
                  : stats?.trendDirection === 'DOWNWARD'
                  ? 'bg-clear/15'
                  : 'bg-slate-800/50'
              }`}>
                {stats?.trendDirection === 'UPWARD_SPIKE' ? (
                  <TrendingUp size={28} strokeWidth={2} className="text-critical gauge-pulse" />
                ) : stats?.trendDirection === 'DOWNWARD' ? (
                  <TrendingDown size={28} strokeWidth={2} className="text-clear" />
                ) : (
                  <Minus size={28} strokeWidth={2} className="text-text-secondary" />
                )}
              </div>
              <div>
                <p className={`text-lg font-bold ${
                  stats?.trendDirection === 'UPWARD_SPIKE'
                    ? 'text-critical'
                    : stats?.trendDirection === 'DOWNWARD'
                    ? 'text-clear'
                    : 'text-text-secondary'
                }`}>
                  {stats?.trendDirection === 'UPWARD_SPIKE'
                    ? 'ESCALATING'
                    : stats?.trendDirection === 'DOWNWARD'
                    ? 'DE-ESCALATING'
                    : 'STABLE'}
                </p>
                <p className="text-xs text-text-secondary">14-Day Trend</p>
              </div>
            </div>

            {/* Key metrics */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Δ from baseline</span>
                <span className={`text-sm font-bold flex items-center gap-1 ${
                  Number(stats?.deviation) > 0 ? 'text-critical' : 'text-clear'
                }`}>
                  {Number(stats?.deviation) > 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {stats?.deviation}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Hist. Average</span>
                <span className="text-sm font-medium text-accent-blue">{stats?.historicalAvg}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Peak (14-day)</span>
                <span className="text-sm font-medium text-warning">{stats?.maxRisk}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Trend Δ</span>
                <span className={`text-sm font-bold ${
                  (stats?.trend ?? 0) > 0 ? 'text-critical' : (stats?.trend ?? 0) < 0 ? 'text-clear' : 'text-text-secondary'
                }`}>
                  {(stats?.trend ?? 0) > 0 ? '+' : ''}{stats?.trend}
                </span>
              </div>
            </div>
          </div>

          {/* Deploy Patrols CTA + Quick Stats */}
          <div className="col-span-6 grid grid-rows-2 gap-4">
            {/* Mini stat cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl bg-surface p-3 border border-slate-800">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Latest Risk</p>
                <p className={`text-xl font-bold ${
                  (stats?.latestRisk ?? 0) >= 70 ? 'text-critical' : (stats?.latestRisk ?? 0) >= 40 ? 'text-warning' : 'text-clear'
                }`}>
                  {stats?.latestRisk}
                </p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-slate-800">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">14-Day Avg</p>
                <p className="text-xl font-bold text-text-primary">{stats?.avgRisk}</p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-slate-800">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Peak Risk</p>
                <p className="text-xl font-bold text-warning">{stats?.maxRisk}</p>
              </div>
              <div className="rounded-xl bg-surface p-3 border border-slate-800">
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Trend</p>
                <p className={`text-xl font-bold ${
                  (stats?.trend ?? 0) > 0 ? 'text-critical' : (stats?.trend ?? 0) < 0 ? 'text-clear' : 'text-text-secondary'
                }`}>
                  {(stats?.trend ?? 0) > 0 ? '+' : ''}{stats?.trend}
                </p>
              </div>
            </div>

            {/* 7. DEPLOY PATROLS CTA */}
            {stats && stats.latestRisk >= 60 && (
              <div className="rounded-xl bg-critical/5 border border-critical/30 p-4 flex items-center gap-4">
                <div className="shrink-0 p-2.5 rounded-xl bg-critical/15">
                  <Siren size={24} strokeWidth={1.5} className="text-critical gauge-pulse" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">
                    Elevated Risk Detected — {selectedDistrict}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    AI forecasts {stats.deviation}% deviation from baseline. Recommend preventive action.
                  </p>
                </div>
                <button
                  onClick={handleDeployPatrols}
                  className="shrink-0 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-gold text-background hover:bg-accent-gold/90 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <Shield size={16} strokeWidth={2} />
                  Deploy Patrols
                </button>
              </div>
            )}
            {stats && stats.latestRisk < 60 && (
              <div className="rounded-xl bg-clear/5 border border-clear/20 p-4 flex items-center gap-4">
                <div className="shrink-0 p-2.5 rounded-xl bg-clear/15">
                  <Shield size={24} strokeWidth={1.5} className="text-clear" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">
                    Risk Within Normal Range — {selectedDistrict}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    No proactive deployment recommended at this time.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ 4 & 5. BAR CHART + AI INSIGHTS ROW ═══════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* Historical vs Predicted Bar Chart */}
          <div className="col-span-7 rounded-xl bg-surface border border-slate-800 p-5">
            <h3 className="text-sm font-medium text-text-primary mb-1">
              Historical vs Predicted — Last 7 Days
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Gray: historical baseline &nbsp;|&nbsp; Colored: AI prediction
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barChartData} barGap={2} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
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
                <Bar dataKey="historical" name="Historical Avg" fill="#374151" radius={[3, 3, 0, 0]} barSize={20} />
                <Bar dataKey="predicted" name="Predicted Risk" radius={[3, 3, 0, 0]} barSize={20}>
                  {barChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isHigher ? '#EF4444' : '#10B981'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* AI Correlation Insights Panel */}
          <div className="col-span-5 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
              <Activity size={16} strokeWidth={1.5} className="text-accent-gold" />
              AI Correlation Insights
            </h3>
            <p className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">
              &quot;Why is this happening?&quot;
            </p>

            {aiInsight ? (
              <div className="flex-1 flex flex-col justify-between">
                {/* AI Insight quote */}
                <div className="rounded-lg bg-accent-blue/5 border-l-2 border-accent-blue px-4 py-3 mb-4">
                  <p className="text-xs text-text-primary italic leading-relaxed">
                    &quot;{aiInsight.summary}&quot;
                  </p>
                  <p className="text-[10px] text-accent-blue mt-2 font-medium">
                    Correlation Strength: {aiInsight.correlationStrength}
                  </p>
                </div>

                {/* Socio-economic driver values */}
                <div className="space-y-2.5">
                  {aiInsight.factors.map((factor) => {
                    const pct = factor.label === 'Population Density'
                      ? Math.min((factor.value / 15000) * 100, 100)
                      : factor.value * 100;
                    return (
                      <div key={factor.label}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-text-secondary">{factor.label}</span>
                          <span className="text-xs text-text-primary font-mono">{factor.formatted}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: factor.label === 'Poverty Index' ? '#EF4444' : '#3B82F6',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-text-secondary text-center">
                  Socio-economic data unavailable for {selectedDistrict}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ 6 & 8. RADAR CHART + AREA CHART ROW ═══════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* Radar Chart — Socio-Economic Footprint */}
          <div className="col-span-5 rounded-xl bg-surface border border-slate-800 p-5">
            <h3 className="text-sm font-medium text-text-primary mb-1">
              Socio-Economic Footprint
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              {selectedDistrict} — multi-dimensional risk profile
            </p>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis
                    dataKey="axis"
                    stroke="#9CA3AF"
                    fontSize={10}
                    tick={{ fill: '#9CA3AF' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    stroke="#374151"
                    fontSize={9}
                    tick={{ fill: '#6B7280' }}
                  />
                  <Radar
                    name={selectedDistrict}
                    dataKey="value"
                    stroke="#D4AF37"
                    fill="#D4AF37"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#F3F4F6',
                    }}
                    formatter={(value) => [`${Number(value).toFixed(1)}`, '']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center">
                <p className="text-xs text-text-secondary">No socio-economic data available</p>
              </div>
            )}
          </div>

          {/* 14-Day Risk Forecast — Area Chart */}
          <div className="col-span-7 rounded-xl bg-surface border border-slate-800 p-5">
            <h3 className="text-sm font-medium text-text-primary mb-1">
              14-Day Risk Forecast — {selectedDistrict}
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Predicted risk score vs historical baseline
            </p>
            <ResponsiveContainer width="100%" height={260}>
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
        </div>

        {/* ═══════ INFO NOTE ═══════ */}
        <div className="rounded-lg bg-accent-blue/5 border border-accent-blue/20 px-4 py-3">
          <p className="text-xs text-text-secondary">
            <span className="text-accent-blue font-medium">Note:</span> Risk predictions use AI models trained on
            historical FIR data correlated with live socio-economic indicators. Socio-economic data is live from backend.
            AI Predictions API is pending OAuth configuration — currently using locally generated forecasts.
          </p>
        </div>
      </div>

      {/* ═══════ DEPLOY PATROLS TOAST ═══════ */}
      {deployToast.visible && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-clear/90 shadow-2xl border border-clear/40">
            <CheckCircle size={20} strokeWidth={2} className="text-white shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                Patrol Units Notified
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                Preventive patrol deployed to {deployToast.district}. Est. response: 15 minutes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
