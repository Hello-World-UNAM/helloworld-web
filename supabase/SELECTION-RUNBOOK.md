# Selecciones progresivas — runbook de laboratorio a producción

Este documento describe el estado y el corte del proyecto `hzewxtimkbxljozyrafk`.
La prioridad es conservar solicitudes, CVs, miembros y puntos; un cambio de
flujo no autoriza borrar ni reescribir datos que no pertenecen a Selecciones.

## Estado auditado antes del corte

Fecha de referencia: **5 de septiembre de 2026**. Temporada activa de
producción: **`2027-1`**.

La auditoría de sólo lectura encontró:

- 15 solicitudes vigentes de la temporada activa; las 15 estaban en revisión;
- cero decisiones finales, entrevistas, tokens de agenda, mensajes de cola o
  eventos de Selecciones para esa temporada;
- 23 filas en `public.miembros_activos` y 130 en `public.puntos_registros`;
- una referencia activa a CV y su objeto privado presente en el bucket `cvs`;
- formularios públicos disponibles, sin necesidad de pausarlos para preparar el
  corte;
- `progressive_enabled=false` y `dispatch_paused=true`.

Los respaldos privados históricos `3471e0a0-cd03-4187-a974-62f58f81d119` (11
solicitudes) y `e74692e2-00f1-48ff-abc9-323859e5c45e` (12 solicitudes) tienen
checksums válidos y conservaron miembros/puntos, pero **no son suficientes para
este corte**: se requiere un snapshot fresco de las 15 solicitudes y un
respaldo externo cifrado de los binarios de CV.

Durante la implementación de este corte se creó el snapshot fresco
`aad57717-431d-4360-9da3-639f59a27194`. Su manifest quedó verificado con 15
solicitudes, una referencia de CV y un objeto de CV presente, además de 23
miembros y 130 registros de puntos. Las dos migraciones incrementales quedaron
aplicadas remotamente como `selection_save_preserves_booking` y
`selection_evaluation_metadata` (el servidor les asignó las versiones
`20260906020234` y `20260906020239`).

También quedaron publicadas las funciones progresivas `selection-dispatch` v2 y
`selection-webhook` v2. La bandera sigue apagada, el dispatcher sigue pausado,
los triggers legacy siguen habilitados y no hay cron/secretos operativos
configurados todavía. No se hizo push ni despliegue nuevo de Vercel en esta
etapa: el frontend continúa protegido por el gate hasta que se configure
`SUPABASE_SECRET_KEY` en Vercel y se valide el build que se vaya a promover.

La auditoría de variables de Vercel encontró `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY` y `CRON_SECRET`, pero no
`SUPABASE_SECRET_KEY`; el cron `/api/cron/daily-digest` quedará correctamente
en 503 hasta que se agregue esa clave. La auditoría de Resend encontró cero
webhooks, por lo que aún no existe el webhook de Selecciones.

No se incluyen aquí nombres, correos, tokens, rutas de CV ni claves. El MCP de
Supabase no tiene actualmente alcance para `query_logs`; durante el despliegue
se deben revisar los logs desde el Dashboard de Supabase.

## Comparación laboratorio / producción

### Laboratorio local

El laboratorio usa Supabase local en puertos 55321–55324, una base sintética y
un servidor Astro en `http://127.0.0.1:4321`. Sus datos se recrean con
`npm run selection:lab:reset`; nunca apunta al proyecto remoto. El escenario
incluye solicitudes sintéticas, una agenda, reprogramación, evaluación,
decisión final y mensajes en Mailpit.

El flujo E2E validado recorre:

1. revisión y decisión inicial;
2. vista previa sin envío;
3. confirmación de comunicación inicial;
4. entrega simulada por el dispatcher;
5. agenda y reprogramación liberando el horario anterior;
6. entrevista, evaluación y resultado final;
7. selección explícita y comunicación final.

Se validó también que guardar una evaluación no envía correo, que la decisión
final puede cambiar antes de comunicarla, que las tarjetas canceladas quedan
como historial sin casilla de comunicación y que el flujo no depende de que la
fecha de la entrevista ya haya pasado en el laboratorio.

### Producción

Producción conserva el esquema y los datos existentes. Las tres migraciones
progresivas iniciales ya estaban aplicadas:

- `20260905013950_progressive_selection`;
- `20260905015832_selection_hardening`;
- `20260905022036_selection_reminder_window`.

Las dos migraciones incrementales de esta entrega son:

- `20260905152829_selection_save_preserves_booking`: guardar evaluación no
  cancela confirmaciones de agenda/reagenda;
