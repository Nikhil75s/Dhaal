import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { KARNATAKA_DISTRICTS } from "../../utils/districts";
import { TimeLapseScrubber } from "./TimeLapseScrubber";
import { Loader2 } from "lucide-react";
import { computeHexBins, hexBinsToGeoJSON, getResolutionForZoom } from "../../utils/hexbins";
import { HexTooltip } from "./HexTooltip";
import { getISTDateString, parseISTDate } from "../../utils/dateUtils";

declare global {
  interface Window {
    mappls: any;
  }
}

const MAPPLS_TOKEN =
  import.meta.env.VITE_MAPPLS_TOKEN || "YOUR_MAPPLS_TOKEN_HERE";
const API_URL =
  "https://dhaal-60077679458.development.catalystserverless.in/server/spatial_api/api/v1/map/clusters";
const ANOMALY_API_URL = 
  "https://dhaal-60077679458.development.catalystserverless.in/server/anomaly_alerts_api/api/v1/ai/anomalies/history";

export const CrimeMap = () => {
  const { filters, setAvailableStations, setAvailableCrimeTypes, showAnomalies, targetLocation, setTargetLocation } = useDashboard();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const [dataCount, setDataCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isFetchingMapData, setIsFetchingMapData] = useState(false);
  const [currentResolution, setCurrentResolution] = useState(5);
  const [hoveredHex, setHoveredHex] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const anomalyMarkersRef = useRef<any[]>([]);

  // 0. Fetch Anomalies (Today's default)
  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const response = await fetch(ANOMALY_API_URL);
        const data = await response.json();
        if (data.status === "success" && data.alerts) {
          setAnomalies(data.alerts);
        }
      } catch (err) {
        console.error("Failed to fetch anomalies", err);
      }
    };
    fetchAnomalies();
  }, []);

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

  // 2.5 Handle Target Location (from Predictive Dash "Show on Map")
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !targetLocation) return;

    mapInstanceRef.current.setCenter({
      lat: targetLocation.lat,
      lng: targetLocation.lng
    });
    mapInstanceRef.current.setZoom(targetLocation.zoom || 14);

    // Optional: Add a temporary marker or pulse effect
    const marker = new window.mappls.Marker({
      map: mapInstanceRef.current,
      position: { lat: targetLocation.lat, lng: targetLocation.lng },
      html: `<div class="w-4 h-4 bg-red-500 rounded-full animate-ping"></div>`,
      width: 16,
      height: 16
    });

    // Remove the marker and clear the target after a few seconds so it doesn't get stuck
    setTimeout(() => {
      if (marker && marker.remove) marker.remove();
      setTargetLocation(null);
    }, 5000);

  }, [targetLocation, mapLoaded]);

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
        ? parseISTDate(filters.startDate + "T00:00:00").getTime()
        : 0;

      // If time-lapse is running, restrict the end date to the current animated replayDate
      const activeEndDate = filters.replayDate || filters.endDate;
      const endDateMs = activeEndDate
        ? parseISTDate(activeEndDate + "T23:59:59").getTime()
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
          const itemDate = parseISTDate(dateStr);
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
          // If the mouse is actually over our HTML marker, ignore the hex layer
          const target = e.originalEvent.target as HTMLElement;
          if (target && typeof target.closest === "function" && target.closest('.group\\/marker')) {
            map.getCanvas().style.cursor = "";
            setHoveredHex(null);
            return;
          }

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

  // 5. Render Anomaly Pulsing Markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || anomalies.length === 0) return;

    // Clear existing markers
    anomalyMarkersRef.current.forEach((marker) => {
      if (typeof marker.remove === "function") marker.remove();
    });
    anomalyMarkersRef.current = [];

    // Check if the current effective map date is exactly today
    const activeEndDate = filters.replayDate || filters.endDate;
    const todayStr = getISTDateString();
    const isToday = activeEndDate === todayStr;

    // Only render anomalies if toggle is ON and the date is Today
    if (!showAnomalies || !isToday) return;

    anomalies.forEach((anomaly) => {
      if (anomaly.pulsingZone && anomaly.pulsingZone.lat && anomaly.pulsingZone.lng) {
        // Build the HTML for the pulsing marker and tooltip using Tailwind classes
        const html = `
          <div class="group/marker relative cursor-pointer" style="z-index: 50;">
            <div class="w-12 h-12 bg-red-500/40 rounded-full animate-ping absolute -top-4 -left-4"></div>
            <div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white relative z-10 shadow-[0_0_15px_rgba(220,38,38,0.8)]"></div>
            
            <div class="hidden group-hover/marker:block absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-red-950/95 text-red-50 text-sm rounded-xl border border-red-800 shadow-2xl backdrop-blur-md z-[100] pointer-events-none text-center leading-relaxed">
              <div class="font-bold text-red-400 mb-1.5 flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Emerging Trend
              </div>
              ${anomaly.Message.replace(/\s*\(Z-Score:\s*[\d.]+\)/i, '')}
            </div>
          </div>
        `;

        try {
          const marker = new window.mappls.Marker({
            map: mapInstanceRef.current,
            position: { lat: anomaly.pulsingZone.lat, lng: anomaly.pulsingZone.lng },
            html: html,
            width: 16,
            height: 16,
          });
          anomalyMarkersRef.current.push(marker);
        } catch (e) {
          console.warn("Failed to create anomaly marker:", e);
        }
      }
    });

    return () => {
      anomalyMarkersRef.current.forEach((marker) => {
        if (typeof marker.remove === "function") marker.remove();
      });
      anomalyMarkersRef.current = [];
    };
  }, [mapLoaded, anomalies, showAnomalies, filters.endDate, filters.replayDate]);

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
