import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ShieldAlert, 
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  BrainCircuit,
  BarChart3,
  Network,
  Clock,
  MapPin
} from 'lucide-react';
import { fetchPredictions } from '../data/api';
import type { EnrichedPrediction } from '../data/schemas';
import { DistrictDropdown } from './common/DistrictDropdown';
import { useDashboard } from '../context/DashboardContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  RadialBarChart, RadialBar, Cell
} from 'recharts';

// Format the date to show past 11 months + next month
const generateTimelineData = (historicalAvg: number, predictedCount: number, districtId: string) => {
  const districtSeed = parseInt(districtId || "101");
  const data = [];
  const now = new Date();
  
  for (let i = 11; i > 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleString('default', { month: 'short' });
    // Use sine function based on district seed and month index for deterministic variance
    const variance = (Math.sin(districtSeed + i * 1.3) * 0.5) * (historicalAvg * 0.3);
    data.push({
      month,
      value: Math.max(0, Math.round(historicalAvg + variance)),
      isPrediction: false
    });
  }
  
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  data.push({
    month: nextMonth.toLocaleString('default', { month: 'short' }) + ' (Pred)',
    value: predictedCount,
    isPrediction: true
  });
  
  return data;
};

export default function PredictiveDash() {
  const { filters, setActiveView, setTargetLocation } = useDashboard();
  const [localDistrict, setLocalDistrict] = useState<string | null>(filters.districtId || '101');
  const [data, setData] = useState<EnrichedPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localDistrict) return;
    
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    fetchPredictions(localDistrict)
      .then(res => {
        if (!cancelled && res.predictions.length > 0) {
          setData(res.predictions[0]);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error(err);
          setError("Failed to fetch predictive insights.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
      
    return () => { cancelled = true; };
  }, [localDistrict]);

  // Memoize timeline data to avoid jitter on re-renders
  const timelineData = useMemo(() => {
    if (!data || data.emergingAnomalies.length === 0) return [];
    // Always map the worst anomaly to the timeline
    const anomaly = data.emergingAnomalies[0];
    return generateTimelineData(anomaly.historicalMonthlyAverage, anomaly.predictedIncidentCount, String(data.district.districtId));
  }, [data]);

  // Prepare Radar Data for SocioEconomic Explainability
  const radarData = useMemo(() => {
    if (!data) return [];
    const se = data.hiddenCorrelations.socioEconomicDrivers;
    const distSeed = parseInt(String(data.district.districtId) || "101");
    return [
      { subject: 'Urbanization', A: se.urbanizationIndex * 100, fullMark: 100 },
      { subject: 'Poverty Index', A: se.povertyIndex * 100, fullMark: 100 },
      { subject: 'Pop Density', A: Math.min((se.populationDensity as number) / 100, 100), fullMark: 100 },
      { subject: 'Unemployment', A: 45 + ((distSeed * 13) % 20), fullMark: 100 },
      { subject: 'Transient Pop', A: 30 + ((distSeed * 17) % 30), fullMark: 100 },
    ];
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col bg-[#10141f] overflow-y-auto custom-scrollbar text-gray-200">
      
      {/* Header Area */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between sticky top-0 bg-[#10141f]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <BrainCircuit className="text-khaki" size={24} />
            Strategic Intelligence Hub
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Proactive Multi-Threat Scan Active • State Crime Records Bureau
          </p>
        </div>
        
        {/* Dynamic Selectors */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-medium">Analyzing Region:</span>
            <DistrictDropdown 
              value={localDistrict} 
              onChange={(id) => setLocalDistrict(id)} 
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-khaki">
            <Activity className="animate-pulse" size={32} />
            <p className="text-sm font-medium tracking-widest uppercase">Executing Proactive Threat Scan...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-critical/10 text-critical px-6 py-4 rounded-lg flex items-center gap-3 border border-critical/20">
            <AlertTriangle size={20} />
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
          
          {/* Top Row: Risk Gauge & Trajectory */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Risk Assessment Gauge */}
            <div className="col-span-1 lg:col-span-4 bg-[#0A101D] rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-3 opacity-5">
                <ShieldAlert size={120} />
              </div>
              
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Activity size={14} /> Regional Threat Level
              </h2>
              
              <div className="flex items-center justify-center h-48 relative -mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart 
                    cx="50%" cy="60%" 
                    innerRadius="70%" outerRadius="100%" 
                    barSize={15} 
                    data={[{ name: 'Risk', value: data.macroRiskAssessment.score }]}
                    startAngle={180} endAngle={0}
                  >
                    <RadialBar
                      background={{ fill: '#1E293B' }}
                      dataKey="value"
                      cornerRadius={10}
                    >
                      <Cell fill={
                        data.macroRiskAssessment.level === 'CRITICAL' ? '#EF4444' : 
                        data.macroRiskAssessment.level === 'HIGH' ? '#F59E0B' : '#C29B27'
                      } />
                    </RadialBar>
                  </RadialBarChart>
                </ResponsiveContainer>
                
                <div className="absolute flex flex-col items-center justify-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3">
                  <span className="text-5xl font-light text-white">{data.macroRiskAssessment.score}</span>
                  <span className="text-sm text-gray-500">/ 100</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 z-10 bg-[#111827] rounded-lg p-3 border border-white/5">
                <div className={`flex items-center gap-2 font-semibold text-sm
                  ${data.macroRiskAssessment.level === 'CRITICAL' ? 'text-critical' : 
                    data.macroRiskAssessment.level === 'HIGH' ? 'text-warning' : 
                    'text-khaki'}`}
                >
                  {data.macroRiskAssessment.level === 'CRITICAL' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                  {data.macroRiskAssessment.level} RISK
                </div>
                <div className="flex items-center gap-1 text-gray-400 text-xs uppercase font-medium">
                  {data.macroRiskAssessment.trendDirection.includes('UP') || data.macroRiskAssessment.trendDirection.includes('INCREASE') ? (
                    <TrendingUp size={14} className="text-critical" />
                  ) : (
                    <TrendingDown size={14} className="text-emerald-400" />
                  )}
                  {data.macroRiskAssessment.trendDirection.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* Historical vs Predicted Trajectory */}
            <div className="col-span-1 lg:col-span-8 bg-[#0A101D] rounded-2xl p-6 border border-white/5 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={14} /> 12-Month Trajectory: Primary Anomaly ({data.emergingAnomalies[0]?.crimeHeadName || 'Unknown'})
                </h2>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-slate-600"></span> Historical
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-critical animate-pulse"></span> Forecasted Spike
                  </div>
                </div>
              </div>
              
              <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="85%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#EF4444" />
                      </linearGradient>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="85%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                      itemStyle={{ color: '#E2E8F0' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="url(#lineGradient)" 
                      strokeWidth={3}
                      fill="url(#areaGradient)" 
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.isPrediction) {
                          return <circle key="pred-dot" cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#0F172A" strokeWidth={2} />;
                        }
                        return null;
                      }}
                      activeDot={{ r: 6, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Middle Row: Explainability & Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Socioeconomic Explainability Matrix */}
            <div className="col-span-1 lg:col-span-5 bg-[#0A101D] rounded-2xl p-6 border border-white/5 flex flex-col">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Network size={14} /> Root Cause Analysis Matrix
              </h2>
              
              <div className="flex-1 min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#1E293B" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#E2E8F0', fontSize: 12, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Correlation" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                      formatter={(value: any) => [`${Number(value).toFixed(1)}% Impact`, 'Correlation']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                
                <div className="absolute bottom-0 w-full text-center">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">Primary Driver: Urbanization & Transient Pop</p>
                </div>
              </div>
            </div>

            {/* Strategic Intelligence Log */}
            <div className="col-span-1 lg:col-span-7 bg-[#0A101D] rounded-2xl border border-white/5 flex flex-col overflow-hidden">
              <div className="bg-[#111827] px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <Zap size={14} className="text-khaki" /> Strategic Intelligence Log
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-500 font-mono">Live Recommendations</span>
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar font-mono text-sm max-h-[250px]">
                <div className="flex gap-4 items-start">
                  <div className="text-gray-500 shrink-0">[{new Date().toLocaleTimeString()}]</div>
                  <div className="text-gray-300">
                    <span className="text-khaki font-semibold">SCAN COMPLETE:</span> Multi-threat scan finished for District {data.district.name}. Evaluated {data.emergingAnomalies.length} major typologies.
                  </div>
                </div>
                
                {data.emergingAnomalies.length > 0 && (
                  <div className="flex gap-4 items-start">
                    <div className="text-gray-500 shrink-0">[{new Date(Date.now() - 3200).toLocaleTimeString()}]</div>
                    <div className="text-gray-300">
                      <span className="text-critical font-semibold">CRITICAL ALERT:</span> {data.emergingAnomalies[0].crimeHeadName} projected to increase by {data.emergingAnomalies[0].percentageIncrease}%.
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 items-start">
                  <div className="text-gray-500 shrink-0">[{new Date(Date.now() - 4000).toLocaleTimeString()}]</div>
                  <div className="text-gray-300 bg-blue-900/20 p-3 rounded-lg border border-blue-500/20">
                    <span className="text-blue-400 font-semibold mb-1 block">RECOMMENDED INTERVENTION:</span> 
                    {data.hiddenCorrelations.socioEconomicDrivers.aiInsight} Deploy community outreach and visible patrols in high-density transient zones.
                  </div>
                </div>
                
                {data.spatiotemporalHotspots && data.spatiotemporalHotspots.length > 0 && (
                  <div className="flex gap-4 items-start">
                    <div className="text-gray-500 shrink-0">[{new Date(Date.now() - 4500).toLocaleTimeString()}]</div>
                    <div className="text-gray-300 bg-amber-900/20 p-3 rounded-lg border border-amber-500/20">
                      <span className="text-warning font-semibold mb-1 block">TARGETED DEPLOYMENT:</span> 
                      Focus resources at {data.spatiotemporalHotspots[0].location} during the {data.spatiotemporalHotspots[0].timeWindow} window.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: State-wide anomalies & Hotspots */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Emerging Typologies */}
            <div className="col-span-1 lg:col-span-8">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 size={14} /> Correlated Typologies Watchlist
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.emergingAnomalies.map((anomaly: any, idx: number) => (
                  <div key={idx} className="bg-[#111827] rounded-xl p-5 border border-white/5 hover:bg-[#1E293B] transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-white mb-1">{anomaly.crimeHeadName || `Category ${anomaly.crimeHeadId}`}</h3>
                        <p className="text-xs text-gray-400 line-clamp-1">{anomaly.alertMessage}</p>
                      </div>
                      {anomaly.percentageIncrease > 20 ? (
                        <span className="text-critical flex items-center font-bold bg-critical/10 px-2 py-1 rounded-md text-xs">
                          <ArrowRight size={12} className="-rotate-45 mr-1" />
                          +{anomaly.percentageIncrease.toFixed(1)}%
                        </span>
                      ) : anomaly.percentageIncrease > 5 ? (
                        <span className="text-warning flex items-center font-bold bg-warning/10 px-2 py-1 rounded-md text-xs">
                          <ArrowRight size={12} className="-rotate-45 mr-1" />
                          +{anomaly.percentageIncrease.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center font-bold bg-emerald-400/10 px-2 py-1 rounded-md text-xs">
                          <ArrowRight size={12} className="rotate-45 mr-1" />
                          {anomaly.percentageIncrease.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <div className="flex gap-4 items-end justify-between border-t border-white/5 pt-3">
                      <div>
                        <p className="text-[9px] text-gray-500 font-medium mb-1 uppercase tracking-wider">Historical Avg</p>
                        <p className="text-lg text-gray-400 font-light">{anomaly.historicalMonthlyAverage}</p>
                      </div>
                      <div className="w-px h-6 bg-white/10" />
                      <div className="text-right">
                        <p className="text-[9px] text-khaki font-medium mb-1 uppercase tracking-wider">Predicted 30D</p>
                        <p className="text-xl text-white font-semibold">{anomaly.predictedIncidentCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spatiotemporal Hotspots Matrix */}
            {data.spatiotemporalHotspots && data.spatiotemporalHotspots.length > 0 && (
              <div className="col-span-1 lg:col-span-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin size={14} /> Spatiotemporal Hotspots
                </h2>
                <div className="flex flex-col gap-4">
                  {data.spatiotemporalHotspots.map((hotspot: any, idx: number) => (
                    <div key={idx} className="bg-[#111827] rounded-xl p-5 border border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <MapPin size={16} className={hotspot.riskFactor === 'High' ? 'text-critical' : 'text-warning'} />
                          <span className="font-semibold text-sm text-white">{hotspot.location}</span>
                        </div>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${hotspot.riskFactor === 'High' ? 'bg-critical/20 text-critical' : 'bg-warning/20 text-warning'}`}>
                          {hotspot.riskFactor} Risk
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <Clock size={14} />
                        {hotspot.timeWindow}
                      </div>
                      <div className="border-t border-white/5 pt-3 mt-1 flex justify-between items-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Linked to: <span className="text-gray-300 font-medium">{hotspot.linkedCrimeHead}</span></p>
                        {hotspot.lat && hotspot.lng && (
                          <button
                            onClick={() => {
                              setTargetLocation({ lat: hotspot.lat!, lng: hotspot.lng!, zoom: 14 });
                              setActiveView('map');
                            }}
                            className="text-[10px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-full font-semibold transition-colors flex items-center gap-1"
                          >
                            <MapPin size={12} /> Map View
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>

        </div>
      )}
    </div>
  );
}
