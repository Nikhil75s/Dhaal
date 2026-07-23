"use strict";

const express = require("express");
const cors = require("cors");
const catalyst = require("zcatalyst-sdk-node");

const app = express();
app.use(cors());
app.use(express.json());

// Helper to calculate standard deviation
const calculateStdDev = (values, mean) => {
  if (values.length === 0) return 1;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance) || 1;
};

// Helper to handle ZCQL Pagination
async function fetchPaginated(zcql, queryTemplate, tableName) {
  let offset = 1;
  let limit = 200;
  let allResults = [];
  while (true) {
    const query = `${queryTemplate} LIMIT ${limit} OFFSET ${offset}`;
    const results = await zcql.executeZCQLQuery(query);
    allResults = allResults.concat(results.map((r) => r[tableName]));
    if (results.length < limit) break;
    offset += limit;
  }
  return allResults;
}

// GET /api/v1/ai/anomalies
// Calculates a live 7-day moving average anomaly test per Crime Category
app.get("/api/v1/ai/anomalies", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    let { endDate } = req.query;
    let targetDate;
    if (endDate) {
      targetDate = new Date(endDate);
    } else {
      const now = new Date();
      targetDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    }

    const currentStart = new Date(targetDate);
    currentStart.setDate(targetDate.getDate() - 7);

    // Historical windows: 4 weeks (28 days) broken down into 4 concurrent queries
    const weekStarts = [];
    for(let i=1; i<=4; i++) {
       const d = new Date(currentStart);
       d.setDate(currentStart.getDate() - (7 * i));
       weekStarts.push(d); 
    }

    const formatDt = (d) => d.toISOString().replace("T", " ").substring(0, 19);

    // 1. Fire all queries concurrently (Massive performance boost)
    const subHeadPromise = fetchPaginated(zcql, `SELECT ROWID, CrimeHeadName FROM CrimeSubHead`, "CrimeSubHead");
    const currentPromise = fetchPaginated(zcql, `SELECT DistrictID, CrimeMinorHeadID, latitude, longitude FROM CaseMaster WHERE CrimeRegisteredDate >= '${formatDt(currentStart)}' AND CrimeRegisteredDate <= '${formatDt(targetDate)}'`, "CaseMaster");
    
    const weekPromises = weekStarts.map((wStart, idx) => {
       const wEnd = idx === 0 ? currentStart : weekStarts[idx - 1];
       const q = `SELECT DistrictID, CrimeMinorHeadID FROM CaseMaster WHERE CrimeRegisteredDate >= '${formatDt(wStart)}' AND CrimeRegisteredDate < '${formatDt(wEnd)}'`;
       return fetchPaginated(zcql, q, "CaseMaster");
    });

    const [
      subHeads, 
      currentResults, 
      w1Results, 
      w2Results, 
      w3Results, 
      w4Results
    ] = await Promise.all([
       subHeadPromise, 
       currentPromise, 
       ...weekPromises
    ]);

    // 2. Process Crime Mappings
    const subHeadMap = {};
    subHeads.forEach(s => subHeadMap[s.ROWID] = s.CrimeHeadName);

    // 3. Process Historical Data
    const categoryWeeklyCounts = {};
    const processHistorical = (results, weekIndex) => {
        results.forEach((row) => {
            const dId = row.DistrictID;
            const cId = row.CrimeMinorHeadID;
            if (!dId || !cId) return;
            const key = `${dId}_${cId}`;
            if (!categoryWeeklyCounts[key]) categoryWeeklyCounts[key] = [0, 0, 0, 0];
            categoryWeeklyCounts[key][weekIndex]++;
        });
    };
    processHistorical(w1Results, 0);
    processHistorical(w2Results, 1);
    processHistorical(w3Results, 2);
    processHistorical(w4Results, 3);

    // 4. Process Current Data
    const currentCounts = {};
    const districtLocations = {};

    currentResults.forEach((row) => {
      const dId = row.DistrictID;
      const cId = row.CrimeMinorHeadID;
      if (!dId || !cId) return;

      const key = `${dId}_${cId}`;
      currentCounts[key] = (currentCounts[key] || 0) + 1;
      
      if (!districtLocations[dId]) {
        districtLocations[dId] = { lat: row.latitude, lng: row.longitude };
      }
    });

    // 5. Analyze each district + crime category
    const anomalies = [];
    const zScoreThreshold = 2.0;

    for (const [key, currentCount] of Object.entries(currentCounts)) {
      const [districtIdStr, crimeMinorHeadIdStr] = key.split("_");
      const districtId = parseInt(districtIdStr, 10);
      const crimeName = subHeadMap[crimeMinorHeadIdStr] || "Crime";

      const histWeeks = categoryWeeklyCounts[key] || [0, 0, 0, 0];
      
      const mean = histWeeks.reduce((a, b) => a + b, 0) / 4;
      const stdDev = calculateStdDev(histWeeks, mean);
      
      const safeMean = mean > 0 ? mean : 1;
      const zScore = (currentCount - safeMean) / stdDev;

      if (zScore > zScoreThreshold) {
        const spikePercentage = Math.round(((currentCount - safeMean) / safeMean) * 100);
        const loc = districtLocations[districtId];
        anomalies.push({
          alert: true,
          districtId: districtId,
          message: `Unusual ${spikePercentage}% spike in ${crimeName} cases over the last 7 days!`,
          severity: "HIGH",
          pulsingZone: loc ? { lat: loc.lat, lng: loc.lng, radius: 5000 } : null,
        });
      }
    }

    res.status(200).json({
      status: "success",
      analyzedCategories: Object.keys(currentCounts).length,
      anomaliesDetected: anomalies.length,
      alerts: anomalies,
    });
  } catch (err) {
    console.error("Anomaly Engine Error:", err.message);
    res.status(500).json({ error: "Failed to run Anomaly Detection Engine", details: err.message });
  }
});

