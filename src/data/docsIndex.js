export const docsIndex = [
  {
    title: "Overview & Welcome",
    category: "General",
    description: "Welcome to Atlas Docs. Dive deep into content structure, reading paths, and best practices.",
    href: "/project-docs/guide",
    keywords: "welcome overview reading paths guide help docs intro introduction"
  },
  {
    title: "Introduction to PebbleDB",
    category: "PebbleDB",
    description: "High-performance LSM-tree storage engine written in Go, inspired by LevelDB and RocksDB.",
    href: "/project-docs/guide/pebbledb/introduction",
    keywords: "introduction pebbledb go storage engine rocksdb leveldb"
  },
  {
    title: "Project Setup",
    category: "PebbleDB",
    description: "How to initialize, run, and import PebbleDB. Workspace configurations and dependency management.",
    href: "/project-docs/guide/setup",
    keywords: "setup installation compile run command build import dependencies"
  },
  {
    title: "LSM Tree Fundamentals",
    category: "PebbleDB",
    description: "Core principles of Log-Structured Merge Trees: write path, memtable, compaction, read amplification.",
    href: "/project-docs/guide/lsm-fundamentals",
    keywords: "lsm tree log structured merge fundamentals write path compaction amplification"
  },
  {
    title: "System Overview",
    category: "Architecture",
    description: "Overall design of PebbleDB, component boundaries, internal data flow, and worker go-routines.",
    href: "/project-docs/guide/architecture/system-overview",
    keywords: "system overview architecture design flow workers go-routines boundaries"
  },
  {
    title: "Write Path",
    category: "Architecture",
    description: "Detailed step-by-step walkthrough of DB write operations, batching, WAL syncing, and memtable insertions.",
    href: "/project-docs/guide/architecture/write-path",
    keywords: "write path batch write operation put delete insert sync locking"
  },
  {
    title: "Read Path",
    category: "Architecture",
    description: "Point lookup lifecycle. Searching active memtable, frozen memtables, and multi-level SSTables.",
    href: "/project-docs/guide/architecture/read-path",
    keywords: "read path get point lookup keys versioning seek find"
  },
  {
    title: "Scan Path",
    category: "Architecture",
    description: "Range query implementation. Orchestrating iterators, merging streams, and sorting keys dynamically.",
    href: "/project-docs/guide/architecture/scan-path",
    keywords: "scan path range query iterator merge sorting key ordering seek"
  },
  {
    title: "Crash Recovery",
    category: "Architecture",
    description: "WAL replay mechanisms, checkpointing, manifest validation, and state reconciliation after dirty shutdown.",
    href: "/project-docs/guide/architecture/crash-recovery",
    keywords: "crash recovery wal replay checkpoint manifest validation consistency safety"
  },
  {
    title: "Shutdown Sequence",
    category: "Architecture",
    description: "Graceful process exit sequence. Waiting for flusher/compactor, closing WAL and manifest logs safely.",
    href: "/project-docs/guide/architecture/shutdown-sequence",
    keywords: "shutdown sequence graceful close compactor flusher locks close exit"
  },
  {
    title: "Concurrency Model",
    category: "Architecture",
    description: "Concurrent read-write safety. Reader lifecycle, COW slices, mutex bounds, and writer synchronization.",
    href: "/project-docs/guide/architecture/concurrency-model",
    keywords: "concurrency model read write lock mutex synchronization cow slices"
  },
  {
    title: "Write-Ahead Log (WAL)",
    category: "Core Components",
    description: "Durability engine. Structured binary record formats, active file syncs, and log rotation.",
    href: "/project-docs/guide/core-components/wal",
    keywords: "wal write ahead log durability binary records log rotation fsync sync"
  },
  {
    title: "MemTable",
    category: "Core Components",
    description: "In-memory sorted write buffer using a lock-free probabilistic SkipList structure.",
    href: "/project-docs/guide/core-components/memtable",
    keywords: "memtable skiplist write buffer sorted memory locks concurrent"
  },
  {
    title: "Skip List",
    category: "Core Components",
    description: "Concurrent lock-free sorted SkipList structure, node towers, and search/insert complexity.",
    href: "/project-docs/guide/core-components/skiplist",
    keywords: "skiplist skip list concurrent sorted index search tower complexity"
  },
  {
    title: "Sorted String Tables (SSTables)",
    category: "Core Components",
    description: "On-disk layout of immutable files: blocks, indexes, footer, filters, and block caches.",
    href: "/project-docs/guide/core-components/sstable",
    keywords: "sstable sorted string table block index footer block cache file layout"
  },
  {
    title: "Manifest",
    category: "Core Components",
    description: "Single source of truth tracking live SSTables, directory changes, and commit records.",
    href: "/project-docs/guide/core-components/manifest",
    keywords: "manifest tracking sstables active version directory recovery record"
  },
  {
    title: "Bloom Filter",
    category: "Core Components",
    description: "Probabilistic membership check to prevent expensive disk reads for non-existent keys.",
    href: "/project-docs/guide/core-components/bloom-filter",
    keywords: "bloom filter lookup point key hashing false positive optimization"
  },
  {
    title: "Block Cache",
    category: "Core Components",
    description: "LRU-based in-memory cache for decompressed SSTable blocks to speed up repeat reads.",
    href: "/project-docs/guide/core-components/block-cache",
    keywords: "block cache cache lru memory read speed decompression page cache"
  },
  {
    title: "Merge Iterator",
    category: "Core Components",
    description: "Priority queue iterator heap that combines sorted keys from multiple levels and memtables.",
    href: "/project-docs/guide/core-components/merge-iterator",
    keywords: "merge iterator heap sorting keys priority queue range scan"
  },
  {
    title: "Command-Line Interface (CLI)",
    category: "Reference",
    description: "Reference guide for PebbleDB's diagnostic tools, benchmarks, and debug CLI options.",
    href: "/project-docs/guide/reference/cli",
    keywords: "cli command line interface binary diagnostics run benchmark tools"
  },
  {
    title: "Configuration Reference",
    category: "Reference",
    description: "Options struct configuration parameters: memtable size, block cache bounds, and write batch settings.",
    href: "/project-docs/guide/reference/configuration",
    keywords: "configuration options parameters settings bounds options struct sizes"
  },
  {
    title: "Project Directory Structure",
    category: "Reference",
    description: "Directory tree explanation for internal/, cmd/, internal/db, and visual layouts.",
    href: "/project-docs/guide/reference/project-structure",
    keywords: "project structure directories layout internal cmd package package structure"
  },
  {
    title: "Source Code Tour",
    category: "Reference",
    description: "Step-by-step walkthrough of major files, packages, interfaces, and code structures.",
    href: "/project-docs/guide/reference/source-code-tour",
    keywords: "source code tour walk file package classes functions interfaces"
  },
  {
    title: "Development Timeline",
    category: "Reference",
    description: "Chronological milestones, feature releases, and major design changes in PebbleDB.",
    href: "/project-docs/guide/reference/development-timeline",
    keywords: "development timeline history milestones dates version releases logs"
  }
];
