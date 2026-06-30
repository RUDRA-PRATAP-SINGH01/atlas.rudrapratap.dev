import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

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
  },
  {
    label: "Blogs",
    href: "/blog",
  },
  {
    label: "Project-Docs",
    href: "/project-docs",
    menu: {
      items: [
        {
          title: "GUIDE",
          description:
            "Step-by-step introduction, fundamentals, and setup guides.",
          href: "/project-docs/guide/pebbledb/introduction",
          icon: "grid",
        },
        {
          title: "Architecture Design",
          description:
            "Deep dive into system boundaries, write paths, read paths, and concurrency.",
          href: "/project-docs/guide/architecture/system-overview",
          icon: "layers",
        },
        {
          title: "Technical Reference",
          description:
            "Milestones, development timeline, and specifications.",
          href: "/project-docs/reference",
          icon: "spark",
        },
        {
          title: "GitHub Repository",
          description:
            "View the complete open-source PebbleDB implementation.",
          href: "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB",
          icon: "cube",
        },
      ],
    },
  },
];

const sectionIds = navItems
  .filter((item) => item.href.startsWith("#"))
  .map((item) => item.href.slice(1));

function getNavKey(item) {
  if (item.href.startsWith("#")) {
    return item.href.slice(1);
  }

  return item.href.replace(/^\//, "") || "home";
}

// Custom icon rendering for the mega menu
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
    if (location.pathname.startsWith("/project-docs")) {
      setActiveSection("project-docs");
    }
  }, [location.pathname]);

  const hoveredItem = navItems.find((item) => item.label === hoveredLabel);

  const isNavActive = (item) => {
    const key = getNavKey(item);

    if (item.href.startsWith("/")) {
      if (item.href === "/project-docs") {
        return location.pathname.startsWith("/project-docs");
      }
      if (item.href === "/blog") {
        return location.pathname.startsWith("/blog");
      }
      return location.pathname === item.href;
    }

    return location.pathname === "/" && activeSection === key;
  };

  // Nav link rendering utility (handles Router Links vs regular Anchors)
  const renderNavLink = (item, isActive, isHovered) => {
    const className = [
      "navbar-link",
      (isActive || isHovered) && "navbar-link--active",
    ]
      .filter(Boolean)
      .join(" ");

    const isExternal = item.href.startsWith("http");
    const isHash = item.href.startsWith("#");

    if (isExternal) {
      return (
        <a
          href={item.href}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.label}
        </a>
      );
    }

    if (isHash && location.pathname !== "/") {
      return (
        <Link
          to={`/${item.href}`}
          className={className}
        >
          {item.label}
        </Link>
      );
    }

    if (isHash) {
      return (
        <a
          href={item.href}
          className={className}
        >
          {item.label}
        </a>
      );
    }

    return (
      <Link
        to={item.href}
        className={className}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header
      className="navbar"
      onMouseLeave={() => setHoveredLabel(null)}
    >
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" aria-label="Atlas home">
          <img
            src="/images/final-a.png"
            alt=""
            className="navbar-logo-img"
            draggable={false}
          />
          <span className="navbar-logo-text">tlas</span>
        </Link>

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
                {renderNavLink(item, isActive, isHovered)}
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
              {hoveredItem.menu.items.map((entry) => {
                const isExternal = entry.href.startsWith("http");
                const isHash = entry.href.startsWith("#");

                if (isExternal) {
                  return (
                    <a
                      key={entry.title}
                      href={entry.href}
                      className="navbar-mega-card"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setHoveredLabel(null)}
                    >
                      <MenuIcon type={entry.icon} />
                      <span className="navbar-mega-card-copy">
                        <span className="navbar-mega-card-title">{entry.title}</span>
                        <span className="navbar-mega-card-desc">{entry.description}</span>
                      </span>
                    </a>
                  );
                }

                if (isHash && location.pathname !== "/") {
                  return (
                    <Link
                      key={entry.title}
                      to={`/${entry.href}`}
                      className="navbar-mega-card"
                      onClick={() => setHoveredLabel(null)}
                    >
                      <MenuIcon type={entry.icon} />
                      <span className="navbar-mega-card-copy">
                        <span className="navbar-mega-card-title">{entry.title}</span>
                        <span className="navbar-mega-card-desc">{entry.description}</span>
                      </span>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={entry.title}
                    to={entry.href}
                    className="navbar-mega-card"
                    onClick={() => setHoveredLabel(null)}
                  >
                    <MenuIcon type={entry.icon} />
                    <span className="navbar-mega-card-copy">
                      <span className="navbar-mega-card-title">{entry.title}</span>
                      <span className="navbar-mega-card-desc">{entry.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            {hoveredItem.menu.featured && (() => {
              const isExternal = hoveredItem.menu.featured.href.startsWith("http");
              const isHash = hoveredItem.menu.featured.href.startsWith("#");

              if (isExternal) {
                return (
                  <a
                    href={hoveredItem.menu.featured.href}
                    className="navbar-mega-featured"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setHoveredLabel(null)}
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
                );
              }

              if (isHash && location.pathname !== "/") {
                return (
                  <Link
                    to={`/${hoveredItem.menu.featured.href}`}
                    className="navbar-mega-featured"
                    onClick={() => setHoveredLabel(null)}
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
                  </Link>
                );
              }

              return (
                <Link
                  to={hoveredItem.menu.featured.href}
                  className="navbar-mega-featured"
                  onClick={() => setHoveredLabel(null)}
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
                </Link>
              );
            })()}
          </div>
        )}
      </div>
    </header>
  );
}
