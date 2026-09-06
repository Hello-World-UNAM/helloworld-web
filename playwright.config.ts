import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4329', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/e2e/fake-supabase.mjs', url: 'http://127.0.0.1:55439/__health', reuseExistingServer: false },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4329', url: 'http://127.0.0.1:4329', reuseExistingServer: false,
      env: { PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55439', PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key', SUPABASE_SERVICE_ROLE_KEY: '', RESEND_API_KEY: '' } },
  ],
});
