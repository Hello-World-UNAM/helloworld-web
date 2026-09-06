import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { assertSafeSupabaseEnvironment } from './selection-lab';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

assertSafeSupabaseEnvironment(url);

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Check .env file (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createBrowserClient<Database>(url, anonKey);
