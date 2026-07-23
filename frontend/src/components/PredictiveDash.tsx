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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { fetchPredictions, fetchSocioEconomic, generatePdfBrief } from '../data/api';
import type { SocioEconomicRecord, EnrichedPredictionResponse } from '../data/schemas';

import RiskGauge from './RiskGauge';
import AlertMarquee from './AlertMarquee';

/**
 * PredictiveDash — AI Predictive Risk Command Center.
 *
 * Full-featured dashboard with:
 *   1. Alert Marquee (live anomalies)
 *   2. Risk Score Gauge (semi-circle SVG)
 *   3. Trend Direction Indicator (animated arrow)
 *   4. AI Correlation Insights Panel (using live socio-economic data)
 *   5. Radar Chart (socio-economic footprint)
 *   6. "Deploy Patrols" CTA (proactive policing demo)
 *
 * Consumes: GET /api/v1/ai/predict (LIVE)
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

// Districts array derived from the map
const DISTRICTS = Object.keys(DISTRICT_ID_MAP);

interface DeployToast {
  visible: boolean;
  district: string;
  downloadUrl?: string;
  loadingPdf?: boolean;
}

export default function PredictiveDash() {
  // ── Data states ──
  const [realPrediction, setRealPrediction] = useState<EnrichedPredictionResponse | null>(null);
  const [socioData, setSocioData] = useState<SocioEconomicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Bengaluru Urban');
  const [deployToast, setDeployToast] = useState<DeployToast>({ visible: false, district: '' });

  // ── Fetch socio-economic data on mount ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSocioEconomic()
      .then((socData) => {
        if (!cancelled) {
          setSocioData(socData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load socio-economic data');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // ── Derived: socio-economic record for selected district ──
  const districtSocioData = useMemo(() => {
    const districtId = DISTRICT_ID_MAP[selectedDistrict];
    if (!districtId) return null;
    return socioData.find((s) => s.districtId === districtId) ?? null;
  }, [socioData, selectedDistrict]);

  // ── Fetch real AI prediction when district or socioData changes ──
  useEffect(() => {
    let cancelled = false;
    const distId = DISTRICT_ID_MAP[selectedDistrict];
    
    // Only fetch if we have loaded the socioData to send to the AI
    if (!distId || !districtSocioData) return;
    
    setLoading(true);
    fetchPredictions(distId, districtSocioData)
      .then((res) => {
        if (!cancelled && res.predictions.length > 0) {
          setRealPrediction(res);
        } else if (!cancelled) {
          setRealPrediction(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch real AI predictions:', err);
        if (!cancelled) {
          setError('Prediction model unavailable for ' + selectedDistrict);
          setLoading(false);
        }
      });
      
    return () => { cancelled = true; };
  }, [selectedDistrict, districtSocioData]);

  // ── Derived: stats for the selected district (PURELY from real backend data) ──
  const stats = useMemo(() => {
    if (!realPrediction || realPrediction.predictions.length === 0) return null;
    
    const p = realPrediction.predictions[0];
    const latestRisk = p.macroRiskAssessment.score;
    const trendDirection = p.macroRiskAssessment.trendDirection;
    const historicalAvg = p.emergingAnomalies[0]?.historicalMonthlyAverage ?? 0;
    const predictedCount = p.emergingAnomalies[0]?.predictedIncidentCount ?? 0;
    
    // Calculate simple deviation from historical
    const deviation = historicalAvg > 0
      ? ((predictedCount - historicalAvg) / historicalAvg * 100).toFixed(1)
      : '0';

    return { 
      latestRisk, 
      historicalAvg, 
      predictedCount,
      trendDirection, 
      deviation 
    };
  }, [realPrediction]);


  // ── Derived: AI Insight text ──
  const aiInsight = useMemo(() => {
    if (realPrediction && realPrediction.predictions.length > 0) {
      const p = realPrediction.predictions[0];
      const drivers = p.hiddenCorrelations.socioEconomicDrivers;
      const urbanIdx = drivers.urbanizationIndex;
      const povertyIdx = drivers.povertyIndex;
      const popDensity = Number(drivers.populationDensity) || 0;
      
      return {
        summary: drivers.aiInsight,
        factors: [
          { label: 'Urbanization Index', value: urbanIdx, formatted: `${(urbanIdx * 100).toFixed(0)}%` },
          { label: 'Poverty Index', value: povertyIdx, formatted: `${(povertyIdx * 100).toFixed(0)}%` },
          { label: 'Population Density', value: popDensity, formatted: `${popDensity.toLocaleString()} / km²` },
        ],
        correlationStrength: urbanIdx > 0.5 ? 'Strong' : urbanIdx > 0.3 ? 'Moderate' : 'Weak',
      };
    }
    
    return null;
  }, [realPrediction]);

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
        axis: 'Baseline Avg',
        value: stats?.historicalAvg ?? 0,
        fullMark: 100,
      },
    ];
  }, [districtSocioData, stats]);

  // ── Deploy Patrols handler ──
  const handleDeployPatrols = useCallback(async () => {
    setDeployToast({ visible: true, district: selectedDistrict, loadingPdf: true });
    
    try {
      const url = await generatePdfBrief({
        districtName: selectedDistrict,
        message: `High risk detected. AI forecasts ${stats?.deviation ?? '0'}% deviation from baseline.`,
        severity: (stats?.latestRisk ?? 0) >= 70 ? 'CRITICAL' : 'HIGH',
      });
      setDeployToast({ visible: true, district: selectedDistrict, downloadUrl: url, loadingPdf: false });
      
      setTimeout(() => setDeployToast({ visible: false, district: '' }), 15000);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      setDeployToast({ visible: true, district: selectedDistrict, loadingPdf: false });
      setTimeout(() => setDeployToast({ visible: false, district: '' }), 5000);
    }
  }, [selectedDistrict, stats]);

  // ── Loading state ──
  if (loading && !stats) {
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
  if (error && !stats) {
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
              {DISTRICTS.map((d) => (
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
          <div className="col-span-4 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col items-center justify-center">
            <RiskGauge
              score={stats?.latestRisk ?? 0}
              label="Current Risk Score"
              size={200}
            />
          </div>

          {/* Trend Direction + Key Metrics */}
          <div className="col-span-4 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col justify-between">
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
                <p className="text-xs text-text-secondary">Current Trend</p>
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
                <span className="text-xs text-text-secondary">Historical Monthly Avg</span>
                <span className="text-sm font-medium text-accent-blue">{stats?.historicalAvg} incidents</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary">Predicted Incidents</span>
                <span className="text-sm font-medium text-warning">{stats?.predictedCount} incidents</span>
              </div>
            </div>
          </div>

          {/* AI Correlation Insights Panel */}
          <div className="col-span-4 rounded-xl bg-surface border border-slate-800 p-5 flex flex-col">
            <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-3">
              <Activity size={16} strokeWidth={1.5} className="text-accent-gold" />
              AI Correlation Insights
            </h3>
            
            {aiInsight ? (
              <div className="flex-1 flex flex-col justify-between">
                <div className="rounded-lg bg-accent-blue/5 border-l-2 border-accent-blue px-4 py-3 mb-4">
                  <p className="text-xs text-text-primary italic leading-relaxed">
                    &quot;{aiInsight.summary}&quot;
                  </p>
                  <p className="text-[10px] text-accent-blue mt-2 font-medium">
                    Correlation Strength: {aiInsight.correlationStrength}
                  </p>
                </div>
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
                  Insight unavailable
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ 6 & 8. RADAR CHART & CTA ROW ═══════ */}
        <div className="grid grid-cols-12 gap-4">
          {/* Radar Chart — Socio-Economic Footprint */}
          <div className="col-span-6 rounded-xl bg-surface border border-slate-800 p-5">
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
          
          <div className="col-span-6 flex flex-col gap-4">
            {/* 7. DEPLOY PATROLS CTA */}
            {stats && stats.latestRisk >= 60 && (
              <div className="rounded-xl bg-critical/5 border border-critical/30 p-6 flex flex-col justify-center h-full gap-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 p-2.5 rounded-xl bg-critical/15">
                    <Siren size={32} strokeWidth={1.5} className="text-critical gauge-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-text-primary">
                      Elevated Risk Detected — {selectedDistrict}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      AI forecasts {stats.deviation}% deviation from baseline. Recommend preventive action.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDeployPatrols}
                  className="w-full mt-4 py-3 rounded-lg text-sm font-semibold bg-accent-gold text-background hover:bg-accent-gold/90 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <Shield size={18} strokeWidth={2} />
                  Deploy Patrols & Generate Brief
                </button>
              </div>
            )}
            {stats && stats.latestRisk < 60 && (
              <div className="rounded-xl bg-clear/5 border border-clear/20 p-6 flex flex-col justify-center h-full gap-4">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 p-2.5 rounded-xl bg-clear/15">
                    <Shield size={32} strokeWidth={1.5} className="text-clear" />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-text-primary">
                      Risk Within Normal Range — {selectedDistrict}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      No proactive deployment recommended at this time.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ═══════ DEPLOY PATROLS TOAST ═══════ */}
      {deployToast.visible && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-clear/90 shadow-2xl border border-clear/40">
            {deployToast.loadingPdf ? (
              <Activity size={20} strokeWidth={2} className="text-white shrink-0 animate-pulse" />
            ) : (
              <CheckCircle size={20} strokeWidth={2} className="text-white shrink-0" />
            )}
            <div className="pr-4">
              <p className="text-sm font-semibold text-white">
                Patrol Units Notified
              </p>
              <p className="text-xs text-white/80 mt-0.5">
                Preventive patrol deployed to {deployToast.district}. Est. response: 15 minutes.
              </p>
              {deployToast.loadingPdf && (
                <p className="text-[10px] text-accent-gold mt-1 animate-pulse">
                  Generating AI Intelligence Brief...
                </p>
              )}
              {deployToast.downloadUrl && !deployToast.loadingPdf && (
                <a 
                  href={deployToast.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 text-xs font-semibold bg-white text-clear px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
                >
                  Download AI Brief (PDF)
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
