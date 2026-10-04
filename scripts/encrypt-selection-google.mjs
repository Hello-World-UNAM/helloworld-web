import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, createCipheriv } from 'node:crypto';

// Provisioning helper: reads JSON from a local file and writes a mode-0600 secrets file.
// Never print cleartext credentials or the encryption key to a terminal/log.
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || inputPath === outputPath) throw new Error('Usage: node scripts/encrypt-selection-google.mjs credentials.json /tmp/google-selection.env');
const clear = readFileSync(inputPath);
const credentials = JSON.parse(clear.toString());
for (const name of ['client_id', 'client_secret', 'refresh_token', 'calendar_id']) {
  if (typeof credentials[name] !== 'string' || !credentials[name]) throw new Error(`Missing ${name}`);
}
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const encrypted = Buffer.concat([cipher.update(clear), cipher.final(), cipher.getAuthTag()]);
writeFileSync(outputPath, `GOOGLE_SELECTION_CREDENTIALS=v1.${iv.toString('base64')}.${encrypted.toString('base64')}\nGOOGLE_SELECTION_ENCRYPTION_KEY=${key.toString('base64')}\n`, { mode: 0o600, flag: 'wx' });
console.log('Encrypted server secrets file created.');
