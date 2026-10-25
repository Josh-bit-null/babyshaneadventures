# BabyShaneAdventures

A mobile-first, two-player study island built as a React PWA. Explore a low-poly
3D home, study from PDFs, compare screen-time totals, focus together, complete
verified chores, and spend earned coins on shared furniture and themes.

## Requirements

- Node.js 22.5 or newer
- npm
- MariaDB for deployment (local development uses Node's built-in SQLite by default)

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The Vite client runs at `http://localhost:5173`; Express and Socket.IO run at
`http://localhost:3001`. In development, demo accounts are seeded and printed
in the server console. Set `GEMINI_API_KEY` in `.env` to enable Gemini quiz
generation; without it, the local quiz engine remains available.

## Production

Set `NODE_ENV=production`, a strong `JWT_SECRET`, the deployed frontend origin
in `CLIENT_ORIGIN`, and a MariaDB URL in `DATABASE_URL`. Set `COOKIE_SECURE=true`
when serving over HTTPS. Build and start with:

```powershell
npm run build
npm start
```

The Express server serves `client/dist` and the API from the same origin.
`npm run build` also checks that the shipped client, models, fonts, and OCR
data remain below the 18 MB asset budget.

## Project layout

- `client/` — Vite, React, routing, PWA shell, Three.js/R3F world, and controls
- `server/` — Express API, cookie-based JWT auth, Socket.IO, study logic, and persistence
- `server/db/schema.mariadb.sql` — the `Users`, `Rooms`, and `Inventories` tables
- `client/public/models/` — locally cached low-poly GLB models

MariaDB is selected when `DATABASE_URL` is set. Otherwise, development uses
SQLite with the same three-table data model.

Ready Player Me shut down its avatar service on January 31, 2026. The app keeps
editable native chibi avatars for Mushroom Joshua and Siopao RikaShane, and can
still load a previously exported Ready Player Me `.glb` URL.

## Checks

```powershell
npm test
npm run lint
npm run build
```
