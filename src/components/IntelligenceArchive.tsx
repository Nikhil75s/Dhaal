import { useState, useEffect } from 'react';
import { Download, Loader, AlertCircle, FileX } from 'lucide-react';
import { fetchReportHistory } from '../data/api';
import type { ReportHistoryItem } from '../data/schemas';

const SEVERITY_STYLES: Record<string, string> = {
  high: 'text-critical',
  medium: 'text-warning',
  low: 'text-clear',
};

export default function IntelligenceArchive() {
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchReportHistory();
        if (!cancelled) setReports(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDownload = async (url: string, title: string) => {
    try {
      window.open(url, '_blank');
    } catch {
      // Graceful handling — no unhandled errors on dead PDF links
      alert(`Unable to download: "${title}". The link may have expired.`);
    }
  };

  return (
    <div className="w-full h-full overflow-auto p-8">
      {/* Page title — no subtitle under obvious headers */}
      <h1 className="text-2xl font-semibold text-text-primary mb-8">Intelligence Archive</h1>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader size={28} className="text-accent-gold animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-critical/10 text-critical text-sm mb-6">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <FileX size={40} strokeWidth={1} className="mb-4 opacity-40" />
          <p className="text-sm">No reports available</p>
        </div>
      )}

      {/* Report table */}
      {!loading && !error && reports.length > 0 && (
        <div className="w-full">
          {/* Table header */}
          <div className="grid grid-cols-[140px_100px_1fr_200px_48px] gap-4 px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider">
            <span>Date</span>
            <span>Severity</span>
            <span>District</span>
            <span>Title</span>
            <span />
          </div>

          {/* Table rows — borderless, zebra striping */}
          {reports.map((report, i) => (
            <div
              key={report.id}
              className={`
                grid grid-cols-[140px_100px_1fr_200px_48px] gap-4 items-center px-4 py-3 rounded-lg
                transition-colors duration-150
                ${i % 2 === 1 ? 'bg-slate-900/50' : ''}
                hover:bg-slate-800/40
              `}
            >
              <span className="text-sm text-text-primary tabular-nums">{report.date}</span>

              <span className={`text-xs font-medium uppercase ${SEVERITY_STYLES[report.severity]}`}>
                {report.severity}
              </span>

              <span className="text-sm text-text-primary">{report.district}</span>

              <span className="text-sm text-text-secondary truncate">{report.title}</span>

              <button
                onClick={() => handleDownload(report.pdfUrl, report.title)}
                title="Download PDF"
                className="text-text-secondary hover:text-accent-blue transition-colors cursor-pointer"
              >
                <Download size={16} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
