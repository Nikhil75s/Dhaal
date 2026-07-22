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

// GET /api/v1/ai/anomalies
// Calculates a live 7-day moving average anomaly test (Does NOT persist to DB)
app.get("/api/v1/ai/anomalies", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    let { endDate } = req.query;
    const targetDate = endDate ? new Date(endDate) : new Date();

    // Current window: 7 days ending on targetDate
    const currentStart = new Date(targetDate);
    currentStart.setDate(targetDate.getDate() - 7);

    // Historical window: 4 weeks (28 days) before the current window
    const historicalStart = new Date(currentStart);
    historicalStart.setDate(currentStart.getDate() - 28);

    const formatDt = (d) => d.toISOString().replace("T", " ").substring(0, 19);

    // 1. Fetch HISTORICAL Cases (Previous 4 Weeks)
    const historicalQuery = `SELECT DistrictID, CrimeRegisteredDate FROM CaseMaster WHERE CrimeRegisteredDate >= '${formatDt(historicalStart)}' AND CrimeRegisteredDate < '${formatDt(currentStart)}'`;
    const historicalResults = await zcql.executeZCQLQuery(historicalQuery);

    const districtWeeklyCounts = {};
    historicalResults.forEach((row) => {
      const dId = row.CaseMaster.DistrictID;
      // Catalyst returns date strings, parse safely
      const date = new Date(row.CaseMaster.CrimeRegisteredDate.replace(" ", "T"));
      const daysDiff = Math.floor((currentStart - date) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7); // 0, 1, 2, 3

      if (weekIndex >= 0 && weekIndex < 4) {
        if (!districtWeeklyCounts[dId]) districtWeeklyCounts[dId] = [0, 0, 0, 0];
        districtWeeklyCounts[dId][weekIndex]++;
      }
    });

    // 2. Fetch CURRENT Cases (Last 7 Days)
    const currentQuery = `SELECT DistrictID, latitude, longitude FROM CaseMaster WHERE CrimeRegisteredDate >= '${formatDt(currentStart)}' AND CrimeRegisteredDate <= '${formatDt(targetDate)}'`;
    const currentResults = await zcql.executeZCQLQuery(currentQuery);

    const currentCounts = {};
    const districtLocations = {};

    currentResults.forEach((row) => {
      const dId = row.CaseMaster.DistrictID;
      currentCounts[dId] = (currentCounts[dId] || 0) + 1;
      if (!districtLocations[dId]) {
        districtLocations[dId] = { lat: row.CaseMaster.latitude, lng: row.CaseMaster.longitude };
      }
    });

    // 3. Analyze each district using Moving Average Z-Score
    const anomalies = [];
    const zScoreThreshold = 2.0; // Standard statistical threshold

    for (const [districtIdStr, currentCount] of Object.entries(currentCounts)) {
      const districtId = parseInt(districtIdStr, 10);
      const histWeeks = districtWeeklyCounts[districtId] || [0, 0, 0, 0];

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
          message: `Unusual ${spikePercentage}% spike in cases over the last 7 days!`,
          severity: "HIGH",
          pulsingZone: { lat: loc.lat, lng: loc.lng, radius: 5000 },
        });
        // Note: We no longer persist to DB here. This is a pure idempotent test endpoint.
      }
    }

    res.status(200).json({
      status: "success",
      analyzedDistricts: Object.keys(currentCounts).length,
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
      const today = new Date().toISOString().split("T")[0];
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
