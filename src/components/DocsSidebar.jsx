import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function DocsSidebar() {
  const location = useLocation();

  const [expanded, setExpanded] = useState({
    pebbleDb: true,
    architecture: location.pathname.startsWith("/project-docs/guide/architecture"),
    coreComponents: false,
    internals: false,
    implementation: false,
    designDecisions: false,
    performance: false,
    testing: false,
    debugging: false,
    reference: false,
    timeline: false,
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
              {["Write-Ahead Log (WAL)", "MemTable", "Skip List", "SSTables", "Manifest", "Bloom Filter", "Block Cache", "Merge Iterator"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["SSTable Layout", "WAL Record Format", "Manifest Format", "Block Format", "File Layout"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Package Structure", "Database Lifecycle", "Flush Pipeline", "WAL Truncation", "Compaction Pipeline", "Recovery Pipeline"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Design Decisions", "System Invariants", "Engineering Trade-offs", "Evolution", "Lessons Learned"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Benchmark Methodology", "Benchmark Results", "Memory Usage", "Read & Write Performance"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Testing Strategy", "Crash Testing", "Failure Injection", "Race Detection"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["WAL Replay Bug", "Manifest Consistency", "Compaction Race", "Reader Lifecycle", "Scan Lock Contention", "Shutdown Ordering"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Configuration", "CLI", "Project Structure", "Source Code Tour"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
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
              {["Development Timeline", "Milestones"].map((item) => (
                <li key={item} className="guide-sidebar-group-item">
                  <a href="#" onClick={preventDefaultLink} className="guide-sidebar-link guide-sidebar-link-placeholder">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </aside>
  );
}
