require('dotenv').config();
const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const axios = require('axios');

let currentAccessToken = null;
let tokenExpiresAt = 0;

async function getValidAccessToken() {
    const now = Date.now();
    // If token is missing, or expires in less than 1 minute, refresh it
    if (!currentAccessToken || now >= (tokenExpiresAt - 60000)) {
        try {
            console.log("Refreshing Zoho Access Token...");
            const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.in/oauth/v2/token";
            const response = await axios.post(accountsUrl, null, {
                params: {
                    client_id: process.env.ZOHO_CLIENT_ID,
                    client_secret: process.env.ZOHO_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: process.env.ZOHO_REFRESH_TOKEN
                }
            });

            if (response.data && response.data.access_token) {
                currentAccessToken = response.data.access_token;
                // expires_in is in seconds
                tokenExpiresAt = now + (response.data.expires_in * 1000);
                console.log(`Successfully refreshed token. Valid for ${response.data.expires_in} seconds.`);
            } else {
                throw new Error("Invalid response from Zoho Accounts");
            }
        } catch (error) {
            console.error("Failed to refresh Zoho Access Token:", error.response?.data || error.message);
            // Fallback to the hardcoded env token if refresh fails
            if (!currentAccessToken) currentAccessToken = process.env.QUICKML_OAUTH_TOKEN;
        }
    }
    return currentAccessToken;
}

const app = express();
app.use(express.json());

