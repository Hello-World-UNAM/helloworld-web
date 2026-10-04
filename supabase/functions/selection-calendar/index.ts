import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
import { CalendarError, decryptCalendarCredentials, googleAccessToken, processCalendarJob, type CalendarJob } from '../_shared/selection-calendar.ts';
import { processManagedRoom } from '../_shared/selection-meet-hosts.ts';

function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let n = 0; n < Math.max(a.length, b.length); n++) difference |= (a.charCodeAt(n) || 0) ^ (b.charCodeAt(n) || 0);
  return difference === 0;
}
export async function handleSelectionCalendar(request: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-selection-worker-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('SELECTION_WORKER_SECRET');
  const encrypted = Deno.env.get('GOOGLE_SELECTION_CREDENTIALS');
  const key = Deno.env.get('GOOGLE_SELECTION_ENCRYPTION_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const databaseKey = Deno.env.get('SELECTION_DB_SECRET_KEY');
  if (!encrypted || !key || !url || !databaseKey) return json({ error: 'calendar_not_configured' }, 503);
  const client = createClient(url, databaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!secret || !equal(request.headers.get('X-Selection-Worker-Secret') ?? '', secret)) {
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json({ error: 'unauthorized' }, 401);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return json({ error: 'unauthorized' }, 401);
    const actorClient = createClient(url, databaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const membership = await actorClient.from('directiva').select('email').eq('email', data.user.email.toLowerCase()).maybeSingle();
    if (membership.error || !membership.data) return json({ error: 'forbidden' }, 403);
  }
  try {
    let target: { room_id?: string; bookings_only?: boolean } = {};
    try { target = await request.json(); } catch { /* scheduled calls may have no body */ }
    if (!target || typeof target !== 'object' || Array.isArray(target)) return json({ error: 'invalid_request' }, 400);
    if (target.room_id !== undefined && (typeof target.room_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.room_id))) return json({ error: 'invalid_room_id' }, 400);
    if (target.bookings_only !== undefined && typeof target.bookings_only !== 'boolean') return json({ error: 'invalid_request' }, 400);
    const credentials = await decryptCalendarCredentials(encrypted, key);
    // Refresh first: missing/revoked credentials must not consume any outbox lease.
    const accessToken = await googleAccessToken(credentials);
    const rpc = async (action: string, data: Record<string, unknown>) => {
      const result = await client.rpc('selection_calendar_worker', { p_action: action, p_data: data });
      if (result.error) throw new Error('calendar_database_error');
      return result.data;
    };
    const started = Date.now();
    let processed = 0, failed = 0;
    while (processed < 10 && Date.now() - started < 40_000) {
      const job = await rpc('claim', target.room_id ? { room_id: target.room_id } : target.bookings_only ? { bookings_only: true } : {}) as CalendarJob | null;
      if (!job) break;
      try {
        const result = job.kind === 'room' && (job.google_space_name || !job.meet_url)
          ? await processManagedRoom(job, credentials.calendar_id, credentials.organizer_email ?? '', accessToken, {
            trackHosts: async (emails) => { await rpc('space_hosts', { ...job, cohost_emails: emails }); },
            start: async () => { await rpc('space_start', job as unknown as Record<string, unknown>); },
            save: async (space) => { await rpc('space_save', { ...job, ...space }); },
          })
          : await processCalendarJob(job, credentials.calendar_id, accessToken);
        await rpc('finish', { ...job, ...result, outcome: 'ready' });
      } catch (error) {
        const detail = error instanceof CalendarError ? error.message : 'calendar_network_or_database_error';
        await rpc('finish', { ...job, outcome: 'failed', error: detail });
        failed++;
      }
      processed++;
    }
    return json({ ok: failed === 0, processed, failed });
  } catch (error) {
    return json({ error: error instanceof CalendarError ? error.message : 'calendar_worker_error' }, 503);
  }
}
Deno.serve(handleSelectionCalendar);
