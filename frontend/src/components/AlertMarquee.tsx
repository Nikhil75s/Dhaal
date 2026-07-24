import { useEffect, useRef, useState, useMemo } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';
import { fetchAnomalies } from '../data/api';
import type { Anomaly } from '../data/schemas';

/**
 * AlertMarquee — Scrolling ticker of high-priority anomaly alerts.
 * Pulls from the LIVE anomaly API. Displays a red-accented horizontal
 * scroller at the top of the Predictive Dashboard for real-time urgency.
 */
export default function AlertMarquee() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnomalies()
      .then((data) => {
        if (!cancelled) {
          setAnomalies(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Sort: high severity first
  const sortedAnomalies = useMemo(() => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...anomalies].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }, [anomalies]);

  if (loading) {
    return (
      <div className="w-full h-10 bg-critical/5 border border-critical/20 rounded-lg flex items-center justify-center gap-2">
        <Loader size={12} className="animate-spin text-critical" />
        <span className="text-xs text-gray-400">Loading alerts...</span>
      </div>
    );
  }

  if (sortedAnomalies.length === 0) {
    return (
      <div className="w-full h-10 bg-clear/5 border border-clear/20 rounded-lg flex items-center justify-center gap-2">
        <span className="text-xs text-clear">✓ No active anomaly alerts</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-critical/30 bg-critical/5 relative">
      {/* Fixed label */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-1.5 px-3 bg-critical/90 rounded-l-lg">
        <AlertTriangle size={12} strokeWidth={2} className="text-white" />
        <span className="text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
          ALERT
        </span>
      </div>

      {/* Scrolling content */}
      <div className="overflow-hidden pl-20" ref={scrollRef}>
        <div className="marquee-scroll flex items-center gap-8 py-2.5 whitespace-nowrap">
          {/* Duplicate content for seamless loop */}
          {[...sortedAnomalies, ...sortedAnomalies].map((anomaly, i) => (
            <span key={`${anomaly.id}-${i}`} className="inline-flex items-center gap-2">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  anomaly.severity === 'high'
                    ? 'bg-critical animate-pulse'
                    : anomaly.severity === 'medium'
                    ? 'bg-warning'
                    : 'bg-clear'
                }`}
              />
              <span className="text-xs text-gray-100 font-medium">
                {anomaly.district}:
              </span>
              <span className="text-xs text-gray-400">
                {anomaly.description}
              </span>
              <span className="text-xs text-gray-400 opacity-40 mx-2">│</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