// GET /api/v1/ai/anomalies/history
// Retrieves previously stored anomalies from the Data Store
app.get("/api/v1/ai/anomalies/history", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    let { districtId, startDate, endDate } = req.query;

    // Default to today if neither date is provided
    if (!startDate && !endDate) {
      const now = new Date();
      const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const today = istDate.toISOString().split("T")[0];
      startDate = today;
      endDate = today;
    }

    let query = `SELECT AlertID, Message, DistrictID, Severity, AlertTimestamp FROM AnomalyAlerts`;
    let filters = [];

    if (districtId) filters.push(`DistrictID = ${districtId}`);
    if (startDate) filters.push(`AlertTimestamp >= '${startDate} 00:00:00'`);
    if (endDate) filters.push(`AlertTimestamp <= '${endDate} 23:59:59'`);

    if (filters.length > 0) {
      query += ` WHERE ` + filters.join(" AND ");
    }

    const results = await zcql.executeZCQLQuery(query);
    const historicalAlerts = results.map((row) => row.AnomalyAlerts);

    // Fetch coordinates for the districts to power map pulsing on frontend
    const locQuery = `SELECT DistrictID, latitude, longitude FROM CaseMaster LIMIT 200`;
    const locResults = await zcql.executeZCQLQuery(locQuery);
    const locMap = {};
    locResults.forEach(r => {
      if(r.CaseMaster.DistrictID && !locMap[r.CaseMaster.DistrictID]) {
         locMap[r.CaseMaster.DistrictID] = { lat: r.CaseMaster.latitude, lng: r.CaseMaster.longitude };
      }
    });

    historicalAlerts.forEach(alert => {
      const loc = locMap[alert.DistrictID];
      if (loc) {
        alert.pulsingZone = { lat: loc.lat, lng: loc.lng, radius: 5000 };
      }
    });

    // Sort descending by timestamp in Node.js
    historicalAlerts.sort((a, b) => new Date(b.AlertTimestamp) - new Date(a.AlertTimestamp));

    res.status(200).json({
      status: "success",
      count: historicalAlerts.length,
      alerts: historicalAlerts,
    });
  } catch (err) {
    console.error("Error fetching historical anomalies:", err.message);
    res.status(500).json({ error: "Failed to retrieve anomaly history", details: err.message });
  }
});

module.exports = app;
