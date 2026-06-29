import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function DocsSidebar() {
  const location = useLocation();

  const [expanded, setExpanded] = useState({
    pebbleDb: true,
    architecture: location.pathname.startsWith("/project-docs/guide/architecture"),
    coreComponents: location.pathname.startsWith("/project-docs/guide/core-components"),
    internals: location.pathname.startsWith("/project-docs/guide/internals"),
    implementation: location.pathname.startsWith("/project-docs/guide/implementation"),
    designDecisions: location.pathname.startsWith("/project-docs/guide/design-decisions") || 
                    location.pathname.startsWith("/project-docs/guide/system-invariants") ||
                    location.pathname.startsWith("/project-docs/guide/engineering-tradeoffs") ||
                    location.pathname.startsWith("/project-docs/guide/evolution") ||
                    location.pathname.startsWith("/project-docs/guide/lessons-learned"),
    performance: location.pathname.startsWith("/project-docs/guide/performance"),
    testing: location.pathname.startsWith("/project-docs/guide/testing"),
    debugging: location.pathname.startsWith("/project-docs/guide/debugging"),
    reference: location.pathname.startsWith("/project-docs/guide/reference"),
    timeline: location.pathname.startsWith("/project-docs/guide/reference/development-timeline") ||
              location.pathname.startsWith("/project-docs/guide/reference/milestones"),
  });

  const toggleSection = (section) => {
    setExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const preventDefaultLink = (e) => {
    e.preventDefault();
  };

  // Helper to determine link styles
  const getLinkClass = (path) => {
    return `guide-sidebar-link ${
      location.pathname === path ? "guide-sidebar-link--active" : ""
    }`;
  };

  const renderChevron = (isOpen) => (
    <svg
      className={`chevron-icon ${isOpen ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transition: "transform 0.2s ease" }}
    >
      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <aside className="guide-sidebar-left" aria-label="Documentation Categories">
      <div className="guide-sidebar-left-content">
        
        {/* PebbleDB Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("pebbleDb")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.pebbleDb}
          >
            <span>PebbleDB</span>
            {renderChevron(expanded.pebbleDb)}
          </button>
          {expanded.pebbleDb && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide" className={getLinkClass("/project-docs/guide")}>
                  Introduction
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/setup" className={getLinkClass("/project-docs/guide/setup")}>
                  Project Setup
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/lsm-fundamentals" className={getLinkClass("/project-docs/guide/lsm-fundamentals")}>
                  LSM Tree Fundamentals
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Architecture Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("architecture")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.architecture}
          >
            <span>Architecture</span>
            {renderChevron(expanded.architecture)}
          </button>
          {expanded.architecture && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/system-overview" className={getLinkClass("/project-docs/guide/architecture/system-overview")}>
                  System Overview
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/write-path" className={getLinkClass("/project-docs/guide/architecture/write-path")}>
                  Write Path
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/read-path" className={getLinkClass("/project-docs/guide/architecture/read-path")}>
                  Read Path
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/scan-path" className={getLinkClass("/project-docs/guide/architecture/scan-path")}>
                  Scan Path
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/crash-recovery" className={getLinkClass("/project-docs/guide/architecture/crash-recovery")}>
                  Crash Recovery
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/shutdown-sequence" className={getLinkClass("/project-docs/guide/architecture/shutdown-sequence")}>
                  Shutdown Sequence
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/architecture/concurrency-model" className={getLinkClass("/project-docs/guide/architecture/concurrency-model")}>
                  Concurrency Model
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Core Components Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("coreComponents")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.coreComponents}
          >
            <span>Core Components</span>
            {renderChevron(expanded.coreComponents)}
          </button>
          {expanded.coreComponents && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/core-components/wal" className={getLinkClass("/project-docs/guide/core-components/wal")}>
                  Write-Ahead Log (WAL)
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/core-components/memtable" className={getLinkClass("/project-docs/guide/core-components/memtable")}>
                  MemTable
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/core-components/skiplist" className={getLinkClass("/project-docs/guide/core-components/skiplist")}>
                  Skip List
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/core-components/sstable" className={getLinkClass("/project-docs/guide/core-components/sstable")}>
                  SSTables
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/core-components/manifest" className={getLinkClass("/project-docs/guide/core-components/manifest")}>
                  Manifest
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link
                  to="/project-docs/guide/core-components/bloom-filter"
                  className={getLinkClass("/project-docs/guide/core-components/bloom-filter")}
                >
                  Bloom Filter
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link
                  to="/project-docs/guide/core-components/block-cache"
                  className={getLinkClass("/project-docs/guide/core-components/block-cache")}
                >
                  Block Cache
                </Link>
              </li>
                <li className="guide-sidebar-group-item">
                  <Link
                    to="/project-docs/guide/core-components/merge-iterator"
                    className={getLinkClass("/project-docs/guide/core-components/merge-iterator")}
                  >
                    Merge Iterator
                  </Link>
                </li>
            </ul>
          )}
        </div>

        {/* Storage Engine Internals Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("internals")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.internals}
          >
            <span>Storage Engine Internals</span>
            {renderChevron(expanded.internals)}
          </button>
          {expanded.internals && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/internals/sstable-layout" className={getLinkClass("/project-docs/guide/internals/sstable-layout")}>
                  SSTable Layout
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/internals/wal-record-format" className={getLinkClass("/project-docs/guide/internals/wal-record-format")}>
                  WAL Record Format
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/internals/manifest-format" className={getLinkClass("/project-docs/guide/internals/manifest-format")}>
                  Manifest Format
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/internals/block-format" className={getLinkClass("/project-docs/guide/internals/block-format")}>
                  Block Format
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/internals/file-layout" className={getLinkClass("/project-docs/guide/internals/file-layout")}>
                  File Layout
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Implementation Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("implementation")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.implementation}
          >
            <span>Implementation</span>
            {renderChevron(expanded.implementation)}
          </button>
          {expanded.implementation && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/package-structure" className={getLinkClass("/project-docs/guide/implementation/package-structure")}>
                  Package Structure
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/db-lifecycle" className={getLinkClass("/project-docs/guide/implementation/db-lifecycle")}>
                  Database Lifecycle
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/flush-pipeline" className={getLinkClass("/project-docs/guide/implementation/flush-pipeline")}>
                  Flush Pipeline
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/wal-truncate" className={getLinkClass("/project-docs/guide/implementation/wal-truncate")}>
                  WAL Truncation
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/compaction-pipeline" className={getLinkClass("/project-docs/guide/implementation/compaction-pipeline")}>
                  Compaction Pipeline
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/implementation/recovery-pipeline" className={getLinkClass("/project-docs/guide/implementation/recovery-pipeline")}>
                  Recovery Pipeline
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Design Decisions Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("designDecisions")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.designDecisions}
          >
            <span>Design Decisions</span>
            {renderChevron(expanded.designDecisions)}
          </button>
          {expanded.designDecisions && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/design-decisions" className={getLinkClass("/project-docs/guide/design-decisions")}>
                  Design Decisions
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/system-invariants" className={getLinkClass("/project-docs/guide/system-invariants")}>
                  System Invariants
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/engineering-tradeoffs" className={getLinkClass("/project-docs/guide/engineering-tradeoffs")}>
                  Engineering Trade-offs
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/evolution" className={getLinkClass("/project-docs/guide/evolution")}>
                  Evolution
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/lessons-learned" className={getLinkClass("/project-docs/guide/lessons-learned")}>
                  Lessons Learned
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Performance Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("performance")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.performance}
          >
            <span>Performance</span>
            {renderChevron(expanded.performance)}
          </button>
          {expanded.performance && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/performance/benchmark-methodology" className={getLinkClass("/project-docs/guide/performance/benchmark-methodology")}>
                  Benchmark Methodology
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/performance/benchmark-results" className={getLinkClass("/project-docs/guide/performance/benchmark-results")}>
                  Benchmark Results
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/performance/memory-usage" className={getLinkClass("/project-docs/guide/performance/memory-usage")}>
                  Memory Usage
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/performance/read-write-performance" className={getLinkClass("/project-docs/guide/performance/read-write-performance")}>
                  Read & Write Performance
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Testing Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("testing")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.testing}
          >
            <span>Testing</span>
            {renderChevron(expanded.testing)}
          </button>
          {expanded.testing && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/testing/testing-strategy" className={getLinkClass("/project-docs/guide/testing/testing-strategy")}>
                  Testing Strategy
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/testing/crash-testing" className={getLinkClass("/project-docs/guide/testing/crash-testing")}>
                  Crash Testing
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/testing/failure-injection" className={getLinkClass("/project-docs/guide/testing/failure-injection")}>
                  Failure Injection
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/testing/race-detection" className={getLinkClass("/project-docs/guide/testing/race-detection")}>
                  Race Detection
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Debugging & Postmortems Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("debugging")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.debugging}
          >
            <span>Debugging & Postmortems</span>
            {renderChevron(expanded.debugging)}
          </button>
          {expanded.debugging && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/wal-replay-bug" className={getLinkClass("/project-docs/guide/debugging/wal-replay-bug")}>
                  WAL Replay Bug
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/manifest-consistency" className={getLinkClass("/project-docs/guide/debugging/manifest-consistency")}>
                  Manifest Consistency
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/compaction-race" className={getLinkClass("/project-docs/guide/debugging/compaction-race")}>
                  Compaction Race
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/reader-lifecycle" className={getLinkClass("/project-docs/guide/debugging/reader-lifecycle")}>
                  Reader Lifecycle
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/scan-lock-contention" className={getLinkClass("/project-docs/guide/debugging/scan-lock-contention")}>
                  Scan Lock Contention
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/debugging/shutdown-ordering" className={getLinkClass("/project-docs/guide/debugging/shutdown-ordering")}>
                  Shutdown Ordering
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Reference Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("reference")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.reference}
          >
            <span>Reference</span>
            {renderChevron(expanded.reference)}
          </button>
          {expanded.reference && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/configuration" className={getLinkClass("/project-docs/guide/reference/configuration")}>
                  Configuration
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/cli" className={getLinkClass("/project-docs/guide/reference/cli")}>
                  CLI
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/project-structure" className={getLinkClass("/project-docs/guide/reference/project-structure")}>
                  Project Structure
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/source-code-tour" className={getLinkClass("/project-docs/guide/reference/source-code-tour")}>
                  Source Code Tour
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* Timeline Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("timeline")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.timeline}
          >
            <span>Timeline</span>
            {renderChevron(expanded.timeline)}
          </button>
          {expanded.timeline && (
            <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/development-timeline" className={getLinkClass("/project-docs/guide/reference/development-timeline")}>
                  Development Timeline
                </Link>
              </li>
              <li className="guide-sidebar-group-item">
                <Link to="/project-docs/guide/reference/milestones" className={getLinkClass("/project-docs/guide/reference/milestones")}>
                  Milestones
                </Link>
              </li>
            </ul>
          )}
        </div>

      </div>
    </aside>
  );
}
