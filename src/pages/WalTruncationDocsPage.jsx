import React from "react";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import DocsMermaid from "../components/DocsMermaid";
import GoCodeBlock from "../components/GoCodeBlock";

const pageTopics = [
  { label: "Trigger Sequence & Checkpointing", href: "#trigger-sequence" },
  { label: "Checkpoint Writing", href: "#checkpoint-writing" },
  { label: "Copy-Rename Truncation", href: "#copy-rename" },
  { label: "Tail Copying Implementation", href: "#tail-copy" },
  { label: "Checkpoint Cleanup", href: "#cleanup" },
];

const TRIGGER_SEQUENCE_CHART = `sequenceDiagram
    autonumber
    participant FL as db.flusher
    participant W as wal.log
    participant WT as wal.log.truncate.tmp
    participant D as Disk (wal.flush)

    FL->>D: Write checkpoint (wal.flush) with FreezeOffset & SSTID
    FL->>D: Fsync & Rename checkpoint
    FL->>W: Sync active WAL
    FL->>WT: Copy active tail [FreezeOffset, EOF) to temp
    FL->>WT: Fsync temp copy
    FL->>W: Close active WAL
    FL->>W: Rename temp → wal.log (Replace old log)
    FL->>W: Reopen wal.log for appends
    FL->>D: Delete checkpoint (wal.flush)`;

const STATE_CODE = `type walFlushState struct {
	FreezeOffset int64
	SSTID        uint64
}

func writeWalFlushState(dir string, st walFlushState) error {
	buf := make([]byte, 16)
	binary.BigEndian.PutUint64(buf[0:8], uint64(st.FreezeOffset))
	binary.BigEndian.PutUint64(buf[8:16], st.SSTID)
	tmp := walFlushStatePath(dir) + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil { return err }
	
	if _, err := f.Write(buf); err != nil {
		f.Close(); os.Remove(tmp); return err
	}
	if err := f.Sync(); err != nil {
		f.Close(); os.Remove(tmp); return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp); return err
	}
	return os.Rename(tmp, walFlushStatePath(dir))
}`;

const TRUNCATE_BEFORE_CODE = `func (w *WAL) TruncateBefore(truncateAt int64) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if truncateAt <= 0 { return nil }
	if err := w.file.Sync(); err != nil { return err }
	fi, err := w.file.Stat()
	if err != nil { return err }
	size := fi.Size()
	
	// If the entire WAL is obsolete, clear and reopen in-place
	if truncateAt >= size {
		return w.reopenEmptyLocked()
	}
	// Copy active log tail to a temporary file
	tmpPath := w.path + ".truncate.tmp"
	if err := w.copyWalTailLocked(truncateAt, size, tmpPath); err != nil {
		os.Remove(tmpPath); return err
	}
	// Close active WAL handle to release locks (critical on Windows)
	if err := w.file.Close(); err != nil {
		os.Remove(tmpPath); return w.reopenAppendAfterTruncateErr(err)
	}
	w.file = nil
	// Replace old WAL with the truncated copy
	if err := os.Rename(tmpPath, w.path); err != nil {
		os.Remove(tmpPath)
		if reopenErr := w.reopenAppend(); reopenErr != nil {
			return errors.Join(err, reopenErr)
		}
		return err
	}
	return w.reopenAppend()
}`;

const COPY_TAIL_CODE = `func (w *WAL) copyWalTailLocked(truncateAt, size int64, tmpPath string) error {
	tmp, err := os.OpenFile(tmpPath, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0644)
	if err != nil { return err }
	defer tmp.Close()
	const chunkSize = 64 * 1024
	buf := make([]byte, chunkSize)
	for off := truncateAt; off < size; {
		n := int64(len(buf))
		if size-off < n { n = size - off }
		
		readN, err := w.file.ReadAt(buf[:n], off)
		if err != nil && err != io.EOF { return err }
		if readN == 0 {
			return fmt.Errorf("%w: read 0 bytes at offset %d", ErrTruncateIncomplete, off)
		}
		if _, err := tmp.Write(buf[:readN]); err != nil { return err }
		off += int64(readN)
	}
	return tmp.Sync()
}`;

const REMOVE_STATE_CODE = `func removeWalFlushState(dir string) error {
	err := os.Remove(walFlushStatePath(dir))
	if os.IsNotExist(err) { return nil }
	return err
}`;

export default function WalTruncationDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="wal-truncate-title">
              PebbleDB Subsystem: WAL Truncation
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This document specifies the WAL Truncation subsystem in PebbleDB, explaining how the database coordinates checkpointing, performs copy-rename log truncations, and cleanups checkpoints.
              </p>

              {/* ── 1. Trigger Sequence and the wal.flush Checkpoint ── */}
              <h2 className="guide-sub-heading" id="trigger-sequence" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                1. Trigger Sequence and the wal.flush Checkpoint
              </h2>
              <p>
                When a memtable flush completes, the records in that memtable are durable on disk in an SSTable.
                The corresponding section of the WAL is no longer needed. To reclaim space without losing active writes in the log tail,
                PebbleDB performs a WAL truncation:
              </p>
              <DocsMermaid chart={TRIGGER_SEQUENCE_CHART} />

              {/* ── 2. Checkpoint Writing ── */}
              <h2 className="guide-sub-heading" id="checkpoint-writing" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                2. Checkpoint Writing (wal.flush)
              </h2>
              <p>
                PebbleDB writes a checkpoint file (<code className="inline-code">wal.flush</code>) containing the truncation boundaries before modifying the WAL (Invariant D10).
                This ensures that if the system crashes during the truncation, recovery can identify which writes are already stored in the new SSTable.
              </p>
              <GoCodeBlock>{STATE_CODE}</GoCodeBlock>

              {/* ── 3. Copy-Rename Truncation ── */}
              <h2 className="guide-sub-heading" id="copy-rename" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                3. Copy-Rename Truncation (TruncateBefore)
              </h2>
              <p>
                PebbleDB avoids in-place file truncations (which can be blocked by file locks on Windows) by copying the active tail of the log
                to a temporary file, replacing the old log file, and reopening the log handle:
              </p>
              <GoCodeBlock>{TRUNCATE_BEFORE_CODE}</GoCodeBlock>

              {/* ── 4. Tail Copying Implementation ── */}
              <h2 className="guide-sub-heading" id="tail-copy" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                4. Tail Copying Implementation
              </h2>
              <p>
                The tail copying logic uses 64 KiB chunks and calls <code className="inline-code">Sync</code> to ensure data durability before the old WAL handle is closed:
              </p>
              <GoCodeBlock>{COPY_TAIL_CODE}</GoCodeBlock>

              {/* ── 5. Checkpoint Cleanup ── */}
              <h2 className="guide-sub-heading" id="cleanup" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                5. Checkpoint Cleanup
              </h2>
              <p>
                Once the WAL truncation completes successfully, the database deletes the checkpoint file (<code className="inline-code">wal.flush</code>).
                This marks the end of the flush transaction.
              </p>
              <GoCodeBlock>{REMOVE_STATE_CODE}</GoCodeBlock>

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
