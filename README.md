# NeoBank

A demo retail banking app built with the **MEAN** stack (MongoDB, Express, Angular, Node) in an **Nx monorepo**. It's a learning project: no real money moves.

## Stack

| Layer      | Tech                                                         |
| ---------- | ------------------------------------------------------------ |
| Monorepo   | Nx 23                                                        |
| Frontend   | Angular 22 (standalone, zoneless, signals), NgRx SignalStore |
| UI         | Bootstrap 5.3 + ng-bootstrap, wrapped in `@neobank/web/ui`   |
| Backend    | Node 24, Express 5, Mongoose 9                               |
| Validation | Zod 4 schemas shared by API and web                          |
| Tests      | Vitest, Supertest, Playwright                                |
| Hosting    | Render (Docker, free) + MongoDB Atlas M0 (free)              |

## Layout

```
apps/
  api/          Express API (also serves the built Angular app in production)
  web/          Angular SPA
  web-e2e/      Playwright tests
libs/
  shared/models @neobank/shared/models  Zod schemas + types (API and web)
  shared/utils  @neobank/shared/utils   INR / paise helpers
  web/ui        @neobank/web/ui         nb-* components, themes, ThemeService
```

Lint rules enforce the boundaries: `scope:web` and `scope:api` may only import their own scope and `scope:shared`.

## Getting started

```bash
npm install
npm start            # Angular on http://localhost:4200 + API on :3333
```

No database setup is needed. If `MONGODB_URI` is empty, the API starts an **in-memory MongoDB replica set**, and its data resets when the API restarts. For persistent local data, run `docker compose up -d` and set `MONGODB_URI` in `.env` (see `.env.example`).

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm start`     | Run web + API with live reload        |
| `npm test`      | Unit tests for every project          |
| `npm run lint`  | Lint every project                    |
| `npm run build` | Production build of API and web       |
| `npm run e2e`   | Playwright tests (starts the servers) |
| `npm run graph` | Interactive project dependency graph  |

## Conventions

- **Money is integer paise.** `₹1,050.00` is stored as `105000`. Display it with `<nb-amount>` or the `inr` pipe.
- **Validate at the edges with Zod.** The API uses `validateBody(Schema)`, and the web app parses responses with the same schema.
- **API errors** always have the shape `{ error: { code, message, fields? } }`.
- **Themes:** `ThemeService` sets `data-bs-theme` and `data-nb-theme` on `<html>`. To add a theme, edit `libs/web/ui/src/lib/styles/_themes.scss` and `THEMES` in `theme.service.ts`.

## Deploying (Render + Atlas)

1. **Atlas:** create an M0 cluster (Mumbai or Singapore), a database user, and allow network access from `0.0.0.0/0`. Copy the `mongodb+srv://…/neobank` connection string.
2. **Render:** push this repo to GitHub, then choose **New → Blueprint** and pick the repo. `render.yaml` creates a free Docker web service. Paste the Atlas string as `MONGODB_URI`.
3. Open `https://<service>.onrender.com/api/health`. It should report `"db": "up"`.

On the free tier the service sleeps after 15 minutes idle, so the first request after that takes about 30–60 seconds.

## Roadmap

- [x] Day 1 – Monorepo, API skeleton, DB, themed UI kit, health check, CI, Docker
- [ ] Day 2 – Authentication (JWT + refresh cookie)
- [ ] Day 3 – Accounts + dashboard
- [ ] Day 4 – Transfers (transactions, ledger, idempotency)
- [ ] Day 5 – History, statements, admin
- [ ] Day 6 – Tests, security hardening
- [ ] Day 7 – Deploy
