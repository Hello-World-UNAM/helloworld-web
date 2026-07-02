import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Panel Principal \xB7 Hello World" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div style="max-width: 900px; margin: 0 auto; padding: 2rem 1rem;"> <div style="margin-bottom: 3rem;"> <h1 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: -1px;">Panel de Administración</h1> <p style="color: #555; font-size: 1.1rem; font-weight: 500;">Selecciona el módulo que deseas gestionar.</p> </div> <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;"> <!-- Leaderboard Card --> <div style="background: #fff; padding: 2.5rem; border: 4px solid #000; box-shadow: 8px 8px 0 #6225e6; display: flex; flex-direction: column; height: 100%;"> <div style="margin-bottom: auto;"> <h2 style="font-size: 1.8rem; font-weight: 900; text-transform: uppercase; margin-bottom: 1rem;"><i class="bi bi-trophy-fill" style="color: #6225e6;"></i> Leaderboard</h2> <p style="color: #444; font-size: 1rem; font-weight: 500; line-height: 1.5; margin-bottom: 2rem;">Revisa las evidencias subidas por los miembros activos, aprueba o rechaza puntos y mantén el ranking actualizado.</p> </div> <div style="display: flex; gap: 1rem; flex-direction: column;"> <a href="/admin/leaderboard" class="hw-btn hw-btn-primary" style="text-align: center; display: block; width: 100%;">Gestionar Evidencias</a> <a href="/admin/periodos" class="hw-btn hw-btn-secondary" style="text-align: center; display: block; width: 100%;">Administrar Semestres</a> </div> </div> <!-- Selección Card --> <div style="background: #fff; padding: 2.5rem; border: 4px solid #000; box-shadow: 8px 8px 0 #000; display: flex; flex-direction: column; height: 100%;"> <div style="margin-bottom: auto;"> <h2 style="font-size: 1.8rem; font-weight: 900; text-transform: uppercase; margin-bottom: 1rem;"><i class="bi bi-person-lines-fill"></i> Selecciones</h2> <p style="color: #444; font-size: 1rem; font-weight: 500; line-height: 1.5; margin-bottom: 2rem;">Abre o cierra convocatorias, revisa solicitudes de aspirantes y gestiona el proceso de reclutamiento.</p> </div> <div style="display: flex; gap: 1rem; flex-direction: column;"> <a href="/admin/solicitudes" class="hw-btn hw-btn-secondary" style="text-align: center; display: block; width: 100%;">Ver Solicitudes</a> <a href="/admin/seleccion-config" class="hw-btn hw-btn-primary" style="text-align: center; display: block; width: 100%; background: #000; color: #fff;">Configurar Temporada</a> </div> </div> <!-- Miembros Card --> <div style="background: #fff; padding: 2.5rem; border: 4px solid #000; box-shadow: 8px 8px 0 #6225e6; display: flex; flex-direction: column; height: 100%;"> <div style="margin-bottom: auto;"> <h2 style="font-size: 1.8rem; font-weight: 900; text-transform: uppercase; margin-bottom: 1rem;"><i class="bi bi-people-fill" style="color: #6225e6;"></i> Miembros</h2> <p style="color: #444; font-size: 1rem; font-weight: 500; line-height: 1.5; margin-bottom: 2rem;">Gestiona el directorio de miembros del club. Añade nuevos miembros, actualiza su información o elimínalos.</p> </div> <a href="/admin/miembros" class="hw-btn hw-btn-primary" style="text-align: center; display: block; width: 100%;">Directorio de Miembros →</a> </div> </div> </div> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/index.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/index.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
