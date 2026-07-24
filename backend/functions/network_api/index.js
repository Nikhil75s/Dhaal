"use strict";

const express = require("express");
const cors = require("cors");
const catalyst = require("zcatalyst-sdk-node");
const zlib = require("zlib");

const app = express();
app.use(cors());
app.use(express.json());

// Helper to handle ZCQL Pagination (1-indexed OFFSET)
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

let inMemoryGraphCache = null;
let inMemoryGraphCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Helper to fetch graph data with Cache implementation
async function getGraphData(catalystApp) {
  // Use Node.js in-memory cache to bypass strict Catalyst cache size limits
  if (inMemoryGraphCache && Date.now() - inMemoryGraphCacheTime < CACHE_TTL) {
    return inMemoryGraphCache;
  }

  const zcql = catalystApp.zcql();

  // Fetch all records across paginated ZCQL
  const cases = await fetchPaginated(
    zcql,
    `SELECT ROWID, CrimeNo, PoliceStationID, CrimeMinorHeadID, BriefFacts, CrimeRegisteredDate FROM CaseMaster`,
    "CaseMaster",
  );
  const accused = await fetchPaginated(
    zcql,
    `SELECT AccusedMasterID, AccusedName, AgeYear, GenderID, CaseMasterID FROM Accused`,
    "Accused",
  );
  const victims = await fetchPaginated(
    zcql,
    `SELECT VictimMasterID, VictimName, AgeYear, GenderID, CaseMasterID FROM Victim`,
    "Victim",
  );

  const nodes = [];
  const links = [];
  const addedNodeIds = new Set();

  // Lookups for MO and Jurisdiction
  const crimeSubHeads = await fetchPaginated(zcql, `SELECT ROWID, CrimeHeadName FROM CrimeSubHead`, "CrimeSubHead");
  const crimeSubHeadMap = {};
  crimeSubHeads.forEach(cs => { crimeSubHeadMap[cs.ROWID] = cs.CrimeHeadName; });

  const policeStations = await fetchPaginated(zcql, `SELECT ROWID, StationName FROM PoliceStation`, "PoliceStation");
  const policeStationMap = {};
  policeStations.forEach(ps => { policeStationMap[ps.ROWID] = ps.StationName; });

  cases.forEach((c) => {
    // Note: Accused/Victim tables store CaseMaster.ROWID in their CaseMasterID foreign key columns
    const id = `C_${c.ROWID}`;
    nodes.push({ 
      id, 
      label: c.CrimeNo, 
      group: "case",
      mo: crimeSubHeadMap[c.CrimeMinorHeadID] || "Unknown MO",
      jurisdiction: policeStationMap[c.PoliceStationID] || "Unknown Station",
      date: c.CrimeRegisteredDate ? c.CrimeRegisteredDate.split(' ')[0] : null,
      briefFacts: c.BriefFacts || "No summary available."
    });
    addedNodeIds.add(id);
  });

  accused.forEach((a) => {
    const id = `A_${a.AccusedMasterID}`;
    if (!addedNodeIds.has(id)) {
      nodes.push({ 
        id, 
        label: a.AccusedName, 
        group: "accused",
        age: a.AgeYear,
        gender: a.GenderID == 1 ? 'Male' : a.GenderID == 2 ? 'Female' : 'Unknown'
      });
      addedNodeIds.add(id);
    }
    // Link Accused -> Case
    links.push({
      source: id,
      target: `C_${a.CaseMasterID}`,
      label: "Accused In",
    });
  });

  victims.forEach((v) => {
    const id = `V_${v.VictimMasterID}`;
    if (!addedNodeIds.has(id)) {
      nodes.push({ 
        id, 
        label: v.VictimName, 
        group: "victim",
        age: v.AgeYear,
        gender: v.GenderID == 1 ? 'Male' : v.GenderID == 2 ? 'Female' : 'Unknown'
      });
      addedNodeIds.add(id);
    }
    // Link Victim -> Case
    links.push({
      source: id,
      target: `C_${v.CaseMasterID}`,
      label: "Victim In",
    });
  });

  const graphData = { nodes, links };

  // Store in memory cache
  inMemoryGraphCache = graphData;
  inMemoryGraphCacheTime = Date.now();

  return graphData;
}

