/**
 * Canonical bibliography and quick-reference index for PebbleDB documentation.
 * Each entry maps concepts cited across the Atlas docs to external sources
 * and internal guide pages.
 */

export const referenceSections = [
  { id: "overview", label: "Overview" },
  { id: "repositories", label: "Repositories & Source" },
  { id: "literature", label: "Academic & Foundational Literature" },
  { id: "industry", label: "Industry Systems & Projects" },
  { id: "algorithms", label: "Algorithms & Data Structures" },
  { id: "standards", label: "Standards, Formats & Encoding" },
  { id: "os-concurrency", label: "OS & Concurrency" },
  { id: "go-ecosystem", label: "Go Toolchain & Packages" },
  { id: "env-vars", label: "Environment Variables" },
  { id: "internal-docs", label: "Internal Documentation Index" },
];

export const repositories = [
  {
    name: "PebbleDB",
    description: "Primary LSM-tree storage engine — the subject of this documentation.",
    href: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
    external: true,
    docs: [
      { label: "Introduction", path: "/project-docs/guide/pebbledb/introduction" },
      { label: "Setup Guide", path: "/project-docs/guide/setup" },
    ],
  },
  {
    name: "PebbleDB On-Disk Docs",
    description: "Markdown specifications shipped in the repository docs/ folder.",
    href: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB/tree/main/docs",
    external: true,
  },
  {
    name: "Author GitHub Profile",
    description: "Open-source projects and implementations.",
    href: "https://github.com/RUDRA-PRATAP-SINGH01",
    external: true,
  },
];

export const literature = [
  {
    name: "The Log-Structured Merge-Tree (LSM-Tree)",
    authors: "Patrick O'Neil, Edward Cheng, Dieter Gawlick, Elizabeth O'Neil",
    year: "1996",
    description: "Foundational paper motivating sequential-write storage engines. Cited in the PebbleDB introduction and LSM fundamentals guide.",
    href: "https://www.cs.umb.edu/~poneil/lsmtree.pdf",
    external: true,
    docs: [{ label: "Why LSM Trees Were Invented", path: "/project-docs/guide/pebbledb/introduction#why-lsm-trees-were-invented" }],
  },
  {
    name: "Skip Lists: A Probabilistic Alternative to Balanced Trees",
    authors: "William Pugh",
    year: "1990",
    description: "Probabilistic ordered structure used as PebbleDB's memtable backing store.",
    href: "https://www.cs.umd.edu/~pugh/skiplist.pdf",
    external: true,
    docs: [{ label: "SkipList Subsystem", path: "/project-docs/guide/core-components/skiplist" }],
  },
  {
    name: "Space/Time Trade-offs in Hash Coding with Allowable Errors",
    authors: "Burton H. Bloom",
    year: "1970",
    description: "Original Bloom filter paper. PebbleDB attaches per-SSTable Bloom filters to reduce read amplification.",
    href: "https://dl.acm.org/doi/10.1145/362686.362692",
    external: true,
    docs: [{ label: "Bloom Filter Subsystem", path: "/project-docs/guide/core-components/bloom-filter" }],
  },
];

export const industrySystems = [
  {
    name: "LevelDB",
    description: "Google's embedded LSM key-value store; introduced leveled compaction policy referenced in LSM fundamentals.",
    href: "https://github.com/google/leveldb",
    external: true,
    relation: "Compaction policy comparison",
    docs: [{ label: "LSM Fundamentals", path: "/project-docs/guide/lsm-fundamentals" }],
  },
  {
    name: "RocksDB",
    description: "Facebook's high-performance fork of LevelDB; industrial LSM reference and leveled compaction baseline.",
    href: "https://github.com/facebook/rocksdb",
    external: true,
    relation: "Industrial LSM baseline",
    docs: [{ label: "Introduction", path: "/project-docs/guide/pebbledb/introduction" }],
  },
  {
    name: "CockroachDB Pebble",
    description: "CockroachDB's Go storage engine (RocksDB lineage). Distinct from PebbleDB — cited to clarify naming.",
    href: "https://github.com/cockroachdb/pebble",
    external: true,
    relation: "Namesake clarification (not a fork)",
    docs: [{ label: "What is PebbleDB?", path: "/project-docs/guide/pebbledb/introduction#what-is-pebbledb" }],
  },
  {
    name: "SQLite",
    description: "Embedded B-Tree database; comparison point for embedded, in-process database design.",
    href: "https://www.sqlite.org/",
    external: true,
    relation: "Embedded database comparison",
  },
  {
    name: "BoltDB",
    description: "Go B+ tree embedded store; evaluated and rejected in design decisions.",
    href: "https://github.com/boltdb/bolt",
    external: true,
    relation: "Rejected alternative (D-01)",
    docs: [{ label: "Design Decisions", path: "/project-docs/guide/design-decisions" }],
  },
  {
    name: "PostgreSQL / MySQL / Redis",
    description: "Traditional B-Tree and network-server databases cited as contrasts to embedded LSM design.",
    href: null,
    external: false,
    relation: "Architectural contrast",
    docs: [{ label: "LSM Fundamentals", path: "/project-docs/guide/lsm-fundamentals" }],
  },
];

