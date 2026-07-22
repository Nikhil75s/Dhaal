import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  ChevronDown,
  BarChart3,
  Radar as RadarIcon,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { fetchSocioEconomic } from '../data/api';
import type { SocioEconomicRecord } from '../data/schemas';
import { districtIdToName } from '../utils/districts';

type ChartMode = 'bar' | 'radar';
type Indicator = 'urbanizationIndex' | 'povertyIndex' | 'populationDensity';

const INDICATOR_CONFIG: Record<Indicator, { label: string; color: string; format: (v: number) => string }> = {
  urbanizationIndex: {
    label: 'Urbanization Index',
    color: '#3B82F6',
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  povertyIndex: {
    label: 'Poverty Index',
    color: '#EF4444',
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  populationDensity: {
    label: 'Population Density',
    color: '#D4AF37',
    format: (v) => v.toLocaleString(),
  },
};

/**
 * SocioEconomicPanel — Visualizes district-level socio-economic indicators
 * fetched from the live Catalyst API. Provides bar chart and radar chart views
 * with interactive district highlighting and statistical summaries.
 */
export default function SocioEconomicPanel() {
  const [data, setData] = useState<SocioEconomicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [indicator, setIndicator] = useState<Indicator>('urbanizationIndex');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSocioEconomic()
      .then((result) => {
        if (!cancelled) {
          setData(result);
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

  // Transform data for charts — add district names and parse population density
  const chartData = useMemo(() => {
    return data
      .map((d) => ({
        ...d,
        name: districtIdToName(d.districtId),
        shortName: districtIdToName(d.districtId).substring(0, 10),
        populationDensityNum: parseInt(d.populationDensity, 10) || 0,
      }))
      .sort((a, b) => {
        if (indicator === 'populationDensity') {
          return b.populationDensityNum - a.populationDensityNum;
        }
        return (b[indicator] as number) - (a[indicator] as number);
      });
  }, [data, indicator]);

  // Stats
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;

    const values = chartData.map((d) =>
      indicator === 'populationDensity' ? d.populationDensityNum : d[indicator]
    );
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxDistrict = chartData[0]?.name ?? '';
    const minDistrict = chartData[chartData.length - 1]?.name ?? '';

    return { avg, max, min, maxDistrict, minDistrict, total: values.length };
  }, [chartData, indicator]);

  // Radar data for selected district
  const radarData = useMemo(() => {
    if (!selectedDistrict) {
      // Show top 5 districts
      return chartData.slice(0, 5).map((d) => ({
        name: d.shortName,
        urbanization: d.urbanizationIndex * 100,
        poverty: d.povertyIndex * 100,
        density: Math.min(d.populationDensityNum / 150, 100), // Normalize for radar
      }));
    }
    const d = chartData.find((x) => x.districtId === selectedDistrict);
    if (!d) return [];
    return [{
      name: d.shortName,
      urbanization: d.urbanizationIndex * 100,
      poverty: d.povertyIndex * 100,
      density: Math.min(d.populationDensityNum / 150, 100),
    }];
  }, [chartData, selectedDistrict]);

  const cfg = INDICATOR_CONFIG[indicator];

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <Activity size={20} strokeWidth={1.5} className="animate-pulse" />
          <span className="text-sm">Loading socio-economic data...</span>
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
    <div className="w-full h-full overflow-y-auto p-6 space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp size={20} strokeWidth={1.5} className="text-accent-gold" />
            Socio-Economic Indicators
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            District-level correlation data from {data.length} Karnataka districts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chart mode toggle */}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setChartMode('bar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                chartMode === 'bar'
                  ? 'bg-accent-blue/20 text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <BarChart3 size={14} />
            </button>
            <button
              onClick={() => setChartMode('radar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                chartMode === 'radar'
                  ? 'bg-accent-blue/20 text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <RadarIcon size={14} />
            </button>
          </div>

          {/* Indicator selector */}
          <div className="relative">
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value as Indicator)}
              className="appearance-none bg-surface text-text-primary text-sm pl-3 pr-8 py-2 rounded-lg border border-slate-700 focus:border-accent-blue focus:outline-none cursor-pointer"
            >
              {Object.entries(INDICATOR_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">Districts</p>
            <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">State Avg</p>
            <p className="text-2xl font-bold text-accent-blue">
              {indicator === 'populationDensity'
                ? Math.round(stats.avg).toLocaleString()
                : `${(stats.avg * 100).toFixed(0)}%`}
            </p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpRight size={12} className="text-accent-gold" /> Highest
            </p>
            <p className="text-lg font-bold text-accent-gold">{stats.maxDistrict}</p>
            <p className="text-xs text-text-secondary">{cfg.format(stats.max)}</p>
          </div>
          <div className="rounded-xl bg-surface p-4 border border-slate-800">
            <p className="text-xs text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowDownRight size={12} className="text-clear" /> Lowest
            </p>
            <p className="text-lg font-bold text-clear">{stats.minDistrict}</p>
            <p className="text-xs text-text-secondary">{cfg.format(stats.min)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl bg-surface border border-slate-800 p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">
          {cfg.label} — All Districts
        </h3>

        {chartMode === 'bar' ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="shortName"
                stroke="#9CA3AF"
                fontSize={9}
                tickLine={false}
                axisLine={{ stroke: '#1f2937' }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1f2937' }}
                tickFormatter={(v) =>
                  indicator === 'populationDensity'
                    ? v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    : `${(v * 100).toFixed(0)}%`
                }
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
                formatter={(value) => [
                  indicator === 'populationDensity'
                    ? Number(value).toLocaleString()
                    : `${(Number(value) * 100).toFixed(1)}%`,
                  cfg.label,
                ]}
                labelFormatter={(label) => {
                  const d = chartData.find((x) => x.shortName === label);
                  return d?.name ?? label;
                }}
              />
              <Bar
                dataKey={indicator === 'populationDensity' ? 'populationDensityNum' : indicator}
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      selectedDistrict === entry.districtId
                        ? '#D4AF37'
                        : cfg.color
                    }
                    fillOpacity={selectedDistrict && selectedDistrict !== entry.districtId ? 0.3 : 0.85}
                    cursor="pointer"
                    onClick={() =>
                      setSelectedDistrict(
                        selectedDistrict === entry.districtId ? null : entry.districtId
                      )
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1f2937" />
              <PolarAngleAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                stroke="#374151"
                fontSize={10}
              />
              <Radar
                name="Urbanization"
                dataKey="urbanization"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.2}
              />
              <Radar
                name="Poverty"
                dataKey="poverty"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.15}
              />
              <Radar
                name="Density"
                dataKey="density"
                stroke="#D4AF37"
                fill="#D4AF37"
                fillOpacity={0.1}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F3F4F6',
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* District Ranking Table */}
      <div className="rounded-xl bg-surface border border-slate-800 p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">
          District Rankings — {cfg.label}
        </h3>
        <div className="space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
          {chartData.map((d, i) => {
            const value = indicator === 'populationDensity' ? d.populationDensityNum : d[indicator];
            const maxValue = indicator === 'populationDensity'
              ? chartData[0]?.populationDensityNum ?? 1
              : (chartData[0]?.[indicator] ?? 1) as number;
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

            return (
              <button
                key={d.districtId}
                onClick={() =>
                  setSelectedDistrict(
                    selectedDistrict === d.districtId ? null : d.districtId
                  )
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                  selectedDistrict === d.districtId
                    ? 'bg-accent-gold/10 border border-accent-gold/30'
                    : 'hover:bg-slate-800/30 border border-transparent'
                }`}
              >
                <span className="w-6 text-xs text-text-secondary font-mono text-right">
                  {i + 1}.
                </span>
                <span className="flex-1 text-sm text-text-primary text-left truncate">
                  {d.name}
                </span>
                <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: cfg.color,
                      opacity: selectedDistrict && selectedDistrict !== d.districtId ? 0.3 : 1,
                    }}
                  />
                </div>
                <span className="w-16 text-xs text-text-secondary text-right font-mono">
                  {cfg.format(value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-accent-blue/5 border border-accent-blue/20 px-4 py-3">
        <p className="text-xs text-text-secondary">
          <span className="text-accent-blue font-medium">Live Data:</span> Indicators sourced
          from Catalyst socio-economic API. Click bars or rows to highlight individual districts.
          Use radar view to compare multiple indicators simultaneously.
        </p>
      </div>
    </div>
  );
}
