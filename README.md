<div align="center">
  <img src="public/img/logo.png" alt="Club Hello World" width="120" />

  <h1>Club Hello World — Sitio Web Oficial</h1>

  <p>
    Comunidad tecnológica de alto rendimiento de la <b>FES Aragón, UNAM</b>.<br />
    Aplicación web full-stack para presencia pública, portal de miembros y panel de administración interna.
  </p>

  <p>
    <a href="https://helloworld-unam.tech"><b>helloworld-unam.tech</b></a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#arquitectura">Arquitectura</a> ·
    <a href="#contribuir">Contribuir</a>
  </p>

  <p>
    <a href="https://astro.build"><img alt="Astro" src="https://img.shields.io/badge/Astro-5.7-BC52EE?logo=astro&logoColor=white" /></a>
    <a href="https://supabase.com"><img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=white" /></a>
    <a href="https://vercel.com"><img alt="Vercel" src="https://img.shields.io/badge/Vercel-Serverless-000?logo=vercel&logoColor=white" /></a>
    <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-6225E6" /></a>
    <img alt="Estilo" src="https://img.shields.io/badge/design-Neo--Brutalist-000" />
  </p>
</div>

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Stack técnico](#stack-técnico)
- [Arquitectura](#arquitectura)
- [Quick start](#quick-start)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Rutas de la aplicación](#rutas-de-la-aplicación)
- [Modelo de datos](#modelo-de-datos)
- [Sistema de diseño](#sistema-de-diseño)
- [Seguridad](#seguridad)
- [Deployment](#deployment)
- [Convenciones de código](#convenciones-de-código)
- [Contribuir](#contribuir)
- [Roadmap](#roadmap)
- [Licencia](#licencia)
- [Reconocimientos](#reconocimientos)

---

## Descripción

Este repositorio contiene el sitio web oficial del **Club Hello World**, la comunidad de tecnología de la FES Aragón (UNAM). Nació como proyecto ganador del **1er Hackaton Interno del Club** — un sitio estático en HTML/CSS/JS — y ha evolucionado hasta convertirse en una aplicación web completa con:

- **Sitio público** con la identidad, la oferta y el ranking del club.
- **Portal de miembros** con registro de evidencias, historial de puntos y ajustes manuales auditables.
- **Panel de administración** para la directiva: revisión de evidencias, gestión de miembros, ciclo de selección y reporte semestral a Jefatura de la Facultad.
- **Flujo de reclutamiento** end-to-end: aplicación pública, evaluación, agendamiento de entrevistas por token y correos transaccionales.

La estética es **Neo-Brutalista**: bordes duros de 4 px negros, sombras flat en morado `#6225e6`, tipografía uppercase y alto contraste. Todo el sistema está documentado en [`DESIGN.md`](DESIGN.md).

## Características

### Sitio público
- Landing con animación **typewriter** en terminal, activada por `IntersectionObserver`.
- Catálogo de eventos con carruseles horizontales y scroll-snap.
- Ranking en tiempo real desde base de datos.
- Formulario de contacto con Formspree + Google reCAPTCHA v3.
- SEO optimizado: metadatos por página, Open Graph, favicon SVG, sitemap-friendly.

### Portal de miembros (`/mi-cuenta`)
- Login con Supabase Auth (magic link + OAuth).
- Registro de evidencias con **compresión de imágenes en el navegador** y modo enlace.
- Selección de categoría desde `leaderboard_config`, con cálculo de puntos automático.
- Historial paginado con estados (`pendiente`, `aprobado`, `rechazado`, `anulado`).
- Auditoría transparente: cada nota queda visible al miembro, sin exponer la identidad del admin.
- Mensaje amable de cierre de semestre cuando los formularios están inhabilitados.

### Panel de administración (`/admin`)
- Menú **Configuración** que centraliza acciones sensibles (sumar/restar puntos, cerrar formularios, exportar Excel).
- Revisión de evidencias con soporte de imagen, PDF y enlace.
- **Ajustes manuales** con confirmación de dos pasos, motivo mínimo obligatorio, badge visual y anulación con reverso automático del balance.
- **Cierre reversible del semestre**: bloquea nuevos envíos sin afectar el resto del flujo (defensa en profundidad vía trigger de Postgres).
- **Exportación a Excel** neo-brutalista para Jefatura de la Facultad, con logo del club, filas agrupadas por miembro y celdas amarillas para asignación manual de horas.
- Directorio de miembros, gestión de semestres, configuración de temporada de selección y auditoría completa en `audit_logs`.

### Flujo de selección (`/seleccion`)
- Formulario público de aplicación con validación robusta y subida de CV.
- Estados `pending` → `reviewing` → `accepted` / `rejected` con transición trazada.
- Agendamiento self-service de entrevistas mediante token único enviado por correo (sin fricción de auth).
- Slots dinámicos generados desde `interview_days`, respetando duración y disponibilidad.

### Automatización
- **Cron diario** (`/api/cron/daily-digest`) que resume solicitudes y evidencias pendientes para la directiva.
- **Correos transaccionales** de rechazo vía Resend, con plantilla personalizada.
- **Fondo de auditoría** (`audit_logs`) con snapshot antes/después, autor y motivo en cada acción destructiva o de ajuste.

## Stack técnico

| Capa | Tecnología | Uso |
|---|---|---|
| Framework | [**Astro 5.7**](https://astro.build) SSR | Rutas, layouts, generación híbrida |
| Adaptador | [`@astrojs/vercel/serverless`](https://github.com/withastro/adapters/tree/main/packages/vercel) | Deploy a funciones Node en Vercel |
| Lenguaje | **TypeScript** (strict) | Todo `.astro` y `.ts` |
| Base de datos | [**Supabase Postgres**](https://supabase.com) | Auth, Storage, RLS, triggers, RPCs |
| Cliente Supabase | [`@supabase/ssr`](https://github.com/supabase/auth-helpers/tree/main/packages/ssr) + `@supabase/supabase-js` | Browser + server clients |
| Emails | [**Resend**](https://resend.com) | Envíos transaccionales |
| Formularios | [Formspree](https://formspree.io) + [reCAPTCHA v3](https://www.google.com/recaptcha/about/) | Contacto público |
| Analytics | [`@vercel/analytics`](https://vercel.com/analytics), [`@vercel/speed-insights`](https://vercel.com/docs/speed-insights) | Métricas reales |
| Reportes | [**ExcelJS**](https://github.com/exceljs/exceljs) | Generación client-side de `.xlsx` |
| Optimización | [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression) | Reducción antes de subir a Storage |
| Iconos | [Bootstrap Icons](https://icons.getbootstrap.com/) + [Lucide](https://lucide.dev) (inline SVG) | UI |
| Tipografía | Google Fonts (DM Sans + Playfair Display) | UI + énfasis |
| Estilos | CSS global neo-brutalista | Sin CSS Modules, sin Tailwind |

## Arquitectura

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

### Puntos clave

- **SSR completo**: `output: 'server'` en [`astro.config.mjs`](astro.config.mjs). Nada de rutas estáticas puras salvo lo trivial.
- **Middleware único** ([`src/middleware.ts`](src/middleware.ts)) que resuelve auth y role antes de servir cualquier ruta protegida.
- **Tres clientes Supabase** por caso de uso (`supabase.ts` navegador, `supabaseServer.ts` con dos variantes: mutable y "safe" sin write de cookies) — evita el clásico `ResponseSentError` de Astro.
- **RPCs `SECURITY DEFINER`** para todas las acciones de la directiva, con validación `private.is_directiva()` interna y `search_path` fijo para prevenir hijacking.
- **Trigger de defensa en profundidad** (`check_periodo_no_cerrado`) que bloquea inserts a `puntos_registros` si el período tiene los formularios cerrados, aún si el frontend fuera bypasseado.

## Quick start

### Requisitos

- **Node.js 22 LTS** (Vercel corre en 22; localmente 20+ funciona).
- **npm** 10+.
- Cuenta en [Supabase](https://supabase.com) con un proyecto propio si vas a levantar backend nuevo.

### Instalación

```bash
git clone https://github.com/Hello-World-UNAM/helloworld-web.git
cd helloworld-web
npm install
```

### Configuración

Copia el ejemplo y llena con las llaves reales:

```bash
cp .env.example .env
```

Consulta [Variables de entorno](#variables-de-entorno) para el detalle de cada llave.

### Desarrollo

```bash
npm run dev       # servidor en http://localhost:4321
npm run build     # build SSR a .vercel/output
npm run preview   # previsualiza el build
```

## Variables de entorno

| Variable | Requerido | Uso |
|---|:-:|---|
| `PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase. Expuesta al navegador. |
| `PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clave anónima Supabase. Expuesta al navegador (RLS es la puerta real). |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo cron | Bypasa RLS. **Nunca** al cliente. Se usa en `/api/cron/*`. |
| `RESEND_API_KEY` | Producción | Envío de correos transaccionales. |
| `CRON_SECRET` | Producción | Token que autoriza invocar `/api/cron/*` (header `Authorization: Bearer …` o query `?token=…`). |

## Estructura del proyecto

```
helloworld-web/
├── public/
│   └── img/                    Assets estáticos (logo, fotos, favicon)
│
├── src/
│   ├── components/             Header y Footer compartidos
│   ├── data/                   JSON estático (club, eventos, ranking legado, selección)
│   ├── layouts/
│   │   ├── Layout.astro        Sitio público
│   │   ├── AdminLayout.astro   Panel directiva
│   │   └── MiCuentaLayout.astro Portal de miembros
│   ├── lib/
│   │   ├── supabase.ts             Cliente browser
│   │   ├── supabaseServer.ts       Clientes SSR (mutable y safe)
│   │   ├── database.types.ts       Tipos del esquema
│   │   ├── season.ts               Convención de semestres "YYYY-N"
│   │   ├── interview-slots.ts      Generación de slots de entrevista
│   │   └── export-leaderboard.ts   Generación client-side de Excel
│   ├── pages/
│   │   ├── index.astro             Landing
│   │   ├── oferta.astro            Catálogo de eventos
│   │   ├── ranking.astro           Leaderboard público
│   │   ├── nuestro-club.astro      Misión, visión, directiva
│   │   ├── contacto.astro          Formulario público
│   │   ├── seleccion/              Aplicación + agendamiento
│   │   ├── mi-cuenta/              Portal de miembros
│   │   ├── admin/                  Panel directiva
│   │   └── api/                    Endpoints server (cron, callback, emails)
│   ├── styles/global.css       Sistema de diseño (fuente única)
│   ├── middleware.ts           Guards de auth y role
│   └── env.d.ts                Tipos de Astro.locals
│
├── astro.config.mjs            SSR + Vercel adapter + CSS inlining
├── vercel.json                 Headers de seguridad y CSP
├── tsconfig.json               Path aliases (@/, @components, @lib, …)
├── DESIGN.md                   Especificación del sistema de diseño
└── CLAUDE.md                   Guía para agentes de IA
```

## Rutas de la aplicación

| Zona | Ruta | Auth | Descripción |
|---|---|:-:|---|
| **Pública** | `/` | — | Landing con hero + terminal animada |
| | `/oferta` | — | Catálogo de eventos y hackatones |
| | `/ranking` | — | Leaderboard público (view `ranking_por_periodo`) |
| | `/nuestro-club` | — | Misión, visión, mesa directiva |
| | `/contacto` | — | Formulario público (Formspree + reCAPTCHA) |
| **Selección** | `/seleccion` | — | Estado de la convocatoria |
| | `/seleccion/aplicar` | — | Formulario de aplicación |
| | `/seleccion/agendar?t=…` | Token | Agendamiento self-service post-aceptación |
| **Miembros** | `/mi-cuenta` | Sesión | Dashboard con puntaje e historial |
| | `/mi-cuenta/login` | — | Login |
| | `/mi-cuenta/registrar` | Sesión | Subida de evidencia |
| **Admin** | `/admin` | Directiva | Panel principal |
| | `/admin/leaderboard` | Directiva | Revisión de evidencias + ajustes manuales + export |
| | `/admin/solicitudes` | Directiva | Bandeja de aplicaciones |
| | `/admin/solicitudes/detalle?id=…` | Directiva | Evaluación individual |
| | `/admin/entrevistas` | Directiva | Configuración de días de entrevista |
| | `/admin/seleccion-config` | Directiva | Estado del proceso de selección |
| | `/admin/miembros` | Directiva | Directorio de miembros activos |
| | `/admin/periodos` | Directiva | Semestres |
| **API** | `/api/auth/callback` | — | Intercambio OAuth Supabase |
| | `/api/send-rejection` | Sesión | Correo transaccional Resend |
| | `/api/cron/daily-digest` | `CRON_SECRET` | Resumen diario a la directiva |

## Modelo de datos

Tablas principales en `public` (todas con **RLS habilitada**):

| Tabla | Propósito |
|---|---|
| `directiva` | Allowlist de emails con permiso al panel admin |
| `miembros_activos` | Directorio de miembros con `puntos_totales` denormalizado |
| `leaderboard_config` | Catálogo de acciones puntuables (categoría, puntos base, reglas) |
| `puntos_registros` | Evidencias y ajustes manuales con estado y auditoría |
| `periodos` | Semestres (`YYYY-1` / `YYYY-2`) con `formularios_cerrados` |
| `solicitudes` | Aplicaciones al club con evaluación multi-eje |
| `seleccion_config` | Estado global del proceso de selección |
| `interview_days` | Días configurados con rango horario |
| `interviews` | Entrevistas agendadas |
| `interview_booking_tokens` | Tokens únicos para agendamiento sin auth |
| `audit_logs` | Snapshot de acciones sensibles (autor, motivo, before/after) |

**Vista pública**: `ranking_por_periodo` — `SECURITY DEFINER` intencional que expone solo `nombre + puntos` al role `anon` sin abrir `miembros_activos` ni `puntos_registros`.

**RPCs clave**: `insert_ajuste_manual`, `revocar_ajuste_manual`, `approve_puntos`, `reject_puntos`, `delete_puntos_registro`, `toggle_periodo_cerrado`, `book_interview`, `cancel_interview`.

## Sistema de diseño

**Fuente autoritativa**: [`DESIGN.md`](DESIGN.md). Resumen ejecutivo:

- **Paleta**: `#6225e6` (morado primario), `#c4b5fd` (lavanda), `#000`, `#fff`. Prohibido salir de la paleta sin actualizar el doc.
- **Bordes**: `4px solid #000` en cards, `3px` en flip cards y items medianos, `2px` en badges.
- **Sombras**: flat offset — cero blur. Cards grandes `8px 8px 0 #6225e6`, botón primario `6px 6px 0 #000`, etc.
- **Sin `border-radius`** en elementos funcionales. Excepciones: avatares (50%), terminal (10px), nav dots (50%).
- **Tipografía**: DM Sans para UI, Playfair Display para énfasis, Courier New para terminal. Uppercase + peso 700–900 en títulos y CTAs.
- **Animaciones**: `IntersectionObserver` obligatorio. Nada de autoplay.

## Seguridad

El repositorio es público. Por diseño, la seguridad **no depende del código oculto**, sino de estas capas:

- **RLS habilitada en todas las tablas** con policies por role.
- **Middleware de rutas** que valida sesión y (para `/admin`) el rol `directiva` en cada request.
- **RPCs `SECURITY DEFINER`** con:
  - `search_path` fijo (`public, private`) — previene hijacking.
  - Guarda interna `private.is_directiva()` en toda función admin.
  - `REVOKE EXECUTE FROM anon` — solo `authenticated` puede invocarlas, y solo cuando pasan el guard.
- **Trigger `check_periodo_no_cerrado`** como defensa en profundidad contra bypass del frontend.
- **CSP estricta** ([`vercel.json`](vercel.json)) — cada origen externo debe declararse explícitamente.
- **HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy** — headers globales.
- **Formularios públicos** con reCAPTCHA v3 + Formspree.
- **Auditoría completa** en `audit_logs` con snapshot before/after.
- **GitHub**: secret scanning + push protection + Dependabot (security + version updates) + ruleset en `main` que bloquea force-push y exige PR con 1 review.

Para reportar una vulnerabilidad, abre un issue privado en el repo o contacta a la mesa directiva.

## Deployment

### Producción

Este proyecto vive en **Vercel**. Cada push a `main` genera un preview + promueve a producción si viene de la rama por default:

```bash
git push origin main
```

- Framework preset: `Astro`.
- Node runtime: **22 LTS** (default actual).
- Variables de entorno declaradas en **Vercel → Settings → Environment Variables**.

### Cron

`/api/cron/daily-digest` se agenda desde `vercel.json` (Vercel Cron). Requiere `CRON_SECRET` configurado en la variable de entorno para autorizar la invocación.

### Preview local con backend real

```bash
npm run build
npm run preview
```

## Convenciones de código

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org) en español. Ejemplos reales del repo:
  - `feat(admin): permitir cerrar/reabrir el registro de evidencias por período`
  - `fix(mi-cuenta): activar botón de re-login en vista de acceso denegado`
  - `refactor(admin): colapsar acciones del leaderboard en menú Configuración`
  - `chore(deps): añadir resend y browser-image-compression`
- **Estilo**: sin CSS Modules, sin Tailwind. Todo en [`src/styles/global.css`](src/styles/global.css) alineado a `DESIGN.md`.
- **TypeScript**: `strict` habilitado. No `any` cuando el tipo es derivable.
- **Astro**: componentes en `.astro`, lógica cliente en `<script>` con `import.meta.env` para vars públicas.
- **Migraciones**: se aplican vía Supabase MCP o dashboard. Registrar en el mensaje del commit una descripción de qué cambia en la DB.

## Contribuir

1. **Fork + clone**.
2. Rama descriptiva: `feat/nombre-corto` o `fix/nombre-corto`.
3. Ejecuta `npm run build` antes de abrir el PR para asegurar que compila.
4. Abre PR contra `main`. GitHub bloqueará el merge sin al menos 1 review.
5. Asegúrate de que el commit final siga [Conventional Commits](https://www.conventionalcommits.org).

Si tu cambio toca estilos, verifica que respete `DESIGN.md`. Si toca la DB, describe la migración en el PR.

## Roadmap

- [ ] Type-check en CI (`astro check`) con status obligatorio en el ruleset.
- [ ] Generación automática de `src/lib/database.types.ts` con `supabase gen types typescript`.
- [ ] MFA para cuentas de directiva.
- [ ] Integración con Google Drive para subir el Excel del leaderboard a una carpeta compartida con Jefatura.
- [ ] Rate limiting con Vercel Attack Mode.
- [ ] Rotación programada de `CRON_SECRET` y `RESEND_API_KEY`.
- [ ] Migración de estilos inline en el panel admin a clases utilitarias en `global.css`.

## Licencia

Distribuido bajo la [Licencia MIT](LICENSE).

## Reconocimientos

- **Proyecto ganador** del 1er Hackaton Interno del Club Hello World.
- Migrado y mantenido por la mesa directiva del club, temporada **2026–2027**.
- Diseño inspirado en la corriente **Neo-Brutalism** y la identidad histórica del club.
- Corre gracias a [Astro](https://astro.build), [Supabase](https://supabase.com), [Vercel](https://vercel.com) y [Resend](https://resend.com).

---

<div align="center">
  <sub>Hecho con foco y café en la <b>FES Aragón, UNAM</b>.</sub>
</div>