- `20260905195438_selection_evaluation_metadata`: cada edición real de campos
  de evaluación actualiza `evaluated_at` y conserva el correo del evaluador.

Se aplicaron una por una, nunca con `db push` ni `db reset`. Son cambios
expansivos: redefinen la función/RPC y agregan el trigger de metadata; no
eliminan datos de candidatos, miembros ni puntos. El historial remoto puede
tener un timestamp distinto al prefijo local porque `apply_migration` asigna la
versión del servidor.

La versión actual del frontend conserva el feature gate: mientras
`progressive_enabled=false`, el panel anterior puede seguir atendiendo la
operación. La versión progresiva de Astro y las funciones nuevas deben
publicarse antes del corte, pero el envío permanece pausado hasta el canario.

## Contrato funcional que debe mantenerse

- Guardar revisión, evaluación o decisión no envía correo. Comunicar requiere
  selección explícita, vista previa y confirmación.
- Solicitudes, entrevistas y comunicación son decisiones independientes; no se
  exige cerrar toda la temporada para operar un lote.
- Aceptar una solicitud inicial genera invitación; rechazar revoca la agenda.
  Admitir sin entrevista completada exige motivo de excepción.
- La capacidad se calcula con horarios futuros libres menos invitaciones
  vigentes sin reserva. La reserva y la reprogramación se serializan en la BD;
  una reprogramación fallida conserva la cita anterior.
- El plazo de invitación predeterminado es 168 horas. Hay máximo dos
  reprogramaciones; una cancelación no borra el historial.
- La hora pública es Ciudad de México. Las fechas administrativas deben llegar
  con zona horaria explícita.
- Un correo enviado no se reescribe. Un estado incierto se investiga por id/tag
  en Resend y no se reintenta a ciegas.
- El proceso no crea miembros automáticamente y no modifica `miembros_activos`
  ni `puntos_registros`.

## Arquitectura y barreras de correo

Las escrituras del panel progresivo pasan por `selection_admin`, protegida por
`auth.uid()` y correo de directiva. La cola privada tiene RLS; el navegador no
lee tokens ni cuerpos completos. `selection_worker` sólo acepta el rol de
servicio. Los RPC públicos de agenda usan tokens bearer de alta entropía y no
exponen el token en el panel.

`selection-dispatch` sólo usa `SELECTION_DB_SECRET_KEY`, nunca recupera la
antigua variable `SUPABASE_SERVICE_ROLE_KEY`. `selection-webhook` usa la misma
separación y valida la firma de Resend con los bytes originales. Las cuatro
funciones legacy aún leen `SUPABASE_SERVICE_ROLE_KEY` y llevan su propia guarda
del feature flag; no se eliminan durante la preparación.

Los triggers HTTP legacy que deben deshabilitarse únicamente durante la
activación son:

- `public.solicitudes.email_confirmacion_solicitud`;
- `public.interviews.email_confirmacion_entrevista`.

Contenían una referencia histórica a una credencial de servicio en su
definición. No se imprime ni se reutiliza. Una vez que esos triggers estén
deshabilitados y se observe un ciclo estable, se puede rotar/retirar la
credencial legacy y ejecutar `decommission-selection-legacy.sql`.

## Preparación segura

Completa estas tareas antes de la ventana:

1. Confirmar que el despliegue de Vercel contiene el frontend actual y las
   variables `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` y `CRON_SECRET` correctas.
2. Confirmar que `selection-dispatch` y `selection-webhook` están publicadas con
   `verify_jwt=false`; ambas tienen barreras propias y no deben quedar sin sus
   secretos. En esta entrega ya están en v2, pero responden 503 mientras faltan
   sus secretos, que es el comportamiento seguro esperado.
3. Configurar `SELECTION_DB_SECRET_KEY`, `SELECTION_WORKER_SECRET`,
   `RESEND_WEBHOOK_SECRET` y `SELECTION_MAIL_FROM` en Edge Functions. Mantener
   temporalmente la variable legacy para las cuatro funciones antiguas.
4. Guardar el secreto del worker y la URL del proyecto en Vault. Ejecutar
   `operations/schedule-selection.sql`, que instala/reemplaza sólo
   `selection-dispatch-minute` y lo deja condicionado a la pausa.
5. Configurar en Resend el webhook de Selecciones y comprobar un evento de
   prueba. No tocar webhooks ajenos.
6. Ejecutar `operations/verify-selection-storage.sql`; realizar el respaldo
   externo de CVs siguiendo `operations/production-secrets.md`.
7. Ejecutar `operations/backup-selection.sql` y conservar su `id`, manifest y
   checksum. Confirmar antes del corte 15 solicitudes, 23 miembros, 130 puntos
   y CVs presentes.

