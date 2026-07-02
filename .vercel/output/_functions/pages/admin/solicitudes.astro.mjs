import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Solicitudes \xB7 Panel Hello World" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-list"> <!-- Auth guard placeholder — se evalúa en JS --> <div id="admin-list-loading" class="admin-redirect"> <i class="bi bi-arrow-clockwise admin-redirect-spin"></i> <p>Cargando…</p> </div> <div id="admin-list-content" style="display:none;"> <!-- Header --> <div class="admin-list-header"> <div> <h1>Solicitudes</h1> <p class="admin-list-subtitle">
Temporada <strong id="active-season">—</strong> <span id="historical-badge" class="admin-historical-badge" style="display:none;"> <i class="bi bi-archive-fill"></i> Histórico · sólo lectura
</span> </p> </div> <div class="admin-list-header-actions"> <select id="season-filter" class="admin-select"></select> <a href="/admin/seleccion-config" class="admin-action-btn"> <i class="bi bi-gear-fill"></i> Configurar
</a> <a href="/admin/entrevistas" class="admin-action-btn"> <i class="bi bi-calendar-week"></i> Entrevistas
</a> <button id="btn-export" type="button" class="admin-action-btn"> <i class="bi bi-download"></i> CSV
</button> <button id="btn-cierre" type="button" class="admin-action-btn admin-action-btn-primary" disabled> <i class="bi bi-send-fill"></i> Cierre de inscripciones
</button> </div> </div> <!-- Status counters --> <div class="admin-stats" id="admin-stats"> <button data-status="all" class="admin-stat admin-stat-active"> <span class="admin-stat-num" id="count-all">0</span> <span class="admin-stat-label">Total</span> </button> <button data-status="pending" class="admin-stat"> <span class="admin-stat-num" id="count-pending">0</span> <span class="admin-stat-label">Pendientes</span> </button> <button data-status="reviewing" class="admin-stat"> <span class="admin-stat-num" id="count-reviewing">0</span> <span class="admin-stat-label">En revisión</span> </button> <button data-status="accepted" class="admin-stat"> <span class="admin-stat-num" id="count-accepted">0</span> <span class="admin-stat-label">Aceptados</span> </button> <button data-status="rejected" class="admin-stat"> <span class="admin-stat-num" id="count-rejected">0</span> <span class="admin-stat-label">Rechazados</span> </button> </div> <!-- Search --> <div class="admin-search-wrap"> <i class="bi bi-search admin-search-icon"></i> <input type="search" id="admin-search" class="admin-search" placeholder="Buscar por nombre, correo o carrera…" autocomplete="off"> </div> <!-- Table --> <div class="admin-table-wrap"> <table class="admin-table"> <thead> <tr> <th>Nombre</th> <th>Carrera</th> <th class="admin-th-num">Sem.</th> <th>Estado</th> <th>Recibida</th> <th class="admin-th-actions"></th> </tr> </thead> <tbody id="admin-tbody"> <tr><td colspan="6" class="admin-empty">Cargando…</td></tr> </tbody> </table> </div> <p class="admin-list-foot" id="admin-list-foot"></p> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/solicitudes/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/solicitudes/index.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/solicitudes/index.astro";
const $$url = "/admin/solicitudes";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