app.post('/api/v1/ai/predict', async (req, res) => {
    try {
        const catalystApp = catalyst.initialize(req);

        // Ensure Authentication
        const userManagement = catalystApp.userManagement();
        try {
            await userManagement.getCurrentUser();
        } catch (err) {
            // Uncomment to enforce strict auth in production
            // return res.status(401).json({ error: "Unauthorized access" });
        }

        // The frontend only needs to send the minimal identifiers
        const {
            DistrictID,
            Month,
            Year,
            CrimeHeadID,
            CrimeMajorHeadID
        } = req.body;

        if (!DistrictID || !CrimeMajorHeadID) {
            return res.status(400).json({ error: "Missing required fields: DistrictID or CrimeMajorHeadID" });
        }

        const zcql = catalystApp.zcql();

        // 1. Fetch Socio-Economic Data from Catalyst Data Store
        const socioQuery = `SELECT PopulationDensity, PovertyIndex, UrbanizationIndex FROM SocioEconomicData WHERE DistrictID = ${DistrictID}`;
        let PopulationDensity = 0, PovertyIndex = 0, UrbanizationIndex = 0;
        
        try {
            const socioResult = await zcql.executeZCQLQuery(socioQuery);
            if (socioResult && socioResult.length > 0) {
                PopulationDensity = socioResult[0].SocioEconomicData.PopulationDensity;
                PovertyIndex = socioResult[0].SocioEconomicData.PovertyIndex;
                UrbanizationIndex = socioResult[0].SocioEconomicData.UrbanizationIndex;
            }
        } catch (err) {
            console.error("Failed to fetch SocioEconomicData:", err);
        }

        // 2. Calculate or Fetch Historical Monthly Average 
        // (Assuming you have a pre-calculated table or view. Here we simulate fetching it, or you can run a COUNT query on CaseMaster)
        let HistoricalMonthlyAverage = 3.45; // Default fallback
        try {
             // Example query if you had an averages table:
             // const avgQuery = `SELECT HistoricalMonthlyAverage FROM HistoricalAverages WHERE DistrictID = ${DistrictID} AND CrimeMajorHeadID = ${CrimeMajorHeadID}`;
             // const avgResult = await zcql.executeZCQLQuery(avgQuery);
             // if (avgResult.length > 0) HistoricalMonthlyAverage = avgResult[0].HistoricalAverages.HistoricalMonthlyAverage;
        } catch (err) {
            console.error("Failed to fetch HistoricalMonthlyAverage:", err);
        }

        // Formulate the QuickML request body precisely matching the published model schema
        const quickMlRequestBody = {
            "data": {
                "CrimeMajorHeadID": CrimeMajorHeadID,
                "DistrictID": DistrictID,
                "PopulationDensity": PopulationDensity,
                "PovertyIndex": PovertyIndex,
                "UrbanizationIndex": UrbanizationIndex,
                "Month": Month,
                "Year": Year
            },
            "CrimeHead": {
                "CrimeHeadID": CrimeHeadID,
                "ROWID": CrimeMajorHeadID // Often matches in nested Catalyst tables
            },
            "HistoricalMonthlyAverage": {
                "CrimeMajorHeadID": CrimeMajorHeadID,
                "DistrictID": DistrictID,
                "HistoricalMonthlyAverage": HistoricalMonthlyAverage
            }
        };

        // Call the QuickML Endpoint
        const quickMlUrl = process.env.QUICKML_ENDPOINT_URL;

        if (!quickMlUrl) {
            return res.status(500).json({ error: "QUICKML_ENDPOINT_URL environment variable is missing" });
        }

        let response;
        try {
            const accessToken = await getValidAccessToken();

            response = await axios.post(quickMlUrl, quickMlRequestBody, {
                headers: {
                    "X-QUICKML-ENDPOINT-KEY": process.env.QUICKML_ENDPOINT_KEY,
                    "Authorization": `Zoho-oauthtoken ${accessToken}`,
                    "CATALYST-ORG": process.env.ORG_ID,
                    "Environment": process.env.ENVIRONMENT || "Development",
                    "Content-Type": "application/json"
                }
            });
        } catch (quickMlErr) {
            console.error("QuickML API Error:", quickMlErr.response?.data || quickMlErr.message);
            return res.status(502).json({ error: "Failed to communicate with QuickML model", details: quickMlErr.response?.data });
        }

        // The regression model returns a result array
        const predictedIncidentCount = response.data.result[0];

        // Calculate the anomaly spike percentage
        const percentageIncrease = ((predictedIncidentCount - HistoricalMonthlyAverage) / HistoricalMonthlyAverage) * 100;

        // Default macro risk parameters
        let riskLevel = "LOW";
        let riskScore = 30;
        let trendDirection = "STABLE";

        if (percentageIncrease > 50) {
            riskLevel = "CRITICAL";
            riskScore = 95;
            trendDirection = "UPWARD_SPIKE";
        } else if (percentageIncrease > 20) {
            riskLevel = "HIGH";
            riskScore = 80;
            trendDirection = "INCREASING";
        } else if (percentageIncrease > 5) {
            riskLevel = "MEDIUM";
            riskScore = 55;
            trendDirection = "SLIGHT_INCREASE";
        }

        // Formulate the rich JSON response for Frontend 2 dashboard
        const enrichedResponse = {
            "timestamp": new Date().toISOString(),
            "predictions": [
                {
                    "predictionId": `PRD-${Date.now()}`,
                    "district": {
                        "districtId": DistrictID,
                        "name": `District ${DistrictID}` // Frontend can map this ID to a string
                    },
                    "macroRiskAssessment": {
                        "score": riskScore,
                        "level": riskLevel,
                        "trendDirection": trendDirection
                    },
                    "emergingAnomalies": [
                        {
                            "crimeHeadId": CrimeHeadID,
                            "historicalMonthlyAverage": HistoricalMonthlyAverage,
                            "predictedIncidentCount": parseFloat(predictedIncidentCount.toFixed(2)),
                            "percentageIncrease": parseFloat(percentageIncrease.toFixed(2)),
                            "alertMessage": percentageIncrease > 20
                                ? `Severe anomaly detected: ${percentageIncrease.toFixed(1)}% deviation from historical baseline.`
                                : "Normal trend predicted."
                        }
                    ],
                    "hiddenCorrelations": {
                        "socioEconomicDrivers": {
                            "urbanizationIndex": UrbanizationIndex,
                            "povertyIndex": PovertyIndex,
                            "populationDensity": PopulationDensity,
                            "aiInsight": `QuickML Analysis: Evaluated based on urbanization index of ${UrbanizationIndex} and population density of ${PopulationDensity}.`
                        }
                    },
                    "rawQuickMlExplainability": response.data.explanation
                }
            ]
        };

        res.json(enrichedResponse);

    } catch (error) {
        console.error("Error in AI Prediction API:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

module.exports = app;
