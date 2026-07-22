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

// Helper to fetch graph data with Cache implementation
async function getGraphData(catalystApp) {
  const cache = catalystApp.cache();
  const segment = cache.segment();
  const CACHE_KEY = "network_graph_data_v1";

  try {
    const cachedData = await segment.getValue(CACHE_KEY);
    if (cachedData) {
      const decompressed = zlib.inflateSync(Buffer.from(cachedData, 'base64')).toString();
      return JSON.parse(decompressed);
    }
  } catch (e) {
    // Cache miss or key doesn't exist
  }

  const zcql = catalystApp.zcql();

  // Fetch all records across paginated ZCQL
  const cases = await fetchPaginated(
    zcql,
    `SELECT CaseMasterID, CrimeNo FROM CaseMaster`,
    "CaseMaster",
  );
  const accused = await fetchPaginated(
    zcql,
    `SELECT AccusedMasterID, AccusedName, CaseMasterID FROM Accused`,
    "Accused",
  );
  const victims = await fetchPaginated(
    zcql,
    `SELECT VictimMasterID, VictimName, CaseMasterID FROM Victim`,
    "Victim",
  );

  const nodes = [];
  const links = [];
  const addedNodeIds = new Set();

  cases.forEach((c) => {
    const id = `C_${c.CaseMasterID}`;
    nodes.push({ id, label: c.CrimeNo, group: "case" });
    addedNodeIds.add(id);
  });

  accused.forEach((a) => {
    const id = `A_${a.AccusedMasterID}`;
    if (!addedNodeIds.has(id)) {
      nodes.push({ id, label: a.AccusedName, group: "accused" });
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
      nodes.push({ id, label: v.VictimName, group: "victim" });
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

  // Store in cache for 1 hour (Compressed to bypass Catalyst limits)
  try {
    const compressed = zlib.deflateSync(JSON.stringify(graphData)).toString('base64');
    await segment.put(CACHE_KEY, compressed, 1);
  } catch (err) {
    console.error("Failed to cache graph data:", err);
  }

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
app.get(["/api/v1/network/repeat-offenders", "/network/repeat-offenders"], async (req, res) => {
  try {
    const { districtIds, policeStationIds, startDate, endDate } = req.query;
    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    // 1. Build CaseMaster filter query
    let caseFilters = [];
    if (districtIds) {
      const dIds = districtIds.split(",").map(id => id.trim()).join(",");
      caseFilters.push(`DistrictID IN (${dIds})`);
    }
    if (policeStationIds) {
      const pIds = policeStationIds.split(",").map(id => id.trim()).join(",");
      caseFilters.push(`PoliceStationID IN (${pIds})`);
    }
    if (startDate) {
      caseFilters.push(`CrimeRegisteredDate >= '${startDate}'`);
    }
    if (endDate) {
      caseFilters.push(`CrimeRegisteredDate <= '${endDate}'`);
    }

    let caseQueryTemplate = `SELECT CaseMasterID, CrimeNo, PoliceStationID, CrimeMinorHeadID FROM CaseMaster`;
    if (caseFilters.length > 0) {
      caseQueryTemplate += ` WHERE ${caseFilters.join(" AND ")}`;
    }

    const cases = await fetchPaginated(zcql, caseQueryTemplate, "CaseMaster");
    
    if (cases.length === 0) {
      return res.status(200).json({ nodes: [], links: [] });
    }

    // Fetch all Accused (safer than massive IN clause) to process in-memory
    const validCaseIds = new Set(cases.map(c => c.CaseMasterID));
    const allAccused = await fetchPaginated(
      zcql,
      `SELECT AccusedMasterID, AccusedName, CaseMasterID FROM Accused`,
      "Accused"
    );

    const relevantAccused = allAccused.filter(a => validCaseIds.has(a.CaseMasterID));

    // 2. Process repeat offenders
    const accusedCounts = {};
    const accusedMap = {};
    relevantAccused.forEach(a => {
      if (!accusedCounts[a.AccusedMasterID]) {
        accusedCounts[a.AccusedMasterID] = [];
        accusedMap[a.AccusedMasterID] = a.AccusedName;
      }
      accusedCounts[a.AccusedMasterID].push(a.CaseMasterID);
    });

    const repeatOffenderIds = Object.keys(accusedCounts).filter(id => accusedCounts[id].length > 1);

    if (repeatOffenderIds.length === 0) {
      return res.status(200).json({ nodes: [], links: [] });
    }

    // 3. Lookups for MO and Jurisdiction
    const crimeSubHeads = await fetchPaginated(zcql, `SELECT CrimeSubHeadID, CrimeHeadName FROM CrimeSubHead`, "CrimeSubHead");
    const crimeSubHeadMap = {};
    crimeSubHeads.forEach(cs => {
      crimeSubHeadMap[cs.CrimeSubHeadID] = cs.CrimeHeadName;
    });

    const policeStations = await fetchPaginated(zcql, `SELECT PoliceStationID, StationName FROM PoliceStation`, "PoliceStation");
    const policeStationMap = {};
    policeStations.forEach(ps => {
      policeStationMap[ps.PoliceStationID] = ps.StationName;
    });

    // 4. Build Graph
    const nodes = [];
    const links = [];
    const addedNodes = new Set();
    const repeatOffenderCaseIds = new Set();
    
    repeatOffenderIds.forEach(id => {
      accusedCounts[id].forEach(caseId => repeatOffenderCaseIds.add(caseId));
    });

    cases.forEach((c) => {
      if (!repeatOffenderCaseIds.has(c.CaseMasterID)) return; // Skip isolated cases
      
      const id = `C_${c.CaseMasterID}`;
      nodes.push({ 
        id, 
        label: c.CrimeNo, 
        group: "case",
        mo: crimeSubHeadMap[c.CrimeMinorHeadID] || "Unknown MO",
        jurisdiction: policeStationMap[c.PoliceStationID] || "Unknown Station"
      });
      addedNodes.add(id);
    });

    repeatOffenderIds.forEach(id => {
      const aId = `A_${id}`;
      nodes.push({ id: aId, label: accusedMap[id], group: "accused" });
      addedNodes.add(aId);

      // Links to cases
      accusedCounts[id].forEach(caseId => {
        links.push({
          source: aId,
          target: `C_${caseId}`,
          label: "Repeat Offender In"
        });
      });
    });

    res.status(200).json({ nodes, links });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch repeat offenders graph", details: err.message });
  }
});

// GET /network/search (and /api/v1/network/search)
app.get(["/api/v1/network/search", "/network/search"], async (req, res) => {
  try {
    const { q, types } = req.query;
    if (!q) {
      return res.status(400).json({ error: "q query parameter is required" });
    }
    const qLower = q.toLowerCase();
    const typeList = types ? types.split(",").map(t => t.trim().toLowerCase()) : ["case", "accused", "victim"];

    const catalystApp = catalyst.initialize(req);
    const graphData = await getGraphData(catalystApp);

    const results = graphData.nodes.filter((n) => {
      if (!typeList.includes(n.group)) return false;
      if (n.label && n.label.toString().toLowerCase().includes(qLower)) return true;
      if (n.id && n.id.toLowerCase().includes(qLower)) return true;
      return false;
    }).map(n => ({ id: n.id, label: n.label, group: n.group }));

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search network graph", details: err.message });
  }
});

// GET /network/expand (and /api/v1/network/expand)
app.get(["/api/v1/network/expand", "/network/expand"], async (req, res) => {
  try {
    const { nodeId, depth } = req.query;
    if (!nodeId) {
      return res.status(400).json({ error: "nodeId query parameter is required" });
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
      (l) => visited.has(l.source) && visited.has(l.target)
    );

    res.status(200).json({ nodes: resultNodes, links: resultLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to expand node", details: err.message });
  }
});

module.exports = app;
