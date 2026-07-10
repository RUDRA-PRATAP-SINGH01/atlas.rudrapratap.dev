import React, { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import { rateLimiterRegistry, getSectionInfoBySlug, canonicalNavigationOrder } from "./registry";

export default function RateLimiterDocPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Find page content
  const activeSlug = slug || "start-here";
  const pageData = rateLimiterRegistry[activeSlug];

  useEffect(() => {
    // If invalid slug, redirect to introduction start-here
    if (!pageData) {
      navigate("/docs/distributed-rate-limiter/introduction/start-here", { replace: true });
      return;
    }

    // Set page title for SEO & UI
    document.title = `${pageData.title} — Distributed Rate Limiter Docs | Atlas`;

    // Smooth scroll to hash on load/navigation
    if (window.location.hash) {
      const el = document.getElementById(window.location.hash.substring(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [activeSlug, pageData, navigate]);

  if (!pageData) {
    return null;
  }

  // Calculate Next and Previous pages from canonical order
  const activeIndex = canonicalNavigationOrder.findIndex((item) => item.slug === activeSlug);
  const prevPage = activeIndex > 0 ? canonicalNavigationOrder[activeIndex - 1] : null;
  const nextPage = activeIndex < canonicalNavigationOrder.length - 1 ? canonicalNavigationOrder[activeIndex + 1] : null;

  const sectionInfo = getSectionInfoBySlug(activeSlug) || { label: "RATE LIMITER" };

  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            {/* Breadcrumb */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: "rgba(255, 255, 255, 0.4)",
              textTransform: "uppercase",
              marginBottom: 8,
              display: "flex",
              gap: 6
            }}>
              <span>Docs</span>
              <span>/</span>
              <span>Rate Limiter</span>
              <span>/</span>
              <span style={{ color: "#ff5cad" }}>{sectionInfo.label}</span>
            </div>

            <h1 className="guide-main-title" id="page-title" style={{ fontSize: 32, fontWeight: "800", color: "#ffffff", marginBottom: 12 }}>
              {pageData.title}
            </h1>

            <div className="guide-body-text" style={{ marginTop: 20 }}>
              {pageData.content}

              {/* Prev / Next Footer Navigation */}
              <div className="guide-pager">
                {prevPage ? (
                  <Link
                    to={`/docs/distributed-rate-limiter/${prevPage.section}/${prevPage.slug}`}
                    className="guide-pager-link"
                  >
                    <span>&larr;</span>
                    <span className="guide-pager-link-label">
                      {rateLimiterRegistry[prevPage.slug]?.title || prevPage.slug}
                    </span>
                  </Link>
                ) : <div />}

                {nextPage ? (
                  <Link
                    to={`/docs/distributed-rate-limiter/${nextPage.section}/${nextPage.slug}`}
                    className="guide-pager-link guide-pager-link--next"
                  >
                    <span className="guide-pager-link-label">
                      {rateLimiterRegistry[nextPage.slug]?.title || nextPage.slug}
                    </span>
                    <span>&rarr;</span>
                  </Link>
                ) : <div />}
              </div>
            </div>
          </div>
        </main>

        {/* Outline / Right Sidebar */}
        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">Outline</h4>
            <ul className="guide-sidebar-right-list">
              {pageData.topics && pageData.topics.map((topic) => (
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
