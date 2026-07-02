import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../renderers.mjs';

const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Acceso \xB7 Panel Hello World", "showHeader": false }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-login"> <div class="admin-login-card"> <div class="admin-login-eyebrow"> <i class="bi bi-shield-lock-fill"></i> Acceso restringido
</div> <h1>Panel interno</h1> <p class="admin-login-sub">
Acceso exclusivo para miembros de la mesa directiva. Inicia sesión con tu cuenta institucional.
</p> <div id="admin-login-feedback" class="admin-login-feedback" style="display:none;"></div> <button id="google-login-btn" class="hw-btn hw-btn-primary" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.5rem; background: #fff; color: #000;"> <i class="bi bi-google"></i> Continuar con Google
</button> <p class="admin-login-tip" style="margin-top: 1.5rem;"> <i class="bi bi-info-circle"></i>
Si no cuentas con los permisos necesarios, el acceso será denegado.
</p> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/login.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/login.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/login.astro";
const $$url = "/admin/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
