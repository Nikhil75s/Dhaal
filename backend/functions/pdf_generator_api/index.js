"use strict";

const express = require("express");
const cors = require("cors");
const catalyst = require("zcatalyst-sdk-node");

const app = express();
app.use(cors());
app.use(express.json());

const SMARTBROWZ_TEMPLATE_ID = process.env.SMARTBROWZ_TEMPLATE_ID;
const BUCKET_NAME = process.env.STRATUS_BUCKET_NAME; 
const STRATUS_PUBLIC_URL = process.env.STRATUS_PUBLIC_URL;

// POST /api/v1/reports/generate
app.post("/api/v1/reports/generate", async (req, res) => {
    try {
        const { districtName, districtId, message, severity, alertId } = req.body;

        if (!districtName || !message || !severity) {
            return res.status(400).json({ error: "Missing required fields: districtName, message, severity" });
        }

        const catalystApp = catalyst.initialize(req);
        const smartbrowz = catalystApp.smartbrowz();
        const stratus = catalystApp.stratus();
        const datastore = catalystApp.datastore();

        // 1. Generate PDF using the Professional SmartBrowz Template
        console.log("Generating PDF from SmartBrowz Template...");
        const pdfStream = await smartbrowz.generateFromTemplate(SMARTBROWZ_TEMPLATE_ID.toString(), {
            template_data: {
                "District": districtName,
                "AlertMessage": message,
                "Severity": severity
            },
            output_options: {
                output_type: 'pdf'
            }
        });

        // Convert stream to Buffer
        const chunks = [];
        for await (let chunk of pdfStream) {
            chunks.push(chunk);
        }
        const pdfBuffer = Buffer.concat(chunks);
        console.log("PDF Buffer Generated Successfully!");

        // 2. Upload to Stratus using the official Catalyst SDK
        const fileName = `intelligence-brief-${districtName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        
        console.log(`Uploading directly to Stratus bucket: ${BUCKET_NAME}`);
        
        // Use bucket() or bucketInstance() depending on SDK version (some versions use .bucket)
        const bucket = stratus.bucket ? stratus.bucket(BUCKET_NAME) : stratus.bucketInstance(BUCKET_NAME);
        
        // Use putObject to upload the Buffer directly to the bucket securely!
        await bucket.putObject(fileName, pdfBuffer);
        
        // Construct the public URL for the frontend
        const downloadUrl = `${STRATUS_PUBLIC_URL}/${fileName}`;
        console.log("Successfully uploaded to Stratus:", downloadUrl);

        // 3. Persist the anomaly first if it's a live one without an alertId
        let finalAlertId = alertId;
        if (!finalAlertId && districtId) {
            try {
                const zcql = catalystApp.zcql();
                const today = new Date().toISOString().split('T')[0];
                const query = `SELECT ROWID FROM AnomalyAlerts WHERE DistrictID = ${districtId} AND Message = '${message.replace(/'/g, "''")}' AND AlertTimestamp >= '${today} 00:00:00'`;
                const searchRes = await zcql.executeZCQLQuery(query);
                
                if (searchRes && searchRes.length > 0) {
                    finalAlertId = searchRes[0].AnomalyAlerts.ROWID;
                    console.log("Reused existing live anomaly from Data Store, ROWID:", finalAlertId);
                } else {
                    const insertedAlert = await datastore.table('AnomalyAlerts').insertRow({
                        DistrictID: districtId,
                        Severity: severity,
                        Message: message,
                        AlertTimestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    });
                    finalAlertId = insertedAlert.ROWID;
                    console.log("Saved new live anomaly to Data Store, ROWID:", finalAlertId);
                }
            } catch (alertErr) {
                console.error("Failed to save or query live anomaly in DB:", alertErr.message);
            }
        }

        // 4. Persist the report in Catalyst Data Store
        if (finalAlertId) {
            try {
                const zcql = catalystApp.zcql();
                const reportQuery = `SELECT ROWID FROM IntelligenceReports WHERE AlertID = ${finalAlertId}`;
                const reportRes = await zcql.executeZCQLQuery(reportQuery);
                
                if (reportRes && reportRes.length > 0) {
                    console.log("IntelligenceReport already exists for this alert, skipping duplicate insert.");
                } else {
                    await datastore.table('IntelligenceReports').insertRow({
                        AlertID: finalAlertId,
                        PdfUrl: downloadUrl,
                        GeneratedDate: new Date().toISOString().replace('T', ' ').substring(0, 19)
                    });
                    console.log("Saved report metadata to Data Store");
                }
            } catch (dbErr) {
                console.error("Failed to save report to DB:", dbErr.message);
                // We don't fail the request if just DB insert fails, return the URL anyway
            }
        }

        // 4. Return the exact Stratus URL to Frontend 2
        res.status(200).json({
            status: "success",
            fileName: fileName,
            downloadUrl: downloadUrl
        });

    } catch (err) {
        console.error("PDF Generator Error:", err.message);
        res.status(500).json({
            error: "Failed to generate or upload Intelligence Brief",
            details: err.message
        });
    }
});

module.exports = app;
