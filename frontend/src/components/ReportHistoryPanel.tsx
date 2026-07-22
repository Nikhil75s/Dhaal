import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  AlertTriangle,
  Loader,
  Clock,
  Shield,
  FileWarning,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { fetchReportHistory, fetchAnomalies, generatePdfBrief } from '../data/api';
import type { ReportHistoryItem, Anomaly } from '../data/schemas';

type GenerateState = 'idle' | 'generating' | 'success' | 'error';

/**
 * ReportHistoryPanel — Intelligence brief history + "Generate New Brief" capability.
 * Displays past PDF reports from the reports_api and allows generating new ones
 * from active anomaly alerts via the pdf_generator_api.
 */
export default function ReportHistoryPanel() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate brief state
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);
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
      setGenerateError(null);
      setSelectedAnomaly(anomaly.id);

      try {
        const url = await generatePdfBrief({
          districtName: anomaly.district,
          message: anomaly.description,
          severity: anomaly.severity.toUpperCase(),
        });
        setLastGeneratedUrl(url);
        setGenerateState('success');
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : 'Generation failed');
        setGenerateState('error');
      }
    },
    []
  );

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-critical/15 text-critical border-critical/30',
      medium: 'bg-warning/15 text-warning border-warning/30',
      low: 'bg-clear/15 text-clear border-clear/30',
    };
    return colors[severity.toLowerCase()] ?? colors.low;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <Loader size={20} strokeWidth={1.5} className="animate-spin" />
          <span className="text-sm">Loading intelligence briefs...</span>
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
      <div>
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <FileText size={20} strokeWidth={1.5} className="text-accent-gold" />
          Intelligence Briefs
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          AI-generated reports from anomaly detection — powered by Catalyst SmartBrowz
        </p>
      </div>

      {/* Generate New Brief Section */}
      <div className="rounded-xl bg-surface border border-slate-800 p-5">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-4">
          <Sparkles size={16} strokeWidth={1.5} className="text-accent-gold" />
          Generate New Intelligence Brief
        </h3>

        {anomalies.length === 0 ? (
          <div className="text-center py-6">
            <Shield size={32} strokeWidth={1} className="text-clear mx-auto mb-3 opacity-50" />
            <p className="text-sm text-text-secondary">No active anomalies detected</p>
            <p className="text-xs text-text-secondary mt-1">
              Briefs are generated from detected crime spikes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-background/50 border border-slate-800/50 hover:border-slate-700 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-critical animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">
                    {anomaly.district}
                  </p>
                  <p className="text-xs text-text-secondary truncate">{anomaly.description}</p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${severityBadge(
                    anomaly.severity
                  )}`}
                >
                  {anomaly.severity.toUpperCase()}
                </span>
                <button
                  onClick={() => handleGenerate(anomaly)}
                  disabled={generateState === 'generating' && selectedAnomaly === anomaly.id}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {generateState === 'generating' && selectedAnomaly === anomaly.id ? (
                    <>
                      <Loader size={12} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText size={12} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Generation result banner */}
        {generateState === 'success' && lastGeneratedUrl && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-clear/10 border border-clear/30">
            <Download size={16} className="text-clear shrink-0" />
            <p className="text-sm text-clear flex-1">Brief generated successfully!</p>
            <a
              href={lastGeneratedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-clear hover:text-clear/80 flex items-center gap-1 underline"
            >
              Download <ExternalLink size={10} />
            </a>
          </div>
        )}
        {generateState === 'error' && generateError && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-critical/10 border border-critical/30">
            <AlertTriangle size={16} className="text-critical shrink-0" />
            <p className="text-sm text-critical flex-1">{generateError}</p>
          </div>
        )}
      </div>

      {/* Report History */}
      <div className="rounded-xl bg-surface border border-slate-800 p-5">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2 mb-4">
          <Clock size={16} strokeWidth={1.5} className="text-text-secondary" />
          Report History
          <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-800 text-xs text-text-secondary">
            {reports.length}
          </span>
        </h3>

        {reports.length === 0 ? (
          <div className="text-center py-8">
            <FileWarning
              size={36}
              strokeWidth={1}
              className="text-text-secondary opacity-30 mx-auto mb-3"
            />
            <p className="text-sm text-text-secondary">No intelligence briefs generated yet</p>
            <p className="text-xs text-text-secondary mt-1">
              Generate a brief from an active anomaly above to get started
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {reports.map((report) => (
              <a
                key={report.id}
                href={report.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800/30 transition-colors group"
              >
                <FileText
                  size={16}
                  strokeWidth={1.5}
                  className="text-accent-gold shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium group-hover:text-accent-gold transition-colors truncate">
                    {report.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {report.district} · {report.date}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${severityBadge(
                    report.severity
                  )}`}
                >
                  {report.severity.toUpperCase()}
                </span>
                <Download
                  size={14}
                  className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="rounded-lg bg-accent-blue/5 border border-accent-blue/20 px-4 py-3">
        <p className="text-xs text-text-secondary">
          <span className="text-accent-blue font-medium">Note:</span> PDF generation uses Catalyst
          SmartBrowz templates. Reports are persisted to Catalyst Data Store for historical access.
          The AI predictions endpoint is pending OAuth configuration.
        </p>
      </div>
    </div>
  );
}
