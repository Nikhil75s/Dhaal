"use strict";

const express = require("express");
const cors = require("cors");
const catalyst = require("zcatalyst-sdk-node");

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/v1/reports/history
app.get("/api/v1/reports/history", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    // Perform INNER JOIN between IntelligenceReports and AnomalyAlerts
    // Note: IntelligenceReports.AlertID is a Catalyst Lookup column, so it stores the ROWID of AnomalyAlerts!
    const query = `
            SELECT * 
            FROM IntelligenceReports 
            INNER JOIN AnomalyAlerts ON IntelligenceReports.AlertID = AnomalyAlerts.ROWID 
            ORDER BY IntelligenceReports.GeneratedDate DESC
        `;

    const results = await zcql.executeZCQLQuery(query);

    // Flatten the response by safely extracting whatever casing ZCQL returns
    const formattedReports = results.map((row) => {
      const r = row.IntelligenceReports || {};
      const a = row.AnomalyAlerts || {};
      return {
        id: r.ReportID || r.reportID || r.ReportId || r.reportId,
        date: r.GeneratedDate || r.generatedDate,
        pdfUrl: r.PdfUrl || r.pdfUrl,
        severity: a.Severity || a.severity,
        districtId:
          a.DistrictID || a.districtID || a.DistrictId || a.districtId,
        message: a.Message || a.message,
      };
    });

    res.status(200).json(formattedReports);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to fetch historical reports",
      details: err.message,
    });
  }
});

module.exports = app;
