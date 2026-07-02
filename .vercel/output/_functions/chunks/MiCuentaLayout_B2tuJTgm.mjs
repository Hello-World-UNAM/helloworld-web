import { e as createAstro, f as createComponent, h as addAttribute, n as renderHead, r as renderTemplate, o as renderSlot, l as renderScript } from './astro/server_SrH9OeBg.mjs';
import 'piccolore';
import 'clsx';
/* empty css                            */
import { a as getSafeSupabaseServerClient } from './supabaseServer_CGaopGZW.mjs';
/* empty css                         */

const $$Astro = createAstro("https://clubhelloworld.com");
const $$MiCuentaLayout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$MiCuentaLayout;
  const {
    title,
    description = "Portal de Miembros | Club Hello World",
    showHeader = true
  } = Astro2.props;
  let userEmail = Astro2.locals.userEmail || "";
  if (!userEmail) {
    const safeSupabase = getSafeSupabaseServerClient(Astro2.cookies);
    const { data: { session } } = await safeSupabase.auth.getSession();
    userEmail = session?.user?.email || "";
  }
  return renderTemplate`<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="description"${addAttribute(description, "content")}><meta name="theme-color" content="#1a1a2e"><link rel="icon" href="/img/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"><title>${title}</title>${renderHead()}</head> <body class="member-body" style="background: var(--color-bg); color: var(--color-text);"> ${showHeader && renderTemplate`<header class="member-header" style="background: var(--color-surface); padding: 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid var(--color-border); flex-wrap: wrap; gap: 1rem;"> <a href="/mi-cuenta" class="member-brand" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: black;"> <img src="/img/logo.png" alt="Club Hello World Logo" style="height: 35px; object-fit: contain;"> <span style="font-weight: 800; font-size: 1.2rem; letter-spacing: -0.02em;">Miembros</span> </a> <div class="member-header-right" style="display: flex; align-items: center; gap: 1rem;"> <span id="member-user-email" class="hide-on-mobile" style="font-size: 0.9rem; font-weight: 500;">${userEmail}</span> <button id="member-logout-btn" class="hw-btn hw-btn-secondary" type="button" style="padding: 0.5rem 1rem; font-size: 0.9rem;"> <i class="bi bi-box-arrow-right"></i> Salir
</button> </div> </header>`}  <main class="member-main"${addAttribute(`max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; ${showHeader ? "padding: 2rem 1rem;" : "padding: 0;"}`, "style")}> ${renderSlot($$result, $$slots["default"])} </main> ${showHeader && renderTemplate`${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/layouts/MiCuentaLayout.astro?astro&type=script&index=0&lang.ts")}`} </body> </html>`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/layouts/MiCuentaLayout.astro", void 0);

export { $$MiCuentaLayout as $ };
