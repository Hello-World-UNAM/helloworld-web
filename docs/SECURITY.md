# Seguridad

El repositorio es público. La seguridad no depende del código oculto, sino de las capas de abajo.

## RLS

Habilitada en todas las tablas del schema `public`. Policies restringen `SELECT`/`INSERT`/`UPDATE`/`DELETE` por role y por match de `auth.jwt() ->> 'email'`.

## Middleware

`src/middleware.ts` valida sesión y (para `/admin`) el rol `directiva` en cada request antes de servir la página.

## RPCs blindadas

Todas las RPCs `SECURITY DEFINER` tienen:

- `search_path = public, private` fijo → previene search_path hijacking.
- Guarda interna `private.is_directiva()` en toda función admin.
- `REVOKE EXECUTE FROM anon` + `GRANT EXECUTE TO authenticated, service_role`.

## Trigger de defensa en profundidad

`check_periodo_no_cerrado` bloquea inserts de miembro cuando el período tiene los formularios cerrados, aunque el frontend fuera bypasseado.

## Headers y CSP

`vercel.json` fija headers globales:

- **Content-Security-Policy** con allowlist estricta por directiva. Cada origen externo debe declararse.
- **HSTS** `max-age=31536000; includeSubDomains; preload`.
- **X-Content-Type-Options** `nosniff`.
- **X-Frame-Options** `DENY`.
- **Referrer-Policy** `strict-origin-when-cross-origin`.
- **Permissions-Policy** con cámara, micrófono, geo y browsing-topics desactivados.

## Formularios públicos

Formspree + Google reCAPTCHA v3 en `/contacto` — anti-spam sin fricción visible.

## Auditoría

Cada acción destructiva o de ajuste queda registrada en `audit_logs` con `admin_email`, `action_type`, `old_data`, `new_data` y `reason`. Ver [DATA_MODEL.md](DATA_MODEL.md#auditoría).

## GitHub

- Secret scanning + push protection habilitados.
- Dependabot security updates + version updates configurados en `.github/dependabot.yml`.
- Ruleset en `main`: bloquea `deletion`, bloquea `non_fast_forward` (force push), exige PR con 1 review.

## Reportar vulnerabilidades

Abre un issue privado o contacta a la mesa directiva.
