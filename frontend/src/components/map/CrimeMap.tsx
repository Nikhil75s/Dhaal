import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../context/DashboardContext";
import { KARNATAKA_DISTRICTS } from "../../utils/districts";
import { TimeLapseScrubber } from "./TimeLapseScrubber";
import { CaseDetailsPanel } from "./CaseDetailsPanel";
import { Loader2 } from "lucide-react";

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
  const { filters, setFilters } = useDashboard();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any>(null);

  const [dataCount, setDataCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [rawData, setRawData] = useState<any[]>([]);
  const [isFetchingMapData, setIsFetchingMapData] = useState(false);

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

  // 3. Fetch Data (Runs only when District changes or on Mount)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const fetchRawData = async () => {
      setIsFetchingMapData(true);
      try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
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
  }, [filters.districtId, mapLoaded]);

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

        // 2. Date Filter
        const dateStr = item.CaseMaster?.CrimeRegisteredDate;
        if (dateStr) {
          // Supports "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss"
          const itemDateMs = new Date(dateStr.replace(" ", "T")).getTime();
          if (
            !isNaN(itemDateMs) &&
            (itemDateMs < startDateMs || itemDateMs > endDateMs)
          ) {
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
        type: "FeatureCollection",
        features: filteredData
          .map((item: any) => {
            const lat = parseFloat(item.CaseMaster?.latitude);
            const lng = parseFloat(item.CaseMaster?.longitude);

            if (isNaN(lat) || isNaN(lng)) return null;

            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [lng, lat],
              },
              properties: {
                id: item.CaseMaster?.CaseMasterID,
                crimeNo: item.CaseMaster?.CrimeNo,
                crimeGroup: item.CrimeHead?.CrimeGroupName || "Other",
                date: item.CaseMaster?.CrimeRegisteredDate || "",
                isViolent:
                  item.CrimeHead?.CrimeGroupName === "Crimes Against Body"
                    ? 1
                    : 0,
              },
            };
          })
          .filter(Boolean),
      };

      const map = mapInstanceRef.current;

      if (!map.getSource("crimes")) {
        map.addSource("crimes", {
          type: "geojson",
          data: geoJsonData,
        });

        // Add heatmap layer
        map.addLayer({
          id: "crime-heat",
          type: "heatmap",
          source: "crimes",
          maxzoom: 15,
          paint: {
            "heatmap-weight": 0.2,
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              9,
              1.5,
              12,
              6,
              15,
              12,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0, 0, 0, 0)",
              0.2,
              "rgba(194, 65, 12, 0.1)", // dark orange-red, very transparent
              0.5,
              "rgba(234, 88, 12, 0.3)", // medium orange
              0.8,
              "rgba(249, 115, 22, 0.5)", // bright orange
              1,
              "rgba(251, 146, 60, 0.65)", // soft bright orange center, capped opacity
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              25,
              9,
              40,
              15,
              80,
            ],
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              1,
              15,
              0,
            ],
          },
        });

        // Add individual points that fade in as heatmap fades out
        map.addLayer({
          id: "crime-point",
          type: "circle",
          source: "crimes",
          minzoom: 13,
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "isViolent"], 1],
              "#ef4444",
              "#f59e0b",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0,
              14,
              1,
            ],
            "circle-stroke-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0,
              14,
              1,
            ],
          },
        });

        // Interactive hover states for points
        map.on("mouseenter", "crime-point", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "crime-point", () => {
          map.getCanvas().style.cursor = "";
        });

        // Point click to show Case Details Panel
        map.on("click", "crime-point", (e: any) => {
          const props = e.features[0].properties;
          setFilters(prev => ({ ...prev, selectedCaseId: props.id.toString() }));
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
    mapLoaded,
  ]);

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

      <div className="absolute top-4 left-4 bg-[#0B1120]/90 backdrop-blur-md p-4 rounded-xl border border-white/10 text-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_4px_32px_rgba(0,0,0,0.8)]">
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
      <CaseDetailsPanel />
    </div>
  );
};
