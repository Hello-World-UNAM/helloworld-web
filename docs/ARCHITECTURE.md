# Arquitectura

Astro 5 SSR desplegado como funciones serverless en Vercel, con Supabase como backend único (Postgres, Auth, Storage) y Resend para correos.

```
┌────────────────────────────────────────────────────────────┐
│                       Vercel Edge / CDN                    │
│  CSP · HSTS · X-Frame · Rate limit (Attack Mode opcional)  │
└──────────┬─────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────┐
│              Astro SSR (Vercel Functions)                  │
│                                                            │
│   src/middleware.ts                                        │
│    ├─ Guards /admin/*  → is_email_in_directiva()           │
│    ├─ Guards /mi-cuenta/*  → sesión Supabase válida        │
│    └─ Locals.userEmail para layouts                        │
│                                                            │
│   Pages: público · /seleccion · /mi-cuenta · /admin        │
│   API:   /api/auth/callback · /api/send-rejection ·        │
│          /api/cron/daily-digest                            │
└──────────┬───────────────────────────────┬─────────────────┘
           │                               │
           ▼                               ▼
   ┌───────────────┐              ┌─────────────────────┐
   │  Supabase     │              │  Resend             │
   │  ─ Postgres   │              │  Emails transacc.   │
   │  ─ Auth       │              │                     │
   │  ─ Storage    │              └─────────────────────┘
   │  ─ RLS + RPCs │
   │  ─ audit_logs │
   └───────────────┘
```

## Middleware

Un solo archivo (`src/middleware.ts`) resuelve auth y role antes de servir rutas protegidas. Dos zonas:

- `/admin/*` — exige sesión + `private.is_directiva()`.
- `/mi-cuenta/*` — exige sesión válida.

El middleware guarda `user.email` en `Astro.locals.userEmail` para que los layouts lo lean sin round-trip extra. Los callbacks OAuth (`/api/auth/callback`, `/admin/auth/callback`) se saltan del guard para no entrar en loops.

## Clientes Supabase

Tres variantes en `src/lib/`:

| Archivo | Cuándo usar |
|---|---|
| `supabase.ts` | Cliente browser (`createBrowserClient`). Dentro de `<script>`. |
| `supabaseServer.ts` · `getSupabaseServerClient()` | Rutas que mutan cookies de sesión (middleware, OAuth callback). |
| `supabaseServer.ts` · `getSafeSupabaseServerClient()` | Layouts o componentes que solo **leen** sesión. Cookie `set`/`remove` son no-op para evitar `AstroError: ResponseSentError`. |

## Layouts

- `Layout.astro` — sitio público. Fuentes Google + Bootstrap Icons + Vercel Analytics.
- `AdminLayout.astro` — chrome del panel de directiva.
- `MiCuentaLayout.astro` — chrome del portal de miembros.

## Alias de imports

Configurados en `tsconfig.json`:

| Alias | Resuelve a |
|---|---|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@layouts/*` | `src/layouts/*` |
| `@data/*` | `src/data/*` |
| `@lib/*` | `src/lib/*` |

## Data layer

Contenido estático en `src/data/*.json`, importado directo en pages al build time:

- `club.json` — información institucional.
- `events.json` — catálogo de eventos, hackatones y cursos.
- `ranking.json` — ranking histórico (legado).
- `seleccion.json` — contenido del proceso de selección.

Estado dinámico (solicitudes, entrevistas, miembros, puntos, semestres) vive en Supabase.

## Rutas de la aplicación

| Zona | Ruta | Auth | Descripción |
|---|---|:-:|---|
| Pública | `/` | — | Landing con hero + terminal animada |
| | `/oferta` | — | Catálogo de eventos y hackatones |
| | `/ranking` | — | Leaderboard público (view `ranking_por_periodo`) |
| | `/nuestro-club` | — | Misión, visión, mesa directiva |
| | `/contacto` | — | Formulario público (Formspree + reCAPTCHA) |
| Selección | `/seleccion` | — | Estado de la convocatoria |
| | `/seleccion/aplicar` | — | Formulario de aplicación |
| | `/seleccion/agendar?t=…` | Token | Agendamiento self-service |
| Miembros | `/mi-cuenta` | Sesión | Dashboard con puntaje e historial |
| | `/mi-cuenta/login` | — | Login |
| | `/mi-cuenta/registrar` | Sesión | Subida de evidencia |
| Admin | `/admin` | Directiva | Panel principal |
| | `/admin/leaderboard` | Directiva | Revisión, ajustes manuales, export |
| | `/admin/solicitudes[/detalle]` | Directiva | Bandeja y evaluación |
| | `/admin/entrevistas` | Directiva | Configuración de días |
| | `/admin/seleccion-config` | Directiva | Estado del proceso |
| | `/admin/miembros` | Directiva | Directorio |
| | `/admin/periodos` | Directiva | Semestres |
| API | `/api/auth/callback` | — | Intercambio OAuth |
| | `/api/send-rejection` | Sesión | Correo Resend |
| | `/api/cron/daily-digest` | `CRON_SECRET` | Resumen diario |

## Domain helpers

- `src/lib/season.ts` — convención de semestres `"YYYY-N"` (N ∈ {1, 2}). Sem 1 = ene–jul, Sem 2 = ago–dic. Parseo legado `"YYYY-YYYY"`.
- `src/lib/interview-slots.ts` — generación de slots de entrevista respetando duración. Fechas tratadas como locales.
- `src/lib/export-leaderboard.ts` — generación client-side del Excel de reporte.
