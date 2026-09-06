import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// This command is intentionally opt-in. It needs an explicit season and an
// explicit destination outside the repository; it never defaults to a remote
// project or overwrites an existing archive.
const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const season = process.env.SELECTION_BACKUP_SEASON;
const outputDir = process.env.SELECTION_CV_BACKUP_DIR;

function fail(message) {
  console.error(`Selection CV backup: ${message}`);
  process.exit(1);
}

if (!supabaseUrl || !secretKey) fail('define PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno seguro.');
if (!season || !/^\d{4}-[12]$/.test(season)) fail('SELECTION_BACKUP_SEASON debe tener formato YYYY-1 o YYYY-2.');
if (!outputDir || !isAbsolute(outputDir)) fail('SELECTION_CV_BACKUP_DIR debe ser una ruta absoluta nueva.');

let parsedUrl;
try { parsedUrl = new URL(supabaseUrl); } catch { fail('PUBLIC_SUPABASE_URL no es una URL válida.'); }
if (parsedUrl.hostname.endsWith('.supabase.co') === false && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
  fail('PUBLIC_SUPABASE_URL debe apuntar a Supabase o a localhost.');
}

const destination = resolve(outputDir);
const destinationRelativeToRepo = relative(projectRoot, destination);
if (!destinationRelativeToRepo.startsWith(`..${sep}`) && destinationRelativeToRepo !== '..') {
  fail('el destino debe estar fuera del repositorio.');
}

await mkdir(destination, { recursive: true, mode: 0o700 });
await chmod(destination, 0o700);
const existing = await readdir(destination);
if (existing.length > 0) fail('el destino no está vacío; usa una carpeta nueva por respaldo.');

const client = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data: references, error: referencesError } = await client
  .from('solicitudes')
  .select('id,cv_storage_path')
  .eq('season', season)
  .not('cv_storage_path', 'is', null)
  .order('id');
if (referencesError) fail(`no se pudieron leer las referencias de CV (${referencesError.message}).`);

const files = [];
let totalBytes = 0;
for (const reference of references ?? []) {
  const path = String(reference.cv_storage_path ?? '');
  if (!path || path.includes('\0') || path.split('/').includes('..') || path.startsWith('/')) {
    fail(`referencia de CV inválida para el registro ${reference.id}.`);
  }

  const { data: blob, error } = await client.storage.from('cvs').download(path);
  if (error || !blob) fail(`no se pudo descargar el CV del registro ${reference.id}.`);

  const bytes = Buffer.from(await blob.arrayBuffer());
  const extension = extname(path).toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(extension)) {
    fail(`extensión de CV no permitida para el registro ${reference.id}.`);
  }
  const filename = `${reference.id}${extension}`;
  await writeFile(join(destination, filename), bytes, { flag: 'wx', mode: 0o600 });
  const checksum = createHash('sha256').update(bytes).digest('hex');
  files.push({ solicitud_id: reference.id, source_path: path, filename, bytes: bytes.length, sha256: checksum });
  totalBytes += bytes.length;
}

await writeFile(join(destination, 'manifest.json'), JSON.stringify({
  format_version: 1,
  captured_at: new Date().toISOString(),
  season,
  bucket: 'cvs',
  files,
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

console.log(`Respaldo de CVs creado: ${files.length} archivo(s), ${totalBytes} bytes.`);
console.log(`Destino: ${destination}`);
console.log('Cifra esta carpeta con age/tu gestor de secretos antes de conservarla fuera de Supabase.');