export const algorithms = [
  {
    name: "Log-Structured Merge (LSM) Tree",
    description: "Append-only WAL + sorted memtable + immutable SSTables + background compaction.",
    docs: [
      { label: "LSM Fundamentals", path: "/project-docs/guide/lsm-fundamentals" },
      { label: "System Overview", path: "/project-docs/guide/architecture/system-overview" },
    ],
  },
  {
    name: "B-Tree / B+ Tree",
    description: "In-place update trees; contrast for write amplification discussion.",
    docs: [{ label: "LSM Fundamentals", path: "/project-docs/guide/lsm-fundamentals#why-btrees-expensive" }],
  },
  {
    name: "Skip List",
    description: "Probabilistic sorted structure backing the active memtable.",
    docs: [
      { label: "SkipList", path: "/project-docs/guide/core-components/skiplist" },
      { label: "Memtable", path: "/project-docs/guide/core-components/memtable" },
    ],
  },
  {
    name: "Bloom Filter",
    description: "Probabilistic membership test per SSTable; eliminates definite-absent block reads.",
    docs: [{ label: "Bloom Filter", path: "/project-docs/guide/core-components/bloom-filter" }],
  },
  {
    name: "K-Way Merge Iterator",
    description: "Unified sorted stream across memtables and SSTables for Get/Scan.",
    docs: [{ label: "Merge Iterator", path: "/project-docs/guide/core-components/merge-iterator" }],
  },
  {
    name: "LRU Block Cache",
    description: "Least-recently-used eviction for 4 KiB SSTable data blocks.",
    docs: [{ label: "Block Cache", path: "/project-docs/guide/core-components/block-cache" }],
  },
  {
    name: "Binary Search (sort.Search)",
    description: "O(log B) index lookup to locate candidate SSTable blocks.",
    docs: [
      { label: "Block Format", path: "/project-docs/guide/internals/block-format#block-lookup" },
      { label: "Read Path", path: "/project-docs/guide/architecture/read-path" },
    ],
  },
  {
    name: "Group Commit",
    description: "Batch WAL fsync across concurrent writers for ~20× write throughput.",
    docs: [
      { label: "Write Path", path: "/project-docs/guide/architecture/write-path" },
      { label: "Engineering Trade-offs", path: "/project-docs/guide/engineering-tradeoffs" },
    ],
  },
  {
    name: "Reference Counting (Reader Lifecycle)",
    description: "Ref/Unref/Discard pattern preventing compaction from closing in-flight readers.",
    docs: [
      { label: "Compaction Race Postmortem", path: "/project-docs/guide/debugging/compaction-race" },
      { label: "Reader Lifecycle", path: "/project-docs/guide/debugging/reader-lifecycle" },
    ],
  },
  {
    name: "Size-Tiered / Oldest-2 Compaction",
    description: "PebbleDB's chosen compaction policy merging the two oldest overlapping SSTables.",
    docs: [
      { label: "Compaction Pipeline", path: "/project-docs/guide/implementation/compaction-pipeline" },
      { label: "Design Decisions", path: "/project-docs/guide/design-decisions" },
    ],
  },
  {
    name: "Copy-on-Read Snapshots",
    description: "Memtable snapshot copies enabling lock-free scans.",
    docs: [{ label: "Scan Path", path: "/project-docs/guide/architecture/scan-path" }],
  },
  {
    name: "Write-Ahead Log (WAL)",
    description: "Durability log replayed on crash before serving reads.",
    docs: [
      { label: "WAL Subsystem", path: "/project-docs/guide/core-components/wal" },
      { label: "WAL Record Format", path: "/project-docs/guide/internals/wal-record-format" },
    ],
  },
];

