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

// Helper to fetch repeat offenders graph data
async function getRepeatOffendersData(catalystApp, filters) {
  const zcql = catalystApp.zcql();
  
  // 1. Build CaseMaster query with filters
  let caseQuery = `SELECT CaseMasterID, CrimeNo, CrimeMajorHeadID, PoliceStationID, DistrictID FROM CaseMaster`;
  const conditions = [];
  if (filters.districtIds) {
    conditions.push(`DistrictID IN (${filters.districtIds})`);
  }
  if (filters.policeStationIds) {
    conditions.push(`PoliceStationID IN (${filters.policeStationIds})`);
  }
  if (conditions.length > 0) {
    caseQuery += ` WHERE ` + conditions.join(' AND ');
  }
  
  const cases = await fetchPaginated(zcql, caseQuery, "CaseMaster");
  const caseMap = new Map();
  cases.forEach(c => caseMap.set(c.CaseMasterID, c));
  
  // 2. Fetch Accused
  const accused = await fetchPaginated(zcql, `SELECT AccusedMasterID, AccusedName, CaseMasterID FROM Accused`, "Accused");
  
  // 3. Group Accused by AccusedMasterID for cases in our filtered map
  const accusedGroups = {};
  accused.forEach(a => {
    if (caseMap.has(a.CaseMasterID)) {
      if (!accusedGroups[a.AccusedMasterID]) {
        accusedGroups[a.AccusedMasterID] = { name: a.AccusedName, cases: new Set() };
      }
      accusedGroups[a.AccusedMasterID].cases.add(a.CaseMasterID);
    }
  });
  
  // 4. Filter for repeat offenders (> 1 case)
  const repeatOffenders = [];
  const relevantCaseIds = new Set();
  
  Object.keys(accusedGroups).forEach(id => {
    const group = accusedGroups[id];
    if (group.cases.size > 1) {
      repeatOffenders.push({ id, name: group.name, cases: Array.from(group.cases) });
      group.cases.forEach(cId => relevantCaseIds.add(cId));
    }
  });
  
  // 5. Fetch CrimeHead and PoliceStation to enrich cases
  const crimeHeads = await fetchPaginated(zcql, `SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead`, "CrimeHead");
  const chMap = new Map();
  crimeHeads.forEach(ch => chMap.set(ch.CrimeHeadID, ch.CrimeGroupName));
  
  const policeStations = await fetchPaginated(zcql, `SELECT PoliceStationID, StationName FROM PoliceStation`, "PoliceStation");
  const psMap = new Map();
  policeStations.forEach(ps => psMap.set(ps.PoliceStationID, ps.StationName));
  
  // 6. Build Nodes and Links
  const nodes = [];
  const links = [];
  
  repeatOffenders.forEach(ro => {
    const nodeId = `A_${ro.id}`;
    nodes.push({ id: nodeId, label: ro.name || 'Unknown Accused', group: 'accused' });
    
    ro.cases.forEach(cId => {
      links.push({ source: nodeId, target: `C_${cId}`, label: 'Accused In' });
    });
  });
  
  relevantCaseIds.forEach(cId => {
    const c = caseMap.get(cId);
    if (c) {
      const mo = chMap.get(c.CrimeMajorHeadID) || 'Unknown MO';
      const jurisdiction = psMap.get(c.PoliceStationID) || 'Unknown Jurisdiction';
      
      nodes.push({
        id: `C_${cId}`,
        label: c.CrimeNo || 'Unknown Case',
        group: 'case',
        mo,
        jurisdiction
      });
    }
  });
  
  return { nodes, links };
}

// GET /api/v1/network/repeat-offenders
app.get("/api/v1/network/repeat-offenders", async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const filters = {
      districtIds: req.query.districtIds,
      policeStationIds: req.query.policeStationIds,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const graphData = await getRepeatOffendersData(catalystApp, filters);
    res.status(200).json(graphData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch repeat offenders graph", details: err.message });
  }
});

