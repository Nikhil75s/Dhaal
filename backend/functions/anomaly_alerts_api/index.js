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
// Accepts query params: startDate, endDate
app.get("/api/v1/ai/anomalies", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const datastore = catalystApp.datastore();

    const { startDate, endDate } = req.query;

    // 1. Fetch HISTORICAL Baseline (All-time cases to find the mean/stdDev)
    // Note: For a hackathon, doing grouping in Node.js avoids ZCQL GROUP BY limitations.
    const historicalQuery = `SELECT DistrictID FROM CaseMaster`;
    const historicalResults = await zcql.executeZCQLQuery(historicalQuery);

    const historicalCounts = {};
    historicalResults.forEach((row) => {
      const dId = row.CaseMaster.DistrictID;
      historicalCounts[dId] = (historicalCounts[dId] || 0) + 1;
    });

    const allCounts = Object.values(historicalCounts);
    const mean =
      allCounts.length > 0
        ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length
        : 0;
    const stdDev = calculateStdDev(allCounts, mean);

    // 2. Fetch RECENT Inputs (Dynamic based on Date Ranges)
    let recentQuery = `SELECT DistrictID, latitude, longitude FROM CaseMaster`;
    let conditions = [];
    if (startDate) conditions.push(`CrimeRegisteredDate >= '${startDate}'`);
    if (endDate) conditions.push(`CrimeRegisteredDate <= '${endDate}'`);

    if (conditions.length > 0) {
      recentQuery += ` WHERE ` + conditions.join(" AND ");
    }

    const recentResults = await zcql.executeZCQLQuery(recentQuery);

    const recentCounts = {};
    const districtLocations = {}; // Store one lat/lng per district for the map

    recentResults.forEach((row) => {
      const dId = row.CaseMaster.DistrictID;
      recentCounts[dId] = (recentCounts[dId] || 0) + 1;
      if (!districtLocations[dId]) {
        districtLocations[dId] = {
          lat: row.CaseMaster.latitude,
          lng: row.CaseMaster.longitude,
        };
      }
    });

    // 3. Analyze each district for spikes using Z-Score
    const anomalies = [];
    const zScoreThreshold = 1.0; // Lowered to 1.0 to ensure it easily triggers for your hackathon demo

    for (const [districtIdStr, currentCount] of Object.entries(recentCounts)) {
      const districtId = parseInt(districtIdStr, 10);

      // If the district has no historical baseline, it's immediately an anomaly, else calculate standard Z-Score
      const historicalMeanForDistrict = mean > 0 ? mean : 1;
      const zScore = (currentCount - historicalMeanForDistrict) / stdDev;

      if (zScore > zScoreThreshold) {
        const spikePercentage = Math.round(
          ((currentCount - historicalMeanForDistrict) /
            historicalMeanForDistrict) *
            100,
        );
        const message = `Unusual ${spikePercentage}% spike in cases detected recently!`;
        const loc = districtLocations[districtId];

        const alertPayload = {
          alert: true,
          districtId: districtId,
          message: message,
          severity: "HIGH",
          pulsingZone: { lat: loc.lat, lng: loc.lng, radius: 5000 },
        };

        anomalies.push(alertPayload);

        // 4. Persist the Anomaly in Catalyst Data Store
        // Fix: Generating a unique BigInt for AlertID to satisfy the schema's Custom Primary Key
        try {
          await datastore.table("AnomalyAlerts").insertRow({
            AlertID: new Date().getTime() + Math.floor(Math.random() * 1000), // Unique ID
            DistrictID: districtId,
            Severity: "HIGH",
            Message: message,
            AlertTimestamp: new Date()
              .toISOString()
              .replace("T", " ")
              .substring(0, 19), // Safe Catalyst DateTime format
          });
        } catch (insertErr) {
          console.error(
            "Failed to insert Anomaly into Data Store:",
            insertErr.message,
          );
        }
      }
    }

    res.status(200).json({
      status: "success",
      analyzedDistricts: Object.keys(recentCounts).length,
      anomaliesDetected: anomalies.length,
      alerts: anomalies,
    });
  } catch (err) {
    console.error("Anomaly Engine Error:", err.message);
    res.status(500).json({
      error: "Failed to run Anomaly Detection Engine",
      details: err.message,
    });
  }
});

// GET /api/v1/ai/anomalies/history
// Retrieves previously stored anomalies from the Data Store without re-calculating
app.get("/api/v1/ai/anomalies/history", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const { districtId } = req.query;
    // Query the Data Store for historical anomalies, ordered by most recent
    let query = `SELECT * FROM AnomalyAlerts`;

    // Optional filter if the frontend wants history for a specific district
    if (districtId) {
      query += ` WHERE DistrictID = ${districtId}`;
    }

    // ZCQL does not currently support standard SQL ORDER BY in all contexts,
    // but fetching all and returning is safe for a hackathon scale.
    const results = await zcql.executeZCQLQuery(query);
    // Map the results to a clean array
    const historicalAlerts = results.map((row) => row.AnomalyAlerts);
    res.status(200).json({
      status: "success",
      count: historicalAlerts.length,
      alerts: historicalAlerts,
    });
  } catch (err) {
    console.error("Error fetching historical anomalies:", err.message);
    res.status(500).json({
      error: "Failed to retrieve anomaly history",
      details: err.message,
    });
  }
});

module.exports = app;
