# Deployment

## Vercel

Cada push a `main` genera un preview y promueve a producción si viene de la rama por default.

- Framework preset: **Astro**.
- Node runtime: **Node 22** (versión soportada por el adaptador Astro actual; Vercel corre 22 aunque el default de la plataforma sea 24).
- Adaptador: `@astrojs/vercel/serverless` (SSR).
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

## CSP y nuevos orígenes

Cualquier origen externo (imagen, script, font, websocket) debe agregarse a la directiva correspondiente en `vercel.json` o el edge lo bloquea. Ver [`vercel.json`](../vercel.json).
