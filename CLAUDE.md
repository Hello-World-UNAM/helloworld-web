# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at localhost:4321
npm run build     # build (SSR, Vercel adapter) to .vercel/output
npm run preview   # preview built site
```

No linting or test scripts configured. Type-checking happens implicitly via `astro check` if invoked manually.

`scripts/migrate_csv.mjs` is a one-off used to translate the legacy ranking CSV into SQL — not part of the normal workflow.

## Architecture

Astro 5.x **SSR site** with `@astrojs/vercel/serverless` adapter (`astro.config.mjs` sets `output: 'server'`). Pages render on the Vercel function unless purely static. Stylesheets are inlined (`build.inlineStylesheets: 'always'`).

### Path aliases (tsconfig.json)

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@data/*` | `src/data/*` |
| `@lib/*` | `src/lib/*` |

### Auth + route guards (`src/middleware.ts`)

Two protected zones: `/admin/*` (board members) and `/mi-cuenta/*` (any member). Middleware runs Supabase `getUser()` for those zones only and:
- Redirects unauthenticated visitors to the corresponding `/login` page.
- For `/admin/*`, calls RPC `is_email_in_directiva` to enforce role; bounces non-directiva back to `/admin/login?error=unauthorized`.
- Stashes `user.email` into `Astro.locals.userEmail` so layouts can read it without a second round-trip.
- Skips `/api/auth/callback` and `/admin/auth/callback` to avoid loops.

`Astro.locals` typed in `src/env.d.ts`.

### Supabase clients (`src/lib/`)

Three flavors — pick the right one:
- `supabase.ts` → **browser** client (`createBrowserClient`). Use inside `<script>` blocks.
- `supabaseServer.ts` → `getSupabaseServerClient(cookies)` for routes that mutate session cookies (middleware, OAuth callback). Uses `createServerClient` with full cookie set/remove.
- `supabaseServer.ts` → `getSafeSupabaseServerClient(cookies)` for layouts/components that only **read** the session. Its cookie `set`/`remove` are no-ops to avoid `AstroError: ResponseSentError` once response headers have been flushed.

`src/lib/database.types.ts` is a hand-written stub of the Supabase schema (`solicitudes`, etc.) — replace via `supabase gen types typescript` when the schema stabilizes.

### Domain helpers

- `src/lib/season.ts` — semester convention `"YYYY-N"` where N ∈ {1,2}. Sem 1 = Jan–Jul, Sem 2 = Aug–Dec. Includes legacy `"YYYY-YYYY"` parsing for old records.
- `src/lib/interview-slots.ts` — generates interview slot `Date`s from a day spec; date strings are treated as **local** (not UTC) because Supabase returns `DATE` as a string.

### API routes (`src/pages/api/`)

- `auth/callback.ts` — Supabase OAuth code exchange.
- `cron/daily-digest.ts` — invoked by Vercel Cron. Gated by `CRON_SECRET` (Bearer header or `?token=` query). Uses `SUPABASE_SERVICE_ROLE_KEY` if present, else falls back to anon key.
- `send-rejection.ts` — Resend-powered transactional email.

### Layouts

- `Layout.astro` — public pages. Loads Google Fonts (Playfair Display + DM Sans), Bootstrap Icons CDN, Vercel Analytics + Speed Insights. Props: `title`, `description`, `activeNav`.
- `AdminLayout.astro` — directiva dashboard chrome.
- `MiCuentaLayout.astro` — member portal chrome.

### Data layer

`src/data/*.json` is imported directly into pages at build time:
- `club.json` — institutional info
- `events.json` — hackathons, courses, events catalog

Dynamic state (solicitudes, interviews, periods, members, ranking) lives in Supabase, not JSON. `/ranking` queries the `ranking_por_periodo` view directly.

### Design system

**`DESIGN.md` at the repo root is the authoritative spec.** Read it before touching styles. Quick reference:

- Neo-Brutalism: 4px black borders, flat offset shadows in `#6225e6`, zero `border-radius` on functional elements, no gradients, no blur shadows.
- Primary `#6225e6`, accent `#c4b5fd`, structural dividers `4px solid #6225e6`.
- Typography: DM Sans for UI, Playfair Display for quotes/emphasis, Courier New for terminal.
- Uppercase + weights 700–900 on titles, badges, buttons, nav.
- All styles live in `src/styles/global.css` (no CSS modules, no Tailwind).

### Animations

Scroll-triggered animations use `IntersectionObserver` — **never autoplay on load**. Existing examples: typewriter terminal (index), stat counters (index), progress bars (ranking).

### Public forms

`contacto.astro` posts to Formspree, gated by Google reCAPTCHA v3. Wired via inline `<script>` in the page.

## Pages

| Route | Purpose |
|---|---|
| `/` | Hero + animated terminal showcase |
| `/oferta` | Events catalog with horizontal carousels |
| `/ranking` | Member leaderboard with podium |
| `/nuestro-club` | Mission, vision, board members |
| `/contacto` | Public contact form (Formspree + reCAPTCHA) |
| `/seleccion/*` | Public selection flow — `index`, `aplicar`, `agendar` |
| `/mi-cuenta/*` | Member portal — `index`, `login`, `registrar` (auth required) |
| `/admin/*` | Directiva dashboard — `entrevistas`, `leaderboard`, `miembros`, `periodos`, `seleccion-config`, `solicitudes/{index,detalle}` (auth + directiva role required) |

## Vercel config

`vercel.json` sets a strict CSP. Any new external origin (image host, script, font, websocket) **must** be added to the relevant CSP directive there or it will be blocked at the edge. Supabase project URL `hzewxtimkbxljozyrafk.supabase.co` is already whitelisted for `img-src`, `connect-src`, and `wss:`.

## Environment variables

- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — required by all Supabase clients (browser + server).
- `SUPABASE_SERVICE_ROLE_KEY` — used by cron jobs that need to bypass RLS.
- `RESEND_API_KEY` — outbound email.
- `CRON_SECRET` — required to invoke `/api/cron/*` endpoints in production.
