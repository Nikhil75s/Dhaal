import { latLngToCell, cellToBoundary, gridDisk } from 'h3-js';

export interface HexBin {
  hexId: string;
  count: number;
  crimeTypes: Record<string, number>;
  giZScore?: number;
  confidence?: string;
}

export function computeHexBins(records: any[], resolution: number): HexBin[] {
  const bins: Record<string, HexBin> = {};

  for (const record of records) {
    const lat = parseFloat(record.CaseMaster?.latitude);
    const lng = parseFloat(record.CaseMaster?.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;

    const hexId = latLngToCell(lat, lng, resolution);
    const crimeGroup = record.CrimeHead?.CrimeGroupName || 'Other';

    if (!bins[hexId]) {
      bins[hexId] = {
        hexId,
        count: 0,
        crimeTypes: {}
      };
    }

    bins[hexId].count += 1;
    bins[hexId].crimeTypes[crimeGroup] = (bins[hexId].crimeTypes[crimeGroup] || 0) + 1;
  }

  const populatedBins = Object.values(bins);
  if (populatedBins.length === 0) return [];

  // Getis-Ord Gi* Calculation
  const n = populatedBins.length;
  
  let sumX = 0;
  let sumX2 = 0;
  
  for (const bin of populatedBins) {
    sumX += bin.count;
    sumX2 += (bin.count * bin.count);
  }
  
  const X_bar = sumX / n;
  const S = Math.sqrt((sumX2 / n) - (X_bar * X_bar));

  for (let i = 0; i < populatedBins.length; i++) {
    const binI = populatedBins[i];
    const neighbors = gridDisk(binI.hexId, 1); // 1-ring neighborhood
    
    let localSum = 0;
    let weightSum = 0; 
    
    for (const neighborId of neighbors) {
      if (bins[neighborId]) {
        localSum += bins[neighborId].count;
      }
      weightSum += 1;
    }
    
    // Gi* Formula
    const numerator = localSum - (X_bar * weightSum);
    const denominator = S * Math.sqrt( (n * weightSum - weightSum * weightSum) / (n - 1) );
    
    const zScore = denominator !== 0 ? numerator / denominator : 0;
    
    binI.giZScore = zScore;
    
    if (zScore > 2.58) {
      binI.confidence = "99%";
    } else if (zScore > 1.96) {
      binI.confidence = "95%";
    } else if (zScore > 1.65) {
      binI.confidence = "90%";
    } else {
      binI.confidence = "None";
    }
  }

  return populatedBins;
}

// Converts our custom HexBin objects into GeoJSON format for Mapbox/Mappls ingestion
export function hexBinsToGeoJSON(hexBins: HexBin[]) {
  return {
    type: 'FeatureCollection',
    features: hexBins.map(bin => {
      const boundary = cellToBoundary(bin.hexId);
      const coordinates = boundary.map((coord: [number, number]) => [coord[1], coord[0]]);
      coordinates.push([...coordinates[0]]);

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: {
          hexId: bin.hexId,
          count: bin.count,
          crimeTypes: JSON.stringify(bin.crimeTypes),
          giZScore: bin.giZScore,
          confidence: bin.confidence
        }
      };
    })
  };
}

export function getResolutionForZoom(zoom: number): number {
  if (zoom < 7) return 4;
  if (zoom < 9) return 5;
  if (zoom < 11) return 6;
  if (zoom < 13) return 7;
  if (zoom < 15) return 8;
  return 9;
}
