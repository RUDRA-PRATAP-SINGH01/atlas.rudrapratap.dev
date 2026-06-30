import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { docsIndex } from "@/data/docsIndex";

function resolveNavHref(href, pathname) {
  if (href.startsWith("#")) {
    return pathname === "/project-docs" ? href : `/project-docs${href}`;
  }
  return href;
}

export default function DocsNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const searchTriggerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setQuery("");
    } else {
      searchTriggerRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const modal = modalRef.current;
    if (!modal) {
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    const focusableSelector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(modal.querySelectorAll(focusableSelector)).filter(
        (el) => el.offsetParent !== null || el === inputRef.current,
      );

    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    modal.addEventListener("keydown", handleTab);

    return () => {
      document.body.style.overflow = previousOverflow;
      modal.removeEventListener("keydown", handleTab);
    };
  }, [searchOpen]);

  const results = query.trim()
    ? docsIndex.filter((item) => {
        const text = `${item.title} ${item.category} ${item.description} ${item.keywords}`.toLowerCase();
        const searchTerms = query.toLowerCase().split(/\s+/);
        return searchTerms.every((term) => text.includes(term));
      })
    : [];

  const handleSelectResult = (href) => {
    setSearchOpen(false);
    navigate(href);
  };

  return (
    <>
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
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14, marginRight: 5, display: "inline-block", verticalAlign: "-1.5px" }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>
            </nav>
          </div>

          <div className="docs-navbar-right">
            <button
              ref={searchTriggerRef}
              type="button"
              className="docs-navbar-search"
              aria-label="Search documentation"
              onClick={() => setSearchOpen(true)}
            >
              <svg className="docs-navbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <span className="docs-navbar-search-placeholder">Search</span>
              <kbd className="docs-navbar-search-kbd">Ctrl K</kbd>
            </button>
          </div>
        </div>
      </header>

      {searchOpen && (
        <div
          className="docs-search-overlay-modal"
          role="presentation"
          onClick={() => setSearchOpen(false)}
        >
          <div
            ref={modalRef}
            className="docs-search-modal-container"
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="docs-search-modal-header">
              <svg className="docs-search-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                className="docs-search-modal-input"
                placeholder="Search database docs, design paths..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search query"
              />
              <button type="button" className="docs-search-modal-close" onClick={() => setSearchOpen(false)}>
                esc
              </button>
            </div>

            <div className="docs-search-modal-body">
              {query.trim() === "" ? (
                <div className="docs-search-modal-empty">
                  Type query keywords to find architecture designs, configs, crash recovery or setup guides...
                </div>
              ) : results.length === 0 ? (
                <div className="docs-search-modal-empty">
                  No matching documentation files found for &quot;<span className="highlight-text">{query}</span>&quot;
                </div>
              ) : (
                <div className="docs-search-modal-results" role="listbox" aria-label="Search results">
                  {results.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      className="docs-search-result-item"
                      role="option"
                      onClick={() => handleSelectResult(item.href)}
                    >
                      <div className="docs-search-result-meta">
                        <span className="docs-search-result-category">{item.category}</span>
                      </div>
                      <span className="docs-search-result-title">{item.title}</span>
                      <span className="docs-search-result-desc">{item.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
