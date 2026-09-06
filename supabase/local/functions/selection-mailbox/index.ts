import { createClient } from 'npm:@supabase/supabase-js@2.105.4';

const corsHeaders = {
  'content-type': 'application/json; charset=utf-8',
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeWebhookSecret(secret: string): Uint8Array {
  const encoded = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

async function signature(secret: string, eventId: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    decodeWebhookSecret(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${eventId}.${timestamp}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(signed)))}`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = `Bearer ${env('RESEND_API_KEY')}`;
  if (request.headers.get('authorization') !== expected) return json({ error: 'unauthorized' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!isRecord(body) || !Array.isArray(body.to) || typeof body.subject !== 'string') {
    return json({ error: 'invalid_mail' }, 422);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const idempotencyKey = request.headers.get('idempotency-key') ?? crypto.randomUUID();
  const providerId = `local-${crypto.randomUUID()}`;

  const row = {
    provider_id: providerId,
    idempotency_key: idempotencyKey,
    from_address: String(body.from ?? ''),
    recipients: body.to,
    subject: body.subject,
    text_body: String(body.text ?? ''),
    html_body: String(body.html ?? ''),
    tags: Array.isArray(body.tags) ? body.tags : [],
    simulated_delivery_status: 'delivered',
  };

  const { data: inserted, error } = await client
    .from('selection_lab_mailbox')
    .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('provider_id')
    .maybeSingle();
  if (error) return json({ error: 'mailbox_database_error' }, 500);

  const effectiveProviderId = inserted?.provider_id ?? (
    await client
      .from('selection_lab_mailbox')
      .select('provider_id')
      .eq('idempotency_key', idempotencyKey)
      .single()
  ).data?.provider_id;
  if (!effectiveProviderId) return json({ error: 'mailbox_lookup_error' }, 500);

  const tags = Object.fromEntries(
    (Array.isArray(body.tags) ? body.tags : [])
      .filter((tag): tag is { name: string; value: string } =>
        isRecord(tag) && typeof tag.name === 'string' && typeof tag.value === 'string')
      .map((tag) => [tag.name, tag.value]),
  );
  const eventId = `local-event-${crypto.randomUUID()}`;
  const eventBody = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { email_id: effectiveProviderId, tags },
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const webhook = await fetch(`${supabaseUrl}/functions/v1/selection-webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': await signature(env('RESEND_WEBHOOK_SECRET'), eventId, timestamp, eventBody),
    },
    body: eventBody,
  });

  await client
    .from('selection_lab_mailbox')
    .update({ webhook_http_status: webhook.status })
    .eq('provider_id', effectiveProviderId);

  return json({ id: effectiveProviderId });
});
