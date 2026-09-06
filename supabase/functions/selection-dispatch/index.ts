import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.105.4';
import {
  buildSelectionMailRequestBody,
  isSelectionMailRequestBody,
  SELECTION_MAIL_KINDS,
  type SelectionMailKind,
  type SelectionMailRequestBody,
  type SelectionMailPayload,
} from '../_shared/selection-mail.ts';

/*
 * Deployment contract (intentionally not changed in this task):
 * [functions.selection-dispatch]
 * verify_jwt = false
 *
 * The worker authenticates with X-Selection-Worker-Secret instead of a JWT.
 */

const DEFAULT_RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const MAX_JOBS_PER_INVOCATION = 10;
const MAX_INVOCATION_MS = 45_000;
const HTTP_TIMEOUT_MS = 15_000;
const MIN_SEND_INTERVAL_MS = 600;
const WORKER_WINDOW_RESERVE_MS = HTTP_TIMEOUT_MS + 1_000;
const DEFAULT_FROM = 'Club Hello World <contacto@helloworld-unam.tech>';

interface EdgeRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

const edgeRuntime = (globalThis as typeof globalThis & { Deno?: EdgeRuntime }).Deno;

type ServiceClient = Pick<SupabaseClient, 'rpc'>;

interface WorkerJob {
  id: string | number;
  lease_token: string;
  kind: SelectionMailKind;
  recipient: string;
  payload: SelectionMailPayload;
  idempotency_key: string;
  first_attempt_at: string;
  attempts: number;
}

type DeliveryOutcome =
  | { outcome: 'accepted'; provider_id: string }
  | { outcome: 'retry'; retry_after_seconds?: number; error?: string }
  | { outcome: 'failed'; error: string }
  | { outcome: 'uncertain'; retry_after_seconds?: number; error?: string };

class WorkerDatabaseError extends Error {
  constructor() {
    super('selection_worker_database_error');
    this.name = 'WorkerDatabaseError';
  }
}

function env(name: string): string | undefined {
  return edgeRuntime?.env.get(name) ?? undefined;
}

function resendEmailsUrl(): string {
  return env('RESEND_EMAILS_URL') ?? DEFAULT_RESEND_EMAILS_URL;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapRpcData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value[0];
  }

  return value;
}

async function callSelectionWorker(
  client: ServiceClient,
  action: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const { data: result, error } = await client.rpc('selection_worker', {
    p_action: action,
    p_data: data,
  });

  if (error) {
    throw new WorkerDatabaseError();
  }

  return unwrapRpcData(result);
}

function createServiceClient(): ServiceClient | null {
  const url = env('SUPABASE_URL');
  // Do not couple the progressive worker to Supabase's legacy built-in
  // service-role JWT. The deploy contract uses a dedicated modern secret key
  // configured as SELECTION_DB_SECRET_KEY.
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

function isMailKind(value: unknown): value is SelectionMailKind {
  return typeof value === 'string' && (SELECTION_MAIL_KINDS as readonly string[]).includes(value);
}

function parseClaimedJob(value: unknown): WorkerJob {
  if (!isRecord(value)) {
    throw new WorkerDatabaseError();
  }

  const id = value.id;
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    (typeof id === 'string' && !id) ||
    (typeof id === 'number' && !Number.isSafeInteger(id))
  ) {
    throw new WorkerDatabaseError();
  }

  if (
    typeof value.lease_token !== 'string' ||
    !value.lease_token ||
    !isMailKind(value.kind) ||
    typeof value.recipient !== 'string' ||
    !value.recipient ||
    !isRecord(value.payload) ||
    typeof value.idempotency_key !== 'string' ||
    !value.idempotency_key ||
    typeof value.first_attempt_at !== 'string' ||
    typeof value.attempts !== 'number' ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0
  ) {
    throw new WorkerDatabaseError();
  }

  return {
    id,
    lease_token: value.lease_token,
    kind: value.kind,
    recipient: value.recipient,
    payload: value.payload as unknown as SelectionMailPayload,
    idempotency_key: value.idempotency_key,
    first_attempt_at: value.first_attempt_at,
    attempts: value.attempts,
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds), 2_147_483_647);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return undefined;
  }

  return Math.min(Math.max(0, Math.ceil((date - Date.now()) / 1_000)), 2_147_483_647);
}