// GET /api/v1/network/path
app.get("/api/v1/network/path", async (req, res) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) {
      return res
        .status(400)
        .json({ error: "source and target query parameters are required" });
    }

    const catalystApp = catalyst.initialize(req);
    const graphData = await getGraphData(catalystApp);

    // Build Adjacency List for undirected graph
    const adj = {};
    graphData.nodes.forEach((n) => (adj[n.id] = []));
    graphData.links.forEach((l) => {
      if (!adj[l.source]) adj[l.source] = [];
      if (!adj[l.target]) adj[l.target] = [];
      adj[l.source].push(l.target);
      adj[l.target].push(l.source);
    });

    // Breadth-First Search
    const q = [source];
    const visited = new Set([source]);
    const parent = {};
    let found = false;

    while (q.length > 0) {
      const curr = q.shift();
      if (curr === target) {
        found = true;
        break;
      }
      for (const neighbor of adj[curr] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent[neighbor] = curr;
          q.push(neighbor);
        }
      }
    }

    if (!found) {
      return res
        .status(404)
        .json({ error: "No connection found between the source and target." });
    }

    // Reconstruct Path
    const pathNodeIds = [];
    let curr = target;
    while (curr) {
      pathNodeIds.push(curr);
      curr = parent[curr];
    }
    pathNodeIds.reverse(); // [source, ..., target]

    // Extract sub-graph
    const resultNodes = graphData.nodes.filter((n) =>
      pathNodeIds.includes(n.id),
    );
    const resultLinks = [];
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      const s = pathNodeIds[i];
      const t = pathNodeIds[i + 1];
      const link = graphData.links.find(
        (l) =>
          (l.source === s && l.target === t) ||
          (l.source === t && l.target === s),
      );
      if (link) resultLinks.push(link);
    }

    res.status(200).json({ nodes: resultNodes, links: resultLinks });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to calculate path", details: err.message });
  }
});

