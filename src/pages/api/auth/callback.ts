import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabaseServer';

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';

  if (code) {
    const supabase = getSupabaseServerClient(cookies);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return redirect(next);
    } else {
      console.error("Auth callback error:", error);
    }
  }
  
  return redirect('/admin/login?error=auth_failed');
};
