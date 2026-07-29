/**
 * Lazy-load + cache architecture project packs so inactive project data
 * stays out of the initial architecture chunk.
 */

const loaders = {
  pebbledb: () => import("./projects/pebbledb.js"),
  "rate-limiter": () => import("./projects/rate-limiter.js"),
};

/** @type {Record<string, Promise<import('./projects/pebbledb.js').default>>} */
const cache = Object.create(null);

export function loadProjectPack(projectId) {
  const id = projectId === "rate-limiter" ? "rate-limiter" : "pebbledb";
  if (!cache[id]) {
    cache[id] = loaders[id]().then((mod) => mod.default);
  }
  return cache[id];
}

/** Kick off a fetch without awaiting (idle prefetch). */
export function prefetchProjectPack(projectId) {
  void loadProjectPack(projectId);
}

export function peekProjectIdFromUrl() {
  if (typeof window === "undefined") return "pebbledb";
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("project") === "rate-limiter" ? "rate-limiter" : "pebbledb";
  } catch {
    return "pebbledb";
  }
}

// Start the URL project as soon as this module evaluates (overlaps React mount).
prefetchProjectPack(peekProjectIdFromUrl());
