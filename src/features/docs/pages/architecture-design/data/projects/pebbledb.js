/**
 * PebbleDB architecture pack — loaded only when this project is active.
 */
import {
  GRAPH_META,
  edges,
  getGraphBounds,
  groups,
  nodes,
} from "../graph.js";
import { flows } from "../flows.js";
import { decisionsByNodeId } from "../index.js";

export default {
  projectId: "pebbledb",
  GRAPH_META,
  nodes,
  edges,
  groups,
  getGraphBounds,
  flows,
  getDecisionForNode(nodeId) {
    return decisionsByNodeId[nodeId] ?? null;
  },
};
