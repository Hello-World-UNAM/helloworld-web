import { Resend } from 'npm:resend@6.14.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.105.4';

/*
 * Deployment contract (intentionally not changed in this task):
 * [functions.selection-webhook]
 * verify_jwt = false
 *
 * Resend/Svix signature verification is performed inside this function.
 */

interface EdgeRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

const edgeRuntime = (globalThis as typeof globalThis & { Deno?: EdgeRuntime }).Deno;
type ServiceClient = Pick<SupabaseClient, 'rpc'>;

function env(name: string): string | undefined {
  return edgeRuntime?.env.get(name) ?? undefined;
}

function response(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createServiceClient(): ServiceClient | null {
  const url = env('SUPABASE_URL');
  // Use the dedicated modern secret key used by the progressive workflow;
  // the legacy service-role JWT is intentionally not accepted here.
  const databaseSecretKey = env('SELECTION_DB_SECRET_KEY');
  if (!url || !databaseSecretKey) {
    return null;
  }

  return createClient(url, databaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function persistWebhook(
  client: ServiceClient,
  eventId: string,
  event: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.rpc('selection_worker', {
    p_action: 'webhook',
    p_data: { event_id: eventId, event },
  });

  if (error) {
    throw new Error('selection_worker_database_error');
  }
}

function verifyEvent(
  rawBody: string,
  secret: string,
  id: string,
  timestamp: string,
  signature: string,
): unknown {
  // Resend's verifier only performs local signature work, but its constructor
  // requires an API-key-shaped value. No API request is made here.
  const verifier = new Resend(env('RESEND_API_KEY') ?? 'test-only-webhook-signature-placeholder');
  return verifier.webhooks.verify({
    payload: rawBody,
    headers: { id, timestamp, signature },
    webhookSecret: secret,
  });
}

export async function handleSelectionWebhook(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return response('method_not_allowed', 405);
  }

  const webhookSecret = env('RESEND_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return response('webhook_unavailable', 503);
  }

  const eventId = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!eventId || !timestamp || !signature) {
    return response('invalid_signature', 400);
  }

  const rawBody = await request.text();
  let verified: unknown;
  try {
    // Keep rawBody untouched until the SDK verifies the Svix signature.
    verified = verifyEvent(rawBody, webhookSecret, eventId, timestamp, signature);
  } catch {
    return response('invalid_signature', 400);
  }

  if (!isRecord(verified)) {
    return response('ignored', 200);
  }

  const client = createServiceClient();
  if (!client) {
    return response('webhook_unavailable', 503);
  }

  try {
    // SQL owns deduplication and ordering. The verified parsed event is passed
    // as-is so the database can reconcile it against the provider timestamp.
    await persistWebhook(client, eventId, verified);
  } catch {
    return response('database_error', 500);
  }

  return response('ok', 200);
}

if (edgeRuntime) {
  edgeRuntime.serve(handleSelectionWebhook);
}
