import { e as createAstro, f as createComponent, h as addAttribute, n as renderHead, r as renderTemplate, o as renderSlot, l as renderScript } from './astro/server_SrH9OeBg.mjs';
import 'piccolore';
import 'clsx';
/* empty css                            */
import { a as getSafeSupabaseServerClient } from './supabaseServer_CGaopGZW.mjs';

const $$Astro = createAstro("https://clubhelloworld.com");
const $$AdminLayout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$AdminLayout;
  const {
    title,
    description = "Panel interno del Club Hello World",
    showHeader = true
  } = Astro2.props;
  let userEmail = Astro2.locals.userEmail || "";
  if (!userEmail) {
    const safeSupabase = getSafeSupabaseServerClient(Astro2.cookies);
    const { data: { session } } = await safeSupabase.auth.getSession();
    userEmail = session?.user?.email || "";
  }
  return renderTemplate`<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"${addAttribute(description, "content")}><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#6225e6"><link rel="icon" href="/img/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"><title>${title}</title>${renderHead()}</head> <body class="admin-body" id="admin-body"> ${showHeader && renderTemplate`<header class="admin-header"> <div class="admin-header-inner"> <a href="/admin" class="admin-brand" style="display: flex; align-items: center; gap: 0.8rem; text-decoration: none;"> <div style="background: #fff; padding: 4px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 0 #000;"> <img src="/img/logo.png" alt="Club Hello World Logo" style="height: 30px; object-fit: contain;"> </div> <span class="admin-brand-text" style="color: #fff; text-transform: uppercase;"> <strong style="font-size: 1.1rem; letter-spacing: 1px;">Mesa Directiva</strong> </span> </a> <div class="admin-header-right"> <span id="admin-user-email" class="admin-user-email">${userEmail}</span> <button id="admin-logout-btn" class="admin-logout-btn" type="button"> <i class="bi bi-box-arrow-right"></i> Salir
</button> </div> </div> </header>`} <main class="admin-main" aria-label="Panel de administración"> ${renderSlot($$result, $$slots["default"])} </main> ${showHeader && renderTemplate`${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/layouts/AdminLayout.astro?astro&type=script&index=0&lang.ts")}`} </body> </html>`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/layouts/AdminLayout.astro", void 0);

export { $$AdminLayout as $ };
