import { useState, useEffect, useCallback } from 'react';
import { X, Download, Loader, CheckCircle, RefreshCw } from 'lucide-react';
import { fetchAnomalies, generatePdfBrief } from '../data/api';
import type { Anomaly } from '../data/schemas';

type PdfState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Hook that manages anomaly data and PDF generation state.
 * Markers are rendered inside CrimeMap; this component renders the detail panel.
 */
export function useAnomalies() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAnomalies();
        if (!cancelled) setAnomalies(data);
      } catch (err) {
        console.error('Failed to fetch anomalies:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { anomalies, loading };
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'high': return '#EF4444';
    case 'medium': return '#F59E0B';
    default: return '#10B981';
  }
}

interface AnomalyDetailPanelProps {
  anomalies: Anomaly[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function AnomalyDetailPanel({ anomalies, selectedId, onSelect }: AnomalyDetailPanelProps) {
  const [pdfStates, setPdfStates] = useState<Record<string, PdfState>>({});

  const handleGeneratePdf = useCallback(async (anomalyId: string) => {
    setPdfStates((prev) => ({ ...prev, [anomalyId]: 'loading' }));

    try {
      const url = await generatePdfBrief(anomalyId);
      setPdfStates((prev) => ({ ...prev, [anomalyId]: 'success' }));
      window.open(url, '_blank');
    } catch {
      setPdfStates((prev) => ({ ...prev, [anomalyId]: 'error' }));
    }
  }, []);

  if (!selectedId) return null;

  const anomaly = anomalies.find((a) => a.id === selectedId);
  if (!anomaly) return null;

  const pdfState = pdfStates[anomaly.id] || 'idle';

  return (
    <div className="absolute top-20 right-4 z-30 w-80 p-4 rounded-xl glass">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: severityColor(anomaly.severity) }}
            />
            <span className="text-sm font-medium text-text-primary">
              {anomaly.district}
            </span>
          </div>
          <span
            className="text-xs font-medium uppercase"
            style={{ color: severityColor(anomaly.severity) }}
          >
            {anomaly.severity} severity — +{anomaly.spikePercentage}%
          </span>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        {anomaly.description}
      </p>

      {/* PDF Generation Button */}
      <button
        onClick={() => handleGeneratePdf(anomaly.id)}
        disabled={pdfState === 'loading'}
        className={`
          w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium
          transition-all duration-200 cursor-pointer
          ${pdfState === 'error'
            ? 'bg-critical/20 text-critical hover:bg-critical/30'
            : pdfState === 'success'
            ? 'bg-clear/20 text-clear'
            : 'bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {pdfState === 'idle' && <><Download size={14} /> Download Intelligence Brief</>}
        {pdfState === 'loading' && <><Loader size={14} className="animate-spin" /> Generating PDF…</>}
        {pdfState === 'success' && <><CheckCircle size={14} /> PDF Generated</>}
        {pdfState === 'error' && <><RefreshCw size={14} /> Retry — Generation Failed</>}
      </button>
    </div>
  );
}
