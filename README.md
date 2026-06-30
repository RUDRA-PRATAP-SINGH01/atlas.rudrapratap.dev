# ATLAS

**The Interactive Atlas of Modern Software Engineering**

[atlas.rudrapratap.dev](https://atlas.rudrapratap.dev)

---

I built ATLAS as an engineering publication for people who want to understand complex software systems—not at a surface level, but deeply enough to reason about real production trade-offs.

I do not write beginner tutorials or framework walkthroughs. I start with questions that experienced engineers actually ask: *Why is sharding usually a last resort?* *How does Stripe prevent double charges?* *What really happens during a single ChatGPT request?* From there, each piece builds a complete mental model—from first principles through to how these systems behave at scale.

## What I cover

- Distributed Systems
- Databases and Storage Engines
- AI Infrastructure and ML Systems
- Networking and Operating Systems
- System Design and Cloud Architecture
- Performance, Reliability, and Backend Infrastructure

## How I teach

I design every publication to connect theory with practice. A typical ATLAS piece may combine:

- Long-form technical writing
- Architecture diagrams and animated walkthroughs
- Step-by-step execution visualizations
- Production case studies and implementation notes
- Code snippets, references, and links to primary sources
- Interactive simulations for exploring systems visually

My focus is always on **why** a system is shaped the way it is, **what** it costs you in trade-offs, and **when** it belongs—or does not belong—in production.

## What I built in this repo

This repository is the full ATLAS web application—designed, implemented, and documented by me. It includes:

- The marketing landing page with scroll-driven animations
- The project documentation hub
- The complete PebbleDB technical guide (50+ pages: architecture, internals, implementation, testing, debugging, and reference)
- Global documentation search, sidebar navigation, Mermaid diagrams, and Go code blocks

[PebbleDB](https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB) is my high-performance LSM-tree storage engine written in Go. The docs in this site are the companion to that implementation—I wrote both the engine and the documentation that explains how it works.

The app is a static React SPA that I structured for code splitting, fast initial load, and incremental doc page delivery.

### Stack

| Layer | Technology |
| ----- | ---------- |
| UI | React 19 |
| Build | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4, custom CSS (`src/styles/index.css`) |
| Animation | GSAP, ScrollTrigger, Locomotive Scroll (landing only) |
| Diagrams | Mermaid 11 (lazy-loaded per doc page) |
| Lint | Oxlint |

### Architecture overview

```
Browser
  └── main.jsx                 # Entry point
        └── app/App.jsx        # Router + Suspense boundary
              └── routes/AppRoutes.jsx
                    └── lazy page chunks (per route)
```

- **Route-level code splitting**: I lazy-load every page via `src/routes/lazyPages.js`.
- **Path alias**: `@/` maps to `src/` (configured in Vite and jsconfig).
- **URL-driven docs**: the folder structure under `src/pages/docs/` mirrors public routes under `/project-docs/`.
- **Shared doc shell**: `DocsNavbar`, `DocsSidebar`, `DocsMermaid`, and `GoCodeBlock` live in `src/components/docs/`.
- **Search index**: `src/data/docsIndex.js` powers Ctrl+K search across all guide pages.

### Project structure

```
atlas.rudrapratap.dev/
├── public/
│   ├── _redirects              # SPA fallback (Netlify)
│   ├── fonts/                  # Poppins, Manrope (woff2)
│   └── images/                 # Static assets (hero, docs, project cards)
├── scripts/
│   └── restructure.mjs         # One-time migration helper (optional)
├── src/
│   ├── app/
│   │   └── App.jsx             # Root app shell (BrowserRouter + Suspense)
│   ├── components/
│   │   ├── common/
│   │   │   └── RouteFallback.jsx
│   │   ├── docs/
│   │   │   ├── DocsNavbar.jsx
│   │   │   ├── DocsSidebar.jsx
│   │   │   ├── DocsMermaid.jsx
│   │   │   └── GoCodeBlock.jsx
│   │   ├── layout/
│   │   │   └── Navbar.jsx
│   │   └── ui/
│   │       └── PillButton.jsx
│   ├── data/
│   │   ├── docsIndex.js        # Search index for all doc routes
│   │   └── pebbledbReferences.js
│   ├── hooks/
│   │   └── useLocomotiveScroll.js
│   ├── pages/
│   │   ├── landing/
│   │   │   └── LandingPage.jsx
│   │   ├── docs/
│   │   │   ├── hub/
│   │   │   │   └── ProjectDocsPage.jsx
│   │   │   ├── reference/
│   │   │   │   └── ReferenceDocsPage.jsx
│   │   │   └── guide/
│   │   │       ├── IntroDocsPage.jsx
│   │   │       ├── SetupDocsPage.jsx
│   │   │       ├── LsmFundamentalsDocsPage.jsx
│   │   │       ├── pebbledb/
│   │   │       ├── architecture/
│   │   │       ├── core-components/
│   │   │       ├── internals/
│   │   │       ├── implementation/
│   │   │       ├── design/
│   │   │       ├── performance/
│   │   │       ├── testing/
│   │   │       ├── debugging/
│   │   │       └── reference/
│   │   ├── BlogPage.jsx
│   │   └── NotFoundPage.jsx
│   ├── routes/
│   │   ├── lazyPages.js        # All lazy import definitions
│   │   └── AppRoutes.jsx       # Route table
│   ├── styles/
│   │   └── index.css           # Global styles and design tokens
│   └── main.jsx
├── index.html
├── jsconfig.json               # @ path alias for editor tooling
├── package.json
├── vite.config.js
└── README.md
```

### Route map (documentation)

| URL prefix | Source folder |
| ---------- | ------------- |
| `/` | `pages/landing/` |
| `/blog` | `pages/BlogPage.jsx` |
| `/project-docs` | `pages/docs/hub/` |
| `/project-docs/reference` | `pages/docs/reference/` |
| `/project-docs/guide` | `pages/docs/guide/` |
| `/project-docs/guide/architecture/*` | `pages/docs/guide/architecture/` |
| `/project-docs/guide/core-components/*` | `pages/docs/guide/core-components/` |
| `/project-docs/guide/internals/*` | `pages/docs/guide/internals/` |
| `/project-docs/guide/implementation/*` | `pages/docs/guide/implementation/` |
| `/project-docs/guide/design-*` | `pages/docs/guide/design/` |
| `/project-docs/guide/performance/*` | `pages/docs/guide/performance/` |
| `/project-docs/guide/testing/*` | `pages/docs/guide/testing/` |
| `/project-docs/guide/debugging/*` | `pages/docs/guide/debugging/` |
| `/project-docs/guide/reference/*` | `pages/docs/guide/reference/` |

### Adding a new documentation page

When I add a new doc page, I follow this flow:

1. Create the page component under the matching folder in `src/pages/docs/guide/`.
2. Add a lazy import in `src/routes/lazyPages.js`.
3. Register the route in `src/routes/AppRoutes.jsx`.
4. Add an entry to `src/data/docsIndex.js` for search.
5. Link the page from `src/components/docs/DocsSidebar.jsx` if it should appear in navigation.

Shared imports use the `@/` alias:

```jsx
import DocsNavbar from "@/components/docs/DocsNavbar";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMermaid from "@/components/docs/DocsMermaid";
```

### Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run Oxlint |

### Deploy

```bash
npm run build
```

Deploy the `dist/` directory to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.). For client-side routing, configure the host to serve `index.html` for unknown paths. I included a `_redirects` file in `public/` for Netlify.

### Performance decisions I made

- The initial JS bundle excludes all doc pages and Mermaid; they load on navigation.
- Locomotive Scroll CSS and logic load only on the landing page (`useLocomotiveScroll`).
- Mermaid diagrams are cached in memory by chart content (`DocsMermaid`).
- Below-the-fold images on the landing page use `loading="lazy"` with explicit dimensions.

### License

Private repository. All rights reserved unless otherwise noted.
