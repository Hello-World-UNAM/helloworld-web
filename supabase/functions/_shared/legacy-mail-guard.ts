import { createClient } from "npm:@supabase/supabase-js@2.105.4";

/** Fail closed. Deploy before activation; all new mail must use the durable queue. */
export async function legacyMailAllowed(): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await db.from("seleccion_config").select("progressive_enabled").eq("id", true).single();
    return !error && data?.progressive_enabled === false;
  } catch { return false; }
}
