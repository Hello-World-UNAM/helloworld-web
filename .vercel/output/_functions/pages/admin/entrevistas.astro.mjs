import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../renderers.mjs';

const $$Entrevistas = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Entrevistas \xB7 Panel Hello World" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-interviews"> <div id="entrevistas-loading" class="admin-redirect"> <i class="bi bi-arrow-clockwise admin-redirect-spin"></i> <p>Cargando…</p> </div> <div id="entrevistas-content" style="display:none;"> <div class="admin-list-header"> <div> <h1>Entrevistas</h1> <p class="admin-list-subtitle">Temporada <strong id="active-season">—</strong></p> </div> <div class="admin-list-header-actions"> <a href="/admin/solicitudes?view=1" class="admin-action-btn"> <i class="bi bi-list-ul"></i> Ver solicitudes
</a> <a href="/admin/seleccion-config" class="admin-action-btn"> <i class="bi bi-gear-fill"></i> Configurar
</a> <button id="btn-bulk-final" type="button" class="admin-action-btn admin-action-btn-primary" disabled> <i class="bi bi-send-fill"></i> Enviar resultados finales
</button> </div> </div> <!-- Stats: estado entrevistas + decisión final --> <div id="entrevistas-stats" class="admin-stats admin-stats-extended"> <div class="admin-stat"> <span class="admin-stat-num" id="stat-total">0</span> <span class="admin-stat-label">Pasaron forms</span> </div> <div class="admin-stat"> <span class="admin-stat-num" id="stat-evaluated">0</span> <span class="admin-stat-label">Evaluados</span> </div> <div class="admin-stat"> <span class="admin-stat-num" id="stat-accepted-final">0</span> <span class="admin-stat-label">Aceptados</span> </div> <div class="admin-stat"> <span class="admin-stat-num" id="stat-rejected-final">0</span> <span class="admin-stat-label">Rechazados</span> </div> <div class="admin-stat"> <span class="admin-stat-num" id="stat-pending">0</span> <span class="admin-stat-label">Pendientes</span> </div> </div> <!-- Periodo de agendado (antes del deadline) --> <div id="booking-phase-section" style="display:none;"> <div id="booking-phase-banner"></div> <div id="booking-with-interview"></div> <div id="booking-without-interview"></div> </div> <!-- Agenda por día (post-deadline) --> <div id="agenda-by-day" class="admin-agenda-days"></div> <!-- Solicitudes accepted sin entrevista --> <section id="no-interview-section" style="display:none;" class="admin-agenda-day"> <h2 class="admin-agenda-day-header admin-agenda-day-header-warning"> <i class="bi bi-exclamation-circle"></i> Sin entrevista agendada
<span class="admin-agenda-day-count" id="no-interview-count">0</span> </h2> <p class="admin-no-interview-hint">
Estos candidatos pasaron el formulario pero nunca agendaron entrevista. Requieren decisión manual.
</p> <div class="admin-agenda-list" id="no-interview-list"></div> </section> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/entrevistas.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/entrevistas.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/entrevistas.astro";
const $$url = "/admin/entrevistas";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Entrevistas,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
