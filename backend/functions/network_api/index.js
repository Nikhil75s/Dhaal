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

// GET /api/v1/network/suspects
app.get("/api/v1/network/suspects", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const graphData = await getGraphData(catalystApp);
    res.status(200).json(graphData);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch network graph", details: err.message });
  }
});

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

module.exports = app;