// GET /network/repeat-offenders (and /api/v1/network/repeat-offenders)
app.get(
  ["/api/v1/network/repeat-offenders", "/network/repeat-offenders"],
  async (req, res) => {
    try {
      const { districtIds, policeStationIds, startDate, endDate } = req.query;
      const catalystApp = catalyst.initialize(req);
      const zcql = catalystApp.zcql();

      // 1. Build CaseMaster filter query
      let caseFilters = [];
      if (districtIds) {
        const dIds = districtIds
          .split(",")
          .map((id) => id.trim())
          .join(",");
        caseFilters.push(`DistrictID IN (${dIds})`);
      }
      if (policeStationIds) {
        const pIds = policeStationIds
          .split(",")
          .map((id) => id.trim())
          .join(",");
        // policeStationIds are custom IDs, but CaseMaster stores ROWIDs. Convert them first.
        const psRows = await zcql.executeZCQLQuery(
          `SELECT ROWID FROM PoliceStation WHERE PoliceStationID IN (${pIds})`,
        );
        if (psRows.length > 0) {
          const rowIds = psRows
            .map((r) => `'${r.PoliceStation.ROWID}'`)
            .join(",");
          caseFilters.push(`PoliceStationID IN (${rowIds})`);
        } else {
          caseFilters.push(`PoliceStationID IN ('INVALID')`);
        }
      }
      if (startDate) {
        caseFilters.push(`CrimeRegisteredDate >= '${startDate}'`);
      }
      if (endDate) {
        caseFilters.push(`CrimeRegisteredDate <= '${endDate}'`);
      }

      let caseQueryTemplate = `SELECT ROWID, CrimeNo, PoliceStationID, CrimeMinorHeadID FROM CaseMaster`;
      if (caseFilters.length > 0) {
        caseQueryTemplate += ` WHERE ${caseFilters.join(" AND ")}`;
      }

      const cases = await fetchPaginated(zcql, caseQueryTemplate, "CaseMaster");

      if (cases.length === 0) {
        return res.status(200).json({ nodes: [], links: [] });
      }

      // 2. Fetch the global cached graph for instant calculations
      const graphData = await getGraphData(catalystApp);

      const validCaseIds = new Set(cases.map((c) => `C_${c.ROWID}`));

      // 3. Find suspects involved in District cases & map their global history
      const suspectsOfInterest = new Set();
      const suspectGlobalCaseIds = {};

      graphData.links.forEach((link) => {
        if (link.label === "Accused In") {
          const suspectId = link.source;
          const caseId = link.target;

          if (!suspectGlobalCaseIds[suspectId]) {
            suspectGlobalCaseIds[suspectId] = [];
          }
          suspectGlobalCaseIds[suspectId].push(caseId);

          if (validCaseIds.has(caseId)) {
            suspectsOfInterest.add(suspectId);
          }
        }
      });

      // 4. Sort and keep the Top 20 most prolific offenders to prevent a "spider web" graph
      const sortedSuspects = Array.from(suspectsOfInterest)
        .filter((id) => suspectGlobalCaseIds[id].length > 1)
        .sort(
          (a, b) =>
            suspectGlobalCaseIds[b].length - suspectGlobalCaseIds[a].length,
        );

      const repeatOffenderIds = sortedSuspects.slice(0, 20);

      if (repeatOffenderIds.length === 0) {
        return res.status(200).json({ nodes: [], links: [] });
      }

      // 5. Gather ALL case IDs for these repeat offenders
      const repeatOffenderCaseIds = new Set();
      repeatOffenderIds.forEach((id) => {
        suspectGlobalCaseIds[id].forEach((caseId) =>
          repeatOffenderCaseIds.add(caseId),
        );
      });

      // 6. Fetch details for out-of-district cases so they can render properly
      // Note: our cached graph uses C_ prefix for cases, we need the raw ID
      const missingCaseIds = Array.from(repeatOffenderCaseIds)
        .filter((caseId) => !validCaseIds.has(caseId))
        .map((caseId) => caseId.replace("C_", ""));

      let extraCases = [];
      if (missingCaseIds.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < missingCaseIds.length; i += chunkSize) {
          const chunk = missingCaseIds.slice(i, i + chunkSize);
          const ids = chunk.map((id) => `'${id}'`).join(",");
          const results = await zcql.executeZCQLQuery(
            `SELECT ROWID, CrimeNo, PoliceStationID, CrimeMinorHeadID FROM CaseMaster WHERE ROWID IN (${ids})`,
          );
          extraCases = extraCases.concat(results.map((r) => r.CaseMaster));
        }
      }

      const allRelevantCases = [...cases, ...extraCases];

      // 3. Lookups for MO and Jurisdiction
      const crimeSubHeads = await fetchPaginated(
        zcql,
        `SELECT ROWID, CrimeHeadName FROM CrimeSubHead`,
        "CrimeSubHead",
      );
      const crimeSubHeadMap = {};
      crimeSubHeads.forEach((cs) => {
        crimeSubHeadMap[cs.ROWID] = cs.CrimeHeadName;
      });

      const policeStations = await fetchPaginated(
        zcql,
        `SELECT ROWID, StationName FROM PoliceStation`,
        "PoliceStation",
      );
      const policeStationMap = {};
      policeStations.forEach((ps) => {
        policeStationMap[ps.ROWID] = ps.StationName;
      });

      // 4. Build Graph
      const nodes = [];
      const links = [];
      const addedNodes = new Set();

      // Create a map to quickly grab Accused names from the cached graph
      const cachedNodeMap = new Map();
      graphData.nodes.forEach((n) => cachedNodeMap.set(n.id, n.label));

      allRelevantCases.forEach((c) => {
        const id = `C_${c.ROWID}`;
        if (!repeatOffenderCaseIds.has(id)) return; // Skip isolated cases

        nodes.push({
          id,
          label: c.CrimeNo,
          group: "case",
          mo: crimeSubHeadMap[c.CrimeMinorHeadID] || "Unknown MO",
          jurisdiction:
            policeStationMap[c.PoliceStationID] || "Unknown Station",
        });
        addedNodes.add(id);
      });

      repeatOffenderIds.forEach((id) => {
        nodes.push({
          id,
          label: cachedNodeMap.get(id) || "Unknown",
          group: "accused",
        });
        addedNodes.add(id);

        // Links to cases
        suspectGlobalCaseIds[id].forEach((caseId) => {
          links.push({
            source: id,
            target: caseId,
            label: "Repeat Offender In",
          });
        });
      });

      res.status(200).json({ nodes, links });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Failed to fetch repeat offenders graph",
        details: err.message,
      });
    }
  },
);

