import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const navItems = [
  {
    label: "Home",
    href: "#home",
    menu: {
      items: [
        {
          title: "Interactive Atlas",
          description:
            "Explore engineering concepts through guided, visual walkthroughs.",
          href: "#home",
          icon: "grid",
        },
        {
          title: "For Engineers",
          description:
            "Built to explain complex systems with clarity and depth.",
          href: "#home",
          icon: "layers",
        },
        {
          title: "Visual Learning",
          description:
            "Step through ideas with interactive articles and diagrams.",
          href: "#home",
          icon: "spark",
        },
        {
          title: "Getting Started",
          description:
            "Begin with first-principles explanations and case studies.",
          href: "#home",
          icon: "cube",
        },
      ],
      featured: {
        title: "Atlas",
        titleAccent: "Overview",
        description:
          "A visual atlas for engineers — interactive articles, architecture breakdowns, and practical systems thinking in one place.",
        href: "#home",
      },
    },
  },
  {
    label: "Features",
    href: "#features",
    menu: {
      items: [
        {
          title: "Interactive Articles",
          description:
            "Follow concepts step-by-step with visuals that respond as you learn.",
          href: "#features",
          icon: "grid",
        },
        {
          title: "Architecture Views",
          description:
            "See how components connect across layers, boundaries, and flows.",
          href: "#features",
          icon: "layers",
        },
        {
          title: "Live Visualizations",
          description:
            "Manipulate models and watch system behavior change in real time.",
          href: "#features",
          icon: "spark",
        },
        {
          title: "Deep Dives",
          description:
            "Go beyond summaries with structured, engineer-grade explanations.",
          href: "#features",
          icon: "cube",
        },
      ],
      featured: {
        title: "Atlas",
        titleAccent: "Features",
        description:
          "Everything you need to understand hard systems — from algorithms and data flows to production patterns.",
        href: "#features",
      },
    },
  },
  {
    label: "Blogs",
    href: "/blog",
    menu: {
      items: [
        {
          title: "Engineering Notes",
          description:
            "Short essays on how complex ideas are reasoned about and taught.",
          href: "/blog",
          icon: "grid",
        },
        {
          title: "Case Studies",
          description:
            "Real-world breakdowns of architecture decisions and tradeoffs.",
          href: "/blog",
          icon: "layers",
        },
        {
          title: "Systems Thinking",
          description:
            "Posts that connect theory to patterns used in production.",
          href: "/blog",
          icon: "spark",
        },
        {
          title: "Release Notes",
          description:
            "What is new in Atlas — articles, guides, and interactive demos.",
          href: "/blog",
          icon: "cube",
        },
      ],
      featured: {
        title: "Atlas",
        titleAccent: "Blog",
        description:
          "Read how engineers learn, explain, and reason about systems — from first principles to real deployments.",
        href: "/blog",
      },
    },
  },
  {
    label: "Project-Docs",
    href: "/project-docs",
    menu: {
      items: [
        {
          title: "Documentation",
          description:
            "Reference guides for navigating Atlas content and structure.",
          href: "/project-docs",
          icon: "grid",
        },
        {
          title: "API Patterns",
          description:
            "Study interface design, contracts, and integration boundaries.",
          href: "/project-docs",
          icon: "layers",
        },
        {
          title: "System Maps",
          description:
            "Browse indexed breakdowns of databases, networks, and services.",
          href: "/project-docs",
          icon: "spark",
        },
        {
          title: "Contributing",
          description:
            "Learn how Atlas articles are organized and extended over time.",
          href: "/project-docs",
          icon: "cube",
        },
      ],
      featured: {
        title: "Project",
        titleAccent: "Docs",
        description:
          "Structured documentation for every Atlas guide — architecture notes, references, and implementation context.",
        href: "/project-docs",
      },
    },
  },
];

const sectionIds = navItems
  .filter((item) => item.href.startsWith("#"))
  .map((item) => item.href.slice(1));

function resolveNavHref(href, pathname) {
  if (href.startsWith("#")) {
    return pathname === "/" ? href : `/${href}`;
  }

  return href;
}

function getNavKey(item) {
  if (item.href.startsWith("#")) {
    return item.href.slice(1);
  }

  return item.href.replace(/^\//, "") || "home";
}

function MenuIcon({ type }) {
  return (
    <span className={`navbar-mega-icon navbar-mega-icon--${type}`} aria-hidden="true">
      <span className="navbar-mega-icon-face navbar-mega-icon-face--top" />
      <span className="navbar-mega-icon-face navbar-mega-icon-face--left" />
      <span className="navbar-mega-icon-face navbar-mega-icon-face--right" />
    </span>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-40% 0px -45% 0px",
        threshold: [0.1, 0.25, 0.5],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/project-docs") {
      setActiveSection("project-docs");
    }
  }, [location.pathname]);

  const hoveredItem = navItems.find((item) => item.label === hoveredLabel);

  const isNavActive = (item) => {
    const key = getNavKey(item);

    if (item.href.startsWith("/")) {
      return location.pathname === item.href;
    }

    return location.pathname === "/" && activeSection === key;
  };

  return (
    <header
      className="navbar"
      onMouseLeave={() => setHoveredLabel(null)}
    >
      <div className="navbar-container">
        <a href="/" className="navbar-logo" aria-label="Atlas home">
          <img
            src="/images/final-a.png"
            alt=""
            className="navbar-logo-img"
            draggable={false}
          />
          <span className="navbar-logo-text">tlas</span>
        </a>

        <nav className="navbar-links" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = isNavActive(item);
            const isHovered = hoveredLabel === item.label;

            return (
              <div
                key={item.label}
                className="navbar-item"
                onMouseEnter={() => setHoveredLabel(item.label)}
              >
                <a
                  href={resolveNavHref(item.href, location.pathname)}
                  className={[
                    "navbar-link",
                    (isActive || isHovered) && "navbar-link--active",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </a>
              </div>
            );
          })}
        </nav>
      </div>

      <div
        className={[
          "navbar-mega-wrap",
          hoveredItem?.menu && "navbar-mega-wrap--visible",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden={!hoveredItem?.menu}
      >
        {hoveredItem?.menu && (
          <div className="navbar-mega">
            <div className="navbar-mega-grid">
              {hoveredItem.menu.items.map((entry) => (
                <a
                  key={entry.title}
                  href={resolveNavHref(entry.href, location.pathname)}
                  className="navbar-mega-card"
                >
                  <MenuIcon type={entry.icon} />
                  <span className="navbar-mega-card-copy">
                    <span className="navbar-mega-card-title">{entry.title}</span>
                    <span className="navbar-mega-card-desc">{entry.description}</span>
                  </span>
                </a>
              ))}
            </div>

            <a
              href={resolveNavHref(hoveredItem.menu.featured.href, location.pathname)}
              className="navbar-mega-featured"
            >
              <MenuIcon type="cube" />
              <span className="navbar-mega-featured-copy">
                <span className="navbar-mega-featured-title">
                  {hoveredItem.menu.featured.title}{" "}
                  <span className="navbar-mega-featured-accent">
                    {hoveredItem.menu.featured.titleAccent}
                  </span>
                </span>
                <span className="navbar-mega-featured-desc">
                  {hoveredItem.menu.featured.description}
                </span>
              </span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
