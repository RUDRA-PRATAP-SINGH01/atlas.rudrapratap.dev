import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";

const pageTopics = [
  { label: "1. Leveled LSM Structure", href: "#leveled-lsm" },
  { label: "2. Block Checksums", href: "#block-checksums" },
  { label: "3. Directory Fsync Safety", href: "#directory-fsync" },
  { label: "4. Binary Block Search", href: "#binary-search" },
  { label: "5. Optimized Merge Iterator Heap", href: "#merge-heap" },
];

export default function RequiredFeaturesPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="features-title">
              Required Production Features
            </h1>

            <div className="warning-banner" style={{
              background: "rgba(255, 92, 173, 0.08)",
              border: "1px solid rgba(255, 92, 173, 0.25)",
              borderRadius: "8px",
              padding: "16px",
              marginTop: "20px",
              marginBottom: "24px",
              color: "#ff9ed2",
              fontSize: "14px",
              lineHeight: "1.6"
            }}>
              <strong> Structural Enhancements:</strong> Transitioning from an educational project to a durable database requires adding a leveled hierarchy, storage block checksums, direct parent directory syncs, and logarithmic lookups.
            </div>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                To transform PebbleDB into a resilient, high-throughput storage engine capable of scaling to millions of keys and gigabytes of storage, several structural features must be implemented from scratch.
              </p>

              {/* ── 1. Leveled LSM Structure ── */}
              <h2 className="guide-sub-heading" id="leveled-lsm" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Leveled LSM Structure (L1–L6)
              </h2>
              <p>
                Currently, PebbleDB operates as a flat, single-level (Level 0) database where all SSTables are merged together pairwise:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Compaction Tombstone Leak</span>: Without a bottom-most layer, there is no definitive place to safely delete old tombstones. Deletion markers circulate endlessly in compaction runs.
                </li>
                <li>
                  <span className="highlight-text">The Solution</span>: Implement a classical leveled structure where L0 handles incoming flushes, and L1–L6 have strictly bounded size multipliers (e.g., L1 = 10MB, L2 = 100MB, L3 = 1GB). In L1–L6, keys in SSTables do not overlap, enabling binary searching across files and guaranteeing tombstones can be safely discarded at the bottom level.
                </li>
              </ul>

              {/* ── 2. Block Checksums ── */}
              <h2 className="guide-sub-heading" id="block-checksums" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Block Checksums
              </h2>
              <p>
                Corruption detection is mandatory for durability. Data blocks must contain appended verify checksums:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Checksum Tail</span>: Every data block and index block must be written with 4 additional bytes containing a CRC32C or xxHash checksum of its contents.
                </li>
                <li>
                  <span className="highlight-text">Verification on Read</span>: When reading a block from disk or cache, <code className="inline-code">readBlock()</code> must verify the checksum. If mismatched, return a hard corruption error (e.g. <code className="inline-code">ErrCorruptedBlock</code>) rather than continuing, shielding against silent data loss.
                </li>
              </ul>

              {/* ── 3. Directory Fsync Safety ── */}
              <h2 className="guide-sub-heading" id="directory-fsync" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Directory Fsync Safety
              </h2>
              <p>
                Writing file contents is not enough to ensure file presence on disk; directory metadata must be synced:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Directory File Handles</span>: On directory changes (creating an SSTable, rotatating WAL logs, writing the manifest, renaming <code className="inline-code">CURRENT</code>), open the parent directory itself as a read-only file handle.
                </li>
                <li>
                  <span className="highlight-text">Synchronizing metadata</span>: Call <code className="inline-code">Sync()</code> on the directory file descriptor. This flushes directory entry indexes to physical media, ensuring files are not lost on system crashes.
                </li>
              </ul>

              {/* ── 4. Binary Block Search ── */}
              <h2 className="guide-sub-heading" id="binary-search" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Binary Block Search (Restart Points)
              </h2>
              <p>
                Point lookups within block reads must be optimized to prevent high CPU usage:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">The Problem</span>: Currently, searching for a key inside an SSTable data block performs a linear scan from byte 0.
                </li>
                <li>
                  <span className="highlight-text">The Solution</span>: Implement restart points (delta compression boundaries) at the end of every block. This allows the block reader to binary search between restart indexes to narrow down the target key range before performing a short, localized linear search.
                </li>
              </ul>

              {/* ── 5. Optimized Merge Iterator Heap ── */}
              <h2 className="guide-sub-heading" id="merge-heap" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Merge Iterator Heap
              </h2>
              <p>
                Range query performance must scale gracefully as SSTable count increases:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  <span className="highlight-text">Linear Overhead</span>: The current Merge Iterator performs a linear scan across all iterators to find the minimum key.
                </li>
                <li>
                  <span className="highlight-text">Min-Heap Array</span>: Replace the linear scan with a binary min-heap array. Finding the next element shifts from $O(N)$ comparisons to $O(\log N)$, dramatically lowering CPU overhead during range scans.
                </li>
              </ul>

            </div>
          </div>
        </main>

        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Topics</h4>
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
