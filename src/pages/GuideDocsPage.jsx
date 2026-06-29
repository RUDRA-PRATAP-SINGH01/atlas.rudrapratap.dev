import DocsNavbar from "../components/DocsNavbar";

const sidebarCategories = [
  {
    title: "Introduction",
    items: [{ label: "Introduction", active: true }],
  },
  {
    title: "Custom container images",
    items: [
      { label: "Defining Images" },
      { label: "Using existing container images" },
      { label: "Named images" },
      { label: "Fast pull from registry" },
    ],
  },
  {
    title: "GPUs and other resources",
    items: [
      { label: "GPU acceleration" },
      { label: "Using CUDA on Modal" },
      { label: "Configuring CPU, memory, and disk" },
    ],
  },
  {
    title: "Scaling out",
    items: [
      { label: "Scaling out" },
      { label: "Input concurrency" },
      { label: "Batch processing" },
      { label: "Job queues" },
      { label: "Dynamic batching" },
      { label: "Multi-node clusters (Beta)" },
    ],
  },
  {
    title: "Deployment",
    items: [
      { label: "Apps, Functions, and entrypoints" },
      { label: "Managing deployments" },
      { label: "Invoking deployed functions" },
      { label: "Continuous deployment" },
      { label: "Running untrusted code in Functions" },
    ],
  },
  {
    title: "Modal Sandboxes",
    items: [
      { label: "Sandboxes" },
      { label: "Running commands" },
    ],
  },
];

const pageTopics = [
  { label: "Introduction", active: true },
  { label: "How does it work?" },
  { label: "Programming language support" },
  { label: "Getting started" },
];

export default function GuideDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        {/* Left Sidebar */}
        <aside className="guide-sidebar-left" aria-label="Documentation Categories">
          <div className="guide-sidebar-left-content">
            {sidebarCategories.map((category) => (
              <div key={category.title} className="guide-sidebar-group">
                {category.title !== "Introduction" && (
                  <h4 className="guide-sidebar-group-title">{category.title}</h4>
                )}
                <ul className="guide-sidebar-group-list">
                  {category.items.map((item) => (
                    <li key={item.label} className="guide-sidebar-group-item">
                      <a
                        href="#"
                        className={`guide-sidebar-link ${
                          item.active ? "guide-sidebar-link--active" : ""
                        }`}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="guide-main-content">
          <div className="guide-main-container">
            <div className="guide-header-actions">
              <h1 className="guide-main-title">Introduction</h1>
              <button className="guide-copy-btn" aria-label="Copy code page link">
                <span>Copy page</span>
                <svg className="guide-copy-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9H4.5A1.5 1.5 0 0 0 3 10.5v9A1.5 1.5 0 0 0 4.5 21h9a1.5 1.5 0 0 0 1.5-1.5V18" />
                  <rect x="9" y="3" width="12" height="12" rx="1.5" />
                </svg>
              </button>
            </div>

            <div className="guide-body-text">
              <p>
                Atlas is a systems engineering platform built for people who want to understand complex software systems—not at a surface level, but deeply enough to reason about real production trade-offs.
              </p>
              
              <ul className="guide-bullets-list">
                <li>
                  Run low latency <span className="highlight-text">simulations</span> with interactive, real-time node cluster modeling.
                </li>
                <li>
                  Scale out <span className="highlight-text">batch runs</span> to deconstruct system limits and networking boundaries.
                </li>
                <li>
                  Explore <span className="highlight-text">fine-grained</span> details of storage engines like LSM-trees and B-trees.
                </li>
                <li>
                  Spin up isolated and secure <span className="highlight-text">sandboxes</span> to run and analyze distributed system code.
                </li>
                <li>
                  Launch custom <span className="highlight-text">playgrounds</span> to test system topologies and protocols in real time.
                </li>
              </ul>

              <p>
                You get <span className="highlight-text">full interactive simulation and visualization</span> because we model every component from first principles, letting you analyze trade-offs step-by-step.
              </p>

              <p>
                Notably, there is zero complex boilerplate in Atlas — everything, including <span className="highlight-text">node topologies and network parameters</span>, is declared in simple code. Take a breath of fresh air and feel how clean it is to run tests without YAML configuration.
              </p>

              <p className="guide-code-intro">
                Here is a complete, minimal example of a distributed sharded database run on Atlas:
              </p>
            </div>

            {/* Code Block */}
            <div className="guide-code-block-container">
              <pre className="guide-code-pre">
                <code className="guide-code-lines">
                  <span className="code-line"><span className="code-keyword">from</span> pathilb <span className="code-keyword">import</span> Path</span>
                  <span className="code-line"><span className="code-keyword">import</span> atlas</span>
                  <span className="code-line">&nbsp;</span>
                  <span className="code-line">app = atlas.App(<span className="code-string">"example-sharding"</span>)</span>
                  <span className="code-line">image = atlas.Image.debian_slim().uv_pip_install(<span className="code-string">"transformers[torch]"</span>)</span>
                  <span className="code-line">&nbsp;</span>
                  <span className="code-line"><span className="code-decorator">@app.function</span>(gpu=<span className="code-string">"h100"</span>, image=image)</span>
                  <span className="code-line"><span className="code-keyword">def</span> <span className="code-function">chat</span>(prompt: str | None = None) -&gt; list[dict]:</span>
                  <span className="code-line">    <span className="code-keyword">from</span> transformers <span className="code-keyword">import</span> pipeline</span>
                  <span className="code-line">&nbsp;</span>
                  <span className="code-line">    <span className="code-keyword">if</span> prompt <span className="code-keyword">is</span> None:</span>
                  <span className="code-line">        prompt = <span className="code-string">"Explain how sharding works in one paragraph."</span></span>
                  <span className="code-line">&nbsp;</span>
                  <span className="code-line">    print(prompt)</span>
                  <span className="code-line">    context = [{"{"}<span className="code-string">"role"</span>: <span className="code-string">"user"</span>, <span className="code-string">"content"</span>: prompt{"}"}]</span>
                  <span className="code-line">&nbsp;</span>
                  <span className="code-line">    chatbot = pipeline(</span>
                  <span className="code-line">        model=<span className="code-string">"Qwen/Qwen3-1.7B"</span>, device_map=<span className="code-string">"cuda"</span>, max_new_tokens=<span className="code-integer">1024</span></span>
                  <span className="code-line">    )</span>
                  <span className="code-line">    result = chatbot(context)</span>
                  <span className="code-line">    print(result[<span className="code-integer">0</span>][<span className="code-string">"generated_text"</span>][-<span className="code-integer">1</span>][<span className="code-string">"content"</span>])</span>
                </code>
              </pre>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Introduction</h4>
            <ul className="guide-sidebar-right-list">
              {pageTopics.map((topic) => (
                <li key={topic.label} className="guide-sidebar-right-item">
                  <a
                    href="#"
                    className={`guide-sidebar-right-link ${
                      topic.active ? "guide-sidebar-right-link--active" : ""
                    }`}
                  >
                    {topic.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="guide-action-box">
              <h5 className="guide-action-box-title">See it in action</h5>
              <a href="#" className="guide-action-box-link">
                Hello, world!
                <svg className="guide-action-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
              <a href="#" className="guide-action-box-link">
                A simple web scraper
                <svg className="guide-action-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
