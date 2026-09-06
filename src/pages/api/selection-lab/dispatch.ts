import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';
import { assertSafeSupabaseEnvironment, isSelectionLab } from '../../../lib/selection-lab';

export const POST: APIRoute = async ({ cookies }) => {
  if (!isSelectionLab) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const workerSecret = import.meta.env.SELECTION_WORKER_SECRET;
  assertSafeSupabaseEnvironment(supabaseUrl);

  if (!supabaseUrl || !workerSecret) {
    return new Response(JSON.stringify({ error: 'Selection Lab no está preparado.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const supabase = getSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) {
    return new Response(JSON.stringify({ error: 'Sesión requerida.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { data: allowed } = await supabase.rpc('is_email_in_directiva', { p_email: email });
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Permisos de directiva requeridos.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/selection-dispatch`, {
    method: 'POST',
    headers: { 'X-Selection-Worker-Secret': workerSecret },
  });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
};
