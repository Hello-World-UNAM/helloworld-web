# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at localhost:4321
npm run build     # static build to dist/
npm run preview   # preview built site
```

No linting or test scripts configured.

## Architecture

Astro 5.x static site (no SSR adapter). Every page outputs plain HTML — no client JS unless written inside `<script>` tags within `.astro` files.

### Path aliases (tsconfig.json)

| Alias | Resolves to |
|---|---|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@data/*` | `src/data/*` |

### Data layer

All dynamic content lives in `src/data/` as JSON, imported directly into `.astro` pages at build time:
- `club.json` — institutional info
- `events.json` — hackathons, courses, events catalog
- `ranking.json` — member points table (`{ participants: [{ name, pts }] }`)

### Layout

`Layout.astro` wraps every page. Accepts `title`, `description`, and `activeNav` props. Loads Google Fonts (Playfair Display + DM Sans) and Bootstrap Icons via CDN. No local font files.

### Design system

Neo-Brutalist aesthetic — apply consistently:
- **Primary**: `#6225e6` (purple), **Accent**: `#c4b5fd` (lavender), **Black**: `#000`, **White**: `#fff`
- Borders: `4px solid #000` on interactive containers; `4px solid #6225e6` on structural dividers
- Box shadows: flat offset in primary color (e.g. `4px 4px 0 #6225e6`)
- Typography: uppercase, font-weight 700–900, high contrast
- All styles in `src/styles/global.css` (no CSS modules, no Tailwind)

### Animations

All scroll-triggered animations use `IntersectionObserver` — never autoplay on load. Existing examples: typewriter terminal (index), stat counters (index), progress bars (ranking).

### Forms

`contacto.astro` uses Formspree for submission and Google reCAPTCHA v3 for validation. Both are wired via `<script>` in the page.

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `index.astro` | Hero + animated terminal showcase |
| `/oferta` | `oferta.astro` | Events catalog with horizontal carousels |
| `/ranking` | `ranking.astro` | Member leaderboard with podium |
| `/nuestro-club` | `nuestro-club.astro` | Mission, vision, board members |
| `/contacto` | `contacto.astro` | Join form (Formspree + reCAPTCHA) |
