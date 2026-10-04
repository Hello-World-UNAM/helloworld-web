import { assertEquals } from 'jsr:@std/assert@1.0.19';
const realServe = Deno.serve;
Object.defineProperty(Deno, 'serve', { value: () => undefined, configurable: true });
const { handleSelectionCalendar } = await import('../supabase/functions/selection-calendar/index.ts');
Object.defineProperty(Deno, 'serve', { value: realServe, configurable: true });
function setup() {
  for (const [key, value] of Object.entries({
    SUPABASE_URL: 'http://127.0.0.1:59999', SELECTION_DB_SECRET_KEY: 'synthetic-server-key',
    SELECTION_WORKER_SECRET: 'synthetic-worker-secret', GOOGLE_SELECTION_CREDENTIALS: 'invalid-encrypted-credential',
    GOOGLE_SELECTION_ENCRYPTION_KEY: 'invalid-key',
  })) Deno.env.set(key, value);
}
Deno.test('Calendar preflight permits the browser admin request without requiring credentials', async () => {
  const response = await handleSelectionCalendar(new Request('http://localhost', { method: 'OPTIONS' }));
  assertEquals(response.status, 204);
  assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
});
for (const admin of [false, true]) {
  Deno.test(`Calendar verifies identity and checks membership using the actor RLS context: admin=${admin}`, async () => {
    setup(); const original = globalThis.fetch; let membershipChecked = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      assertEquals(request.headers.get('Authorization'), 'Bearer synthetic-user-token');
      if (request.url.includes('/auth/v1/user')) return Response.json({ id: 'synthetic-user', email: 'admin@selection.local' });
      if (request.url.includes('/rest/v1/directiva')) {
        membershipChecked = true;
        return Response.json(admin ? { email: 'admin@selection.local' } : null);
      }
      throw new Error('No worker RPC or Google call is allowed with invalid credentials');
    }) as typeof fetch;
    try {
      const response = await handleSelectionCalendar(new Request('http://localhost', {
        method: 'POST', headers: { Authorization: 'Bearer synthetic-user-token' },
      }));
      assertEquals(membershipChecked, true);
      assertEquals(response.status, admin ? 503 : 403);
    } finally { globalThis.fetch = original; }
  });
}
Deno.test('Calendar rejects missing identity before making any request', async () => {
  setup();
  assertEquals((await handleSelectionCalendar(new Request('http://localhost', { method: 'POST' }))).status, 401);
});
