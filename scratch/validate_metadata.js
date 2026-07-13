import { nodes, edges, groups } from "../src/features/docs/pages/architecture-design/data/graph.js";
import { decisionsByNodeId } from "../src/features/docs/pages/architecture-design/data/index.js";
import { flows } from "../src/features/docs/pages/architecture-design/data/flows.js";

console.log("=== PEBBLEDB ARCHITECTURE METADATA VALIDATION ===");

let exitCode = 0;
function logError(msg) {
  console.error(`[ERROR] ${msg}`);
  exitCode = 1;
}

function logWarning(msg) {
  console.warn(`[WARNING] ${msg}`);
}

// 1. Verify Nodes
const nodeIds = new Set();
for (const node of nodes) {
  if (!node.id) {
    logError("Node is missing 'id' field.");
  } else if (nodeIds.has(node.id)) {
    logError(`Duplicate Node ID: '${node.id}'`);
  } else {
    nodeIds.add(node.id);
  }

  if (!node.label) {
    logError(`Node '${node.id}' is missing 'label'.`);
  }
  if (!node.kind) {
    logError(`Node '${node.id}' is missing 'kind'.`);
  }
}
console.log(`- Verified ${nodeIds.size} nodes.`);

// 2. Verify Edges
const edgeIds = new Set();
const edgePairs = new Set();
for (const edge of edges) {
  if (!edge.id) {
    logError("Edge is missing 'id' field.");
  } else if (edgeIds.has(edge.id)) {
    logError(`Duplicate Edge ID: '${edge.id}'`);
  } else {
    edgeIds.add(edge.id);
  }

  if (!edge.from || !edge.to) {
    logError(`Edge '${edge.id}' is missing 'from' or 'to'.`);
    continue;
  }

  if (!nodeIds.has(edge.from)) {
    logError(`Edge '${edge.id}' references non-existent source node: '${edge.from}'`);
  }
  if (!nodeIds.has(edge.to)) {
    logError(`Edge '${edge.id}' references non-existent target node: '${edge.to}'`);
  }

  const pairKey = `${edge.from}->${edge.to}`;
  const reversePairKey = `${edge.to}->${edge.from}`;
  if (edgePairs.has(pairKey) || edgePairs.has(reversePairKey)) {
    logWarning(`Duplicate or redundant edge relationship between '${edge.from}' and '${edge.to}'.`);
  } else {
    edgePairs.add(pairKey);
  }
}
console.log(`- Verified ${edgeIds.size} edges.`);

// 3. Verify Groups
const groupIds = new Set();
for (const g of groups) {
  if (!g.id) {
    logError("Group is missing 'id'.");
  } else if (groupIds.has(g.id)) {
    logError(`Duplicate Group ID: '${g.id}'`);
  } else {
    groupIds.add(g.id);
  }
}
console.log(`- Verified ${groupIds.size} groups.`);

// 4. Verify Decisions
const decisionsCount = Object.keys(decisionsByNodeId).length;
for (const [nodeId, decision] of Object.entries(decisionsByNodeId)) {
  if (!nodeIds.has(nodeId)) {
    logError(`Decision index maps node ID '${nodeId}' which is absent from graph nodes.`);
  }

  if (decision.nodeId !== nodeId) {
    logError(`Decision for '${nodeId}' has mismatched internal nodeId '${decision.nodeId}'.`);
  }

  if (!decision.title) {
    logError(`Decision for '${nodeId}' is missing 'title'.`);
  }

  if (!decision.category) {
    logError(`Decision for '${nodeId}' is missing 'category'.`);
  }

  if (!decision.summary) {
    logError(`Decision for '${nodeId}' is missing 'summary'.`);
  }

  const validEvidence = ["source-verified", "documented", "measured", "derived", "simulated", "theoretical", "configured", "not-measured"];
  if (!validEvidence.includes(decision.evidenceStatus)) {
    logError(`Decision for '${nodeId}' has invalid evidenceStatus: '${decision.evidenceStatus}'`);
  }

  // Check metrics evidence status
  if (decision.metrics) {
    for (const m of decision.metrics) {
      if (!validEvidence.includes(m.evidenceType)) {
        logError(`Metric '${m.name}' in decision '${nodeId}' has invalid evidenceType: '${m.evidenceType}'`);
      }
    }
  }

  // Check alternatives evidence status
  if (decision.alternatives) {
    for (const alt of decision.alternatives) {
      if (alt.evidenceStatus && !validEvidence.includes(alt.evidenceStatus)) {
        logError(`Alternative '${alt.name}' in decision '${nodeId}' has invalid evidenceStatus: '${alt.evidenceStatus}'`);
      }
    }
  }
}
console.log(`- Verified ${decisionsCount} decision records.`);

// 5. Verify Flows
for (const flow of flows) {
  if (!flow.id) {
    logError("Flow is missing 'id'.");
    continue;
  }
  if (!flow.title) {
    logError(`Flow '${flow.id}' is missing 'title'.`);
  }
  if (!flow.steps || flow.steps.length === 0) {
    logError(`Flow '${flow.id}' has no steps.`);
    continue;
  }

  const flowStepIds = new Set();
  for (const step of flow.steps) {
    if (!step.id) {
      logError(`Flow '${flow.id}' has a step missing 'id'.`);
    } else if (flowStepIds.has(step.id)) {
      logError(`Flow '${flow.id}' has duplicate step ID: '${step.id}'`);
    } else {
      flowStepIds.add(step.id);
    }

    if (!nodeIds.has(step.nodeId)) {
      logError(`Flow '${flow.id}' step '${step.id}' references non-existent node: '${step.nodeId}'`);
    }
  }
}
console.log(`- Verified ${flows.length} operational walkthrough flows.`);

if (exitCode === 0) {
  console.log("SUCCESS: All architecture metadata, indices, decisions, and walkthrough flows are valid and consistent!");
} else {
  console.error("FAILURE: Validation detected inconsistencies in metadata. See errors above.");
}

process.exit(exitCode);
