import { d as defineMiddleware, s as sequence } from './chunks/index_D-cKhIKj.mjs';
import { g as getSupabaseServerClient } from './chunks/supabaseServer_CGaopGZW.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_CV7amaLY.mjs';
import 'piccolore';
import './chunks/astro/server_SrH9OeBg.mjs';
import 'clsx';

const onRequest$1 = defineMiddleware(async ({ url, cookies, redirect, locals }, next) => {
  const isAdminRoute = url.pathname.startsWith("/admin");
  const isMiCuentaRoute = url.pathname.startsWith("/mi-cuenta");
  if (!isAdminRoute && !isMiCuentaRoute) {
    return next();
  }
  if (url.pathname.startsWith("/api/auth/callback") || url.pathname.startsWith("/admin/auth/callback")) {
    return next();
  }
  const supabase = getSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    locals.userEmail = user.email;
  }
  if (isAdminRoute) {
    const isLoginPage = url.pathname.includes("/login");
    if (!user && !isLoginPage) {
      return redirect("/admin/login");
    }
    if (user && isLoginPage) {
      const { data: isAllowed } = await supabase.rpc("is_email_in_directiva", { p_email: user.email });
      if (isAllowed) return redirect("/admin");
    }
    if (user && !isLoginPage) {
      const { data: isAllowed } = await supabase.rpc("is_email_in_directiva", { p_email: user.email });
      if (!isAllowed) {
        return redirect("/admin/login?error=unauthorized");
      }
    }
  }
  if (isMiCuentaRoute) {
    const isLoginPage = url.pathname.includes("/login");
    if (!user && !isLoginPage) {
      return redirect("/mi-cuenta/login");
    }
    if (user && isLoginPage) {
      return redirect("/mi-cuenta");
    }
  }
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
