import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "Overview", href: "#overview" },
  { label: "PebbleDB", href: "#pebbledb" },
  { label: "Distributed Rate Limiter", href: "#rate-limiter" },
];

export default function IntroDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              Welcome to Atlas Technical Documentation
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This documentation platform hosts the architectural specifications, system designs, and postmortems for two primary open-source projects. You can navigate through the detailed guides for both of them using the left sidebar.
              </p>

              {/* Project 1: PebbleDB */}
              <div 
                style={{ 
                  background: "rgba(255, 92, 173, 0.03)", 
                  border: "1px solid rgba(255, 92, 173, 0.15)", 
                  borderRadius: "8px", 
                  padding: "24px", 
                  marginTop: "28px" 
                }}
              >
                <h2 id="pebbledb" style={{ fontSize: 20, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                  1. PebbleDB LSM Storage Engine
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
                  An embedded, single-process, Log-Structured Merge (LSM) key-value engine written in Go. PebbleDB implements concurrent write pipelines, group-commits, background compaction threads, binary WAL replay checkpoints, and space-efficient Bloom filters.
                </p>
                <div style={{
                  background: "rgba(239, 68, 68, 0.06)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  fontSize: "12.5px",
                  lineHeight: "1.5",
                  color: "#fca5a5",
                  marginTop: "12px",
                  marginBottom: "12px"
                }}>
                  <strong>⚠️ Educational Learning Project:</strong> PebbleDB is not production-ready. It is a first-principles educational implementation built to explore storage engine components and layout trade-offs.
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "16px", flexWrap: "wrap" }}>
                  <a 
                    href="https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="project-docs-featured-link"
                    style={{ fontSize: 13, textDecoration: "none", color: "#ff5cad", fontWeight: "bold" }}
                  >
                    GitHub Repository →
                  </a>
                  <a 
                    href="https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB/tree/main/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, textDecoration: "none", color: "#38bdf8", fontWeight: "bold" }}
                  >
                    On-Disk Docs Folder →
                  </a>
                </div>
              </div>

              {/* Project 2: Distributed Rate Limiter */}
              <div 
                style={{ 
                  background: "rgba(56, 189, 248, 0.03)", 
                  border: "1px solid rgba(56, 189, 248, 0.15)", 
                  borderRadius: "8px", 
                  padding: "24px", 
                  marginTop: "20px" 
                }}
              >
                <h2 id="rate-limiter" style={{ fontSize: 20, color: "#ffffff", marginTop: 0, marginBottom: 12 }}>
                  2. Distributed Rate Limiter
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
                  A high-throughput, horizontally scalable rate limiting service designed for microservice environments. Features consistent hashing ring topologies, localized sliding-window counter evaluation, asynchronous replication, and consensus-backed quota allocations.
                </p>
                <div style={{ display: "flex", gap: "16px", marginTop: "16px", flexWrap: "wrap" }}>
                  <a 
                    href="https://github.com/RUDRA-PRATAP-SINGH01/Distributed-rate-limiter" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, textDecoration: "none", color: "#ff5cad", fontWeight: "bold" }}
                  >
                    GitHub Repository →
                  </a>
                  <a 
                    href="https://github.com/RUDRA-PRATAP-SINGH01/Distributed-rate-limiter/tree/main/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, textDecoration: "none", color: "#38bdf8", fontWeight: "bold" }}
                  >
                    On-Disk Docs Folder →
                  </a>
                </div>
              </div>

            </div>
          </div>
        </main>

        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Outline</h4>
            <ul className="guide-sidebar-right-list">
              {pageTopics.map((topic) => (
                <li key={topic.label} className="guide-sidebar-right-item">
                  <a href={topic.href} className="guide-sidebar-right-link">
                    {topic.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