// GET /network/search (and /api/v1/network/search)
app.get(["/api/v1/network/search", "/network/search"], async (req, res) => {
  try {
    const { q, types } = req.query;
    if (!q) {
      return res.status(400).json({ error: "q query parameter is required" });
    }
    const qLower = q.toLowerCase();
    const typeList = types
      ? types.split(",").map((t) => t.trim().toLowerCase())
      : ["case", "accused", "victim"];

    const catalystApp = catalyst.initialize(req);
    const graphData = await getGraphData(catalystApp);

    const cases = [];
    const accused = [];
    const victims = [];

    for (const n of graphData.nodes) {
      if (!typeList.includes(n.group)) continue;

      const matchesLabel =
        n.label && n.label.toString().toLowerCase().includes(qLower);
      const matchesId = n.id && n.id.toLowerCase().includes(qLower);

      if (matchesLabel || matchesId) {
        const item = { id: n.id, label: n.label, group: n.group };
        if (n.group === "case" && cases.length < 15) cases.push(item);
        else if (n.group === "accused" && accused.length < 15)
          accused.push(item);
        else if (n.group === "victim" && victims.length < 15)
          victims.push(item);
      }

      // Early exit if we have enough of all requested types
      const maxCases = typeList.includes("case") ? 15 : 0;
      const maxAccused = typeList.includes("accused") ? 15 : 0;
      const maxVictims = typeList.includes("victim") ? 15 : 0;
      if (
        cases.length >= maxCases &&
        accused.length >= maxAccused &&
        victims.length >= maxVictims
      ) {
        break;
      }
    }

    const results = [...cases, ...accused, ...victims];

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to search network graph", details: err.message });
  }
});

// GET /network/expand (and /api/v1/network/expand)
app.get(["/api/v1/network/expand", "/network/expand"], async (req, res) => {
  try {
    const { nodeId, depth } = req.query;
    if (!nodeId) {
      return res
        .status(400)
        .json({ error: "nodeId query parameter is required" });
    }
    const maxDepth = depth ? parseInt(depth, 10) : 1;

    const catalystApp = catalyst.initialize(req);
    const graphData = await getGraphData(catalystApp);

    // Build Adjacency List for undirected graph
    const adj = {};
    graphData.nodes.forEach((n) => (adj[n.id] = []));
    graphData.links.forEach((l) => {
      if (!adj[l.source]) adj[l.source] = [];
      if (!adj[l.target]) adj[l.target] = [];
      adj[l.source].push(l.target);
      adj[l.target].push(l.source);
    });

    if (!adj[nodeId]) {
      return res.status(404).json({ error: "Node not found" });
    }

    // Breadth-First Search to find nodes within maxDepth
    const q = [{ id: nodeId, d: 0 }];
    const visited = new Set([nodeId]);

    while (q.length > 0) {
      const { id, d } = q.shift();
      if (d < maxDepth) {
        for (const neighbor of adj[id] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            q.push({ id: neighbor, d: d + 1 });
          }
        }
      }
    }

    const resultNodes = graphData.nodes.filter((n) => visited.has(n.id));
    const resultLinks = graphData.links.filter(
      (l) => visited.has(l.source) && visited.has(l.target),
    );

    res.status(200).json({ nodes: resultNodes, links: resultLinks });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to expand node", details: err.message });
  }
});

module.exports = app;
