// Deno tests: no network permission. All HTTP requests are intercepted below.
import { assertEquals } from 'jsr:@std/assert@1.0.19';

const realServe = Deno.serve;
Object.defineProperty(Deno, 'serve', { value: () => undefined, configurable: true });
const { handleSelectionDispatch } = await import('../supabase/functions/selection-dispatch/index.ts');
const { handleSelectionWebhook } = await import('../supabase/functions/selection-webhook/index.ts');
Object.defineProperty(Deno, 'serve', { value: realServe, configurable: true });

const id = '00000000-0000-0000-0000-000000000099';
const env = { SELECTION_WORKER_SECRET: 'synthetic-worker-secret', RESEND_API_KEY: 'synthetic-resend-api-key', SUPABASE_URL: 'http://127.0.0.1:59999', SELECTION_DB_SECRET_KEY: 'synthetic-service', RESEND_WEBHOOK_SECRET: 'c3ludGhldGljLXNlY3JldA==' };
function setup() { for (const [key,value] of Object.entries(env)) Deno.env.set(key,value); }
const request = () => new Request('http://localhost/worker', { method: 'POST', headers: { 'X-Selection-Worker-Secret': env.SELECTION_WORKER_SECRET } });

Deno.test('dispatch and webhook reject unauthenticated calls before HTTP', async () => {
  setup();
  assertEquals((await handleSelectionDispatch(new Request('http://localhost', {method:'POST'}))).status,401);
  assertEquals((await handleSelectionWebhook(new Request('http://localhost', {method:'POST',body:'{}'}))).status,400);
  Deno.env.delete('SELECTION_WORKER_SECRET');
  assertEquals((await handleSelectionDispatch(request())).status,503);
});

Deno.test('progressive functions do not fall back to the legacy service-role key', async () => {
  setup();
  Deno.env.delete('SELECTION_DB_SECRET_KEY');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'legacy-key-must-not-be-used');
  assertEquals((await handleSelectionDispatch(request())).status, 503);
  Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
});

for (const [status,outcome] of [[200,'accepted'],[429,'retry'],[500,'uncertain'],[422,'failed'],[0,'uncertain']] as const) {
  Deno.test(`provider ${status || 'timeout'} is recorded as ${outcome}`, async () => {
    setup();
    const original = globalThis.fetch;
    let claimed = false;
    let recorded: Record<string,unknown> | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url === 'https://api.resend.com/emails') {
        assertEquals(new Headers(init?.headers).get('Idempotency-Key'),'synthetic-key');
        if (!status) throw new TypeError('Synthetic timeout');
        return Response.json(status === 200 ? {id:'synthetic-provider-id'} : {message:'synthetic failure'}, {status});
      }
      if (!url.startsWith(env.SUPABASE_URL + '/rest/v1/rpc/selection_worker')) throw new Error('Unexpected HTTP target');
      const body = JSON.parse(String(init?.body));
      if (body.p_action === 'claim') {
        if (claimed) return Response.json(null);
        claimed = true;
        return Response.json({id,lease_token:id,kind:'receipt',recipient:'synthetic@example.org',payload:{nombre:'Synthetic',season:'2027-1'},idempotency_key:'synthetic-key',first_attempt_at:new Date().toISOString(),attempts:1});
      }
      if (body.p_action === 'prepared') return Response.json({request_body:body.p_data.request_body});
      if (body.p_action === 'finish') { recorded=body.p_data; return Response.json({ok:true}); }
      throw new Error('Unexpected RPC');
    }) as typeof fetch;
    try {
      assertEquals((await handleSelectionDispatch(request())).status,200);
      assertEquals(recorded?.outcome,outcome);
    } finally { globalThis.fetch=original; }
  });
}

Deno.test('webhook verifies exact signed bytes and rejects changed payload', async () => {
  setup();
  const original = globalThis.fetch;
  let persisted = 0;
  globalThis.fetch = (async () => { persisted++; return Response.json({ok:true}); }) as typeof fetch;
  try {
    const body = JSON.stringify({type:'email.delivered',data:{email_id:'synthetic-provider-id'}});
    const timestamp = Math.floor(Date.now()/1000).toString();
    const key = await crypto.subtle.importKey('raw',new TextEncoder().encode('synthetic-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const sig = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`synthetic-event.${timestamp}.${body}`));
    const headers = {'svix-id':'synthetic-event','svix-timestamp':timestamp,'svix-signature':'v1,'+btoa(String.fromCharCode(...new Uint8Array(sig)))};
    assertEquals((await handleSelectionWebhook(new Request('http://localhost',{method:'POST',headers,body}))).status,200);
    assertEquals((await handleSelectionWebhook(new Request('http://localhost',{method:'POST',headers,body:body+' '}))).status,400);
    assertEquals(persisted,1);
  } finally { globalThis.fetch=original; }
});