// GET /api/v1/network/search
app.get("/api/v1/network/search", async (req, res) => {
  try {
    const { q, types } = req.query;
    if (!q) {
      return res.status(200).json({ nodes: [] });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    let searchTypes = ["case", "accused", "victim"];
    if (types) {
      searchTypes = types.split(",").map(t => t.trim().toLowerCase());
    }

    const nodes = [];

    // Cases
    if (searchTypes.includes("case")) {
      const cases = await zcql.executeZCQLQuery(`SELECT CaseMasterID, CrimeNo FROM CaseMaster WHERE CrimeNo LIKE '%${q}%' LIMIT 50`);
      cases.forEach(r => {
        nodes.push({ id: `C_${r.CaseMaster.CaseMasterID}`, label: r.CaseMaster.CrimeNo || 'Unknown Case', group: "case", type: "case" });
      });
    }

    // Accused
    if (searchTypes.includes("accused")) {
      const accused = await zcql.executeZCQLQuery(`SELECT AccusedMasterID, AccusedName FROM Accused WHERE AccusedName LIKE '%${q}%' LIMIT 50`);
      const added = new Set();
      accused.forEach(r => {
        const id = `A_${r.Accused.AccusedMasterID}`;
        if (!added.has(id)) {
          nodes.push({ id, label: r.Accused.AccusedName || 'Unknown Accused', group: "accused", type: "accused" });
          added.add(id);
        }
      });
    }

    // Victim
    if (searchTypes.includes("victim")) {
      const victims = await zcql.executeZCQLQuery(`SELECT VictimMasterID, VictimName FROM Victim WHERE VictimName LIKE '%${q}%' LIMIT 50`);
      const added = new Set();
      victims.forEach(r => {
        const id = `V_${r.Victim.VictimMasterID}`;
        if (!added.has(id)) {
          nodes.push({ id, label: r.Victim.VictimName || 'Unknown Victim', group: "victim", type: "victim" });
          added.add(id);
        }
      });
    }

    res.status(200).json({ nodes });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Failed to search", details: err.message });
  }
});

// GET /api/v1/network/expand
app.get("/api/v1/network/expand", async (req, res) => {
  try {
    const { nodeId, depth } = req.query;
    if (!nodeId) {
      return res.status(400).json({ error: "nodeId is required" });
    }

    const catalystApp = catalyst.initialize(req);
    const zcql = catalystApp.zcql();

    const nodes = [];
    const links = [];
    const addedNodeIds = new Set();
    const addedLinkKeys = new Set();

    const addNode = (id, label, group) => {
      if (!addedNodeIds.has(id)) {
        nodes.push({ id, label: label || 'Unknown', group });
        addedNodeIds.add(id);
      }
    };

    const addLink = (source, target, label) => {
      const key = `${source}-${target}`;
      if (!addedLinkKeys.has(key)) {
        links.push({ source, target, label });
        addedLinkKeys.add(key);
      }
    };

    // If expanding a case, fetch all its accused and victims
    if (nodeId.startsWith("C_")) {
      const caseId = nodeId.split("_")[1];
      const caseRes = await zcql.executeZCQLQuery(`SELECT CaseMasterID, CrimeNo FROM CaseMaster WHERE CaseMasterID = ${caseId}`);
      if (caseRes.length > 0) {
        addNode(nodeId, caseRes[0].CaseMaster.CrimeNo, "case");
      }

      const accused = await zcql.executeZCQLQuery(`SELECT AccusedMasterID, AccusedName FROM Accused WHERE CaseMasterID = ${caseId}`);
      accused.forEach(r => {
        const aid = `A_${r.Accused.AccusedMasterID}`;
        addNode(aid, r.Accused.AccusedName, "accused");
        addLink(aid, nodeId, "Accused In");
      });

      const victims = await zcql.executeZCQLQuery(`SELECT VictimMasterID, VictimName FROM Victim WHERE CaseMasterID = ${caseId}`);
      victims.forEach(r => {
        const vid = `V_${r.Victim.VictimMasterID}`;
        addNode(vid, r.Victim.VictimName, "victim");
        addLink(vid, nodeId, "Victim In");
      });
    } 
    // If expanding Accused or Victim, fetch all cases they are in, then fetch those cases
    else if (nodeId.startsWith("A_") || nodeId.startsWith("V_")) {
      const isAccused = nodeId.startsWith("A_");
      const entityId = nodeId.split("_")[1];
      const tableName = isAccused ? "Accused" : "Victim";
      const idField = isAccused ? "AccusedMasterID" : "VictimMasterID";
      const nameField = isAccused ? "AccusedName" : "VictimName";
      const linkLabel = isAccused ? "Accused In" : "Victim In";

      const casesInvolved = await zcql.executeZCQLQuery(`SELECT ${idField}, ${nameField}, CaseMasterID FROM ${tableName} WHERE ${idField} = ${entityId}`);
      
      for (const row of casesInvolved) {
        const r = row[tableName];
        addNode(nodeId, r[nameField], isAccused ? "accused" : "victim");
        
        if (r.CaseMasterID) {
          const cid = `C_${r.CaseMasterID}`;
          addLink(nodeId, cid, linkLabel);
          
          const caseRes = await zcql.executeZCQLQuery(`SELECT CaseMasterID, CrimeNo FROM CaseMaster WHERE CaseMasterID = ${r.CaseMasterID}`);
          if (caseRes.length > 0) {
            addNode(cid, caseRes[0].CaseMaster.CrimeNo, "case");
          }
        }
      }
    }

    res.status(200).json({ nodes, links });
  } catch (err) {
    console.error("Expand error:", err);
    res.status(500).json({ error: "Failed to expand node", details: err.message });
  }
});

// GET /api/v1/network/path
app.get("/api/v1/network/path", async (req, res) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) {
      return res.status(400).json({ error: "source and target query parameters are required" });
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
