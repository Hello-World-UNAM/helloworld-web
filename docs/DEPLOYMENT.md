# Deployment

## Vercel

Cada push a `main` genera un preview y promueve a producción si viene de la rama por default.

- Framework preset: **Astro**.
- Node runtime: **22 LTS**.
- Adaptador: `@astrojs/vercel/serverless` (SSR).
- Variables de entorno declaradas en **Vercel → Settings → Environment Variables**.

## Comandos locales

```bash
npm run dev       # http://localhost:4321
npm run build     # build SSR a .vercel/output
npm run preview   # previsualiza el build
```

## Cron

`/api/cron/daily-digest` se agenda desde `vercel.json` (Vercel Cron). Requiere `CRON_SECRET` configurado en el entorno para autorizar la invocación:

```
Authorization: Bearer <CRON_SECRET>
```

o como query string `?token=<CRON_SECRET>`.

## CSP y nuevos orígenes

Cualquier origen externo (imagen, script, font, websocket) debe agregarse a la directiva correspondiente en `vercel.json` o el edge lo bloquea. Ver [`vercel.json`](../vercel.json).
