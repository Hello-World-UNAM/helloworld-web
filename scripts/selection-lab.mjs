import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const labRoot = join(projectRoot, '.selection-lab');
const labSupabase = join(labRoot, 'supabase');
const sourceSupabase = join(projectRoot, 'supabase');
const cli = join(projectRoot, 'node_modules', '.bin', 'supabase');
const productionProjectRef = 'hzewxtimkbxljozyrafk';
const adminEmail = 'admin@selection.local';
const adminPassword = 'SelectionLab!2026';
const workerSecret = 'selection-lab-worker-secret-only';
const resendApiKey = 'selection-lab-resend-api-key';
const webhookSecret = 'c2VsZWN0aW9uLWxhYi13ZWJob29rLXNlY3JldA==';

function fail(message) {
  console.error(`\nSelection Lab: ${message}`);
  process.exit(1);
}

function assertLocalValue(label, value) {
  const normalized = String(value ?? '').toLowerCase();
  if (
    normalized.includes(productionProjectRef) ||
    normalized.includes('.supabase.co') ||
    normalized.startsWith('re_gb')
  ) {
    fail(`${label} contiene una referencia de producción. Operación cancelada.`);
  }
}

function copy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}

function writeFunctionEnvironment(databaseSecretKey) {
  const functionEnvironment = [
    `RESEND_API_KEY=${resendApiKey}`,
    'RESEND_EMAILS_URL=http://kong:8000/functions/v1/selection-mailbox',
    `RESEND_WEBHOOK_SECRET=${webhookSecret}`,
    `SELECTION_WORKER_SECRET=${workerSecret}`,
    `SELECTION_DB_SECRET_KEY=${databaseSecretKey}`,
    'SELECTION_MAIL_FROM=Selection Lab <no-reply@selection.local>',
    '',
  ].join('\n');
  assertLocalValue('entorno de funciones', functionEnvironment);
  writeFileSync(join(labSupabase, 'functions', '.env'), functionEnvironment, { mode: 0o600 });
}

function prepare() {
  if (!existsSync(cli)) fail('falta la CLI local. Ejecuta npm install.');

  mkdirSync(join(labSupabase, 'migrations'), { recursive: true });
  mkdirSync(join(labSupabase, 'functions'), { recursive: true });

  copy(join(sourceSupabase, 'local', 'config.toml'), join(labSupabase, 'config.toml'));
  copy(join(sourceSupabase, 'local', 'seed.sql'), join(labSupabase, 'seed.sql'));
  copy(
    join(sourceSupabase, 'tests', 'selection-baseline.sql'),
    join(labSupabase, 'migrations', '20260905010000_selection_baseline.sql'),
  );
  for (const migration of [
    '20260905013950_progressive_selection.sql',
    '20260905015832_selection_hardening.sql',
    '20260905022036_selection_reminder_window.sql',
    '20260905152829_selection_save_preserves_booking.sql',
    '20260905195438_selection_evaluation_metadata.sql',
  ]) {
    copy(join(sourceSupabase, 'migrations', migration), join(labSupabase, 'migrations', migration));
  }
  copy(
    join(sourceSupabase, 'local', 'selection-lab.sql'),
    join(labSupabase, 'migrations', '20260905030000_selection_lab.sql'),
  );
  copy(join(sourceSupabase, 'functions', '_shared'), join(labSupabase, 'functions', '_shared'));
  copy(
    join(sourceSupabase, 'functions', 'selection-dispatch'),
    join(labSupabase, 'functions', 'selection-dispatch'),
  );
  copy(
    join(sourceSupabase, 'functions', 'selection-webhook'),
    join(labSupabase, 'functions', 'selection-webhook'),
  );
  copy(
    join(sourceSupabase, 'local', 'functions', 'selection-mailbox'),
    join(labSupabase, 'functions', 'selection-mailbox'),
  );

  // The real local secret is filled in after `supabase start` reports it.
  // Keeping a local-only placeholder here prevents prepare() from ever
  // copying a production credential into the lab.
  writeFunctionEnvironment('local-selection-db-secret-only');

  console.log('Selection Lab preparado en .selection-lab (ignorado por Git).');
}

function runCli(args, { capture = false } = {}) {
  const result = spawnSync(cli, [...args, '--workdir', labRoot], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    if (capture) console.error(result.stderr || result.stdout);
    fail(`supabase ${args.join(' ')} falló.`);
  }
  return capture ? result.stdout.trim() : '';
}

function localStatus() {
  const output = runCli(['status', '--output', 'json'], { capture: true });
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    fail('no se pudo interpretar supabase status --output json.');
  }
  const apiUrl = status.API_URL ?? status.api_url;
  const anonKey = status.ANON_KEY ?? status.anon_key;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
  if (!apiUrl || !anonKey || !serviceRoleKey) fail('Supabase local no reportó URL o claves esperadas.');
  assertLocalValue('API URL', apiUrl);
  const host = new URL(apiUrl).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') fail(`API no local detectada: ${host}`);
  return { status, apiUrl, anonKey, serviceRoleKey };
}

