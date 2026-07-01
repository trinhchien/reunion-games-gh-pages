# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack web application for reunion event games and a lucky wheel. Files are split into frontend (`public/`) and backend (`server/`):

### Frontend (`public/`)
- `public/index.html`: public page structure, sections, UI hooks, player join modal.
- `public/admin.html`: admin page structure with JWT login form.
- `public/style.css`: all visual styling, layout, responsive rules, modal/WSA styles.
- `public/script.js`: public page app logic — fetches state from API, WebSocket realtime sync, wheel spin via server, player registration.
- `public/admin.js`: admin page app logic — JWT auth, CRUD via API, debounced save, WebSocket state sync.

### Backend (`server/`)
- `server/index.ts`: Hono + Bun entry point; serves `public/` static files and mounts API routes.
- `server/db.ts`: PostgreSQL client (postgres npm package).
- `server/schema.sql`: database schema (games, attendees, players, turns, admin_users).
- `server/seed-admin.ts`: seeds the first admin user.
- `server/ws.ts`: WebSocket client management and state broadcast.
- `server/middleware/auth.ts`: JWT verification middleware for admin routes.
- `server/routes/`: API route modules — `admin.ts`, `games.ts`, `players.ts`, `turns.ts`.

### Root
- `README.md`: end-user setup and deployment notes.
- `docker-compose.yml`: PostgreSQL 16 container.
- `package.json`: project dependencies and scripts.
- `tsconfig.json`: TypeScript configuration for the server.

There is no `src/` or build output directory. All frontend code is served as static files from `public/`.

## Build, Test, and Development Commands

```bash
bun run dev       # Start dev server with hot reload
bun run start     # Start production server
bun run seed      # Seed the admin user
```

Database requires PostgreSQL (via `docker compose up -d` or a remote instance).

## Coding Style & Naming Conventions
Use 2-space indentation in HTML and 2 spaces in CSS and JavaScript to match the existing files. Prefer descriptive camelCase for JavaScript variables and functions such as `renderPublicGames` and `toggleAttendeeExcluded`. Use kebab-case for CSS classes like `.hero-card` and `.tab-panel`.

Keep JavaScript framework-free and DOM-driven. Preserve relative imports like `./style.css` and `./script.js`.

For server code (TypeScript), follow the existing patterns in `server/` — Hono router, async route handlers, and the established error handling conventions.

## Testing Guidelines
There is no automated test suite yet. Before opening a PR, verify manually:

- Start the server with `bun run dev`
- Go to `http://localhost:3000` — public page loads, tabs switch correctly
- Go to `http://localhost:3000/admin.html` — login form appears
- Player registration, wheel spin, and attendee management work end-to-end
- Layout remains usable on desktop and mobile widths

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so no established commit pattern can be inferred. Use short, imperative commit messages such as `Add attendee import validation` or `Refine wheel mobile layout`.

Pull requests should include:

- a brief summary of user-visible changes
- manual test notes
- screenshots or short recordings for UI changes
- linked issue or task reference when applicable

## Configuration Notes
Application state (games, attendees, players) is stored in PostgreSQL. Admin auth uses JWT tokens stored in `sessionStorage`. Avoid storing secrets or assuming shared state across devices. Use `.env` for configuration (see README).

## Language & Copy Guidelines
Write all Vietnamese copy with proper diacritics. Do not introduce Vietnamese text without accents in UI labels, descriptions, documentation, or seeded content. When editing existing Vietnamese copy, normalize it to accented Vietnamese where practical.
