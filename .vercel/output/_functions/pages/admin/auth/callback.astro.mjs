import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../../renderers.mjs';

const $$Callback = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Verificando acceso\u2026", "showHeader": false }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-callback"> <div class="admin-callback-card"> <div id="callback-loading"> <i class="bi bi-arrow-clockwise admin-redirect-spin"></i> <h1>Verificando tu acceso…</h1> <p>Un segundo.</p> </div> <div id="callback-error" style="display:none;"> <i class="bi bi-shield-exclamation admin-callback-error-icon"></i> <h1>Acceso no autorizado</h1> <p id="callback-error-msg">Este correo no está registrado en la directiva del club.</p> <a href="/admin/login" class="hw-btn hw-btn-secondary">Volver</a> </div> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/auth/callback.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/auth/callback.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/auth/callback.astro";
const $$url = "/admin/auth/callback";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Callback,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
