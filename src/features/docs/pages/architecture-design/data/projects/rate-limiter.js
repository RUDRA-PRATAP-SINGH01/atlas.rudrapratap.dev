/**
 * Rate Limiter architecture pack — loaded only when this project is active.
 */
import {
  GRAPH_META,
  edges,
  getGraphBounds,
  groups,
  nodes,
} from "../rate-limiter/graph.js";
import { flows } from "../rate-limiter/flows.js";
import { decisionsByNodeId } from "../rate-limiter/decisions.js";

export default {
  projectId: "rate-limiter",
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
