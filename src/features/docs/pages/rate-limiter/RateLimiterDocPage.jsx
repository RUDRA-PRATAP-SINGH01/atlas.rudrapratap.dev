import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DocsNavbar from "@/features/docs/components/DocsNavbar";
import DocsSidebar from "@/features/docs/components/DocsSidebar";
import {
  DocsHeader,
  OnThisPage,
  PageNavigation,
} from "@/features/docs/components/system";
import {
  canonicalNavigationOrder,
  getNavBySlug,
  getSectionInfoBySlug,
  getPageHref,
  pageTitles,
  sectionLoaders,
} from "./registry/nav";

const sectionCache = new Map();

async function loadPage(slug) {
  const nav = getNavBySlug(slug);
  if (!nav) return null;

  let pages = sectionCache.get(nav.section);
  if (!pages) {
    const loader = sectionLoaders[nav.section];
    if (!loader) return null;
    pages = await loader();
    sectionCache.set(nav.section, pages);
  }

  const page = pages[slug];
  if (!page) return null;
  return { ...page, section: nav.section, slug };
}

export default function RateLimiterDocPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const activeSlug = slug || "start-here";
  const [pageData, setPageData] = useState(null);
  const [loadState, setLoadState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    loadPage(activeSlug)
      .then((page) => {
        if (cancelled) return;
        if (!page) {
          navigate("/docs/distributed-rate-limiter/introduction/start-here", { replace: true });
          return;
        }
        setPageData(page);
        setLoadState("ready");
        document.title = `${page.title} — Distributed Rate Limiter Docs | Atlas`;

        if (window.location.hash) {
          const el = document.getElementById(window.location.hash.substring(1));
          if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
        } else {
          window.scrollTo(0, 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlug, navigate]);

  const activeIndex = canonicalNavigationOrder.findIndex((item) => item.slug === activeSlug);
  const prevNav = activeIndex > 0 ? canonicalNavigationOrder[activeIndex - 1] : null;
  const nextNav =
    activeIndex >= 0 && activeIndex < canonicalNavigationOrder.length - 1
      ? canonicalNavigationOrder[activeIndex + 1]
      : null;

  const sectionInfo = getSectionInfoBySlug(activeSlug) || { label: "RATE LIMITER" };
  const title = pageData?.title || pageTitles[activeSlug] || "Distributed Rate Limiter";

  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <DocsHeader
              breadcrumb={["Docs", "Rate Limiter", sectionInfo.label]}
              title={title}
            />

            <div className="guide-body-text" style={{ marginTop: 20 }}>
              {loadState === "loading" && (
                <p style={{ color: "var(--docs-text-muted)" }}>Loading page…</p>
              )}
              {loadState === "error" && (
                <p style={{ color: "var(--docs-accent-muted)" }}>Failed to load this page.</p>
              )}
              {loadState === "ready" && pageData?.content}

              <PageNavigation
                prev={
                  prevNav
                    ? { to: getPageHref(prevNav), title: pageTitles[prevNav.slug] || prevNav.slug }
                    : null
                }
                next={
                  nextNav
                    ? { to: getPageHref(nextNav), title: pageTitles[nextNav.slug] || nextNav.slug }
                    : null
                }
              />
            </div>
          </div>
        </main>

        <OnThisPage topics={pageData?.topics || []} />
      </div>
    </div>
  );
}
