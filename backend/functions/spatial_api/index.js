"use strict";
const express = require("express");
const catalyst = require("zcatalyst-sdk-node");
const zlib = require("zlib");

const app = express();
app.use(express.json());

// Enable CORS for frontend integration
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  if (req.method === "OPTIONS") {
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    return res.status(200).json({});
  }
  next();
});

// GET /api/v1/map/clusters
app.get("/api/v1/map/clusters", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);

    // Optional filters from query params
    const districtId = req.query.districtId || "all";
    const dateFilter = req.query.date || "all";

    // Setup Cache
    const cache = catalystApp.cache();
    const segment = cache.segment();
    const cacheKey = `hotspots_${dateFilter}_${districtId}`;

    try {
      // 1. Try Cache First
      const cachedData = await segment.getValue(cacheKey);
      if (cachedData) {
        console.log(`Cache HIT for key: ${cacheKey}`);
        const decompressed = zlib
          .inflateSync(Buffer.from(cachedData, "base64"))
          .toString();
        return res.status(200).json(JSON.parse(decompressed));
      }
    } catch (e) {
      console.log(`Cache MISS for key: ${cacheKey}`);
    }

    // 2. Query Data Store (ZCQL)
    const zcql = catalystApp.zcql();

    // Base Query joining CaseMaster and CrimeHead
    // Note: CaseMaster.CrimeMajorHeadID is a Catalyst Lookup column, so it stores the ROWID of CrimeHead!
    let query = `
            SELECT CaseMaster.CaseMasterID, CaseMaster.ROWID, CaseMaster.DistrictID, CaseMaster.latitude, CaseMaster.longitude, CaseMaster.CrimeRegisteredDate, CrimeHead.CrimeGroupName 
            FROM CaseMaster 
            INNER JOIN CrimeHead ON CaseMaster.CrimeMajorHeadID = CrimeHead.ROWID
        `;

    // Append WHERE clauses if filters exist
    const conditions = [];
    if (districtId !== "all") {
      conditions.push(`CaseMaster.DistrictID = ${districtId}`);
    }

    if (dateFilter !== "all") {
      conditions.push(`CaseMaster.CrimeRegisteredDate LIKE '${dateFilter}%'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    // Remove the hardcoded LIMIT, we will paginate
    // query += ` LIMIT 1000`;

    // Implement Pagination Loop to bypass ZCQL 300 limit!
    let offset = 1;
    let limit = 200;
    let allResults = [];

    while (true) {
      const paginatedQuery = `${query} LIMIT ${limit} OFFSET ${offset}`;
      const results = await zcql.executeZCQLQuery(paginatedQuery);
      allResults = allResults.concat(results);

      if (results.length < limit) break;
      offset += limit;
    }

    // 3. Store in Cache (Compressed to bypass Catalyst 32KB free-tier limits!)
    try {
      const compressed = zlib
        .deflateSync(JSON.stringify(allResults))
        .toString("base64");
      await segment.put(cacheKey, compressed, 1);
    } catch (e) {
      console.error("Error setting cache:", e.message);
    }

    return res.status(200).json(allResults);
  } catch (err) {
    console.error("Error fetching map clusters:", err);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});
// GET /api/v1/map/case/:caseId
app.get("/api/v1/map/case/:caseId", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();
    const caseId = req.params.caseId;

    // 1. Fetch Case details
    const caseQuery = `SELECT CaseMaster.ROWID, CaseMaster.CaseMasterID, CaseMaster.CrimeNo, CaseMaster.BriefFacts, CaseMaster.CrimeRegisteredDate, CrimeHead.CrimeGroupName FROM CaseMaster INNER JOIN CrimeHead ON CaseMaster.CrimeMajorHeadID = CrimeHead.ROWID WHERE CaseMaster.CaseMasterID = ${caseId}`;
    const caseResult = await zcql.executeZCQLQuery(caseQuery);

    if (!caseResult || caseResult.length === 0) {
      return res.status(404).json({ error: "Case not found" });
    }

    const caseRowId = caseResult[0].CaseMaster.ROWID;

    // 2. Fetch Accused
    const accusedQuery = `SELECT Accused.AccusedName, Accused.AgeYear, Accused.GenderID FROM Accused WHERE Accused.CaseMasterID = ${caseRowId}`;
    const accusedResult = await zcql.executeZCQLQuery(accusedQuery);

    // 3. Fetch Victims
    const victimQuery = `SELECT Victim.VictimName, Victim.AgeYear, Victim.GenderID FROM Victim WHERE Victim.CaseMasterID = ${caseRowId}`;
    const victimResult = await zcql.executeZCQLQuery(victimQuery);

    // Format response
    const responseData = {
      details: {
        CaseMasterID: caseResult[0].CaseMaster.CaseMasterID,
        CrimeNo: caseResult[0].CaseMaster.CrimeNo,
        BriefFacts: caseResult[0].CaseMaster.BriefFacts,
        CrimeRegisteredDate: caseResult[0].CaseMaster.CrimeRegisteredDate,
        CrimeGroupName: caseResult[0].CrimeHead.CrimeGroupName,
      },
      accused: accusedResult.map((a) => a.Accused),
      victims: victimResult.map((v) => v.Victim),
    };

    return res.status(200).json(responseData);
  } catch (err) {
    console.error("Error fetching case details:", err);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

module.exports = app;
