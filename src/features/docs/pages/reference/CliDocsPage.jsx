import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";

const pageTopics = [
  { label: "Command-Line Syntax", href: "#syntax" },
  { label: "Flags", href: "#flags" },
  { label: "Command Catalog", href: "#commands" },
  { label: "Environment Variables", href: "#env" },
  { label: "Exit Codes", href: "#exit-codes" },
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

export default function CliDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="cli-title">
              PebbleDB Subsystem: CLI
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the command-line interface (CLI) of PebbleDB, detailing supported commands, flags, environment variables, and exit codes.
              </p>

              {/* ── 1. Command-Line Syntax ── */}
              <h2 className="guide-sub-heading" id="syntax" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Command-Line Syntax
              </h2>
              <p>
                The CLI follows Go&apos;s standard flag parsing convention:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "16px 0" }}>
                <code>{`pebbledb [flags] <command> [arguments]`}</code>
              </pre>
              <p>
                By default, the CLI opens the database, runs the command, and closes the database, releasing the lock.
              </p>

              {/* ── 2. Flags ── */}
              <h2 className="guide-sub-heading" id="flags" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Flags
              </h2>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Flag</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Default</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>-dir</td>
                      <td style={tdMonoStyle}>string</td>
                      <td style={tdMonoStyle}>./pebbledb-data</td>
                      <td style={tdStyle}>Directory where the database files are stored. Can be overridden via the PEBBLEDB_DIR environment variable.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>-sync-writes</td>
                      <td style={tdMonoStyle}>bool</td>
                      <td style={tdMonoStyle}>false</td>
                      <td style={tdStyle}>When enabled, the WAL is fsynced before each write returns. Can be enabled via the PEBBLEDB_SYNC_WRITES environment variable.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 3. Command Catalog ── */}
              <h2 className="guide-sub-heading" id="commands" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Command Catalog
              </h2>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>3.1 put — Write a Key-Value Pair</h3>
              <p>
                <strong>Syntax:</strong> <code className="inline-code">pebbledb put &lt;key&gt; &lt;value&gt;</code>
                <br />
                <strong>Example:</strong> <code className="inline-code">pebbledb put user:101 &quot;John Doe&quot;</code>
                <br />
                <strong>Behavior:</strong> Inserts or updates the key in the database. Returns an error if the key or value exceeds maximum size limits.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>3.2 get — Read a Key</h3>
              <p>
                <strong>Syntax:</strong> <code className="inline-code">pebbledb get &lt;key&gt;</code>
                <br />
                <strong>Example:</strong> <code className="inline-code">pebbledb get user:101</code>
                <br />
                <strong>Output:</strong> Writes the raw value to stdout with a trailing newline.
                <br />
                <strong>Exit Code:</strong> Exits with code 1 if the key is not found in the database.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>3.3 delete — Delete a Key</h3>
              <p>
                <strong>Syntax:</strong> <code className="inline-code">pebbledb delete &lt;key&gt;</code>
                <br />
                <strong>Example:</strong> <code className="inline-code">pebbledb delete user:101</code>
                <br />
                <strong>Behavior:</strong> Writes a tombstone record to the WAL and inserts a delete marker in the active memtable.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>3.4 sync — Flush Pending Writes</h3>
              <p>
                <strong>Syntax:</strong> <code className="inline-code">pebbledb sync</code>
                <br />
                <strong>Behavior:</strong> Forces a synchronous <code className="inline-code">Sync()</code> call on the WAL, guaranteeing that all prior async writes are durable on disk.
              </p>

              <h3 style={{ color: "#ffffff", marginTop: 16 }}>3.5 scan — Scan a Range of Keys</h3>
              <p>
                <strong>Syntax:</strong> <code className="inline-code">pebbledb scan [start] [end]</code>
                <br />
                <strong>Example:</strong> <code className="inline-code">pebbledb scan user:100 user:200</code>
                <br />
                <strong>Output:</strong> Iterates over keys in the half-open range [start, end) in sorted order. Writes tab-separated key-value pairs to stdout:
              </p>
              <pre className="guide-code-pre" style={{ background: "#18181b", padding: "12px", borderRadius: "6px", overflowX: "auto", margin: "12px 0" }}>
                <code>{`user:101    John Doe
user:102    Jane Smith`}</code>
              </pre>
              <p>Parameters:</p>
              <ul className="guide-bullets-list">
                <li><strong>scan (no args):</strong> Scans the entire database.</li>
                <li><strong>scan user::</strong> Scans all keys starting from user: to the end of the database.</li>
                <li><strong>scan user:100 user:200:</strong> Scans keys within the specified range.</li>
              </ul>

              {/* ── 4. Environment Variables ── */}
              <h2 className="guide-sub-heading" id="env" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Environment Variables
              </h2>
              <p>
                PebbleDB evaluates environment variables to configure default settings:
              </p>
              <div style={{ overflowX: "auto", marginTop: 16, marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Variable</th>
                      <th style={thStyle}>Target Parameter</th>
                      <th style={thStyle}>Accepted Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "rgba(255, 255, 255, 0.02)" }}>
                      <td style={tdBoldStyle}>PEBBLEDB_DIR</td>
                      <td style={tdMonoStyle}>Options Dir</td>
                      <td style={tdStyle}>Any valid directory path.</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <td style={tdBoldStyle}>PEBBLEDB_SYNC_WRITES</td>
                      <td style={tdMonoStyle}>Options SyncWrites</td>
                      <td style={tdStyle}>1, true, yes, on (case-insensitive)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── 5. Exit Codes ── */}
              <h2 className="guide-sub-heading" id="exit-codes" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Exit Codes
              </h2>
              <ul className="guide-bullets-list">
                <li><strong>0:</strong> Command completed successfully.</li>
                <li><strong>1:</strong> Key not found during get, missing command arguments, or unknown CLI command.</li>
                <li><strong>Other Codes:</strong> System or I/O errors (e.g. <code className="inline-code">ErrDatabaseLocked</code> if the directory lock cannot be acquired).</li>
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
