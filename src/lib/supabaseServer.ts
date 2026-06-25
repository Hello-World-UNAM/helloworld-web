import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function getSupabaseServerClient(cookies: any): SupabaseClient<Database> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase env vars.');
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(key: string) {
        return cookies.get(key)?.value;
      },
      set(key: string, value: string, options: any) {
        cookies.set(key, value, options);
      },
      remove(key: string, options: any) {
        cookies.delete(key, options);
      },
    },
  });
}

// Cliente seguro para Layouts y Componentes: NO intenta modificar cookies,
// evitando así el AstroError: ResponseSentError.
export function getSafeSupabaseServerClient(cookies: any): SupabaseClient<Database> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(key: string) { return cookies.get(key)?.value; },
      set() { /* ignorar para evitar ResponseSentError */ },
      remove() { /* ignorar para evitar ResponseSentError */ },
    },
  });
}
