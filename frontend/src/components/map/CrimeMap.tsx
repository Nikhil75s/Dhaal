import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { KARNATAKA_DISTRICTS, districtCoords } from "../../utils/districts";
import { fetchAnomalies, fetchSocioEconomic } from "../../data/api";
import { TimeLapseScrubber } from "./TimeLapseScrubber";
import { Loader2 } from "lucide-react";
import { computeHexBins, hexBinsToGeoJSON, getResolutionForZoom } from "../../utils/hexbins";
import { HexTooltip } from "./HexTooltip";

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
  const { filters, setAvailableStations, setAvailableCrimeTypes } = useDashboard();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const [dataCount, setDataCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [socioData, setSocioData] = useState<any[]>([]);
  const [isFetchingMapData, setIsFetchingMapData] = useState(false);
  const [currentResolution, setCurrentResolution] = useState(5);
  const [hoveredHex, setHoveredHex] = useState<any>(null);

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
            minZoom: 6, // Limit the zoom out
            zoomControl: true,
            location: true,
            fullscreenControl: false, // Disabled because it hides the TopNav filters
          },
        );

        // Add ResizeObserver to force canvas resize when container changes (fixes fullscreen exit bug)
        const resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current && typeof mapInstanceRef.current.resize === "function") {
            mapInstanceRef.current.resize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);

        // Store observer on the ref so we can disconnect it later
        (mapInstanceRef.current as any)._resizeObserver = resizeObserver;

        // Restrict the map to Karnataka and surrounding borders to save Vector Tile API calls
        mapInstanceRef.current.setMaxBounds([
          [72.0, 10.0], // Southwest coordinates (Lng, Lat)
          [80.0, 19.5], // Northeast coordinates (Lng, Lat)
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
                  layer.paint["background-color"] = "#10141f";
                } else if (
                  layer.type === "fill" ||
                  layer.type === "fill-extrusion"
                ) {
                  const colorProp =
                    layer.type === "fill"
                      ? "fill-color"
                      : "fill-extrusion-color";
                  if (layerId.includes("water")) {
                    layer.paint[colorProp] = "#0a0c13";
                  } else if (layerId.includes("building")) {
                    layer.paint[colorProp] = "#181e2e";
                  } else {
                    layer.paint[colorProp] = "#10141f";
                  }
                } else if (layer.type === "line") {
                  if (layerId.includes("water")) {
                    layer.paint["line-color"] = "#0a0c13";
                  } else if (
                    layerId.includes("boundary") ||
                    layerId.includes("border") ||
                    layerId.includes("admin")
                  ) {
                    layer.paint["line-color"] = "#232a3d";
                  } else {
                    // Default all other lines (roads, paths, railways) to the road color
                    layer.paint["line-color"] = "#4f483c";
                  }
                } else if (layer.type === "symbol") {
                  if (
                    layerId.includes("highway") ||
                    layerId.includes("road") ||
                    layerId.includes("shield") ||
                    layerId.includes("motorway") ||
                    layerId.includes("nh") ||
                    layerId.includes("sh")
                  ) {
                    // Golden yellow highway shields with black text
                    if (layer.paint["icon-color"])
                      layer.paint["icon-color"] = "#facc15";
                    layer.paint["text-color"] = "#000000";
                    layer.paint["text-halo-width"] = 0;
                  } else {
                    layer.paint["text-color"] = "#9ca3af";
                    layer.paint["text-halo-color"] = "#10141f";
                    layer.paint["text-halo-width"] = 2;
                    if (layer.paint["icon-color"])
                      layer.paint["icon-color"] = "#4b5563";
                  }
                }
              });
              mapInstanceRef.current.setStyle(style);
            }
          } catch (e) {
            console.warn("Failed to apply custom dark style", e);
          }

          setMapLoaded(true);

          mapInstanceRef.current.on('zoomend', () => {
            if (mapInstanceRef.current) {
              const zoom = mapInstanceRef.current.getZoom();
              setCurrentResolution(getResolutionForZoom(zoom));
            }
          });
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
      if (mapInstanceRef.current) {
        if ((mapInstanceRef.current as any)._resizeObserver) {
          (mapInstanceRef.current as any)._resizeObserver.disconnect();
        }
        if (typeof mapInstanceRef.current.remove === "function") {
          mapInstanceRef.current.remove();
        }
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []); // Run once on mount

  // 1.5 Fetch Overlays (Anomalies & Socio-Economic)
  useEffect(() => {
    fetchAnomalies().then(setAnomalies).catch(console.error);
    fetchSocioEconomic().then(setSocioData).catch(console.error);
  }, []);

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
      setIsFetchingMapData(true);
      try {
        const url = `${API_URL}?districtId=${filters.districtId || "all"}&startDate=${filters.startDate}&endDate=${filters.endDate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        
        // Extract distinct police stations and crime types for the filters
        const stationsMap = new Map<string, string>();
        const crimeTypesSet = new Set<string>();

        data.forEach((item: any) => {
          if (item.PoliceStation?.PoliceStationID) {
            stationsMap.set(item.PoliceStation.PoliceStationID.toString(), item.PoliceStation.StationName);
          }
          if (item.CrimeHead?.CrimeGroupName) {
            crimeTypesSet.add(item.CrimeHead.CrimeGroupName);
          }
        });

        setAvailableStations(
          Array.from(stationsMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setAvailableCrimeTypes(Array.from(crimeTypesSet).sort());

        setRawData(data);
      } catch (error) {
        console.warn("Backend API not reachable. Falling back to Mock Data.");
        const baseLat =
          filters.districtId && KARNATAKA_DISTRICTS[filters.districtId]
            ? KARNATAKA_DISTRICTS[filters.districtId].lat
            : 15.3173;
        const baseLng =
          filters.districtId && KARNATAKA_DISTRICTS[filters.districtId]
            ? KARNATAKA_DISTRICTS[filters.districtId].lng
            : 75.7139;
        const spread = filters.districtId ? 0.3 : 3.0;

        const mockData = Array.from({ length: 500 }).map((_, i) => ({
          CaseMaster: {
            CaseMasterID: i,
            CrimeNo: `FIR-${2023000 + i}`,
            latitude: baseLat + (Math.random() - 0.5) * spread,
            longitude: baseLng + (Math.random() - 0.5) * spread,
            CrimeRegisteredDate: new Date(
              Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .replace("T", " ")
              .split(".")[0],
            DistrictID:
              filters.districtId ||
              (101 + Math.floor(Math.random() * 31)).toString(),
          },
          CrimeHead: {
            CrimeGroupName: i % 2 === 0 ? "Property Crimes" : "Violent Crimes",
          },
        }));
        setRawData(mockData);
      } finally {
        setIsFetchingMapData(false);
      }
    };

    fetchRawData();
  }, [filters.districtId, filters.startDate, filters.endDate, mapLoaded]);

  // 4. Plot Clusters (Runs highly efficiently on Timeline scrub)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || rawData.length === 0) return;

    const plotData = () => {
      // Filter crimes by district and date range
      const startDateMs = filters.startDate
        ? new Date(filters.startDate).getTime()
        : 0;

      // If time-lapse is running, restrict the end date to the current animated replayDate
      const activeEndDate = filters.replayDate || filters.endDate;
      const endDateMs = activeEndDate
        ? new Date(activeEndDate).setHours(23, 59, 59, 999)
        : Infinity;

      const filteredData = rawData.filter((item: any) => {
        // 1. District Filter
        if (
          filters.districtId &&
          String(item.CaseMaster?.DistrictID) !== String(filters.districtId)
        ) {
          return false;
        }

        // 2. Police Station Filter
        if (
          filters.policeStationId &&
          String(item.PoliceStation?.PoliceStationID) !== String(filters.policeStationId)
        ) {
          return false;
        }

        // 3. Date & Time Filter
        const dateStr = item.CaseMaster?.CrimeRegisteredDate;
        if (dateStr) {
          // Supports "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
          const itemDate = new Date(dateStr.replace(" ", "T"));
          const itemDateMs = itemDate.getTime();
          if (
            !isNaN(itemDateMs) &&
            (itemDateMs < startDateMs || itemDateMs > endDateMs)
          ) {
            return false;
          }

          if (filters.timeOfDay !== 'all') {
            const hour = itemDate.getHours();
            if (filters.timeOfDay === 'morning' && (hour < 6 || hour >= 14)) return false;
            if (filters.timeOfDay === 'afternoon' && (hour < 14 || hour >= 22)) return false;
            if (filters.timeOfDay === 'night' && (hour >= 6 && hour < 22)) return false;
          }

          if (filters.dayOfWeek) {
            // JS getDay(): 0 = Sunday, 1 = Monday...
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[itemDate.getDay()];
            if (dayName !== filters.dayOfWeek) return false;
          }
        }
        
        // 4. Crime Category Filter
        if (filters.crimeGroup && item.CrimeHead?.CrimeGroupName !== filters.crimeGroup) {
          return false;
        }

        return true;
      });

      setDataCount(filteredData.length);

      const hexBins = computeHexBins(filteredData, currentResolution);
      const geoJsonData = hexBinsToGeoJSON(hexBins);

      const map = mapInstanceRef.current;

      if (!map.getSource("crimes")) {
        map.addSource("crimes", {
          type: "geojson",
          data: geoJsonData,
        });

        map.addLayer({
          id: "crime-hex",
          type: "fill",
          source: "crimes",
          paint: {
            "fill-color": [
              "case",
              ["==", ["get", "confidence"], "99%"], "rgba(153, 27, 27, 0.7)",   // Red 800
              ["==", ["get", "confidence"], "95%"], "rgba(220, 38, 38, 0.55)",  // Red 600
              ["==", ["get", "confidence"], "90%"], "rgba(248, 113, 113, 0.4)", // Red 400
              "rgba(251, 146, 60, 0.15)" // None/Insignificant (pale orange/grey)
            ],
            "fill-outline-color": "rgba(255, 255, 255, 0.15)"
          }
        });

        // Add an additional outline layer for better definition
        map.addLayer({
          id: "crime-hex-line",
          type: "line",
          source: "crimes",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "confidence"], "99%"], "rgba(252, 165, 165, 0.6)",
              ["==", ["get", "confidence"], "95%"], "rgba(252, 165, 165, 0.4)",
              ["==", ["get", "confidence"], "90%"], "rgba(252, 165, 165, 0.2)",
              "rgba(255, 255, 255, 0.15)"
            ],
            "line-width": 1
          }
        });

        map.on("mousemove", "crime-hex", (e: any) => {
          if (e.features.length > 0) {
            const feature = e.features[0];
            map.getCanvas().style.cursor = "pointer";
            setHoveredHex({
              x: e.originalEvent.clientX,
              y: e.originalEvent.clientY,
              count: feature.properties.count,
              crimeTypes: JSON.parse(feature.properties.crimeTypes),
              confidence: feature.properties.confidence,
              zScore: feature.properties.giZScore
            });
          }
        });

        map.on("mouseleave", "crime-hex", () => {
          map.getCanvas().style.cursor = "";
          setHoveredHex(null);
        });

      } else {
        // Source already exists, just update the data smoothly
        map.getSource("crimes").setData(geoJsonData);
      }
    };

    plotData();
  }, [
    rawData,
    filters.startDate,
    filters.endDate,
    filters.replayDate,
    filters.districtId,
    filters.policeStationId,
    filters.timeOfDay,
    filters.dayOfWeek,
    filters.crimeGroup,
    currentResolution,
    mapLoaded,
  ]);

  // 5. Plot Overlays (Anomalies & Socio-Economic)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // ── Anomalies (Pulsing Red Zones) ──
    if (anomalies.length > 0) {
      const geoJson = {
        type: "FeatureCollection",
        features: anomalies.map((a: any) => ({
          type: "Feature",
          properties: { severity: a.severity, message: a.description },
          geometry: { type: "Point", coordinates: [a.longitude, a.latitude] }
        }))
      };

      if (!map.getSource("anomalies")) {
        map.addSource("anomalies", { type: "geojson", data: geoJson });
        
        // Add a pulsing circle layer
        map.addLayer({
          id: "anomalies-pulse",
          type: "circle",
          source: "anomalies",
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "severity"], "high"], 25,
              ["==", ["get", "severity"], "medium"], 15,
              10
            ],
            "circle-color": "rgba(220, 38, 38, 0.4)", // glowing red
            "circle-stroke-color": "rgba(239, 68, 68, 0.8)",
            "circle-stroke-width": 2,
            "circle-blur": 0.5
          }
        });
        
        // Inner core dot
        map.addLayer({
          id: "anomalies-core",
          type: "circle",
          source: "anomalies",
          paint: {
            "circle-radius": 5,
            "circle-color": "#ef4444",
          }
        });
      } else {
        map.getSource("anomalies").setData(geoJson);
      }
    }

    // ── Socio-Economic (Choropleth proxy / Bubbles) ──
    if (socioData.length > 0) {
      const geoJson = {
        type: "FeatureCollection",
        features: socioData.map((s: any) => {
          const coords = districtCoords(s.districtId);
          if (!coords) return null;
          return {
            type: "Feature",
            properties: { 
              district: s.districtId,
              poverty: s.povertyIndex,
              urban: s.urbanizationIndex 
            },
            geometry: { type: "Point", coordinates: [coords.lng, coords.lat] }
          };
        }).filter(Boolean)
      };

      if (!map.getSource("socio")) {
        map.addSource("socio", { type: "geojson", data: geoJson });
        
        map.addLayer({
          id: "socio-bubbles",
          type: "circle",
          source: "socio",
          paint: {
            // Radius scales with urbanization
            "circle-radius": ["*", ["get", "urban"], 40],
            // Color scales with poverty (green = low poverty, yellow = mid, red = high poverty)
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "poverty"],
              0.1, "rgba(34, 197, 94, 0.1)",
              0.3, "rgba(234, 179, 8, 0.15)",
              0.6, "rgba(239, 68, 68, 0.2)"
            ],
            "circle-stroke-color": "rgba(255, 255, 255, 0.05)",
            "circle-stroke-width": 1
          }
        }); 
      } else {
        map.getSource("socio").setData(geoJson);
      }
    }
  }, [mapLoaded, anomalies, socioData]);

  return (
    <div className="w-full h-full relative group bg-[#10141f] overflow-hidden">
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 transition-opacity duration-1000 ${mapLoaded ? "opacity-100" : "opacity-0"}`}
        id="mappls-map"
      />

      {isFetchingMapData && (
        <div className="absolute inset-0 bg-[#0A0F1A]/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center transition-all duration-300">
          <Loader2 className="animate-spin text-khaki mb-4" size={48} />
          <div className="text-gray-200 font-semibold text-lg tracking-wide">Analyzing Spatial Data...</div>
          <div className="text-gray-400 text-sm mt-2">Fetching anomaly clusters from Catalyst</div>
        </div>
      )}

      <div className="absolute top-4 left-4 bg-[#1E293B] p-4 rounded-xl shadow-md shadow-black/30 text-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-khaki font-medium mb-1">Active Map State</p>
        <p className="text-gray-300">
          Date: {filters.startDate} to {filters.replayDate || filters.endDate}
        </p>
        <p className="text-gray-300">Total Incidents: {dataCount}</p>
        <div className="mt-3 text-xs font-semibold px-2.5 py-1.5 bg-[#0F172A] rounded-lg text-gray-400 inline-block">
          Powered by Mappls
        </div>
      </div>

      <TimeLapseScrubber />
      {hoveredHex && <HexTooltip {...hoveredHex} />}
    </div>
  );
};