export const standards = [
  {
    name: "CRC32-IEEE",
    description: "Checksum algorithm for WAL records, manifest envelopes, and integrity verification.",
    href: "https://pkg.go.dev/hash/crc32",
    external: true,
    docs: [
      { label: "WAL Record Format", path: "/project-docs/guide/internals/wal-record-format" },
      { label: "Manifest Format", path: "/project-docs/guide/internals/manifest-format" },
    ],
  },
  {
    name: "Big-Endian Binary Encoding",
    description: "All length-prefixed fields in WAL, manifest, blocks, and SSTable footer use network byte order.",
    docs: [
      { label: "Block Format", path: "/project-docs/guide/internals/block-format" },
      { label: "SSTable Layout", path: "/project-docs/guide/internals/sstable-layout" },
    ],
  },
  {
    name: "SSTable On-Disk Layout",
    description: "Data blocks → index block → Bloom filter → 48-byte footer with magic 0x88e241b3.",
    docs: [{ label: "SSTable Layout", path: "/project-docs/guide/internals/sstable-layout" }],
  },
  {
    name: "Manifest Record Envelope",
    description: "Length-prefixed, CRC-checked edit log (NewFile, DeleteFile, SetFileSet tags).",
    docs: [{ label: "Manifest Format", path: "/project-docs/guide/internals/manifest-format" }],
  },
  {
    name: "Directory File Layout",
    description: "CURRENT, MANIFEST-NNNNNN, wal.log, sst_NNNNNNNN.sst, wal.flush checkpoint files.",
    docs: [{ label: "File Layout", path: "/project-docs/guide/internals/file-layout" }],
  },
  {
    name: "Atomic Rename Durability Pattern",
    description: "write-to-tmp → fsync → os.Rename for CURRENT, SSTables, wal.flush, and WAL truncation.",
    docs: [
      { label: "File Layout", path: "/project-docs/guide/internals/file-layout#atomic-writes" },
      { label: "Crash Recovery", path: "/project-docs/guide/architecture/crash-recovery" },
    ],
  },
];

export const osConcurrency = [
  {
    name: "flock (Unix)",
    description: "Advisory file lock for single-writer process guarantee on Linux/macOS.",
    href: "https://man7.org/linux/man-pages/man2/flock.2.html",
    external: true,
    docs: [{ label: "Crash Recovery", path: "/project-docs/guide/architecture/crash-recovery" }],
  },
  {
    name: "LockFileEx (Windows)",
    description: "Exclusive byte-range lock equivalent to flock on Windows.",
    href: "https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex",
    external: true,
    docs: [{ label: "Introduction", path: "/project-docs/guide/pebbledb/introduction" }],
  },
  {
    name: "fsync / file.Sync()",
    description: "Durability barrier after WAL, manifest, and SSTable commits.",
    docs: [{ label: "WAL Subsystem", path: "/project-docs/guide/core-components/wal" }],
  },
  {
    name: "Go Race Detector (-race)",
    description: "Dynamic data-race detector used in CI and local concurrency testing.",
    href: "https://go.dev/doc/articles/race_detector",
    external: true,
    docs: [{ label: "Race Detection", path: "/project-docs/guide/testing/race-detection" }],
  },
  {
    name: "GitHub Actions CI",
    description: "Ubuntu + macOS test matrix; Windows excluded due to file-locking flakiness.",
    href: "https://github.com/features/actions",
    external: true,
    docs: [{ label: "Testing Strategy", path: "/project-docs/guide/testing/testing-strategy" }],
  },
];

