"use strict";

const express = require("express");
const cors = require("cors");
const catalyst = require("zcatalyst-sdk-node");

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/v1/data/socio-economic
app.get("/api/v1/data/socio-economic", async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);
        const zcql = catalystApp.zcql();

        const query = `SELECT * FROM SocioEconomicData`;
        const results = await zcql.executeZCQLQuery(query);

        // Map it so it's clean for the frontend (handling Catalyst ZCQL casing differences)
        const formattedData = results.map((row) => {
            const data = row.SocioEconomicData || {};
            return {
                districtId: data.DistrictID || data.districtID || data.DistrictId || data.districtId,
                urbanizationIndex: data.UrbanizationIndex || data.urbanizationIndex,
                povertyIndex: data.PovertyIndex || data.povertyIndex,
                populationDensity: data.PopulationDensity || data.populationDensity
            };
        });

        res.status(200).json(formattedData);
    } catch (err) {
        console.error("Error fetching socio-economic data:", err);
        res.status(500).json({
            error: "Failed to fetch socio-economic data",
            details: err.message,
        });
    }
});

module.exports = app;
