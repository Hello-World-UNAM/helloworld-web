import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$MiCuentaLayout } from '../../chunks/MiCuentaLayout_B2tuJTgm.mjs';
export { renderers } from '../../renderers.mjs';

const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "MiCuentaLayout", $$MiCuentaLayout, { "title": "Iniciar Sesi\xF3n | Portal de Miembros", "showHeader": false }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-login"> <div class="admin-login-card"> <div class="admin-login-eyebrow" style="background: #a7f3d0;"> <i class="bi bi-person-badge-fill"></i> Portal de Miembros
</div> <h1>Leaderboard</h1> <p class="admin-login-sub">
Inicia sesión con tu correo para registrar y monitorear tus puntos de este semestre.
</p> <div id="login-error" class="admin-login-feedback admin-login-feedback-error" style="display: none;"></div> <button id="google-login-btn" class="hw-btn hw-btn-primary" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.5rem; background: #fff; color: #000;"> <i class="bi bi-google"></i> Continuar con Google
</button> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/mi-cuenta/login.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/mi-cuenta/login.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/mi-cuenta/login.astro";
const $$url = "/mi-cuenta/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
