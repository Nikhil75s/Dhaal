import { useState, useCallback } from 'react';
import MapGL, {
  Source,
  Layer,
  type ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mockSocioEconomicData } from '../data/mockData';

// Same free dark tiles as CrimeMap
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

// District approximate coords for socio-economic overlay
const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Bengaluru Urban':   [12.9716, 77.5946],
  'Bengaluru Rural':   [13.1986, 77.7066],
  'Mysuru':            [12.2958, 76.6394],
  'Mangaluru':         [12.9141, 74.8560],
  'Hubli-Dharwad':     [15.3647, 75.1240],
  'Belagavi':          [15.8497, 74.4977],
  'Kalaburagi':        [17.3297, 76.8343],
  'Tumakuru':          [13.3379, 77.1173],
  'Davanagere':        [14.4644, 75.9218],
  'Shivamogga':        [13.9299, 75.5681],
  'Raichur':           [16.2076, 77.3463],
  'Ballari':           [15.1394, 76.9214],
  'Hassan':            [13.0000, 76.1000],
  'Vijayapura':        [16.8302, 75.7100],
  'Udupi':             [13.3409, 74.7421],
};

// Unemployment color scale (higher = more red)
function getUnemploymentColor(rate: number): string {
  if (rate >= 9) return '#EF4444';
  if (rate >= 7) return '#F59E0B';
  if (rate >= 5) return '#3B82F6';
  return '#10B981';
}

interface SocioEconomicMapProps {
  halfWidth?: boolean;
  onViewStateChange?: (viewState: ViewStateChangeEvent) => void;
  syncViewState?: { longitude: number; latitude: number; zoom: number };
}

export default function SocioEconomicMap({
  halfWidth,
  onViewStateChange,
  syncViewState,
}: SocioEconomicMapProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);

  // Build GeoJSON for socio-economic points
  const geoData = {
    type: 'FeatureCollection' as const,
    features: Object.entries(mockSocioEconomicData).map(([district, data]) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: DISTRICT_COORDS[district]
          ? [DISTRICT_COORDS[district][1], DISTRICT_COORDS[district][0]]
          : [77, 14],
      },
      properties: {
        district,
        unemployment: data.unemployment,
        literacy: data.literacy,
        urbanization: data.urbanization,
        color: getUnemploymentColor(data.unemployment),
      },
    })),
  };

  const handleHover = useCallback((e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      setHoveredDistrict(e.features[0].properties?.district || null);
    } else {
      setHoveredDistrict(null);
    }
  }, []);

  const hoveredData = hoveredDistrict ? mockSocioEconomicData[hoveredDistrict] : null;

  return (
    <div className={`relative ${halfWidth ? 'w-1/2' : 'w-full'} h-full bg-background`}>
      {/* Label */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg glass">
        <span className="text-xs font-medium text-accent-blue">Socio-Economic Overlay</span>
      </div>

      <MapGL
        initialViewState={{ longitude: 77.5946, latitude: 12.9716, zoom: 6 }}
        {...(syncViewState
          ? { longitude: syncViewState.longitude, latitude: syncViewState.latitude, zoom: syncViewState.zoom }
          : {}
        )}
        mapStyle={FREE_DARK_STYLE}
        onMove={onViewStateChange}
        onMouseMove={handleHover}
        interactiveLayerIds={['socio-circles']}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="socio-data" type="geojson" data={geoData}>
          <Layer
            id="socio-heatmap"
            type="heatmap"
            paint={{
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'unemployment'], 4, 0.2, 12, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 9, 1.5],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 15, 9, 35],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 0.2],
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
          <Layer
            id="socio-circles"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['get', 'unemployment'], 4, 8, 12, 20],
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.6,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#0B1120',
            }}
          />
        </Source>
      </MapGL>

      {/* Hover tooltip */}
      {hoveredDistrict && hoveredData && (
        <div className="absolute bottom-6 left-4 z-10 px-4 py-3 rounded-xl glass">
          <h4 className="text-sm font-medium text-text-primary mb-2">{hoveredDistrict}</h4>
          <div className="flex gap-6 text-xs">
            <div>
              <span className="text-text-secondary">Unemployment</span>
              <p className="text-warning font-medium">{hoveredData.unemployment}%</p>
            </div>
            <div>
              <span className="text-text-secondary">Literacy</span>
              <p className="text-accent-blue font-medium">{hoveredData.literacy}%</p>
            </div>
            <div>
              <span className="text-text-secondary">Urban</span>
              <p className="text-clear font-medium">{hoveredData.urbanization}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-4 z-10 px-3 py-2 rounded-lg glass">
        <p className="text-[10px] text-text-secondary mb-1.5">Unemployment Rate</p>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="w-2 h-2 rounded-full bg-clear" /> <span className="text-text-secondary mr-2">&lt;5%</span>
          <span className="w-2 h-2 rounded-full bg-accent-blue" /> <span className="text-text-secondary mr-2">5-7%</span>
          <span className="w-2 h-2 rounded-full bg-warning" /> <span className="text-text-secondary mr-2">7-9%</span>
          <span className="w-2 h-2 rounded-full bg-critical" /> <span className="text-text-secondary">9%+</span>
        </div>
      </div>
    </div>
  );
}
