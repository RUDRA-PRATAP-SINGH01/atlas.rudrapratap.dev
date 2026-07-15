/**
 * Central index: maps every node ID to its architecture decision record.
 *
 * Import this in the inspector panel to look up decisions by node ID.
 * All decision records are SOURCE VERIFIED (see individual decision files).
 */

import { cliDecision, apiDecision } from "./decisions/client.js";
import { walDecision, memtableDecision, memtablePkgDecision } from "./decisions/wal.js";
import {
  flusherDecision,
  compactorDecision,
  sstableDecision,
  manifestDecision,
  bloomDecision,
} from "./decisions/persistence.js";
import {
  iteratorDecision,
  batchFlusherDecision,
  pendingFlushDecision,
  sstListDecision,
  lockDecision,
  walLogDecision,
  walFlushDecision,
  currentDecision,
  manifestFileDecision,
  sstFileDecision,
  quarantineDecision,
} from "./decisions/memory-and-disk.js";

/** @type {Record<string, import('./schema').ArchitectureDecision>} */
export const decisionsByNodeId = {
  cli: cliDecision,
  api: apiDecision,
  "active-mt": memtableDecision,
  "pending-flush": pendingFlushDecision,
  "sst-list": sstListDecision,
  "batch-flusher": batchFlusherDecision,
  flusher: flusherDecision,
  compactor: compactorDecision,
  wal: walDecision,
  "memtable-pkg": memtablePkgDecision,
  sstable: sstableDecision,
  manifest: manifestDecision,
  iterator: iteratorDecision,
  bloom: bloomDecision,
  lock: lockDecision,
  "wal-log": walLogDecision,
  "wal-flush": walFlushDecision,
  current: currentDecision,
  "manifest-file": manifestFileDecision,
  "sst-file": sstFileDecision,
  quarantine: quarantineDecision,
};

import { decisionsByNodeId as rateLimiterDecisions } from "./rate-limiter/decisions.js";

export {
  cliDecision,
  apiDecision,
  walDecision,
  memtableDecision,
  memtablePkgDecision,
  flusherDecision,
  compactorDecision,
  sstableDecision,
  manifestDecision,
  bloomDecision,
  iteratorDecision,
  batchFlusherDecision,
  pendingFlushDecision,
  sstListDecision,
  lockDecision,
  walLogDecision,
  walFlushDecision,
  currentDecision,
  manifestFileDecision,
  sstFileDecision,
  quarantineDecision,
};

/** @returns {import('./schema').ArchitectureDecision | null} */
export function getDecisionForNode(nodeId, project = "pebbledb") {
  if (project === "rate-limiter") {
    return rateLimiterDecisions[nodeId] ?? null;
  }
  return decisionsByNodeId[nodeId] ?? null;
}

