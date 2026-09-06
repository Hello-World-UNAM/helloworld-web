# Secretos y respaldo externo de Selecciones

Este documento forma parte del corte de producción. No contiene valores reales
y no se deben pegar secretos en el repositorio, en tickets ni en el chat.

## Separación de credenciales

Configura en **Supabase → Edge Functions → Secrets**:

| Nombre | Quién lo usa | Observación |
|---|---|---|
| `SELECTION_DB_SECRET_KEY` | `selection-dispatch`, `selection-webhook` | Clave moderna `sb_secret_…`; no usar el nombre legacy de `service_role`. |
| `SELECTION_WORKER_SECRET` | `selection-dispatch` y cron | Secreto aleatorio largo, dedicado a este worker. |
| `RESEND_API_KEY` | Dispatcher y funciones legacy | Conserva la clave vigente hasta comprobar todos sus consumidores. |
| `RESEND_WEBHOOK_SECRET` | `selection-webhook` | Secreto de firma del webhook de Resend. |
| `SELECTION_MAIL_FROM` | Dispatcher | Opcional; `Club Hello World <contacto@helloworld-unam.tech>` por defecto. |

El sitio SSR de Vercel necesita en sus variables de entorno:

- `PUBLIC_SUPABASE_URL`;
- `PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_…`);
- `SUPABASE_SECRET_KEY` (`sb_secret_…`) para `/api/cron/daily-digest`;
- `RESEND_API_KEY` y `CRON_SECRET` para los consumidores de Vercel que ya los
  usen.

`SUPABASE_SECRET_KEY` y `SELECTION_DB_SECRET_KEY` pueden tener el mismo valor
de la clave moderna si la política de credenciales lo permite, pero son
variables con responsabilidades distintas. Nunca se envían al navegador.

Las cuatro funciones legacy (`send-confirmation-email`,
`send-interview-confirmation`, `send-decisions-bulk` y
`send-final-decisions-bulk`) todavía leen `SUPABASE_SERVICE_ROLE_KEY` porque
son parte del flujo anterior. No se deben borrar ni rotar durante el primer
corte: primero se deshabilitan sus dos triggers HTTP y se observa que no haya
consumidores. Después de un ciclo estable, se retira la credencial legacy del
entorno y se ejecuta `decommission-selection-legacy.sql` cuando corresponda.

## Vault y cron

En **Supabase → SQL Editor**, con los valores introducidos de forma segura por
la persona operadora, guarda en Vault exactamente:

- `selection_worker_secret`: el mismo valor de `SELECTION_WORKER_SECRET`;
- `selection_project_url`: `https://hzewxtimkbxljozyrafk.supabase.co`.

No hagas un `select decrypted_secret` ni incluyas el valor en la salida de una
consulta. Después ejecuta `schedule-selection.sql`. El script reemplaza de
forma idempotente únicamente el job `selection-dispatch-minute`; no crea un
cron para otra parte del sitio.

El cron sólo llama al dispatcher cuando `progressive_enabled=true` y
`dispatch_paused=false`. Por eso se puede instalar y comprobar mientras el
proceso permanece pausado.

## Webhook de Resend

En Resend crea o actualiza sólo el webhook de Selecciones con esta URL:

`https://hzewxtimkbxljozyrafk.supabase.co/functions/v1/selection-webhook`

Usa el secreto de firma entregado por Resend en `RESEND_WEBHOOK_SECRET` y
habilita los eventos `email.sent`, `email.delivered`, `email.bounced`,
`email.failed`, `email.delivery_delayed` y `email.complained`. No modifiques
webhooks ajenos al club. Valida primero un evento de prueba con la función
pausada y revisa los logs en el Dashboard de Supabase; el MCP disponible no
tiene actualmente el alcance suficiente para consultar logs remotos.

## Doble respaldo antes del corte

El respaldo de base de datos es privado y se toma con
`supabase/operations/backup-selection.sql`. Incluye la temporada activa,
configuración, entrevistas, tokens, cola privada, eventos, referencias de CV y
metadatos de los objetos de storage. También guarda conteos y checksums de
`miembros_activos` y `puntos_registros` para demostrar que no se tocaron.

Los binarios de CV no deben quedar dentro del JSON ni en Git. Crea una carpeta
nueva, fuera del repositorio y con permisos privados, y ejecuta en una máquina
segura:

```sh
SELECTION_BACKUP_SEASON=2027-1 \
SELECTION_CV_BACKUP_DIR=/ruta/segura/nueva/selection-cv-2027-1-20260905 \
node scripts/backup-selection-cvs.mjs
```

El script requiere `PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY` en el entorno
seguro, no acepta una ruta dentro del repositorio, no sobreescribe archivos y
verifica cada descarga con SHA-256. Comprueba que el número de archivos y los
hashes del `manifest.json` coincidan con `verify-selection-storage.sql`.

Conserva el respaldo externo cifrado. Por ejemplo, con `age` y una clave
pública administrada por el equipo:

```sh
tar -C /ruta/segura/nueva -czf - selection-cv-2027-1-20260905 \
  | age -r age1REEMPLAZA_CON_LA_CLAVE_PUBLICA_DEL_EQUIPO \
  > /ruta/segura/archivos/selection-cv-2027-1-20260905.tar.gz.age
```

Después verifica el tamaño/hash del archivo cifrado y conserva la clave
privada fuera de la máquina de despliegue. No borres la carpeta fuente hasta
haber comprobado que el archivo cifrado se puede descifrar en un entorno
aislado. La ruta, el manifiesto y el archivo cifrado deben quedar fuera del
repositorio.

## Puerta de operación

No ejecutes `activate-selection.sql` si falta cualquiera de estos elementos:

1. backup SQL fresco y verificado;
2. backup externo cifrado de todos los CV referenciados;
3. secretos de Edge Functions y Vault alineados;
4. webhook de Resend probado;
5. job `selection-dispatch-minute` presente;
6. admin congelado durante la ventana, con `dispatch_paused=true`;
7. consultas de verificación con los 15 registros activos, 23 miembros y 130
   registros de puntos intactos.

El primer envío real debe ser un canario a una cuenta interna controlada. No
se debe usar una solicitud real como destinatario de prueba ni reanudar el
dispatcher hasta que el canario y su webhook hayan sido conciliados.
