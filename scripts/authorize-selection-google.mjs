import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, createHash, createCipheriv, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';

// One-time administrative provisioning. Neither codes nor tokens are logged.
const [clientPath, expectedEmail, outputPath] = process.argv.slice(2);
if (!clientPath || !expectedEmail || !outputPath || resolve(clientPath) === resolve(outputPath)) {
  throw new Error('Usage: node scripts/authorize-selection-google.mjs desktop-client.json organizer@email /private/google-selection.env');
}
const client = JSON.parse(await readFile(clientPath, 'utf8')).installed;
if (!client?.client_id || !client?.client_secret) throw new Error('Se necesita el JSON de un cliente OAuth de escritorio.');
const requiredScopes = [
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/meetings.space.settings',
];
if (process.argv.includes('--cohosts')) requiredScopes.push('https://www.googleapis.com/auth/meetings.space.created');
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(48).toString('base64url');
let settle;
const callback = new Promise((resolveCallback, rejectCallback) => { settle = { resolveCallback, rejectCallback }; });
// Bind loopback only; accept just our callback with a constant-time state check.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname !== '/oauth/callback') { res.writeHead(404).end(); return; }
  const received = Buffer.from(url.searchParams.get('state') || '');
  if (received.length !== Buffer.byteLength(state) || !timingSafeEqual(received, Buffer.from(state))) {
    res.writeHead(400).end('Estado de autorización inválido.'); return;
  }
  if (url.searchParams.has('error') || !url.searchParams.get('code')) {
    res.writeHead(400).end('Google no autorizó la integración.');
    settle.rejectCallback(new Error('Google no autorizó la integración.')); return;
  }
  res.end('Consentimiento recibido. Puedes cerrar esta pestaña; se está comprobando la autorización.');
  settle.resolveCallback(url.searchParams.get('code'));
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const redirect = `http://127.0.0.1:${server.address().port}/oauth/callback`;
const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authorization.search = new URLSearchParams({
  client_id: client.client_id, redirect_uri: redirect, response_type: 'code',
  scope: [...requiredScopes, 'openid', 'email'].join(' '), access_type: 'offline',
  prompt: 'consent', login_hint: expectedEmail, state,
  code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
}).toString();
const timer = setTimeout(() => settle.rejectCallback(new Error('La autorización caducó después de 10 minutos.')), 600_000);
async function googleJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Google rechazó la comprobación (HTTP ${response.status}).`);
  return response.json();
}
try {
  const browser = spawn('xdg-open', [authorization.toString()], { stdio: 'ignore' });
  browser.on('error', () => settle.rejectCallback(new Error('No se pudo abrir el navegador.')));
  console.log('Autoriza Calendar y Meet en el navegador con la cuenta organizadora.');
  const code = await callback;
  const tokens = await googleJson('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret,
      redirect_uri: redirect, code, code_verifier: verifier, grant_type: 'authorization_code' }),
  });
  const granted = new Set((tokens.scope || '').split(' '));
  if (!tokens.refresh_token || !tokens.access_token || requiredScopes.some(scope => !granted.has(scope))) {
    throw new Error('Falta acceso offline o algún permiso de Calendar/Meet; no se guardaron credenciales.');
  }
  const identity = await googleJson('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!identity.email_verified || identity.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error('La cuenta autorizada no coincide con la organizadora; no se guardaron credenciales.');
  }
  // Prove refresh works before storing the credentials for the worker.
  const renewed = await googleJson('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret,
      refresh_token: tokens.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!renewed.access_token) throw new Error('La renovación de autorización no devolvió un token.');
  await googleJson('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind', {
    headers: { Authorization: `Bearer ${renewed.access_token}` },
  });
  const clear = JSON.stringify({ client_id: client.client_id, client_secret: client.client_secret,
    refresh_token: tokens.refresh_token, calendar_id: 'primary', organizer_email: identity.email });
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final(), cipher.getAuthTag()]);
  await mkdir(dirname(resolve(outputPath)), { recursive: true, mode: 0o700 });
  await writeFile(outputPath, `GOOGLE_SELECTION_CREDENTIALS=v1.${iv.toString('base64')}.${encrypted.toString('base64')}\nGOOGLE_SELECTION_ENCRYPTION_KEY=${key.toString('base64')}\n`, { mode: 0o600, flag: 'wx' });
  console.log('Identidad, permisos, renovación y Calendar comprobados. Credenciales cifradas guardadas.');
  console.log('Pendiente: comprobar Meet con salas reales e instalar los secretos en el servidor.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falló la autorización.');
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