export const goEcosystem = [
  {
    name: "Go 1.23.4+",
    description: "Minimum language version for building and testing PebbleDB.",
    href: "https://go.dev/dl/",
    external: true,
    docs: [{ label: "Setup Guide", path: "/project-docs/guide/setup" }],
  },
  {
    name: "github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
    description: "Module root path for cloning and library imports.",
    href: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
    external: true,
  },
  {
    name: "internal/db",
    description: "Public database API — Open, Put, Get, Delete, Scan, Close.",
    docs: [{ label: "Project Structure", path: "/project-docs/guide/reference/project-structure" }],
  },
  {
    name: "internal/wal",
    description: "Write-ahead log encoding, replay limits, and truncation.",
    docs: [{ label: "Source Code Tour", path: "/project-docs/guide/reference/source-code-tour" }],
  },
  {
    name: "internal/memtable",
    description: "SkipList-backed sorted in-memory buffer.",
    docs: [{ label: "Memtable", path: "/project-docs/guide/core-components/memtable" }],
  },
  {
    name: "internal/sstable",
    description: "SSTable writer, reader, block iterator, Bloom filter integration.",
    docs: [{ label: "SSTables", path: "/project-docs/guide/core-components/sstable" }],
  },
  {
    name: "internal/manifest",
    description: "Append-only live-file registry with rotation and replay.",
    docs: [{ label: "Manifest", path: "/project-docs/guide/core-components/manifest" }],
  },
  {
    name: "internal/bloom",
    description: "Per-SSTable probabilistic filter construction and probing.",
    docs: [{ label: "Bloom Filter", path: "/project-docs/guide/core-components/bloom-filter" }],
  },
  {
    name: "internal/iterator",
    description: "K-way merge iterator across memtable and SSTable sources.",
    docs: [{ label: "Merge Iterator", path: "/project-docs/guide/core-components/merge-iterator" }],
  },
  {
    name: "cmd/pebbledb",
    description: "CLI binary for interactive Put/Get/Delete/Scan operations.",
    docs: [{ label: "CLI Reference", path: "/project-docs/guide/reference/cli" }],
  },
  {
    name: "hash/crc32 (stdlib)",
    description: "CRC32-IEEE implementation used in encode/decode pipelines.",
    href: "https://pkg.go.dev/hash/crc32",
    external: true,
  },
  {
    name: "sort.Search (stdlib)",
    description: "Binary search helper for SSTable index block lookup.",
    href: "https://pkg.go.dev/sort#Search",
    external: true,
  },
];

export const environmentVariables = [
  {
    name: "PEBBLEDB_DIR",
    description: "Override the default data directory (./pebbledb-data).",
    default: "./pebbledb-data",
    docs: [
      { label: "Configuration", path: "/project-docs/guide/reference/configuration" },
      { label: "CLI", path: "/project-docs/guide/reference/cli" },
    ],
  },
  {
    name: "PEBBLEDB_SYNC_WRITES",
    description: "When set, forces synchronous WAL fsync on every Put/Delete.",
    default: "unset (async group commit)",
    docs: [{ label: "CLI", path: "/project-docs/guide/reference/cli" }],
  },
  {
    name: "PEBBLEDB_CRASH_AT",
    description: "Crash-injection hook for durability testing; terminates process at named I/O boundary.",
    default: "unset",
    docs: [{ label: "Crash Testing", path: "/project-docs/guide/testing/crash-testing" }],
  },
];

export const internalDocIndex = [
  {
    category: "API & Configuration",
    items: [
      { label: "Configuration", path: "/project-docs/guide/reference/configuration", description: "Options struct, defaults, and tuning parameters." },
      { label: "CLI Reference", path: "/project-docs/guide/reference/cli", description: "pebbledb command-line flags and subcommands." },
    ],
  },
  {
    category: "Codebase",
    items: [
      { label: "Project Structure", path: "/project-docs/guide/reference/project-structure", description: "Package layout and dependency graph." },
      { label: "Source Code Tour", path: "/project-docs/guide/reference/source-code-tour", description: "Guided walkthrough of critical code paths." },
    ],
  },
  {
    category: "History",
    items: [
      { label: "Development Timeline", path: "/project-docs/guide/reference/development-timeline", description: "Chronological build log from first commit to hardened release." },
      { label: "Milestones", path: "/project-docs/guide/reference/milestones", description: "Feature milestones and invariant checkpoints." },
    ],
  },
  {
    category: "Binary Format Specifications",
    items: [
      { label: "SSTable Layout", path: "/project-docs/guide/internals/sstable-layout", description: "On-disk SSTable file regions and footer." },
      { label: "WAL Record Format", path: "/project-docs/guide/internals/wal-record-format", description: "CRC-checked mutation record encoding." },
      { label: "Manifest Format", path: "/project-docs/guide/internals/manifest-format", description: "Live-file edit log envelope and tags." },
      { label: "Block Format", path: "/project-docs/guide/internals/block-format", description: "Data and index block entry layouts." },
      { label: "File Layout", path: "/project-docs/guide/internals/file-layout", description: "Database directory catalog and crash recovery." },
    ],
  },
];
