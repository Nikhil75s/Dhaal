import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  AlertTriangle,
  Loader,
  Clock,
  Shield,
  FileWarning,
  Sparkles,
  MapPin
} from 'lucide-react';
import { fetchReportHistory, fetchAnomalies, generatePdfBrief } from '../data/api';
import type { ReportHistoryItem, Anomaly } from '../data/schemas';
import { districtIdToName } from '../utils/districts';
import { DistrictDropdown } from './common/DistrictDropdown';
import { DateRangeDropdown } from './common/DateRangeDropdown';

type GenerateState = 'idle' | 'generating' | 'success' | 'error';

export default function ReportHistoryPanel() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local Filters (Decoupled from global map context)
  const [localDistrictId, setLocalDistrictId] = useState<string | null>(null);
  const [localStartDate, setLocalStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [localEndDate, setLocalEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchReportHistory(), fetchAnomalies()])
      .then(([reportData, anomalyData]) => {
        if (!cancelled) {
          setReports(reportData);
          setAnomalies(anomalyData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  const handleGenerate = useCallback(
    async (anomaly: Anomaly) => {
      setGenerateState('generating');
      setSelectedAnomaly(anomaly.id);

      try {
        const distIdMatch = anomaly.id.match(/anomaly-(\d+)-/);
        const districtId = distIdMatch ? parseInt(distIdMatch[1], 10) : 0;
        
        const url = await generatePdfBrief({
          districtName: anomaly.district,
          districtId: districtId,
          message: anomaly.description,
          severity: anomaly.severity.toUpperCase(),
        });
        setGenerateState('success');
        
        // Optimistically add it to reports
        setReports(prev => [{
          id: `new-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          severity: anomaly.severity,
          district: anomaly.district,
          title: anomaly.description,
          pdfUrl: url
        }, ...prev]);
        
      } catch (err) {
        setGenerateState('error');
      }
    },
    []
  );

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-500/20 text-red-400',
      medium: 'bg-amber-500/20 text-amber-400',
      low: 'bg-emerald-500/20 text-emerald-400',
    };
    return colors[severity.toLowerCase()] ?? colors.low;
  };

  // Filter by currently selected district
  const selectedDistrictName = localDistrictId ? districtIdToName(localDistrictId) : null;
  
  const filteredAnomalies = useMemo(() => {
    let result = anomalies;
    if (selectedDistrictName) {
      result = result.filter(a => a.district === selectedDistrictName);
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (localStartDate && todayStr < localStartDate) return [];
    if (localEndDate && todayStr > localEndDate) return [];
    
    return result;
  }, [anomalies, selectedDistrictName, localStartDate, localEndDate]);

  const isTodayInRange = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (localStartDate && todayStr < localStartDate) return false;
    if (localEndDate && todayStr > localEndDate) return false;
    return true;
  }, [localStartDate, localEndDate]);

  const filteredReports = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return reports.filter(r => {
      if (r.date === today) return false;
      if (selectedDistrictName && r.district !== selectedDistrictName) return false;
      if (localStartDate && r.date < localStartDate) return false;
      if (localEndDate && r.date > localEndDate) return false;
      return true;
    });
  }, [reports, selectedDistrictName, localStartDate, localEndDate]);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col bg-[#10141f] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <Loader size={32} strokeWidth={1.5} className="animate-spin text-khaki" />
          <span className="text-sm font-medium tracking-wide">Syncing Intelligence...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col bg-[#10141f] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-red-950/20 border border-red-900/30 max-w-md text-center">
          <AlertTriangle size={32} strokeWidth={1.5} className="text-red-400" />
          <span className="text-sm font-medium text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#10141f] overflow-y-auto custom-scrollbar text-gray-200">
      
      {/* Header Area */}
      <div className="px-8 pt-8 pb-6 flex items-center justify-between sticky top-0 bg-[#10141f]/95 backdrop-blur-md z-50 border-b border-white/5 shadow-2xl shadow-black/50">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <FileText className="text-khaki" size={24} />
            Intelligence Briefs
          </h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
            <Sparkles size={14} className="text-khaki/70" />
            AI-generated tactical reports based on emerging geospatial anomalies
          </p>
        </div>
        
        {/* Local Filters for Reports only */}
        <div className="flex items-center space-x-3">
          <DistrictDropdown 
            value={localDistrictId} 
            onChange={setLocalDistrictId} 
          />
          <DateRangeDropdown 
            startDate={localStartDate}
            endDate={localEndDate}
            onChangeStart={setLocalStartDate}
            onChangeEnd={setLocalEndDate}
          />
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-6xl mx-auto">
        
        {/* Active Threats (Anomalies) */}
        {isTodayInRange && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-100 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                Actionable Threat Vectors
              </h3>
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-300">
                {filteredAnomalies.length} Detected
              </span>
            </div>

          {filteredAnomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl bg-[#1E293B]/30 border border-dashed border-white/10">
              <Shield size={48} strokeWidth={1} className="text-emerald-500/50 mb-4" />
              <p className="text-gray-300 font-medium">No Active Anomalies</p>
              <p className="text-sm text-gray-500 mt-1">Sector is currently stable within historical baselines.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAnomalies.map((anomaly) => {
                // Check if this anomaly already has a matching report generated today by EXACT description
                const today = new Date().toISOString().split('T')[0];
                const hasReport = reports.some(r => r.district === anomaly.district && r.title === anomaly.description && r.date === today);
                
                const existingReportUrl = hasReport ? reports.find(r => r.district === anomaly.district && r.title === anomaly.description && r.date === today)?.pdfUrl : null;

                return (
                  <div
                    key={anomaly.id}
                    className="flex flex-col gap-4 p-6 rounded-2xl bg-[#1E293B]/40 hover:bg-[#1E293B]/60 transition-colors duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <h4 className="text-[17px] font-medium text-gray-100 flex items-center gap-2">
                          {anomaly.district}
                        </h4>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ml-2 ${severityBadge(anomaly.severity)}`}>
                          {anomaly.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        Detected Today
                      </div>
                    </div>
                    
                    <p className="text-[15px] text-gray-300 leading-relaxed pl-5">
                      {anomaly.description}
                    </p>

                    <div className="flex items-center justify-end mt-2">
                      {existingReportUrl ? (
                        <a
                          href={existingReportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-khaki/10 text-khaki font-medium rounded-lg hover:bg-khaki/20 transition-colors text-sm"
                        >
                          <Download size={16} /> Download Brief
                        </a>
                      ) : (
                        <button
                          onClick={() => handleGenerate(anomaly)}
                          disabled={generateState === 'generating'}
                          className="flex items-center gap-2 px-4 py-2 bg-khaki/5 text-khaki font-medium rounded-lg hover:bg-khaki/15 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generateState === 'generating' && selectedAnomaly === anomaly.id ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <FileText size={16} /> Generate Brief
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* Report Archives */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-medium text-gray-100 flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Intelligence Archives
            </h3>
            <div className="h-px bg-white/10 flex-1 ml-4" />
          </div>

          {filteredReports.length === 0 ? (
            <div className="text-center py-10">
              <FileWarning size={32} strokeWidth={1} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No archived briefs for this sector</p>
            </div>
          ) : (
            <div className="bg-[#1E293B]/20 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              <div className="divide-y divide-white/5">
                {filteredReports.map((report) => (
                  <a
                    key={report.id}
                    href={report.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors group"
                  >
                    <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                      <FileText size={20} strokeWidth={1.5} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors truncate flex items-center gap-2">
                        {report.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin size={12}/> {report.district}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                        <span className="flex items-center gap-1"><Clock size={12}/> {report.date}</span>
                      </div>
                    </div>

                    <span className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${severityBadge(report.severity)}`}>
                      {report.severity}
                    </span>
                    
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-white/10 group-hover:text-white transition-all ml-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0">
                      <Download size={14} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
