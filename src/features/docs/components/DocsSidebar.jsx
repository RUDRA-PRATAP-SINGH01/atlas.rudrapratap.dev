import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function DocsSidebar() {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Auto-close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const [expanded, setExpanded] = useState({
    pebbleDb: location.pathname.startsWith("/project-docs") && !location.pathname.startsWith("/project-docs/guide/rate-limiter"),
    rateLimit: location.pathname.startsWith("/docs/distributed-rate-limiter") || location.pathname.startsWith("/project-docs/guide/rate-limiter"),
    rlIntro: location.pathname.startsWith("/docs/distributed-rate-limiter/introduction"),
    rlArch: location.pathname.startsWith("/docs/distributed-rate-limiter/architecture"),
    rlEngine: location.pathname.startsWith("/docs/distributed-rate-limiter/rate-limiting-engine"),
    rlResilience: location.pathname.startsWith("/docs/distributed-rate-limiter/resilience"),
    rlRouting: location.pathname.startsWith("/docs/distributed-rate-limiter/request-routing"),
    rlObs: location.pathname.startsWith("/docs/distributed-rate-limiter/observability"),
    rlPerformance: location.pathname.startsWith("/docs/distributed-rate-limiter/performance-lab"),
    rlProduction: location.pathname.startsWith("/docs/distributed-rate-limiter/production-engineering"),
    rlVerification: location.pathname.startsWith("/docs/distributed-rate-limiter/correctness-and-verification"),
    rlJournal: location.pathname.startsWith("/docs/distributed-rate-limiter/engineering-journal"),
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
    reference: location.pathname === "/project-docs/reference" ||
               location.pathname.startsWith("/project-docs/guide/reference"),
    timeline: location.pathname.startsWith("/project-docs/guide/reference/development-timeline") ||
              location.pathname.startsWith("/project-docs/guide/reference/milestones"),
    improvements: location.pathname.startsWith("/project-docs/guide/improvements"),
  });

  const toggleSection = (section) => {
    setExpanded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
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
    <>
      <button 
        className="guide-mobile-menu-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle Documentation Navigation Menu"
      >
        {isMobileOpen ? (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        )}
        <span>docs menu</span>
      </button>

      {isMobileOpen && (
        <div 
          className="guide-mobile-menu-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`guide-sidebar-left ${isMobileOpen ? "guide-sidebar-left--mobile-open" : ""}`} aria-label="Documentation Categories">
        <div className="guide-sidebar-left-content">
        
        {/* Back to Docs Hub Link */}
        <div className="guide-sidebar-group" style={{ marginBottom: 12 }}>
          <Link 
            to="/project-docs" 
            className="guide-sidebar-link"
            style={{ 
              fontSize: 12, 
              fontWeight: "600", 
              color: "rgba(255, 255, 255, 0.45)", 
              display: "flex", 
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px", 
              textDecoration: "none"
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ verticalAlign: 'middle' }}>
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to Docs Hub
          </Link>
        </div>

        {/* Top-level Introduction/Overview Link */}
        <div className="guide-sidebar-group" style={{ marginBottom: 16 }}>
          <Link 
            to="/project-docs/guide" 
            className={getLinkClass("/project-docs/guide")} 
            style={{ 
              fontSize: 13, 
              fontWeight: "bold", 
              color: "#ffffff", 
              display: "block", 
              padding: "6px 12px", 
              background: location.pathname === "/project-docs/guide" ? "rgba(255, 92, 173, 0.08)" : "transparent", 
              borderRadius: 6, 
              border: location.pathname === "/project-docs/guide" ? "1px solid rgba(255, 92, 173, 0.25)" : "1px solid transparent",
              textDecoration: "none"
            }}
          >
            Overview & Welcome
          </Link>
        </div>

        {/* PebbleDB Section */}
        <div className="guide-sidebar-group">
          <button
            onClick={() => toggleSection("pebbleDb")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.pebbleDb}
            style={{ fontWeight: "bold", color: "#ffffff" }}
          >
            <span>PebbleDB</span>
            {renderChevron(expanded.pebbleDb)}
          </button>

          {expanded.pebbleDb && (
            <div style={{ marginLeft: 8, borderLeft: "1px solid rgba(255, 255, 255, 0.05)", paddingLeft: 8 }}>
              {/* Introduction, Project Setup, LSM Tree Fundamentals */}
              <ul className="guide-sidebar-group-list" style={{ marginTop: 6, marginBottom: 12 }}>
                <li className="guide-sidebar-group-item">
                  <Link to="/project-docs/guide/pebbledb/introduction" className={getLinkClass("/project-docs/guide/pebbledb/introduction")}>
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
                      <Link to="/project-docs/guide/core-components/bloom-filter" className={getLinkClass("/project-docs/guide/core-components/bloom-filter")}>
                        Bloom Filter
                      </Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/project-docs/guide/core-components/block-cache" className={getLinkClass("/project-docs/guide/core-components/block-cache")}>
                        Block Cache
                      </Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/project-docs/guide/core-components/merge-iterator" className={getLinkClass("/project-docs/guide/core-components/merge-iterator")}>
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
                        Read &amp; Write Performance
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
                  <span>Debugging &amp; Postmortems</span>
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
                      <Link to="/project-docs/reference" className={getLinkClass("/project-docs/reference")}>
                        Reference Overview
                      </Link>
                    </li>
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

              {/* Fallbacks & Improvements Section */}
              <div className="guide-sidebar-group">
                <button
                  onClick={() => toggleSection("improvements")}
                  className="guide-sidebar-dropdown-toggle"
                  aria-expanded={expanded.improvements}
                  style={{ color: "#ff5cad" }}
                >
                  <span>Fallbacks &amp; Improvements</span>
                  {renderChevron(expanded.improvements)}
                </button>
                {expanded.improvements && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/project-docs/guide/improvements/production-failures" className={getLinkClass("/project-docs/guide/improvements/production-failures")}>
                        Production Failures
                      </Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/project-docs/guide/improvements/required-features" className={getLinkClass("/project-docs/guide/improvements/required-features")}>
                        Required Features
                      </Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/project-docs/guide/improvements/proposed-fixes" className={getLinkClass("/project-docs/guide/improvements/proposed-fixes")}>
                        Proposed Fixes
                      </Link>
                    </li>
                  </ul>
                )}
              </div>

            </div>
          )}
        </div>

        {/* ─── DISTRIBUTED RATE LIMITER SECTION ─── */}
        <div className="guide-sidebar-group" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => toggleSection("rateLimit")}
            className="guide-sidebar-dropdown-toggle"
            aria-expanded={expanded.rateLimit}
            style={{ fontWeight: "bold", color: "#ff5cad" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 9, padding: "2px 5px", borderRadius: 4,
                background: "rgba(255,92,173,0.15)", color: "#ff5cad",
                fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase"
              }}>NEW</span>
              Distributed Rate Limiter
            </span>
            {renderChevron(expanded.rateLimit)}
          </button>

          {expanded.rateLimit && (
            <div style={{ marginLeft: 8, borderLeft: "1px solid rgba(255,92,173,0.1)", paddingLeft: 8 }}>

              {/* 1. INTRODUCTION */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlIntro")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlIntro}>
                  <span>1. Introduction</span>
                  {renderChevron(expanded.rlIntro)}
                </button>
                {expanded.rlIntro && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/introduction/start-here" className={getLinkClass("/docs/distributed-rate-limiter/introduction/start-here")}>Start Here</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/introduction/the-problem" className={getLinkClass("/docs/distributed-rate-limiter/introduction/the-problem")}>The Problem</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/introduction/guarantees-and-limitations" className={getLinkClass("/docs/distributed-rate-limiter/introduction/guarantees-and-limitations")}>Guarantees &amp; Limitations</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/introduction/five-minute-technical-tour" className={getLinkClass("/docs/distributed-rate-limiter/introduction/five-minute-technical-tour")}>5-Minute Technical Tour</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 2. ARCHITECTURE */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlArch")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlArch}>
                  <span>2. Architecture</span>
                  {renderChevron(expanded.rlArch)}
                </button>
                {expanded.rlArch && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/system-at-a-glance" className={getLinkClass("/docs/distributed-rate-limiter/architecture/system-at-a-glance")}>System at a Glance</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/anatomy-of-a-request" className={getLinkClass("/docs/distributed-rate-limiter/architecture/anatomy-of-a-request")}>Anatomy of a Request</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/why-this-architecture" className={getLinkClass("/docs/distributed-rate-limiter/architecture/why-this-architecture")}>Why This Architecture?</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/distributed-state-model" className={getLinkClass("/docs/distributed-rate-limiter/architecture/distributed-state-model")}>Distributed State Model</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/system-invariants" className={getLinkClass("/docs/distributed-rate-limiter/architecture/system-invariants")}>System Invariants</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/architecture/engineering-trade-offs" className={getLinkClass("/docs/distributed-rate-limiter/architecture/engineering-trade-offs")}>Engineering Trade-offs</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 3. RATE LIMITING ENGINE */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlEngine")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlEngine}>
                  <span>3. Rate Limiting Engine</span>
                  {renderChevron(expanded.rlEngine)}
                </button>
                {expanded.rlEngine && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/rate-limiting-engine/algorithm-explorer" className={getLinkClass("/docs/distributed-rate-limiter/rate-limiting-engine/algorithm-explorer")}>Algorithm Explorer</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/rate-limiting-engine/redis-lua-atomicity" className={getLinkClass("/docs/distributed-rate-limiter/rate-limiting-engine/redis-lua-atomicity")}>Redis + Lua Atomicity</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/rate-limiting-engine/hierarchical-quotas" className={getLinkClass("/docs/distributed-rate-limiter/rate-limiting-engine/hierarchical-quotas")}>Hierarchical Quotas</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/rate-limiting-engine/multi-replica-correctness" className={getLinkClass("/docs/distributed-rate-limiter/rate-limiting-engine/multi-replica-correctness")}>Multi-Replica Correctness</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/rate-limiting-engine/configuration-overrides" className={getLinkClass("/docs/distributed-rate-limiter/rate-limiting-engine/configuration-overrides")}>Configuration Overrides</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 4. RESILIENCE */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlResilience")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlResilience}>
                  <span>4. Resilience</span>
                  {renderChevron(expanded.rlResilience)}
                </button>
                {expanded.rlResilience && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/failure-model" className={getLinkClass("/docs/distributed-rate-limiter/resilience/failure-model")}>Failure Model</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/circuit-breaker" className={getLinkClass("/docs/distributed-rate-limiter/resilience/circuit-breaker")}>Circuit Breaker</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/idempotency" className={getLinkClass("/docs/distributed-rate-limiter/resilience/idempotency")}>Idempotency</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight" className={getLinkClass("/docs/distributed-rate-limiter/resilience/denial-cache-and-singleflight")}>Denial Cache &amp; Singleflight</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/failure-latency-budgets" className={getLinkClass("/docs/distributed-rate-limiter/resilience/failure-latency-budgets")}>Failure Latency Budgets</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/resilience/recovery-behaviour" className={getLinkClass("/docs/distributed-rate-limiter/resilience/recovery-behaviour")}>Recovery Behaviour</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 5. REQUEST ROUTING */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlRouting")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlRouting}>
                  <span>5. Request Routing</span>
                  {renderChevron(expanded.rlRouting)}
                </button>
                {expanded.rlRouting && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/request-routing/sidecar-architecture" className={getLinkClass("/docs/distributed-rate-limiter/request-routing/sidecar-architecture")}>Sidecar Architecture</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/request-routing/intelligent-routing" className={getLinkClass("/docs/distributed-rate-limiter/request-routing/intelligent-routing")}>Intelligent Routing</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/request-routing/gateway-health-and-failover" className={getLinkClass("/docs/distributed-rate-limiter/request-routing/gateway-health-and-failover")}>Gateway Health &amp; Failover</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 6. OBSERVABILITY */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlObs")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlObs}>
                  <span>6. Observability</span>
                  {renderChevron(expanded.rlObs)}
                </button>
                {expanded.rlObs && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/overview" className={getLinkClass("/docs/distributed-rate-limiter/observability/overview")}>Overview</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/distributed-tracing" className={getLinkClass("/docs/distributed-rate-limiter/observability/distributed-tracing")}>Distributed Tracing</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/structured-logging" className={getLinkClass("/docs/distributed-rate-limiter/observability/structured-logging")}>Structured Logging</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/metrics-and-prometheus" className={getLinkClass("/docs/distributed-rate-limiter/observability/metrics-and-prometheus")}>Metrics &amp; Prometheus</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/grafana-dashboard" className={getLinkClass("/docs/distributed-rate-limiter/observability/grafana-dashboard")}>Grafana Dashboard</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/observability/incident-correlation" className={getLinkClass("/docs/distributed-rate-limiter/observability/incident-correlation")}>Incident Correlation</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 7. PERFORMANCE LAB */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlPerformance")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlPerformance}>
                  <span>7. Performance Lab</span>
                  {renderChevron(expanded.rlPerformance)}
                </button>
                {expanded.rlPerformance && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/benchmark-overview" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/benchmark-overview")}>Benchmark Overview</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/throughput-and-saturation" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/throughput-and-saturation")}>Throughput &amp; Saturation</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/latency-analysis" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/latency-analysis")}>Latency Analysis</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/failure-benchmarks" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/failure-benchmarks")}>Failure Benchmarks</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/concurrency-experiments" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/concurrency-experiments")}>Concurrency Experiments</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/fifteen-minute-soak-test" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/fifteen-minute-soak-test")}>15-Minute Soak Test</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/performance-lab/reproduce-the-results" className={getLinkClass("/docs/distributed-rate-limiter/performance-lab/reproduce-the-results")}>Reproduce the Results</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 8. PRODUCTION ENGINEERING */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlProduction")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlProduction}>
                  <span>8. Production Engineering</span>
                  {renderChevron(expanded.rlProduction)}
                </button>
                {expanded.rlProduction && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/deployment-topology" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/deployment-topology")}>Deployment Topology</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/redis-and-sentinel-ha" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/redis-and-sentinel-ha")}>Redis &amp; Sentinel HA</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/configuration-reference" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/configuration-reference")}>Configuration Reference</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/health-and-readiness" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/health-and-readiness")}>Health &amp; Readiness</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/graceful-shutdown" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/graceful-shutdown")}>Graceful Shutdown</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/security-model" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/security-model")}>Security Model</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/production-engineering/operations-and-runbooks" className={getLinkClass("/docs/distributed-rate-limiter/production-engineering/operations-and-runbooks")}>Operations &amp; Runbooks</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 9. CORRECTNESS & VERIFICATION */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlVerification")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlVerification}>
                  <span>9. Correctness &amp; Verification</span>
                  {renderChevron(expanded.rlVerification)}
                </button>
                {expanded.rlVerification && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/what-has-been-proven" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/what-has-been-proven")}>What Has Been Proven?</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/test-strategy" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/test-strategy")}>Test Strategy</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/concurrency-and-race-safety" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/concurrency-and-race-safety")}>Concurrency &amp; Race Safety</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/chaos-engineering" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/chaos-engineering")}>Chaos Engineering</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/multi-replica-verification" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/multi-replica-verification")}>Multi-Replica Verification</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/correctness-and-verification/known-limitations" className={getLinkClass("/docs/distributed-rate-limiter/correctness-and-verification/known-limitations")}>Known Limitations</Link>
                    </li>
                  </ul>
                )}
              </div>

              {/* 10. ENGINEERING JOURNAL */}
              <div className="guide-sidebar-group">
                <button onClick={() => toggleSection("rlJournal")} className="guide-sidebar-dropdown-toggle" aria-expanded={expanded.rlJournal}>
                  <span>10. Engineering Journal</span>
                  {renderChevron(expanded.rlJournal)}
                </button>
                {expanded.rlJournal && (
                  <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/engineering-journal/major-design-decisions" className={getLinkClass("/docs/distributed-rate-limiter/engineering-journal/major-design-decisions")}>Major Design Decisions</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/engineering-journal/bugs-found-through-audits" className={getLinkClass("/docs/distributed-rate-limiter/engineering-journal/bugs-found-through-audits")}>Bugs Found Through Audits</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/engineering-journal/performance-evolution" className={getLinkClass("/docs/distributed-rate-limiter/engineering-journal/performance-evolution")}>Performance Evolution</Link>
                    </li>
                    <li className="guide-sidebar-group-item">
                      <Link to="/docs/distributed-rate-limiter/engineering-journal/what-i-would-change-at-10x-scale" className={getLinkClass("/docs/distributed-rate-limiter/engineering-journal/what-i-would-change-at-10x-scale")}>What I Would Change at 10× Scale</Link>
                    </li>
                  </ul>
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </aside>
    </>
  );
}
