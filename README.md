# ATLAS

**The Interactive Atlas of Modern Software Engineering**

[atlas.rudrapratap.dev](https://atlas.rudrapratap.dev)

---

ATLAS is an engineering publication built for people who want to understand complex software systems—not at a surface level, but deeply enough to reason about real production trade-offs.

We don't publish beginner tutorials or framework walkthroughs. We start with questions that experienced engineers actually ask: *Why is sharding usually a last resort?* *How does Stripe prevent double charges?* *What really happens during a single ChatGPT request?* From there, each piece builds a complete mental model—from first principles through to how these systems behave at scale.

## What ATLAS covers

ATLAS spans the parts of computing that matter most when you're designing, operating, or debugging serious software:

- Distributed Systems
- Databases & Storage Engines
- AI Infrastructure & ML Systems
- Networking & Operating Systems
- System Design & Cloud Architecture
- Performance, Reliability & Backend Infrastructure

## How we teach

Every publication is designed to connect theory with practice. A typical ATLAS piece may combine:

- Long-form technical writing
- Architecture diagrams and animated walkthroughs
- Step-by-step execution visualizations
- Production case studies and implementation notes
- Code snippets, references, and links to primary sources
- Interactive simulations for exploring systems visually

The focus is always on **why** a system is shaped the way it is, **what** it costs you in trade-offs, and **when** it belongs—or doesn't belong—in production.

## Vision

ATLAS aims to become a trusted open engineering resource: a place where students, practitioners, and researchers can develop the kind of intuition that usually only comes from years of building and operating real systems.

We care about performance, clarity, and interactive storytelling—turning dense engineering ideas into experiences that are rigorous, readable, and worth returning to.

---

## This repository

This repo contains the ATLAS web experience—the landing page and front-end shell for the platform. It is built for speed, clean design, and a foundation that can grow as the publication expands.

### Stack

- [React](https://react.dev/) 19
- [Vite](https://vite.dev/) 8
- [Tailwind CSS](https://tailwindcss.com/) 4

### Project structure

```
├── public/
│   ├── fonts/              # Poppins & Manrope (woff2)
│   └── images/
│       └── final-a.png     # Logo, hero image & favicon
├── src/
│   ├── components/
│   │   ├── LandingPage.jsx
│   │   └── Navbar.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run Oxlint               |

### Deploy

Build the static site and deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.):

```bash
npm run build
```
