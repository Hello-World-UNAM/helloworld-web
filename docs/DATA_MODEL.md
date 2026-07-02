# Modelo de datos

Todo el estado dinámico vive en Postgres (schema `public`). RLS habilitada en todas las tablas.

## Tablas

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

## Vista pública

`ranking_por_periodo` — `SECURITY DEFINER` intencional. Expone solo `nombre + puntos` al role `anon` sin abrir `miembros_activos` ni `puntos_registros`. Auditar cualquier cambio en columnas seleccionadas.

## Storage

Dos buckets en Supabase Storage:

| Bucket | Uso |
|---|---|
| `evidencias` | Imágenes y PDFs subidos por los miembros al registrar puntos. |
| `cvs` | CVs de aspirantes al club durante el proceso de selección. Se sirven via signed URL desde el panel admin. |

## RPCs clave

Todas las RPCs **administrativas** usan `SECURITY DEFINER`, `search_path = public, private` fijo y guard `private.is_directiva()` interno. Las RPCs públicas del flujo de selección (`book_interview`, `cancel_interview`, `get_booking_state`) también son `SECURITY DEFINER` pero validan un token único en vez del rol; deben ser callable por `anon` para funcionar sin login.

### Puntos y ajustes

- `approve_puntos(registro, puntos, admin, notas)` — aprueba evidencia y suma al balance.
- `reject_puntos(registro, admin, notas)` — rechaza sin sumar.
- `delete_puntos_registro(registro, admin, reason)` — soft-delete con auditoría; revierte balance si estaba aprobado.
- `insert_ajuste_manual(miembro, tipo, cantidad, admin, motivo)` — suma o resta manual con validación `tipo IN ('suma','resta')`, cantidad positiva, motivo ≥ 15 chars.
- `revocar_ajuste_manual(registro, admin, motivo)` — anula ajuste manual; revierte balance automáticamente.

### Ciclo de semestre

- `toggle_periodo_cerrado(periodo, admin)` — alterna `formularios_cerrados`; timestamp y autor.

### Trigger de defensa en profundidad

- `check_periodo_no_cerrado()` en `BEFORE INSERT` de `puntos_registros`. Bloquea inserts de miembro (`pending + config_id NOT NULL`) cuando el período tiene los formularios cerrados. Los ajustes manuales del admin (`approved + config_id NULL`) pasan.

### Selección y entrevistas

- `book_interview(token, slot)` — reserva slot con token único enviado por email.
- `cancel_interview(token)` — cancela con el mismo token.
- `get_booking_state(token)` — estado del agendamiento.
- `is_email_in_directiva(email)` — usado por middleware para gate del panel admin.

## Auditoría

Cada acción sensible (aprobar, rechazar, eliminar, ajuste manual, revocar, cerrar/reabrir) inserta una fila en `audit_logs`:

| Columna | Contenido |
|---|---|
| `admin_email` | Autor |
| `action_type` | Ej. `MANUAL_ADJUSTMENT_ADD`, `MANUAL_ADJUSTMENT_REVOKED`, `PERIODO_FORMULARIOS_CERRADO` |
| `target_table` · `target_id` | Referencia al registro afectado |
| `old_data` · `new_data` | Snapshot jsonb |
| `reason` | Motivo capturado |
