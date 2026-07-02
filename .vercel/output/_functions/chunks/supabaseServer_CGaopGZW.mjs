import { createServerClient } from '@supabase/ssr';

function getSupabaseServerClient(cookies) {
  const url = "https://hzewxtimkbxljozyrafk.supabase.co";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZXd4dGlta2J4bGpvenlyYWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxODk3NjUsImV4cCI6MjA5Mzc2NTc2NX0.FVA9kI7d2S_nXiyGzugC348Upl668B5iodP1OR8whFw";
  return createServerClient(url, anonKey, {
    cookies: {
      get(key) {
        return cookies.get(key)?.value;
      },
      set(key, value, options) {
        cookies.set(key, value, options);
      },
      remove(key, options) {
        cookies.delete(key, options);
      }
    }
  });
}
function getSafeSupabaseServerClient(cookies) {
  const url = "https://hzewxtimkbxljozyrafk.supabase.co";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6ZXd4dGlta2J4bGpvenlyYWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxODk3NjUsImV4cCI6MjA5Mzc2NTc2NX0.FVA9kI7d2S_nXiyGzugC348Upl668B5iodP1OR8whFw";
  return createServerClient(url, anonKey, {
    cookies: {
      get(key) {
        return cookies.get(key)?.value;
      },
      set() {
      },
      remove() {
      }
    }
  });
}

export { getSafeSupabaseServerClient as a, getSupabaseServerClient as g };
