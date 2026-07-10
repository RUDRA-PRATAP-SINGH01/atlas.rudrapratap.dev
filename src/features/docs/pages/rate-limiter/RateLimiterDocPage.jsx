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
              <div style={{
                marginTop: 48,
                paddingTop: 20,
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16
              }}>
                {prevPage ? (
                  <Link
                    to={`/docs/distributed-rate-limiter/${prevPage.section}/${prevPage.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 20,
                      textDecoration: "none",
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: 12,
                      fontWeight: 500,
                      transition: "all 0.2s ease",
                      maxWidth: "48%"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#ff5cad";
                      e.currentTarget.style.background = "rgba(255, 92, 173, 0.08)";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                    }}
                  >
                    <span>&larr;</span>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {rateLimiterRegistry[prevPage.slug]?.title || prevPage.slug}
                    </span>
                  </Link>
                ) : <div />}

                {nextPage ? (
                  <Link
                    to={`/docs/distributed-rate-limiter/${nextPage.section}/${nextPage.slug}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 20,
                      textDecoration: "none",
                      color: "rgba(255, 255, 255, 0.7)",
                      fontSize: 12,
                      fontWeight: 500,
                      transition: "all 0.2s ease",
                      maxWidth: "48%",
                      marginLeft: "auto"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#ff5cad";
                      e.currentTarget.style.background = "rgba(255, 92, 173, 0.08)";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                    }}
                  >
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
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
                  <a href={topic.href} className="guide-sidebar-right-link" style={{ fontSize: 12.5 }}>
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
