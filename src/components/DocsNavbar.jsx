import { Link, useLocation } from "react-router-dom";

function resolveNavHref(href, pathname) {
  if (href.startsWith("#")) {
    return pathname === "/project-docs" ? href : `/project-docs${href}`;
  }
  return href;
}

export default function DocsNavbar() {
  const location = useLocation();

  return (
    <header className="docs-navbar">
      <div className="docs-navbar-container">
        <div className="docs-navbar-left">
          <Link to="/project-docs" className="docs-navbar-logo" aria-label="Atlas Docs home">
            <img
              src="/images/final-a.png"
              alt=""
              className="docs-navbar-logo-img"
              draggable={false}
            />
            <span className="docs-navbar-logo-text">
              <span className="docs-navbar-logo-atlas">tlas</span>
              <span className="docs-navbar-logo-docs">Docs</span>
            </span>
          </Link>

          <nav className="docs-navbar-links" aria-label="Documentation navigation">
            <Link
              to="/project-docs/guide"
              className={`docs-navbar-link${location.pathname.startsWith("/project-docs/guide") ? " docs-navbar-link--active" : ""}`}
            >
              Guide
            </Link>
            <a href={resolveNavHref("#featured-projects", location.pathname)} className="docs-navbar-link">Architecture Design</a>
            <Link
              to="/project-docs/reference"
              className={`docs-navbar-link${location.pathname.startsWith("/project-docs/reference") || location.pathname.startsWith("/project-docs/guide/reference") ? " docs-navbar-link--active" : ""}`}
            >
              Reference
            </Link>
            <a href="https://github.com/RUDRA-PRATAP-SINGH01" target="_blank" rel="noopener noreferrer" className="docs-navbar-link docs-navbar-github-link">
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14, marginRight: 5, display: 'inline-block', verticalAlign: '-1.5px' }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </nav>
        </div>

        <div className="docs-navbar-right">
          <div className="docs-navbar-search" role="search">
            <svg className="docs-navbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="docs-navbar-search-placeholder">Search</span>
            <kbd className="docs-navbar-search-kbd">Ctrl K</kbd>
          </div>
        </div>
      </div>
    </header>
  );
}