El formulario público no se pausa para preparar esto. Sólo se congela el panel
administrativo durante la ventana final para evitar una escritura simultánea.

## Corte de producción

La persona operadora debe registrar hora de inicio y conservar las salidas de
metadatos, sin datos personales:

1. Avisar a directiva y congelar acciones del panel admin durante 15–30 minutos.
2. Confirmar de nuevo que `dispatch_paused=true`, que la bandera progresiva está
   apagada y que no hay nuevos tokens/mensajes/eventos no reconciliados.
3. Ejecutar de nuevo `operations/backup-selection.sql` justo antes de activar;
   este snapshot toma un advisory lock y locks consistentes para ser atómico.
4. Ejecutar `operations/activate-selection.sql`. La transacción se niega a
   continuar si falta esquema, Vault, cron, backup de CVs o si detecta actividad
   legacy incompatible. Si termina, deja `progressive_enabled=true` y
   `dispatch_paused=true`, deshabilitando exactamente los dos triggers legacy.
5. Ejecutar `operations/verify-selection.sql` y
   `operations/verify-selection-storage.sql`. Confirmar nuevamente conteos,
   checksums de miembros/puntos, backup, triggers deshabilitados, queue privada,
   cron y dominio.
6. Desde el panel progresivo revisar una solicitud sintética/real sin guardar
   ni comunicar, revisar una invitación y comprobar que la vista previa no crea
   cola. No usar un postulante real como destinatario de prueba.
7. Enviar un único canario a una cuenta interna controlada. Conciliar el
   mensaje en Resend, el webhook y la fila de cola.
8. Sólo con el canario conciliado, desactivar `dispatch_paused` desde
   Configuración y observar cron, cola, webhook y entregas. Si aparecen
   anomalías, pausar inmediatamente desde Configuración.

El flujo público puede seguir recibiendo solicitudes durante la preparación y
la ventana; sus recibos se procesarán mediante la cola progresiva después de
reanudar. No hay que migrar solicitudes de la base sintética al proyecto real.

## Recuperación

Ante cualquier anomalía, pausar `dispatch_paused` desde Configuración y no
reenviar estados `uncertain`. Conservar un snapshot nuevo antes de reparar.
Comparar por IDs y timestamps los cambios posteriores al corte. Restaurar sólo
registros seleccionados en un entorno aislado con `jsonb_populate_recordset`,
tras aprobación humana; nunca truncar ni restaurar todo sobre datos nuevos.

Los mensajes aceptados por Resend no pueden deshacerse restaurando la base. La
reconciliación debe usar el id/tag del proveedor. Si no hay evidencia suficiente
de entrega, mantener el mensaje bloqueado y documentar la decisión.

## Limpieza posterior, no durante el corte

Después de un ciclo completo estable:

1. pausar el dispatcher;
2. verificar que no haya mensajes legacy, tokens ni triggers necesarios;
3. rotar/retirar la credencial legacy sólo después de confirmar que ninguna
   función la necesita;
4. ejecutar `operations/decommission-selection-legacy.sql` para eliminar
   exactamente los dos triggers antiguos.

No se deben borrar tablas, extensiones HTTP, miembros, puntos, solicitudes,
entrevistas, mensajes, eventos, objetos de CV ni respaldos privados como parte
de este corte.

## Verificación reproducible del laboratorio

```sh
npm run check:selection
npm test
npm run test:edge
npm run test:db
npm run test:e2e
npm run build
npm run selection:lab:reset
npm run selection:lab:verify
npm run selection:lab:smoke
```

`test:db` usa un contenedor desechable validado y `test:e2e` bloquea tráfico
externo; ambos trabajan con fixtures sintéticos. En esta entrega quedaron
verificados los seis escenarios E2E y el recorrido completo del laboratorio.

No ejecutar `supabase db push`, `supabase db reset` ni reparar el historial a
ciegas: el repositorio no contiene todas las migraciones históricas de
producción. Las migraciones nuevas se aplican individualmente y se auditan con
`list_migrations`.

## Archivos operativos

- `operations/backup-selection.sql`: snapshot privado transaccional;
- `operations/verify-selection.sql`: integridad post-corte sin PII;
- `operations/verify-selection-storage.sql`: referencias y objetos de CV;
- `operations/schedule-selection.sql`: cron idempotente pausado;
- `operations/activate-selection.sql`: puerta transaccional de activación;
- `operations/decommission-selection-legacy.sql`: limpieza posterior;
- `operations/production-secrets.md`: secretos, Resend y doble backup;
- `scripts/backup-selection-cvs.mjs`: backup binario externo opt-in.
