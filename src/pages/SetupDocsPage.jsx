import { useState } from "react";
import { Link } from "react-router-dom";
import DocsNavbar from "../components/DocsNavbar";

const sidebarCategories = [
  {
    title: "Introduction",
    items: [
      { label: "Introduction", href: "/project-docs/guide" },
    ],
  },
  {
    title: "Project Setup",
    items: [
      { label: "Project Setup", active: true, href: "/project-docs/guide/setup" },
    ],
  },
];

const pageTopics = [
  { label: "Prerequisites", href: "#prerequisites" },
  { label: "Repository Setup", href: "#repository-setup" },
  { label: "Building the CLI", href: "#building-the-cli" },
  { label: "Running CLI Commands", href: "#running-cli-commands" },
  { label: "Running the Test Suite", href: "#running-the-test-suite" },
  { label: "Using as a Library", href: "#using-as-a-library" },
];

export default function SetupDocsPage() {
  const [isPebbleDbOpen, setIsPebbleDbOpen] = useState(true);

  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        {/* Left Sidebar */}
        <aside className="guide-sidebar-left" aria-label="Documentation Categories">
          <div className="guide-sidebar-left-content">
            <div className="guide-sidebar-group">
              <button
                onClick={() => setIsPebbleDbOpen(!isPebbleDbOpen)}
                className="guide-sidebar-dropdown-toggle"
                aria-expanded={isPebbleDbOpen}
              >
                <span>PebbleDB</span>
                <svg
                  className={`chevron-icon ${isPebbleDbOpen ? "rotate-90" : ""}`}
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isPebbleDbOpen && (
                <ul className="guide-sidebar-group-list" style={{ marginTop: 6, paddingLeft: 8 }}>
                  <li className="guide-sidebar-group-item">
                    <Link
                      to="/project-docs/guide"
                      className="guide-sidebar-link"
                    >
                      Introduction
                    </Link>
                  </li>
                  <li className="guide-sidebar-group-item">
                    <Link
                      to="/project-docs/guide/setup"
                      className="guide-sidebar-link guide-sidebar-link--active"
                    >
                      Project Setup
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="setup-guide">PebbleDB Cross-Platform Execution Guide</h1>
            
            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This guide provides step-by-step instructions to download, build, test, and run PebbleDB on any operating system (Windows, macOS, or Linux).
              </p>

              <h2 className="guide-sub-heading" id="prerequisites" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>1. Prerequisites</h2>
              <p>
                Before running PebbleDB, you must install Go version 1.23.4 or higher:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  Windows: Download and run the installer from the Official Go Downloads Page.
                </li>
                <li>
                  macOS: Install via Homebrew: <span className="highlight-text">brew install go</span>, or use the official package installer.
                </li>
                <li>
                  Linux (Ubuntu/Debian): Run the standard installation command:
                </li>
              </ul>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">sudo</span> apt update && <span className="code-keyword">sudo</span> apt install golang-go</span>
                  </code>
                </pre>
              </div>

              <p>
                Ensure your Go version is updated by checking:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">go</span> version</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="repository-setup" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>2. Repository Setup</h2>
              <p>
                Clone the repository and download the required dependency:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">git</span> clone https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB.git</span>
                    <span className="code-line"><span className="code-keyword">cd</span> PebbleDB</span>
                    <span className="code-line"><span className="code-keyword">go</span> mod download</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="building-the-cli" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>3. Building the Command-Line Interface (CLI)</h2>
              <p>
                Depending on your operating system, compile the command-line utility into an executable:
              </p>
              
              <p style={{ marginTop: 16, fontWeight: 500, color: "#ffffff" }}>Windows (PowerShell / Command Prompt)</p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 16 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">go</span> build -o pebbledb.exe ./cmd/pebbledb</span>
                  </code>
                </pre>
              </div>

              <p style={{ marginTop: 16, fontWeight: 500, color: "#ffffff" }}>Linux / macOS (Bash / Zsh)</p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 16 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">go</span> build -o pebbledb ./cmd/pebbledb</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="running-cli-commands" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>4. Running CLI Commands</h2>
              <p>
                Below are the step-by-step CLI commands for interacting with the database.
              </p>

              <div className="guide-action-box" style={{ marginTop: 16, marginBottom: 20, border: "1px solid rgba(255, 92, 173, 0.3)", background: "rgba(255, 92, 173, 0.02)" }}>
                <h5 className="guide-action-box-title" style={{ color: "#ff5cad" }}>NOTE</h5>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255, 255, 255, 0.7)" }}>
                  By default, writes are buffered in memory and group-committed asynchronously to the Write-Ahead Log (WAL) to maximize performance. Use the sync command to ensure durability, or pass the -sync-writes flag.
                </p>
              </div>

              <p style={{ marginTop: 20, fontWeight: 500, color: "#ffffff" }}>Windows (PowerShell)</p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment"># 1. Put (write) a key-value pair</span></span>
                    <span className="code-line">.\pebbledb.exe put user_101 <span className="code-string">"Rudra Pratap Singh"</span></span>
                    <span className="code-line"><span className="code-comment"># 2. Sync to force the pending write buffer to disk (WAL fsync)</span></span>
                    <span className="code-line">.\pebbledb.exe sync</span>
                    <span className="code-line"><span className="code-comment"># 3. Get (read) the value back</span></span>
                    <span className="code-line">.\pebbledb.exe get user_101</span>
                    <span className="code-line"><span className="code-comment"># 4. Write with synchronous writes (immediate WAL fsync)</span></span>
                    <span className="code-line">.\pebbledb.exe -sync-writes put user_102 <span className="code-string">"Alice Smith"</span></span>
                    <span className="code-line"><span className="code-comment"># 5. Write multiple keys</span></span>
                    <span className="code-line">.\pebbledb.exe put product_A <span className="code-string">"Laptop"</span></span>
                    <span className="code-line">.\pebbledb.exe put product_B <span className="code-string">"Keyboard"</span></span>
                    <span className="code-line">.\pebbledb.exe put product_C <span className="code-string">"Mouse"</span></span>
                    <span className="code-line">.\pebbledb.exe sync</span>
                    <span className="code-line"><span className="code-comment"># 6. Scan (iterate) keys (prints all keys)</span></span>
                    <span className="code-line">.\pebbledb.exe scan</span>
                    <span className="code-line"><span className="code-comment"># 7. Range Scan keys in the half-open range [start, end)</span></span>
                    <span className="code-line">.\pebbledb.exe scan product_A product_C</span>
                    <span className="code-line"><span className="code-comment"># 8. Delete a key</span></span>
                    <span className="code-line">.\pebbledb.exe delete user_101</span>
                    <span className="code-line">.\pebbledb.exe sync</span>
                    <span className="code-line"><span className="code-comment"># 9. Verifying the deletion (this will return exit code 1: key not found)</span></span>
                    <span className="code-line">.\pebbledb.exe get user_101</span>
                  </code>
                </pre>
              </div>

              <p style={{ marginTop: 20, fontWeight: 500, color: "#ffffff" }}>Linux / macOS</p>
              <div className="guide-code-block-container" style={{ marginTop: 8, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment"># 1. Put (write) a key-value pair</span></span>
                    <span className="code-line">./pebbledb put user_101 <span className="code-string">"Rudra Pratap Singh"</span></span>
                    <span className="code-line"><span className="code-comment"># 2. Sync to force the pending write buffer to disk (WAL fsync)</span></span>
                    <span className="code-line">./pebbledb sync</span>
                    <span className="code-line"><span className="code-comment"># 3. Get (read) the value back</span></span>
                    <span className="code-line">./pebbledb get user_101</span>
                    <span className="code-line"><span className="code-comment"># 4. Write with synchronous writes (immediate WAL fsync)</span></span>
                    <span className="code-line">./pebbledb -sync-writes put user_102 <span className="code-string">"Alice Smith"</span></span>
                    <span className="code-line"><span className="code-comment"># 5. Write multiple keys</span></span>
                    <span className="code-line">./pebbledb put product_A <span className="code-string">"Laptop"</span></span>
                    <span className="code-line">./pebbledb put product_B <span className="code-string">"Keyboard"</span></span>
                    <span className="code-line">./pebbledb put product_C <span className="code-string">"Mouse"</span></span>
                    <span className="code-line">./pebbledb sync</span>
                    <span className="code-line"><span className="code-comment"># 6. Scan (iterate) keys (prints all keys)</span></span>
                    <span className="code-line">./pebbledb scan</span>
                    <span className="code-line"><span className="code-comment"># 7. Range Scan keys in the half-open range [start, end)</span></span>
                    <span className="code-line">./pebbledb scan product_A product_C</span>
                    <span className="code-line"><span className="code-comment"># 8. Delete a key</span></span>
                    <span className="code-line">./pebbledb delete user_101</span>
                    <span className="code-line">./pebbledb sync</span>
                    <span className="code-line"><span className="code-comment"># 9. Verifying the deletion (this will return exit code 1: key not found)</span></span>
                    <span className="code-line">./pebbledb get user_101</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="running-the-test-suite" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>5. Running the Test Suite</h2>
              <p>
                PebbleDB has tests verifying concurrency safety, LRU caching, and crash recovery. Run these commands from the root directory:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 12, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-comment"># 1. Run all standard unit and integration tests</span></span>
                    <span className="code-line"><span className="code-keyword">go</span> test ./... -v</span>
                    <span className="code-line"><span className="code-comment"># 2. Run tests with the Go Race Detector enabled (Linux/macOS)</span></span>
                    <span className="code-line"><span className="code-keyword">go</span> test -race -shuffle=on ./...</span>
                    <span className="code-line"><span className="code-comment"># 3. Run the crash injection recovery tests in verbose mode</span></span>
                    <span className="code-line"><span className="code-keyword">go</span> test ./internal/db -run Crash -v</span>
                  </code>
                </pre>
              </div>

              <h2 className="guide-sub-heading" id="using-as-a-library" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>6. Using PebbleDB as a Library in Go Applications</h2>
              <p>
                To import and use PebbleDB in another Go project:
              </p>

              <div className="guide-code-block-container" style={{ marginTop: 16, marginBottom: 20 }}>
                <pre className="guide-code-pre">
                  <code className="guide-code-lines">
                    <span className="code-line"><span className="code-keyword">package</span> main</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line"><span className="code-keyword">import</span> (</span>
                    <span className="code-line">    <span className="code-string">"fmt"</span></span>
                    <span className="code-line">    <span className="code-string">"log"</span></span>
                    <span className="code-line">    <span className="code-string">"github.com/RUDRA-PRATAP-SINGH01/PebbleDB/internal/db"</span></span>
                    <span className="code-line">)</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line"><span className="code-keyword">func</span> <span className="code-function">main</span>() {"{"}</span>
                    <span className="code-line">    <span className="code-comment">// 1. Open the database</span></span>
                    <span className="code-line">    options := db.Options{"{"}Dir: <span className="code-string">"./my-database-directory"</span>{"}"}</span>
                    <span className="code-line">    database, err := db.Open(options)</span>
                    <span className="code-line">    <span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">        log.Fatalf(<span className="code-string">"failed to open database: %v"</span>, err)</span>
                    <span className="code-line">    {"}"}</span>
                    <span className="code-line">    <span className="code-keyword">defer</span> database.Close()</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line">    <span className="code-comment">// 2. Write a key</span></span>
                    <span className="code-line">    err = database.Put([]<span className="code-keyword">byte</span>(<span className="code-string">"hello"</span>), []<span className="code-keyword">byte</span>(<span className="code-string">"world"</span>))</span>
                    <span className="code-line">    <span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">        log.Fatalf(<span className="code-string">"failed to put: %v"</span>, err)</span>
                    <span className="code-line">    {"}"}</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line">    <span className="code-comment">// 3. Make the write durable</span></span>
                    <span className="code-line">    <span className="code-keyword">if</span> err := database.Sync(); err != nil {"{"}</span>
                    <span className="code-line">        log.Fatalf(<span className="code-string">"failed to sync WAL: %v"</span>, err)</span>
                    <span className="code-line">    {"}"}</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line">    <span className="code-comment">// 4. Read the key back</span></span>
                    <span className="code-line">    value, err := database.Get([]<span className="code-keyword">byte</span>(<span className="code-string">"hello"</span>))</span>
                    <span className="code-line">    <span className="code-keyword">if</span> err != nil {"{"}</span>
                    <span className="code-line">        log.Fatalf(<span className="code-string">"failed to get: %v"</span>, err)</span>
                    <span className="code-line">    {"}"}</span>
                    <span className="code-line">&nbsp;</span>
                    <span className="code-line">    fmt.Printf(<span className="code-string">"Value read: %s\n"</span>, string(value))</span>
                    <span className="code-line">{"}"}</span>
                  </code>
                </pre>
              </div>

            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Outline</h4>
            <ul className="guide-sidebar-right-list">
              {pageTopics.map((topic) => (
                <li key={topic.label} className="guide-sidebar-right-item">
                  <a
                    href={topic.href}
                    className="guide-sidebar-right-link"
                  >
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
