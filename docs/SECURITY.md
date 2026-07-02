# Seguridad

El repositorio es público. La seguridad no depende del código oculto, sino de las capas de abajo.

## RLS

Habilitada en todas las tablas del schema `public`. Policies restringen `SELECT`/`INSERT`/`UPDATE`/`DELETE` por role y por match de `auth.jwt() ->> 'email'`.

## Middleware

`src/middleware.ts` valida sesión y (para `/admin`) el rol `directiva` en cada request antes de servir la página.

## RPCs blindadas

RPCs **administrativas** (aprobar, rechazar, eliminar, ajustes manuales, cerrar semestre, sync directiva):

- `search_path = public, private` fijo → previene search_path hijacking.
- Guarda interna `private.is_directiva()` en la función.
- `REVOKE EXECUTE FROM anon` + `GRANT EXECUTE TO authenticated, service_role`.

RPCs **públicas** del flujo de selección (`book_interview`, `cancel_interview`, `get_booking_state`, `is_email_in_directiva`):

- `SECURITY DEFINER` intencional para exponer solo el subset necesario.
- Callable por `anon` porque el flujo no requiere login.
- La autorización se resuelve por token único (`interview_booking_tokens`) o por match de email.

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

`/contacto` envía a **Formspree**, que hace filtrado antispam del lado del proveedor. CSP en `vercel.json` restringe `form-action` a `formspree.io`.

## Auditoría

Cada acción destructiva o de ajuste queda registrada en `audit_logs` con `admin_email`, `action_type`, `old_data`, `new_data` y `reason`. Ver [DATA_MODEL.md](DATA_MODEL.md#auditoría).

## GitHub

- Secret scanning + push protection habilitados.
- Dependabot security updates + version updates configurados en `.github/dependabot.yml`.
- Ruleset en `main`: bloquea `deletion`, bloquea `non_fast_forward` (force push), exige PR con 1 review.

## Reportar vulnerabilidades

Usa el reporte privado de vulnerabilidades de GitHub — nunca abras un issue público con detalles:

> <https://github.com/Hello-World-UNAM/helloworld-web/security/advisories/new>

Si la feature no está habilitada, contacta a la mesa directiva por otro canal privado y ella activará el reporte.
