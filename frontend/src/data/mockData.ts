import { subDays, format } from 'date-fns';
import type { ClusterPoint, Anomaly, ReportHistoryItem } from './schemas';

/**
 * Realistic mock data for Karnataka districts.
 * Used when USE_MOCK = true in api.ts — swap to real endpoints with a one-line change.
 */

// Karnataka district centers (approximate coordinates)
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

const CRIME_CATEGORIES = [
  'Theft', 'Burglary', 'Assault', 'Robbery', 'Cybercrime',
  'Drug Offense', 'Fraud', 'Murder', 'Kidnapping', 'Extortion',
];

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateClusters(): ClusterPoint[] {
  const clusters: ClusterPoint[] = [];
  const today = new Date();
  let id = 1;

  for (const [district, [lat, lng]] of Object.entries(DISTRICT_COORDS)) {
    // Generate 3-5 cluster points per district with slight offsets
    const pointCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pointCount; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      clusters.push({
        id: `cluster-${id++}`,
        latitude: lat + randomInRange(-0.15, 0.15),
        longitude: lng + randomInRange(-0.15, 0.15),
        category: CRIME_CATEGORIES[Math.floor(Math.random() * CRIME_CATEGORIES.length)],
        date: format(subDays(today, daysAgo), 'yyyy-MM-dd'),
        count: Math.floor(randomInRange(1, 25)),
        district,
        station: `Station ${Math.floor(Math.random() * 5) + 1}`,
      });
    }
  }

  return clusters;
}

function generateAnomalies(): Anomaly[] {
  const today = new Date();
  return [
    {
      id: 'anomaly-1',
      district: 'Bengaluru Urban',
      latitude: 12.9716,
      longitude: 77.5946,
      severity: 'high',
      spikePercentage: 340,
      description: 'Cybercrime cases surged 340% above 90-day moving average in central Bengaluru',
      detectedAt: format(subDays(today, 1), "yyyy-MM-dd'T'HH:mm:ss"),
    },
    {
      id: 'anomaly-2',
      district: 'Mysuru',
      latitude: 12.2958,
      longitude: 76.6394,
      severity: 'high',
      spikePercentage: 210,
      description: 'Theft reports spiked 210% in Mysuru — possible organized ring',
      detectedAt: format(subDays(today, 2), "yyyy-MM-dd'T'HH:mm:ss"),
    },
    {
      id: 'anomaly-3',
      district: 'Hubli-Dharwad',
      latitude: 15.3647,
      longitude: 75.1240,
      severity: 'medium',
      spikePercentage: 145,
      description: 'Drug offense reports up 145% in Hubli industrial zone',
      detectedAt: format(subDays(today, 3), "yyyy-MM-dd'T'HH:mm:ss"),
    },
    {
      id: 'anomaly-4',
      district: 'Kalaburagi',
      latitude: 17.3297,
      longitude: 76.8343,
      severity: 'medium',
      spikePercentage: 120,
      description: 'Assault cases increased 120% near railway junction area',
      detectedAt: format(subDays(today, 5), "yyyy-MM-dd'T'HH:mm:ss"),
    },
  ];
}

function generateReportHistory(): ReportHistoryItem[] {
  const today = new Date();
  const districts = Object.keys(DISTRICT_COORDS);

  return Array.from({ length: 12 }, (_, i) => ({
    id: `report-${i + 1}`,
    date: format(subDays(today, i * 2 + 1), 'yyyy-MM-dd'),
    severity: (['high', 'medium', 'low'] as const)[i % 3],
    district: districts[i % districts.length],
    title: `Intelligence Brief — ${districts[i % districts.length]}`,
    pdfUrl: `https://storage.example.com/reports/brief-${i + 1}.pdf`,
  }));
}

// Export stable references (generated once)
export const mockClusters = generateClusters();
export const mockAnomalies = generateAnomalies();
export const mockReportHistory = generateReportHistory();

// Socio-economic mock data for split-screen correlation
export const mockSocioEconomicData: Record<string, { literacy: number; urbanization: number; unemployment: number }> = {
  'Bengaluru Urban':   { literacy: 88.7, urbanization: 91.2, unemployment: 4.1 },
  'Bengaluru Rural':   { literacy: 77.9, urbanization: 32.4, unemployment: 5.8 },
  'Mysuru':            { literacy: 72.8, urbanization: 41.5, unemployment: 6.2 },
  'Mangaluru':         { literacy: 82.4, urbanization: 48.7, unemployment: 5.0 },
  'Hubli-Dharwad':     { literacy: 80.1, urbanization: 52.3, unemployment: 7.1 },
  'Belagavi':          { literacy: 73.4, urbanization: 28.6, unemployment: 8.3 },
  'Kalaburagi':        { literacy: 64.2, urbanization: 25.1, unemployment: 9.7 },
  'Tumakuru':          { literacy: 75.1, urbanization: 22.8, unemployment: 6.5 },
  'Davanagere':        { literacy: 75.7, urbanization: 35.4, unemployment: 7.8 },
  'Shivamogga':        { literacy: 80.5, urbanization: 30.2, unemployment: 6.0 },
  'Raichur':           { literacy: 60.1, urbanization: 20.3, unemployment: 11.2 },
  'Ballari':           { literacy: 67.5, urbanization: 33.9, unemployment: 9.1 },
  'Hassan':            { literacy: 76.1, urbanization: 19.4, unemployment: 5.5 },
  'Vijayapura':        { literacy: 70.2, urbanization: 27.8, unemployment: 8.9 },
  'Udupi':             { literacy: 86.3, urbanization: 24.1, unemployment: 4.8 },
};
