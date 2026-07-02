import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../renderers.mjs';

const $$Periodos = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Gesti\xF3n de Periodos | Admin" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="admin-header-flex" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;"> <div style="flex: 1; min-width: 300px;"> <h1 class="admin-page-title" style="margin-bottom: 0.5rem;"><i class="bi bi-calendar-range"></i> Periodos y Semestres</h1> <p class="admin-page-subtitle" style="margin-bottom: 1.5rem;">Crea nuevos semestres y elige cuál es el activo actualmente.</p> <div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 1rem 1.5rem; border-radius: 4px; display: flex; gap: 1rem; align-items: flex-start;"> <i class="bi bi-info-circle-fill" style="color: #16a34a; font-size: 1.2rem; margin-top: 0.2rem;"></i> <div> <h4 style="color: #16a34a; font-weight: 800; margin: 0 0 0.3rem 0; font-size: 1rem;">El Historial es Seguro</h4> <p style="margin: 0; color: #166534; font-size: 0.95rem; font-weight: 500; line-height: 1.5;">Al marcar un semestre pasado como "Activo", los alumnos subirán evidencias amarradas a ese semestre histórico. <strong>Ningún punto pasado se perderá o sobrescribirá</strong>. Para volver a la normalidad, simplemente marca el semestre en curso como activo nuevamente.</p> </div> </div> </div> <button id="btn-new-period" class="hw-btn hw-btn-primary" style="font-size: 0.95rem; font-weight: 800; padding: 0.6rem 1.2rem; border-radius: 6px; border: 2px solid #000; box-shadow: 3px 3px 0 #000; height: fit-content;"> <i class="bi bi-plus-lg"></i> Nuevo Periodo
</button> </div> <div id="new-period-form" style="display: none; background: #fdfdfd; border: 2px dashed #000; padding: 2rem; border-radius: 8px; margin-bottom: 2rem;"> <h3 style="margin-bottom: 1rem; font-weight: 800;">Crear Nuevo Periodo</h3> <form id="form-create-period" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;"> <div style="flex: 1; min-width: 200px;"> <label style="display: block; font-weight: 700; margin-bottom: 0.4rem; font-size: 0.9rem;">ID del Periodo</label> <select id="input-period-id" required style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 2px solid #000; font-family: inherit; font-size: 1rem; background: #fff; cursor: pointer;"> <option value="2027-1">2027-1</option> <option value="2027-2">2027-2</option> <option value="2028-1">2028-1</option> <option value="2028-2">2028-2</option> <option value="2029-1">2029-1</option> </select> </div> <div style="flex: 2; min-width: 250px;"> <label style="display: block; font-weight: 700; margin-bottom: 0.4rem; font-size: 0.9rem;">Nombre Descriptivo (Automático)</label> <input type="text" id="input-period-name" readonly required style="width: 100%; padding: 0.8rem; border-radius: 6px; border: 2px solid #ddd; background: #f5f5f5; color: #666; font-family: inherit; font-size: 1rem; cursor: not-allowed;" value="Semestre 2027-1"> </div> <button type="submit" class="hw-btn hw-btn-primary" style="padding: 0.8rem 1.5rem; border: 2px solid #000; font-weight: 800; border-radius: 6px; box-shadow: 3px 3px 0 #000;">
Guardar
</button> <button type="button" id="btn-cancel-new" class="hw-btn hw-btn-secondary" style="padding: 0.8rem 1.5rem; border: 2px solid #000; font-weight: 800; border-radius: 6px;">
Cancelar
</button> </form> </div> <div id="loading" style="text-align: center; padding: 3rem;"> <i class="bi bi-arrow-clockwise admin-redirect-spin" style="font-size: 2rem;"></i> <p style="margin-top: 1rem; color: var(--color-text-muted);">Cargando periodos...</p> </div> <div id="periods-list" style="display: grid; gap: 1.5rem;"> <!-- Populated by JS --> </div> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/periodos.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/periodos.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/periodos.astro";
const $$url = "/admin/periodos";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Periodos,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
