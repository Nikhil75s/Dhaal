import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { KARNATAKA_DISTRICTS } from "../../utils/districts";
import { TimeLapseScrubber } from "./TimeLapseScrubber";

declare global {
  interface Window {
    mappls: any;
  }
}

const MAPPLS_TOKEN =
  import.meta.env.VITE_MAPPLS_TOKEN || "YOUR_MAPPLS_TOKEN_HERE";
const API_URL =
  "https://dhaal-60077679458.development.catalystserverless.in/server/spatial_api/api/v1/map/clusters";

export const CrimeMap = () => {
  const { filters } = useDashboard();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any>(null);

  const [dataCount, setDataCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);

  // 1. Initialize Map
  useEffect(() => {
    const initMap = () => {
      if (!mapContainerRef.current) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.mappls.Map(
          mapContainerRef.current,
          {
            center: { lat: 15.3173, lng: 75.7139 }, // Centered exactly on Karnataka
            zoom: 6.5,
            minZoom: 5, // Limit the zoom out
            zoomControl: true,
            location: true,
          },
        );

        // Restrict the map to Karnataka and surrounding borders to save Vector Tile API calls
        mapInstanceRef.current.setMaxBounds([
          [72.0, 10.0], // Southwest coordinates (Lng, Lat)
          [80.0, 19.5]  // Northeast coordinates (Lng, Lat)
        ]);

        mapInstanceRef.current.addListener("load", () => {
          // Implement Custom Dark Classic Style programmatically since Mappls lacks this preset
          try {
            const style = mapInstanceRef.current.getStyle();
            if (style && style.layers) {
              style.layers.forEach((layer: any) => {
                if (!layer.paint) layer.paint = {};
                const layerId = layer.id.toLowerCase();

                if (layer.type === "background") {
                  layer.paint["background-color"] = "#2a2a2a";
                } else if (
                  layer.type === "fill" ||
                  layer.type === "fill-extrusion"
                ) {
                  const colorProp =
                    layer.type === "fill"
                      ? "fill-color"
                      : "fill-extrusion-color";
                  if (layerId.includes("water")) {
                    layer.paint[colorProp] = "#1a1a1a";
                  } else if (layerId.includes("building")) {
                    layer.paint[colorProp] = "#ffffff"; // Buildings set to white as requested
                  } else {
                    layer.paint[colorProp] = "#2a2a2a";
                  }
                } else if (layer.type === "line") {
                  if (layerId.includes("water")) {
                    layer.paint["line-color"] = "#1a1a1a";
                  } else if (
                    layerId.includes("road") ||
                    layerId.includes("highway") ||
                    layerId.includes("street")
                  ) {
                    layer.paint["line-color"] = "#4a4a4a";
                  } else if (
                    layerId.includes("boundary") ||
                    layerId.includes("border")
                  ) {
                    layer.paint["line-color"] = "#666666";
                  } else {
                    layer.paint["line-color"] = "#3a3a3a";
                  }
                } else if (layer.type === "symbol") {
                  if (
                    layerId.includes("highway") ||
                    layerId.includes("road") ||
                    layerId.includes("shield")
                  ) {
                    // Set highway labels specifically to white, remove the dark halo that ruins the yellow shield
                    if (layer.paint["icon-color"])
                      layer.paint["icon-color"] = "#ffffff";
                  } else {
                    layer.paint["text-color"] = "#d4d4d4";
                    layer.paint["text-halo-color"] = "#2a2a2a";
                    layer.paint["text-halo-width"] = 1.5;
                    if (layer.paint["icon-color"])
                      layer.paint["icon-color"] = "#888888";
                  }
                }
              });
              mapInstanceRef.current.setStyle(style);
            }
          } catch (e) {
            console.warn("Failed to apply custom dark style", e);
          }

          setMapLoaded(true);
        });
      }
    };

    const loadMapplsScript = () => {
      if (document.getElementById("mappls-script")) {
        if (window.mappls) initMap();
        return;
      }

      const script = document.createElement("script");
      script.id = "mappls-script";
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${MAPPLS_TOKEN}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initMap();
      };
      script.onerror = () => {
        console.error("Failed to load Mappls SDK script.");
      };
      document.body.appendChild(script);
    };

    loadMapplsScript();

    return () => {
      if (
        mapInstanceRef.current &&
        typeof mapInstanceRef.current.remove === "function"
      ) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []); // Run once on mount

  // 2. Handle District Drill-down
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    if (filters.districtId && KARNATAKA_DISTRICTS[filters.districtId]) {
      mapInstanceRef.current.setCenter({
        lat: KARNATAKA_DISTRICTS[filters.districtId].lat,
        lng: KARNATAKA_DISTRICTS[filters.districtId].lng,
      });
      mapInstanceRef.current.setZoom(9.5); // Slightly zoomed in for district view
    } else {
      mapInstanceRef.current.setCenter({ lat: 15.3173, lng: 75.7139 }); // Center of Karnataka
      mapInstanceRef.current.setZoom(6.5);
    }
  }, [filters.districtId, mapLoaded]);

  // 3. Fetch Data (Runs only when District changes or on Mount)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const fetchRawData = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        setRawData(data);
      } catch (error) {
        console.warn("Backend API not reachable. Falling back to Mock Data.");
        const baseLat = filters.districtId && KARNATAKA_DISTRICTS[filters.districtId]
            ? KARNATAKA_DISTRICTS[filters.districtId].lat : 15.3173;
        const baseLng = filters.districtId && KARNATAKA_DISTRICTS[filters.districtId]
            ? KARNATAKA_DISTRICTS[filters.districtId].lng : 75.7139;
        const spread = filters.districtId ? 0.3 : 3.0;

        const mockData = Array.from({ length: 500 }).map((_, i) => ({
          CaseMaster: {
            CaseMasterID: i,
            CrimeNo: `FIR-${2023000 + i}`,
            latitude: baseLat + (Math.random() - 0.5) * spread,
            longitude: baseLng + (Math.random() - 0.5) * spread,
            CrimeRegisteredDate: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0],
            DistrictID: filters.districtId || (101 + Math.floor(Math.random() * 31)).toString(),
          },
          CrimeHead: {
            CrimeGroupName: i % 2 === 0 ? "Property Crimes" : "Violent Crimes",
          },
        }));
        setRawData(mockData);
      }
    };

    fetchRawData();
  }, [filters.districtId, mapLoaded]);

  // 4. Plot Clusters (Runs highly efficiently on Timeline scrub)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || rawData.length === 0) return;

    const plotData = () => {

      // Filter crimes by district and date range
      const startDateMs = filters.startDate ? new Date(filters.startDate).getTime() : 0;
      
      // If time-lapse is running, restrict the end date to the current animated replayDate
      const activeEndDate = filters.replayDate || filters.endDate;
      const endDateMs = activeEndDate ? new Date(activeEndDate).setHours(23, 59, 59, 999) : Infinity;

      const filteredData = rawData.filter((item: any) => {
        // 1. District Filter
        if (filters.districtId && String(item.CaseMaster?.DistrictID) !== String(filters.districtId)) {
          return false;
        }

        // 2. Date Filter
        const dateStr = item.CaseMaster?.CrimeRegisteredDate;
        if (dateStr) {
          // Supports "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
          const itemDateMs = new Date(dateStr.replace(' ', 'T')).getTime();
          if (!isNaN(itemDateMs) && (itemDateMs < startDateMs || itemDateMs > endDateMs)) {
            return false;
          }
        }
        return true;
      });

      setDataCount(filteredData.length);

      // Remove old traditional markers logic since we are migrating to Native Mapbox GL Layers
      if (markersRef.current && Array.isArray(markersRef.current)) {
        markersRef.current.forEach((m: any) => m.remove());
        markersRef.current = [];
      }

      const geoJsonData = {
        type: 'FeatureCollection',
        features: filteredData.map((item: any) => {
          const lat = parseFloat(item.CaseMaster?.latitude);
          const lng = parseFloat(item.CaseMaster?.longitude);

          if (isNaN(lat) || isNaN(lng)) return null;

          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              id: item.CaseMaster?.CaseMasterID,
              crimeNo: item.CaseMaster?.CrimeNo,
              crimeGroup: item.CrimeHead?.CrimeGroupName || 'Other',
              date: item.CaseMaster?.CrimeRegisteredDate || '',
              isViolent: item.CrimeHead?.CrimeGroupName === "Violent Crimes" ? 1 : 0
            }
          };
        }).filter(Boolean)
      };

      const map = mapInstanceRef.current;

      if (!map.getSource('crimes')) {
        map.addSource('crimes', {
          type: 'geojson',
          data: geoJsonData,
          cluster: true,
          clusterMaxZoom: 14, // Max zoom to cluster points on
          clusterRadius: 50 // Radius of each cluster when clustering points
        });

        // Add cluster circles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'crimes',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              'rgba(245, 158, 11, 0.8)', // Amber for small clusters
              10,
              'rgba(239, 68, 68, 0.8)', // Red for medium clusters
              30,
              'rgba(185, 28, 28, 0.9)'  // Dark Red for large clusters
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              15, // 15px radius for small clusters
              10,
              20, // 20px radius for medium
              30,
              25  // 25px radius for large
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Add cluster counts
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'crimes',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff'
          }
        });

        // Add unclustered points
        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'crimes',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'isViolent'], 1],
              '#ef4444', // Red for violent
              '#f59e0b'  // Amber for property
            ],
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Interactive hover states
        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });

        // Cluster click to expand
        map.on('click', 'clusters', (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const clusterId = features[0].properties.cluster_id;
          map.getSource('crimes').getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
            if (err) return;
            map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom
            });
          });
        });

        // Point click to show popup
        map.on('click', 'unclustered-point', (e: any) => {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const props = e.features[0].properties;
          
          const popupHtml = `<div style="padding: 12px; color: #111827; min-width: 150px; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: bold; color: ${props.isViolent === 1 ? '#ef4444' : '#f59e0b'}; text-transform: uppercase;">
              ${props.crimeGroup}
            </div>
            <div style="font-weight: 800; font-size: 14px; margin-top: 4px;">
              ${props.crimeNo}
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">
              ${props.date}
            </div>
          </div>`;

          // Clean up old popups if they exist
          if (window.mappls && window.mappls.Popup) {
            new window.mappls.Popup()
              .setLngLat(coordinates)
              .setHTML(popupHtml)
              .addTo(map);
          }
        });

      } else {
        // Source already exists, just update the data smoothly
        map.getSource('crimes').setData(geoJsonData);
      }
    };

    plotData();
  }, [rawData, filters.startDate, filters.endDate, filters.replayDate, filters.districtId, mapLoaded]);

  return (
    <div className="w-full h-full relative group bg-[#2a2a2a]">
      <div
        ref={mapContainerRef}
        className={`w-full h-full transition-opacity duration-1000 ${mapLoaded ? "opacity-100" : "opacity-0"}`}
        id="mappls-map"
      />

      <div className="absolute top-4 left-4 bg-navy-900/80 backdrop-blur-md p-4 rounded-xl border border-navy-800 text-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-khaki font-medium mb-1">Active Map State</p>
        <p className="text-gray-400">
          Date: {filters.startDate} to {filters.replayDate || filters.endDate}
        </p>
        <p className="text-gray-400">Data Points: {dataCount}</p>
        <div className="mt-2 text-xs font-semibold px-2 py-1 bg-white/10 rounded border border-white/20 inline-block text-gray-200">
          Powered by Mappls
        </div>
      </div>

      <TimeLapseScrubber />
    </div>
  );
};
