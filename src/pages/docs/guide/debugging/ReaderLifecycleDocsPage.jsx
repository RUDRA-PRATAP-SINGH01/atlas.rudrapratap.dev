import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "Lifecycle State Machine", href: "#state-machine" },
  { label: "Ref/Unref Implementation", href: "#implementation" },
  { label: "Global Reader Tracking", href: "#global-tracking" },
  { label: "Cache Key Invalidation", href: "#cache-key" },
];

const LIFECYCLE_CHART = `stateDiagram-v2
    [*] --> Active : OpenReader() [refs=1, closePending=false]
    Active --> Referenced : Get/Scan calls Ref() [refs++]
    Referenced --> Active : Query completes Unref() [refs--]
    Active --> Discarded : Compaction calls Discard() [closePending=true, refs--]
    Referenced --> ClosePending : Compaction calls Discard() [closePending=true, refs > 0]
    ClosePending --> Discarded : In-flight query completes Unref() [refs==0]
    Discarded --> [*] : file.Close() & delete from disk`;

const LIFECYCLE_CODE = `func (r *Reader) Ref() {
	if r == nil { return }
	r.refs.Add(1)
}

func (r *Reader) Unref() error {
	if r == nil { return nil }
	return r.decRef()
}

func (r *Reader) decRef() error {
	newRefs := r.refs.Add(-1)
	if newRefs < 0 {
		panic("sstable: negative reader reference count")
	}
	if newRefs == 0 && r.closePending.Load() {
		return r.Close() // Physically close the file handle
	}
	return nil
}`;

const GLOBAL_TRACK_CODE = `type DB struct {
	// ...
	readersMu  sync.Mutex
	allReaders []*sstable.Reader
}`;

const CACHE_KEY_CODE = `type blockCacheKey struct {
	fileID uint64
	offset uint64
}`;

export default function ReaderLifecycleDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="reader-lifecycle-title">
              PebbleDB Postmortem: Reader Lifecycle
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the lifecycle, reference tracking, and garbage collection mechanisms for <code className="inline-code">sstable.Reader</code> handles in PebbleDB.
              </p>

              {/* ── 1. Lifecycle State Machine ── */}
              <h2 className="guide-sub-heading" id="state-machine" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Lifecycle State Machine
              </h2>
              <DocsMermaid chart={LIFECYCLE_CHART} />

              {/* ── 2. Ref/Unref Implementation ── */}
              <h2 className="guide-sub-heading" id="implementation" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Ref/Unref Implementation
              </h2>
              <p>
                The reader tracks references using atomic operations to avoid lock contention:
              </p>
              <GoCodeBlock>{LIFECYCLE_CODE}</GoCodeBlock>
              <ul className="guide-bullets-list">
                <li>
                  <code className="inline-code">r.Close()</code>: Closes the underlying file descriptor and releases resources.
                </li>
                <li>
                  <code className="inline-code">r.Discard()</code>: Called when compaction replaces the SSTable. It sets <code className="inline-code">closePending = true</code> and decrements the reference count (representing the database&apos;s ownership reference).
                </li>
              </ul>

              {/* ── 3. Global Reader Tracking ── */}
              <h2 className="guide-sub-heading" id="global-tracking" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Global Reader Tracking
              </h2>
              <p>
                During database shutdown, PebbleDB must close all open readers, including those that are no longer in the active <code className="inline-code">sstables</code> slice but still have active read references.
              </p>
              <p>
                To do this, PebbleDB tracks all open readers in a global list:
              </p>
              <GoCodeBlock>{GLOBAL_TRACK_CODE}</GoCodeBlock>
              <ul className="guide-bullets-list">
                <li>
                  <code className="inline-code">db.trackReader(r)</code>: Called when a reader is opened.
                </li>
                <li>
                  <code className="inline-code">db.discardAllReaders()</code>: Called during shutdown to call <code className="inline-code">Close()</code> on all tracked readers, ensuring all file handles are closed even if they are still referenced by stalled queries.
                </li>
              </ul>

              {/* ── 4. Cache Key Invalidation ── */}
              <h2 className="guide-sub-heading" id="cache-key" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Cache Key Invalidation
              </h2>
              <p>
                PebbleDB avoids stale read errors by including both the file ID and block offset in the block cache keys:
              </p>
              <GoCodeBlock>{CACHE_KEY_CODE}</GoCodeBlock>
              <p>
                Because file IDs increment sequentially (<code className="inline-code">db.nextSSTID</code>), recycled file IDs cannot serve stale cached blocks from deleted SSTables.
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
