import DocsNavbar from "@/components/docs/DocsNavbar";
import { Link } from "react-router-dom";

const docCards = [
  {
    title: "Guide",
    description:
      "Everything you need to know to navigate Atlas. Dive deep into our content structure, reading paths, and best practices.",
    icon: "guide",
    href: "/project-docs/guide",
  },
  {
    title: "Architecture Design",
    description:
      "Explore how each project is designed — system boundaries, data flows, scaling choices, and the engineering trade-offs behind every decision.",
    icon: "architecture",
    href: "#featured-projects",
  },
  {
    title: "Reference",
    description:
      "Technical notes for each Atlas article. Quickly refer to definitions, diagrams, and implementation context.",
    icon: "reference",
    href: "/project-docs/reference",
  },
  {
    title: "GitHub",
    description:
      "Find the open-source repositories behind every project. Read the code, follow the commits, and learn directly from the implementations on GitHub.",
    icon: "github",
    href: "https://github.com/RUDRA-PRATAP-SINGH01",
  },
];

function DocCardIcon({ type }) {
  const stroke = "currentColor";
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: "1.5",
    "aria-hidden": true,
  };

  if (type === "guide") {
    return (
      <svg {...props}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M10 7h4M10 11h4" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "architecture") {
    return (
      <svg {...props}>
        <path d="M4 8l8-4 8 4-8 4-8-4z" strokeLinejoin="round" />
        <path d="M4 12l8 4 8-4" strokeLinejoin="round" />
        <path d="M4 16l8 4 8-4" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "reference") {
    return (
      <svg {...props}>
        <path d="M8 6l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 4l-2 16" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "github") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    );
  }

  return null;
}

function HeroGraphic() {
  return (
    <svg
      className="project-docs-hero-graphic-svg"
      viewBox="0 0 420 420"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="docs-pink-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ee85e3" />
          <stop offset="100%" stopColor="#ff5cad" />
        </linearGradient>
      </defs>
      <rect
        x="48"
        y="48"
        width="324"
        height="324"
        stroke="#ee85e3"
        strokeWidth="1.5"
      />
      <rect
        x="108"
        y="108"
        width="204"
        height="204"
        stroke="#ee85e3"
        strokeWidth="1.5"
      />
      <line
        x1="48"
        y1="372"
        x2="372"
        y2="48"
        stroke="#ee85e3"
        strokeWidth="1.5"
      />
      <rect
        x="48"
        y="276"
        width="96"
        height="96"
        fill="url(#docs-pink-gradient)"
      />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7M17 7H9M17 7V15"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ProjectDocsPage() {
  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div className="project-docs-page min-h-[100dvh] bg-black">
      <DocsNavbar />
      <main className="project-docs-main px-6 md:px-12">
        <div className="project-docs-inner mx-auto w-full max-w-[1400px]">
          <section id="guide" className="project-docs-hero">
            <div className="project-docs-hero-copy">
              <h1 className="project-docs-title">Project Documentation</h1>
              <p className="project-docs-lead">
                Explore the technical documentation behind the projects I&apos;ve
                built.
              </p>
              <p className="project-docs-lead">
                Dive into architecture decisions, implementation details, system
                design, trade-offs, and engineering insights for every open-source
                project available on my GitHub.
              </p>
            </div>

            <div className="project-docs-hero-graphic">
              <HeroGraphic />
            </div>
          </section>

          <section className="project-docs-cards" aria-label="Documentation sections">
            {docCards.map((card) => (
              card.href?.startsWith("http") ? (
                <a
                  key={card.title}
                  href={card.href}
                  className="project-docs-card"
                  onMouseMove={handleMouseMove}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="project-docs-card-icon">
                    <DocCardIcon type={card.icon} />
                  </span>
                  <span className="project-docs-card-title">{card.title}</span>
                  <span className="project-docs-card-desc">{card.description}</span>
                </a>
              ) : (
                <Link
                  key={card.title}
                  to={card.href}
                  className="project-docs-card"
                  onMouseMove={handleMouseMove}
                >
                  <span className="project-docs-card-icon">
                    <DocCardIcon type={card.icon} />
                  </span>
                  <span className="project-docs-card-title">{card.title}</span>
                  <span className="project-docs-card-desc">{card.description}</span>
                </Link>
              )
            ))}
          </section>

          <section id="featured-projects" className="project-docs-featured">
            <h2 className="project-docs-featured-title">featured projects</h2>
            <div className="project-docs-featured-actions">
              <span className="project-docs-featured-link project-docs-featured-link--disabled" aria-disabled="true">
                All projects
                <ArrowUpRight />
              </span>
              <div className="project-docs-featured-arrows" aria-hidden="true">
                <span className="project-docs-featured-arrow">&lt;</span>
                <span className="project-docs-featured-arrow">&gt;</span>
              </div>
            </div>
          </section>

          <section className="project-docs-featured-grid">
            <Link to="/project-docs/guide/setup" className="project-docs-featured-card">
              <div className="project-docs-featured-card-bg" style={{ backgroundImage: 'url("/images/PebbleDB-img.png")' }} />
              <div className="project-docs-featured-card-overlay" />
              <div className="project-docs-featured-card-content">
                <h3 className="project-docs-featured-card-title">PebbleDB</h3>
                <p className="project-docs-featured-card-desc">A detailed breakdown of PebbleDB, a high-performance LSM-tree storage engine written in Go.</p>
                <span className="project-docs-featured-card-arrow">
                  <ArrowUpRight />
                </span>
              </div>
            </Link>
            <div className="project-docs-featured-card project-docs-featured-card--disabled" aria-disabled="true">
              <div className="project-docs-featured-card-bg" style={{ backgroundImage: 'url("/images/Distributed-img.png")' }} />
              <div className="project-docs-featured-card-overlay" />
              <div className="project-docs-featured-card-content">
                <h3 className="project-docs-featured-card-title">Distributed Systems</h3>
                <p className="project-docs-featured-card-desc">Coming soon — sharding, replication, and consensus protocols like Raft and Paxos.</p>
                <span className="project-docs-featured-card-badge">Coming soon</span>
              </div>
            </div>
          </section>


        </div>
      </main>
    </div>
  );
}
