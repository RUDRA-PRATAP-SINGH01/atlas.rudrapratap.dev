import React from "react";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import DocsMermaid from "@/features/docs/components/DocsMermaid";
import GoCodeBlock from "@/features/docs/components/GoCodeBlock";

const pageTopics = [
  { label: "Symptoms & Inconsistencies", href: "#symptoms" },
  { label: "Root Cause", href: "#root-cause" },
  { label: "The Manifest-Before-Memory Rule", href: "#manifest-before-memory" },
  { label: "Atomic CURRENT Updates", href: "#atomic-current" },
  { label: "Manifest Live Set Authority", href: "#live-set-authority" },
];

const PIPELINE_CHART = `flowchart LR
    merge["Merge inputs to merged.sst.tmp"] --> rename["Rename to merged.sst"]
    rename --> append["Append to manifest & fsync (Boundary)"]
    append --> swap["Swap memory slice"]
    swap --> delete["Delete inputs"]
    
    style append fill:#18181b,stroke:#ff5cad,stroke-width:1.5px`;

const CURRENT_WRITE_CODE = `func writeCurrent(dir, manifestFile string) error {
	currentPath := filepath.Join(dir, currentFileName)
	tmpPath := currentPath + ".tmp"
	f, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil { return err }
	
	content := []byte(manifestFile + "\\n")
	if _, err := f.Write(content); err != nil {
		f.Close(); os.Remove(tmpPath); return err
	}
	if err := f.Sync(); err != nil {
		f.Close(); os.Remove(tmpPath); return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmpPath); return err
	}
	return os.Rename(tmpPath, currentPath)
}`;

export default function ManifestConsistencyDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="manifest-consistency-title">
              PebbleDB Postmortem: Manifest Consistency
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document details the issues, investigation, and design patterns introduced to prevent metadata divergence and corruption in PebbleDB&apos;s manifest log across crash boundaries.
              </p>

              {/* ── 1. Symptoms ── */}
              <h2 className="guide-sub-heading" id="symptoms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Symptoms &amp; Inconsistencies
              </h2>
              <p>
                During early crash testing, two distinct metadata issues occurred:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Metadata-Disk Divergence</span>: After a crash during compaction, the database was unable to open or lost keys. The manifest listed SSTable set A, but the files on disk represented SSTable set B.
                </li>
                <li>
                  <span className="highlight-text">Corrupt Manifest Reads</span>: Manifest rotation occasionally left the <code className="inline-code">CURRENT</code> file pointing to a partial or truncated manifest, causing recovery to fail on startup.
                </li>
                <li>
                  <span className="highlight-text">Orphan SSTs Polluting Recovery</span>: Directory scans loaded obsolete SSTables left behind by crashed compactions, creating duplicate keys.
                </li>
              </ul>

              {/* ── 2. Root Cause ── */}
              <h2 className="guide-sub-heading" id="root-cause" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Root Cause
              </h2>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Memory-First Ordering</span>: Compaction swapped the in-memory <code className="inline-code">sstables</code> slice before appending the update to the manifest file on disk. If a crash occurred between the memory swap and the manifest write, the updated state was lost, but the physical inputs were already marked for deletion.
                </li>
                <li>
                  <span className="highlight-text">Non-Atomic CURRENT Update</span>: The <code className="inline-code">CURRENT</code> pointer file was written directly. A crash during the write left the file truncated or empty.
                </li>
                <li>
                  <span className="highlight-text">Glob-Based Discovery</span>: Discovery used <code className="inline-code">os.ReadDir</code> to find live SSTables. Compaction files that were written but not committed became live by accident.
                </li>
              </ul>

              {/* ── 3. Fixes ── */}
              <h2 className="guide-sub-heading" id="manifest-before-memory" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. The Manifest-Before-Memory Rule
              </h2>
              <p>
                PebbleDB enforces a strict ordering constraint: all structural changes (flushes, compactions) must be successfully written and fsynced to the manifest log before updating in-memory readers or deleting files:
              </p>
              <DocsMermaid chart={PIPELINE_CHART} />
              <p style={{ marginTop: 12 }}>
                If the manifest write fails, the merged file is deleted, and the in-memory reader list remains unmodified.
              </p>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }} id="atomic-current">3.2 Atomic CURRENT Updates</h3>
              <p>
                Manifest updates write to a temporary file, fsync, and rename the file to update the pointer atomically:
              </p>
              <GoCodeBlock>{CURRENT_WRITE_CODE}</GoCodeBlock>

              <h3 style={{ fontSize: 18, color: "#ffffff", marginTop: 24, marginBottom: 12 }} id="live-set-authority">3.3 Manifest Live Set Authority &amp; Quarantine</h3>
              <p>
                The manifest log is the sole authority for which SSTable files are live (Invariant D3). During recovery, PebbleDB scans the directory for .sst files. Any file not registered in the manifest&apos;s live set is moved to a <code className="inline-code">quarantine/</code> directory instead of being loaded.
              </p>

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