async function sendToResend(
  requestBody: SelectionMailRequestBody,
  idempotencyKey: string,
  resendApiKey: string,
  timeoutMs: number,
): Promise<DeliveryOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, Math.min(timeoutMs, HTTP_TIMEOUT_MS)));

  try {
    const response = await fetch(resendEmailsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));

    if (response.status === 429) {
      return { outcome: 'retry', error: 'resend_rate_limited', retry_after_seconds: retryAfter };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { outcome: 'uncertain', error: 'resend_server_error', retry_after_seconds: retryAfter };
    }

    if (response.status >= 400 && response.status <= 499) {
      return { outcome: 'failed', error: `resend_http_${response.status}` };
    }

    if (!response.ok) {
      return { outcome: 'failed', error: `resend_http_${response.status}` };
    }

    const rawBody = await response.text();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return { outcome: 'uncertain', error: 'resend_invalid_success_response' };
    }

    if (!isRecord(parsedBody) || typeof parsedBody.id !== 'string' || !parsedBody.id) {
      return { outcome: 'uncertain', error: 'resend_missing_provider_id' };
    }

    return { outcome: 'accepted', provider_id: parsedBody.id };
  } catch {
    return {
      outcome: 'uncertain',
      error: timedOut ? 'resend_timeout' : 'resend_network_error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function finishJob(
  client: ServiceClient,
  job: WorkerJob,
  outcome: DeliveryOutcome,
): Promise<void> {
  const data: Record<string, unknown> = {
    id: job.id,
    lease_token: job.lease_token,
    outcome: outcome.outcome,
  };

  if (outcome.outcome === 'accepted') {
    data.provider_id = outcome.provider_id;
  }
  if (outcome.outcome !== 'accepted' && outcome.error) {
    data.error = outcome.error;
  }
  if ('retry_after_seconds' in outcome && outcome.retry_after_seconds !== undefined) {
    data.retry_after_seconds = outcome.retry_after_seconds;
  }

  await callSelectionWorker(client, 'finish', data);
}

async function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForSendThrottle(lastSendStartedAt: number | undefined): Promise<void> {
  if (lastSendStartedAt === undefined) {
    return;
  }

  const elapsed = Date.now() - lastSendStartedAt;
  await sleep(Math.max(0, MIN_SEND_INTERVAL_MS - elapsed));
}

export async function handleSelectionDispatch(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const configuredSecret = env('SELECTION_WORKER_SECRET');
  if (!configuredSecret) {
    return jsonResponse({ error: 'worker_unavailable' }, 503);
  }

  const suppliedSecret = request.headers.get('X-Selection-Worker-Secret');
  if (!suppliedSecret || !constantTimeEqual(suppliedSecret, configuredSecret)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const resendApiKey = env('RESEND_API_KEY');
  const client = createServiceClient();
  if (!resendApiKey || !client) {
    return jsonResponse({ error: 'worker_unavailable' }, 503);
  }

  const from = env('SELECTION_MAIL_FROM') ?? DEFAULT_FROM;
  if (!from || /[\r\n]/.test(from)) {
    return jsonResponse({ error: 'worker_unavailable' }, 503);
  }

  const startedAt = Date.now();
  let lastSendStartedAt: number | undefined;
  let processed = 0;
  let accepted = 0;
  let retried = 0;
  let failed = 0;
  let uncertain = 0;

  try {
    while (
      processed < MAX_JOBS_PER_INVOCATION &&
      Date.now() - startedAt < MAX_INVOCATION_MS - WORKER_WINDOW_RESERVE_MS
    ) {
      const claimed = await callSelectionWorker(client, 'claim', {});
      if (claimed === null) {
        break;
      }

      const job = parseClaimedJob(claimed);
      let requestBody: SelectionMailRequestBody;

      try {
        requestBody = buildSelectionMailRequestBody(job.kind, job.payload, job.recipient, from, job.id);
      } catch {
        const invalidPayload: DeliveryOutcome = { outcome: 'failed', error: 'invalid_mail_payload' };
        await finishJob(client, job, invalidPayload);
        processed += 1;
        failed += 1;
        continue;
      }

      const prepared = await callSelectionWorker(client, 'prepared', {
        id: job.id,
        lease_token: job.lease_token,
        request_body: requestBody,
      });
      if (!isRecord(prepared) || !isSelectionMailRequestBody(prepared.request_body, job.id)) {
        throw new WorkerDatabaseError();
      }

      await waitForSendThrottle(lastSendStartedAt);
      const remainingMs = MAX_INVOCATION_MS - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        const outsideWindow: DeliveryOutcome = {
          outcome: 'retry',
          error: 'worker_window_elapsed',
          retry_after_seconds: 60,
        };
        await finishJob(client, job, outsideWindow);
        processed += 1;
        retried += 1;
        continue;
      }

      lastSendStartedAt = Date.now();
      const delivery = await sendToResend(
        prepared.request_body,
        job.idempotency_key,
        resendApiKey,
        Math.min(HTTP_TIMEOUT_MS, remainingMs),
      );
      await finishJob(client, job, delivery);

      processed += 1;
      if (delivery.outcome === 'accepted') accepted += 1;
      if (delivery.outcome === 'retry') retried += 1;
      if (delivery.outcome === 'failed') failed += 1;
      if (delivery.outcome === 'uncertain') uncertain += 1;
    }
  } catch (error) {
    if (error instanceof WorkerDatabaseError) {
      return jsonResponse({ error: 'worker_database_error' }, 500);
    }

    return jsonResponse({ error: 'worker_error' }, 500);
  }

  return jsonResponse({ ok: true, processed, accepted, retried, failed, uncertain });
}

if (edgeRuntime) {
  edgeRuntime.serve(handleSelectionDispatch);
}
