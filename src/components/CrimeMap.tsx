import { useState, useEffect, useCallback, useRef } from 'react';
import MapGL, {
  Source,
  Layer,
  Marker,
  type ViewStateChangeEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDashboardStore } from '../store/dashboardStore';
import { fetchClusters } from '../data/api';
import type { ClusterPoint } from '../data/schemas';
import { parseISO, isBefore, isEqual } from 'date-fns';
import { Loader, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAnomalies, severityColor } from './AnomalyAlertOverlay';
import AnomalyDetailPanel from './AnomalyAlertOverlay';

// Free CartoDB Dark Matter tiles — no API key
const FREE_DARK_STYLE = {
  version: 8 as const,
  sources: {
    'carto-dark-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster' as const,
      source: 'carto-dark-tiles',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// Color scale for cluster intensity
function getClusterColor(count: number): string {
  if (count >= 20) return '#EF4444';
  if (count >= 10) return '#F59E0B';
  if (count >= 5) return '#3B82F6';
  return '#10B981';
}

function getClusterRadius(count: number): number {
  if (count >= 20) return 14;
  if (count >= 10) return 11;
  if (count >= 5) return 8;
  return 6;
}

interface CrimeMapProps {
  halfWidth?: boolean;
  showAnomalies?: boolean;
  onViewStateChange?: (viewState: ViewStateChangeEvent) => void;
  syncViewState?: { longitude: number; latitude: number; zoom: number };
}

export default function CrimeMap({ halfWidth, showAnomalies = true, onViewStateChange, syncViewState }: CrimeMapProps) {
  const filters = useDashboardStore((s) => s.filters);
  const currentDate = useDashboardStore((s) => s.currentDate);
  const selectedDistrict = useDashboardStore((s) => s.selectedDistrict);
  const setSelectedDistrict = useDashboardStore((s) => s.setSelectedDistrict);

  const [clusters, setClusters] = useState<ClusterPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);

  // Anomaly data
  const { anomalies } = useAnomalies();

  // Fetch cluster data
  const loadClusters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClusters(filters.dateRange, filters.crimeCategory);
      setClusters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cluster data');
    } finally {
      setLoading(false);
    }
  }, [filters.dateRange, filters.crimeCategory]);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  // Filter by currentDate for time-lapse
  const visibleClusters = clusters.filter((c) => {
    const d = parseISO(c.date);
    return isBefore(d, currentDate) || isEqual(d, currentDate);
  });

  // District filter
  const displayedClusters = selectedDistrict
    ? visibleClusters.filter((c) => c.district === selectedDistrict)
    : visibleClusters;

  // Click a cluster marker → drill down
  const handleMarkerClick = useCallback(
    (cluster: ClusterPoint) => {
      setSelectedDistrict(cluster.district);
      mapRef.current?.flyTo({
        center: [cluster.longitude, cluster.latitude],
        zoom: 10,
        duration: 1200,
      });
    },
    [setSelectedDistrict]
  );

  // Back to overview
  const handleBackToOverview = useCallback(() => {
    setSelectedDistrict(null);
    mapRef.current?.flyTo({
      center: [77.5946, 12.9716],
      zoom: 6,
      duration: 1200,
    });
  }, [setSelectedDistrict]);

  return (
    <div className={`relative ${halfWidth ? 'w-1/2' : 'w-full'} h-full bg-background`}>
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: 77.5946, latitude: 12.9716, zoom: 6 }}
        {...(syncViewState
          ? { longitude: syncViewState.longitude, latitude: syncViewState.latitude, zoom: syncViewState.zoom }
          : {}
        )}
        mapStyle={FREE_DARK_STYLE}
        onMove={onViewStateChange}
        style={{ width: '100%', height: '100%' }}
      >
        {/* GeoJSON source for heatmap layer */}
        <Source
          id="crime-heat"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: displayedClusters.map((c) => ({
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [c.longitude, c.latitude],
              },
              properties: { count: c.count, category: c.category, district: c.district },
            })),
          }}
        >
          <Layer
            id="crime-heatmap"
            type="heatmap"
            paint={{
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 1, 0.1, 25, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 9, 2],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 9, 25],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 0.3],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, '#10B981',
                0.4, '#3B82F6',
                0.6, '#F59E0B',
                0.8, '#EF4444',
                1, '#DC2626',
              ],
            }}
          />
        </Source>

        {/* Individual cluster markers */}
        {displayedClusters.map((cluster) => (
          <Marker
            key={cluster.id}
            longitude={cluster.longitude}
            latitude={cluster.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(cluster);
            }}
          >
            <div
              className="rounded-full cursor-pointer transition-transform hover:scale-125 border-2 border-background/50"
              style={{
                width: getClusterRadius(cluster.count) * 2,
                height: getClusterRadius(cluster.count) * 2,
                backgroundColor: getClusterColor(cluster.count),
                opacity: 0.85,
              }}
              title={`${cluster.district} — ${cluster.category}: ${cluster.count} cases`}
            />
          </Marker>
        ))}

        {/* Anomaly pulsing markers — rendered inside Map context */}
        {showAnomalies && anomalies.map((anomaly) => (
          <Marker
            key={`anomaly-${anomaly.id}`}
            longitude={anomaly.longitude}
            latitude={anomaly.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedAnomalyId(
                selectedAnomalyId === anomaly.id ? null : anomaly.id
              );
            }}
          >
            <div className="relative cursor-pointer" title={`${anomaly.district} — ${anomaly.severity} alert`}>
              {(anomaly.severity === 'high' || anomaly.severity === 'medium') && (
                <div
                  className="absolute rounded-full animate-pulse-ring"
                  style={{
                    width: 40,
                    height: 40,
                    left: -12,
                    top: -12,
                    backgroundColor: severityColor(anomaly.severity),
                  }}
                />
              )}
              <div
                className="w-4 h-4 rounded-full border-2 border-background"
                style={{ backgroundColor: severityColor(anomaly.severity) }}
              />
            </div>
          </Marker>
        ))}
      </MapGL>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <Loader size={28} className="text-accent-gold animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-lg bg-critical/20 text-critical text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Back to overview button */}
      {selectedDistrict && (
        <button
          onClick={handleBackToOverview}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg glass text-text-secondary hover:text-text-primary text-xs transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to overview
        </button>
      )}

      {/* Anomaly detail panel — outside the map, but in the same relative container */}
      {showAnomalies && (
        <AnomalyDetailPanel
          anomalies={anomalies}
          selectedId={selectedAnomalyId}
          onSelect={setSelectedAnomalyId}
        />
      )}
    </div>
  );
}
