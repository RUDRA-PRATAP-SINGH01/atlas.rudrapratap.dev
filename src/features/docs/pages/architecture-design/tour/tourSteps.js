/**
 * Architecture Explorer product-tour step definitions.
 * Selectors match data-tour attributes on ArchitectureDesignPage.
 */

export const ARCH_TOUR_STORAGE_KEY = "atlas.arch-explorer.tour.completed";

export const TOUR_STEPS = [
  {
    id: "welcome",
    target: '[data-tour="canvas"]',
    title: "Welcome to the Architecture Explorer",
    body: "Explore PebbleDB's internals interactively. Every component is clickable, searchable, and linked to real implementation details.",
    placement: "bottom",
    action: "welcome",
  },
  {
    id: "navigate",
    target: '[data-tour="nav-controls"]',
    title: "Navigate the architecture",
    body: "• Scroll to zoom\n• Hold Space + Drag to pan\n• Press Fit anytime to recenter the graph",
    placement: "bottom",
    action: "pulse-fit",
  },
  {
    id: "inspect",
    target: '[data-tour="sample-node"]',
    title: "Inspect any component",
    body: "Click a node to inspect its responsibilities, ownership, implementation details, related files, and execution behavior.",
    placement: "right",
    action: "pulse-node",
  },
  {
    id: "flows",
    target: '[data-tour="flow-select"]',
    title: "Replay runtime execution",
    body: "Choose an operational flow such as Read, Write, Flush, or Recovery to watch requests move through the storage engine step-by-step.",
    placement: "left",
    action: "open-flow-select",
  },
  {
    id: "controls",
    target: '[data-tour="flow-controls"]',
    title: "Control execution",
    body: "Step through execution manually or press Play to automatically animate the request through the system.",
    placement: "left",
    action: "pulse-play",
  },
  {
    id: "projects",
    target: '[data-tour="project-toggle"]',
    title: "Switch projects instantly",
    body: "Every project has its own interactive architecture explorer with the same inspection tools and runtime walkthroughs.",
    placement: "bottom",
    action: "finish",
    finishTitle: "You're ready to explore.",
  },
];

export function hasCompletedArchTour() {
  try {
    return localStorage.getItem(ARCH_TOUR_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markArchTourCompleted() {
  try {
    localStorage.setItem(ARCH_TOUR_STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
