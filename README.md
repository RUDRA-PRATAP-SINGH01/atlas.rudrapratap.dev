# Atlas

Landing page for **Atlas** — The Interactive Atlas of Modern Software Engineering.

Live site: [atlas.rudrapratap.dev](https://atlas.rudrapratap.dev)

## Stack

- [React](https://react.dev/) 19
- [Vite](https://vite.dev/) 8
- [Tailwind CSS](https://tailwindcss.com/) 4

## Project structure

```
├── public/
│   ├── fonts/          # Web fonts
│   ├── images/         # Static images
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/     # React components
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.js
```

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start development server |
| `npm run build` | Build for production     |
| `npm run preview` | Preview production build |
| `npm run lint`  | Run Oxlint               |

## Deploy

Build the static site and deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.):

```bash
npm run build
```
