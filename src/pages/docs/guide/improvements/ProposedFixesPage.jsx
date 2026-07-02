import React from "react";
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import GoCodeBlock from "@/components/docs/GoCodeBlock";

const pageTopics = [
  { label: "1. Reader Leak Fix", href: "#reader-leak-fix" },
  { label: "2. Lock Release Safe Guard", href: "#lock-release-fix" },
  { label: "3. Write Visibility Fix", href: "#write-visibility-fix" },
  { label: "4. Deadlock & Sync Fix", href: "#deadlock-sync-fix" },
];

const READER_LEAK_CODE = `// db.go (Compaction cleanup)
func (db *DB) removeDiscardedReader(sstID uint64) {
	db.mu.Lock()
	defer db.mu.Unlock()
	
	for i, r := range db.allReaders {
		if r.SSTID() == sstID {
			// Remove from slice to allow garbage collection
			db.allReaders = append(db.allReaders[:i], db.allReaders[i+1:]...)
			break
		}
	}
}`;

const LOCK_RELEASE_CODE = `// close.go (DB Close sequence)
func (db *DB) Close() error {
	db.mu.Lock()
	if db.closed {
		db.mu.Unlock()
		return ErrClosed
	}
	db.closed = true
	db.mu.Unlock()

	// 1. Signal background routines to stop
	close(db.closeCh)

	// 2. Wait for background flusher and compactor to fully terminate
	db.wg.Wait()

	// 3. Sync and close active logs
	var err error
	if db.wal != nil {
		err = db.wal.Close()
	}

	// 4. Finally release the file lock
	if lockErr := db.lockFile.Unlock(); lockErr != nil && err == nil {
		err = lockErr
	}
	return err
}`;

const WRITE_VISIBILITY_CODE = `// db.go (Point get implementation)
func (db *DB) Get(key []byte) ([]byte, error) {
	db.mu.RLock()
	// Read from active memtable
	if val, ok := db.active.Get(key); ok {
		db.mu.RUnlock()
		return val, nil
	}
	
	// Read from pending flushes
	for _, mem := range db.pendingFlush {
		if val, ok := mem.Get(key); ok {
			db.mu.RUnlock()
			return val, nil
		}
	}
	
	// Read from the pipeline staging batch if active write is processing
	if db.stagingBatch != nil {
		if val, ok := db.stagingBatch.Get(key); ok {
			db.mu.RUnlock()
			return val, nil
		}
	}
	db.mu.RUnlock()

	// Proceed to query disk levels...
}`;

export default function ProposedFixesPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="fixes-title">
              Proposed Fixes &amp; Code Recommendations
            </h1>

            <div className="warning-banner" style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: "8px",
              padding: "16px",
              marginTop: "20px",
              marginBottom: "24px",
              color: "#a7f3d0",
              fontSize: "14px",
              lineHeight: "1.6"
            }}>
              <strong>[OK] Implementation Roadmap:</strong> Below are specific code recommendations to resolve the most critical issues identified during the database engine audit.
            </div>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                To resolve the major architectural bugs in memory, concurrency, and consistency, apply the following Go code modifications to the PebbleDB codebase.
              </p>

              {/* ── 1. Reader Leak Fix ── */}
              <h2 className="guide-sub-heading" id="reader-leak-fix" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Fixing allReaders Memory Leak
              </h2>
              <p>
                To stop memory growth during compaction, SSTable readers must be removed from the tracker slice when discarded:
              </p>
              <GoCodeBlock>{READER_LEAK_CODE}</GoCodeBlock>
              <p>
                Ensure this helper is called inside the compaction clean-up pipeline immediately after invoking <code className="inline-code">reader.Discard()</code>.
              </p>

              {/* ── 2. Lock Release Safe Guard ── */}
              <h2 className="guide-sub-heading" id="lock-release-fix" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Preventing Lock Leak on Close Timeout
              </h2>
              <p>
                The LOCK file must not be unlocked while flusher/compaction goroutines are running. I use a sync WaitGroup inside the close sequence:
              </p>
              <GoCodeBlock>{LOCK_RELEASE_CODE}</GoCodeBlock>
              <p>
                By replacing a simple timeout sleep with <code className="inline-code">sync.WaitGroup.Wait()</code>, I guarantee background worker cleanup completes before releasing the DB lock.
              </p>

              {/* ── 3. Write Visibility Fix ── */}
              <h2 className="guide-sub-heading" id="write-visibility-fix" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Closing the Read Visibility Gap
              </h2>
              <p>
                To prevent concurrent GET calls from failing to find key updates during write flushes, staging batches must remain queryable:
              </p>
              <GoCodeBlock>{WRITE_VISIBILITY_CODE}</GoCodeBlock>
              <p>
                Add a <code className="inline-code">stagingBatch</code> reference inside the database state, binding it during write pipeline flushing.
              </p>

              {/* ── 4. Deadlock & Sync Fix ── */}
              <h2 className="guide-sub-heading" id="deadlock-sync-fix" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Safe Shutdown Sequence (Goroutine Leak Fix)
              </h2>
              <p>
                To prevent writing client threads from hanging inside <code className="inline-code">batchSyncCh</code>:
              </p>
              <ul className="guide-bullets-list">
                <li>
                  Verify <code className="inline-code">db.closed</code> state inside write operations before writing to <code className="inline-code">batchSyncCh</code>.
                </li>
                <li>
                  When Close() is called, close the channels or wake up writers with an error so that they exit rather than lock up.
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
