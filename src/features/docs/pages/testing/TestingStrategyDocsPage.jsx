import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "The Testing Pyramid", href: "#pyramid" },
  { label: "Local Verification Workflow", href: "#local-workflow" },
  { label: "Continuous Integration Workflow", href: "#ci-workflow" },
  { label: "Coverage Philosophy", href: "#coverage" },
  { label: "Invariant-Led Naming", href: "#naming" },
];

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: 13,
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const thStyle = {
  padding: "10px 16px",
  color: "#ff5cad",
  fontWeight: 600,
};

const theadRowStyle = {
  background: "rgba(255, 92, 173, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
};

const tdStyle = { padding: "10px 16px" };
const tdMonoStyle = { padding: "10px 16px", fontFamily: "monospace" };
const tdBoldStyle = { padding: "10px 16px", fontWeight: 500, color: "#ffffff" };

export default function TestingStrategyDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="testing-strategy-title">
              PebbleDB Testing Specification: Testing Strategy
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the layered testing strategy designed to verify PebbleDB&apos;s LSM-tree correctness, file format durability, and concurrent write/read safety.
              </p>

              {/* ── 1. The Testing Pyramid ── */}
              <h2 className="guide-sub-heading" id="pyramid" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. The Testing Pyramid
              </h2>
              <p>
                PebbleDB tests are structured in distinct vertical layers to ensure bugs are caught at the narrowest possible scope:
              </p>

              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`                      ┌─────────────────────────────────┐
                      │     Crash Subprocess Tests      │  ◄── Durability & recovery
                      ├─────────────────────────────────┤
                      │    Integration (internal/db)    │  ◄── Component cooperation
                      ├─────────────────────────────────┤
                      │ Storage (wal, manifest, sst)    │  ◄── Binary formats & salvage
                      ├─────────────────────────────────┤
                      │ Unit (bloom, iterator, mem)     │  ◄── Data structure invariants
                      └─────────────────────────────────┘`}</code>
              </pre>

              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Testing Layer</th>
                      <th style={thStyle}>Packages / Path</th>
                      <th style={thStyle}>Focus & Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Unit</td>
                      <td style={tdMonoStyle}>bloom/, memtable/, iterator/</td>
                      <td style={tdStyle}>Data structure correctness, sorted ordering, probabilistic math (Bloom FPR)</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Storage Layer</td>
                      <td style={tdMonoStyle}>wal/, manifest/, sstable/</td>
                      <td style={tdStyle}>Byte-level serialization, CRC verification, partial record salvage on EOF</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Integration</td>
                      <td style={tdMonoStyle}>db/</td>
                      <td style={tdStyle}>End-to-end user path: writes, point lookups, flushes, compactions, scans</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>Crash Subprocess</td>
                      <td style={tdMonoStyle}>db/ (via exec wrappers)</td>
                      <td style={tdStyle}>Process termination under power loss at specific durability boundaries</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>Race Detection</td>
                      <td style={tdMonoStyle}>All packages</td>
                      <td style={tdStyle}>Concurrency correctness under thread contention (-race)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 2. Local Verification Workflow ── */}
              <h2 className="guide-sub-heading" id="local-workflow" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Local Verification Workflow
              </h2>
              <p>
                Developers must run the following suite locally before submitting changes:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`# Run all standard tests
go test ./...

# Run standard tests under the race detector to catch data races
go test ./... -race

# Run the crash recovery subprocess suite
go test ./internal/db -run Crash -v`}</code>
              </pre>

              {/* ── 3. Continuous Integration Workflow ── */}
              <h2 className="guide-sub-heading" id="ci-workflow" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Continuous Integration (CI) Workflow
              </h2>
              <p>
                PebbleDB&apos;s GitHub Actions workflow runs the following test execution path on Linux and macOS targets:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`steps:
  - name: Vet code
    run: go vet ./...
    
  - name: Lint
    uses: golangci/golangci-lint-action@v3

  - name: Run tests with race and shuffle
    run: go test -race -count=1 -shuffle=on -coverprofile=coverage.out ./...`}</code>
              </pre>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }}>3.1 Key CI Configurations</h3>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">-count=1 (No Caching)</span>: Standard Go test caching is disabled. Since storage tests involve file creation, truncation, and deletion, cached passes can hide subtle file state bugs.
                </li>
                <li>
                  <span className="highlight-text">-shuffle=on (Random Ordering)</span>: Randomizes the order of execution for unit and integration tests. This exposes hidden state dependencies across database tests (e.g. background routines not fully shut down).
                </li>
                <li>
                  <span className="highlight-text">Windows Excluded from CI</span>: Windows file systems block renames and deletions while handles are still open. Although PebbleDB handles these correctly via the copy-rename pattern, file locking races under parallel GitHub Action virtual runners caused flaky test failures, so CI is focused on Ubuntu and macOS.
                </li>
              </ul>

              {/* ── 4. Coverage Philosophy ── */}
              <h2 className="guide-sub-heading" id="coverage" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Coverage Philosophy
              </h2>
              <p>
                Instead of aiming for 100% test coverage across mathematical helpers (e.g., FNV hashing), PebbleDB focuses coverage on the durability boundaries and ordering pipelines:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">internal/db Coverage</span>: Maintained at ~79% or higher.
                </li>
                <li>
                  <span className="highlight-text">High-Value Code Paths</span>: Focus is placed on <code className="inline-code">batch.go</code>, <code className="inline-code">flush.go</code>, <code className="inline-code">compactor.go</code>, <code className="inline-code">close.go</code>, and <code className="inline-code">wal_state.go</code> where concurrent modifications and I/O occur.
                </li>
              </ul>

              {/* ── 5. Invariant Naming ── */}
              <h2 className="guide-sub-heading" id="naming" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Invariant-Led Naming Conventions
              </h2>
              <p>
                PebbleDB integration and durability tests are named after the specific system invariants they enforce. This links the verification code directly back to the architectural specification:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">TestWalReplayStartOffsetWhenWalTruncatedBelowFreeze</span> (checks WAL offset boundaries)
                </li>
                <li>
                  <span className="highlight-text">TestManifestIgnoresOrphanSSTAfterCompactionCrash</span> (checks live set invariants)
                </li>
                <li>
                  <span className="highlight-text">TestGetSurvivesCompactionWithHeldRefs</span> (checks reader refcounting under compaction)
                </li>
              </ul>

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
