import { defineMiddleware } from 'astro:middleware';
import { getSupabaseServerClient } from './lib/supabaseServer';

export const onRequest = defineMiddleware(async ({ url, cookies, redirect, locals }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin');
  const isMiCuentaRoute = url.pathname.startsWith('/mi-cuenta');
  
  // Solo aplicar auth guard en las rutas privadas
  if (!isAdminRoute && !isMiCuentaRoute) {
    return next();
  }
  
  // Excluir callbacks para evitar loops infinitos
  if (url.pathname.startsWith('/api/auth/callback') || url.pathname.startsWith('/admin/auth/callback')) {
    return next();
  }

  // Verificar la sesión usando getUser() que contacta al servidor Supabase.
  // Hacer esto en el Middleware evita el "ResponseSentError" porque aquí
  // se permite actualizar las cookies de sesión (refresh) antes de que 
  // Astro empiece a enviar el HTML al cliente.
  const supabase = getSupabaseServerClient(cookies);
  const { data: { user } } = await supabase.auth.getUser();

  // Guardar el email en locals para que los Layouts puedan leerlo sin tener 
  // que hacer otra petición a la base de datos y correr el riesgo de fallar.
  if (user) {
    locals.userEmail = user.email;
  }

  // --- Lógica para el Panel de Administración ---
  if (isAdminRoute) {
    const isLoginPage = url.pathname.includes('/login');
    
    // 1. Redirigir a login si no hay usuario
    if (!user && !isLoginPage) {
      return redirect('/admin/login');
    }
    
    // 2. Si ya hay usuario y estamos en el login, mandarlo al index
    if (user && isLoginPage) {
      // Necesitamos validar que de verdad sea un admin antes de redirigir
      const { data: isAllowed } = await supabase.rpc('is_email_in_directiva', { p_email: user.email });
      if (isAllowed) return redirect('/admin');
    }
    
    // 3. Validar permisos de Directiva para el resto de rutas protegidas
    if (user && !isLoginPage) {
      const { data: isAllowed } = await supabase.rpc('is_email_in_directiva', { p_email: user.email });
      if (!isAllowed) {
        return redirect('/admin/login?error=unauthorized');
      }
    }
  }

  // --- Lógica para el Portal de Miembros ---
  if (isMiCuentaRoute) {
    const isLoginPage = url.pathname.includes('/login');
    
    if (!user && !isLoginPage) {
      return redirect('/mi-cuenta/login');
    }
    if (user && isLoginPage) {
      return redirect('/mi-cuenta');
    }
  }

  return next();
});
