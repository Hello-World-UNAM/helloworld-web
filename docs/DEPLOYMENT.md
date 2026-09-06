# Deployment

## Vercel

Cada push a `main` genera un preview y promueve a producción si viene de la rama por default.

- Framework preset: **Astro**.
- Node runtime: el repositorio se valida con **Node 22** (`engines`); el
  proyecto Vercel auditado está configurado actualmente en **Node 24.x**. Antes
  de promover cambios, alinea Vercel a Node 22 o ejecuta la batería completa
  también con Node 24 y actualiza el pin; no des por probada una versión que no
  se haya validado.
- Adaptador: `@astrojs/vercel` (SSR).
- Variables de entorno declaradas en **Vercel → Settings → Environment Variables**.

## Comandos locales

```bash
npm run dev       # http://localhost:4321
npm run build     # build SSR a .vercel/output
npm run preview   # previsualiza el build
```

## Cron

`/api/cron/daily-digest` se dispara desde **Vercel → Settings → Cron Jobs** (no está declarado en `vercel.json`). Requiere `CRON_SECRET` configurado en el entorno para autorizar la invocación:

```
Authorization: Bearer <CRON_SECRET>
```

o como query string `?token=<CRON_SECRET>`.

Alternativamente, se puede declarar el cron en `vercel.json` con:

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 15 * * *" }
  ]
}
```

## Variables de entorno

- `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` — cliente público; en
  producción usa la clave moderna `sb_publishable_…`.
- `SUPABASE_SECRET_KEY` — clave moderna `sb_secret_…`, sólo para servidor y
  tareas Vercel que necesitan privilegios elevados.
- `RESEND_API_KEY` y `CRON_SECRET` — correo y autorización del cron de Vercel.
- `SELECTION_DB_SECRET_KEY` — clave sólo para las Edge Functions progresivas;
  nunca se expone al navegador.
- `SELECTION_WORKER_SECRET`, `RESEND_WEBHOOK_SECRET` y `SELECTION_MAIL_FROM` —
  configuración de las Edge Functions progresivas. Se cargan en Supabase
  Edge Functions, no en Vercel ni en variables `PUBLIC_*`.

No se debe volver a configurar la antigua `service_role` en triggers SQL ni
publicarla en el repositorio, logs o variables `PUBLIC_*`.

El detalle de configuración de Vault, Resend, el cron de Supabase y el doble
respaldo de CVs está en
[`supabase/operations/production-secrets.md`](../supabase/operations/production-secrets.md).

## CSP y nuevos orígenes

Cualquier origen externo (imagen, script, font, websocket) debe agregarse a la directiva correspondiente en `vercel.json` o el edge lo bloquea. Ver [`vercel.json`](../vercel.json).