async function bootstrapAdmin() {
  let { status, apiUrl, anonKey, serviceRoleKey } = localStatus();
  const databaseSecretKey = status.SECRET_KEY ?? status.secret_key ?? serviceRoleKey;
  if (!databaseSecretKey) fail('Supabase local no reportó una clave secreta para las funciones.');
  writeFunctionEnvironment(databaseSecretKey);

  // `supabase start` launches Edge Runtime before it can report the local
  // secret key, so the first process would otherwise retain the placeholder
  // written by prepare(). Restart once after writing the real local key. This
  // never connects to production and keeps the function contract identical
  // between the lab and deployment.
  runCli(['stop']);
  runCli(['start'], { capture: true });
  ({ status, apiUrl, anonKey, serviceRoleKey } = localStatus());
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { selection_lab: true },
    }),
  });
  if (!response.ok && response.status !== 422) {
    fail(`no se pudo crear el admin local (HTTP ${response.status}).`);
  }

  const astroEnvironment = [
    'PUBLIC_SELECTION_LAB=true',
    `PUBLIC_SUPABASE_URL=${apiUrl}`,
    `PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `SELECTION_WORKER_SECRET=${workerSecret}`,
    'SUPABASE_SERVICE_ROLE_KEY=',
    'RESEND_API_KEY=',
    '',
  ].join('\n');
  assertLocalValue('entorno de Astro', astroEnvironment);
  writeFileSync(join(projectRoot, '.env.selection-lab'), astroEnvironment, { mode: 0o600 });

  console.log('\nLaboratorio listo:');
  console.log('  Aplicación: http://127.0.0.1:4321/admin/login');
  console.log('  Supabase Studio: http://127.0.0.1:55323');
  console.log('  Mailpit (sólo correos de Auth): http://127.0.0.1:55324');
  console.log(`  Usuario local: ${adminEmail}`);
  console.log(`  Contraseña local: ${adminPassword}`);
  console.log('  Datos: 11 postulantes sintéticos, temporada 2099-1');
  console.log('\nSiguiente paso: npm run selection:lab:dev');
}

function readAstroEnvironment() {
  const path = join(projectRoot, '.env.selection-lab');
  if (!existsSync(path)) fail('falta .env.selection-lab. Ejecuta npm run selection:lab:start.');
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function dispatch() {
  const { apiUrl } = localStatus();
  const response = await fetch(`${apiUrl}/functions/v1/selection-dispatch`, {
    method: 'POST',
    headers: { 'X-Selection-Worker-Secret': workerSecret },
  });
  const body = await response.text();
  if (!response.ok) fail(`dispatcher local respondió HTTP ${response.status}: ${body}`);
  console.log(body);
}

async function inbox() {
  const { apiUrl, serviceRoleKey } = localStatus();
  const response = await fetch(
    `${apiUrl}/rest/v1/selection_lab_mailbox?select=provider_id,recipients,subject,simulated_delivery_status,webhook_http_status,created_at&order=created_at.desc`,
    { headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` } },
  );
  if (!response.ok) fail(`no se pudo leer el buzón local (HTTP ${response.status}).`);
  const messages = await response.json();
  if (messages.length === 0) {
    console.log('Buzón local vacío.');
    return;
  }
  console.table(messages.map((message) => ({
    destinatario: message.recipients?.join(', '),
    asunto: message.subject,
    entrega: message.simulated_delivery_status,
    webhook: message.webhook_http_status,
    fecha: message.created_at,
  })));
}

async function verify() {
  const { apiUrl, anonKey } = localStatus();
  const authResponse = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  if (!authResponse.ok) fail(`login local falló (HTTP ${authResponse.status}).`);
  const session = await authResponse.json();
  if (session.user?.email !== adminEmail || !session.access_token) fail('Auth local devolvió una sesión inesperada.');

  const stateResponse = await fetch(`${apiUrl}/rest/v1/rpc/selection_admin`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_action: 'state', p_data: { season: '2099-1' } }),
  });
  if (!stateResponse.ok) fail(`RPC de administración falló (HTTP ${stateResponse.status}).`);
  const state = await stateResponse.json();
  if (
    state.config?.active_season !== '2099-1' ||
    state.config?.progressive_enabled !== true ||
    state.solicitudes?.length !== 11 ||
    state.messages?.length !== 0
  ) {
    fail('el estado inicial del laboratorio no coincide con el escenario esperado.');
  }

  const anonymousResponse = await fetch(`${apiUrl}/rest/v1/rpc/selection_admin`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ p_action: 'state', p_data: { season: '2099-1' } }),
  });
  if (anonymousResponse.ok) fail('la RPC administrativa aceptó una llamada anónima.');

  console.log('Selection Lab verificado: Auth, RLS, RPC y escenario sintético correctos.');
}

const command = process.argv[2] ?? 'help';

switch (command) {
  case 'prepare':
    prepare();
    break;
  case 'start':
    prepare();
    runCli(['start'], { capture: true });
    await bootstrapAdmin();
    break;
  case 'reset':
    prepare();
    runCli(['db', 'reset']);
    // `db reset` can leave the already-created Edge Runtime stopped when
    // another local Supabase process shut it down. Bring the local function
    // gateway back before handing the lab to the browser.
    runCli(['start']);
    await bootstrapAdmin();
    break;
  case 'stop':
    runCli(['stop']);
    break;
  case 'status': {
    const { status } = localStatus();
    const safeStatus = Object.fromEntries(
      Object.entries(status).filter(([key]) => !/KEY|SECRET|PASSWORD/i.test(key)),
    );
    console.log(safeStatus);
    break;
  }
  case 'dev': {
    localStatus();
    const child = spawn(join(projectRoot, 'node_modules', '.bin', 'astro'), ['dev', '--host', '127.0.0.1', '--port', '4321'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, ...readAstroEnvironment() },
    });
    child.on('exit', (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      process.exit(code ?? 0);
    });
    break;
  }
  case 'dispatch':
    await dispatch();
    break;
  case 'inbox':
    await inbox();
    break;
  case 'verify':
    await verify();
    break;
  default:
    console.log('Uso: node scripts/selection-lab.mjs <prepare|start|reset|stop|status|dev|dispatch|inbox|verify>');
}
