import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_BlbbcZKv.mjs';
/* empty css                                   */
export { renderers } from '../renderers.mjs';

const $$Ranking = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Ranking | Club Hello World", "activeNav": "ranking", "data-astro-cid-2edc6foj": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="ranking-section" data-astro-cid-2edc6foj> <h1 class="ranking-title" data-astro-cid-2edc6foj>Leaderboard</h1> <p class="ranking-subtitle" data-astro-cid-2edc6foj>Nuestros miembros acumulan puntos al completar cursos, certificaciones y eventos. Los más destacados obtienen reconocimientos e incentivos cada semestre.</p> <div id="loading-ranking" style="text-align: center; padding: 4rem 0;" data-astro-cid-2edc6foj> <i class="bi bi-arrow-clockwise admin-redirect-spin" style="font-size: 2rem;" data-astro-cid-2edc6foj></i> <p style="margin-top: 1rem; color: var(--color-text-muted);" data-astro-cid-2edc6foj>Cargando posiciones...</p> </div> <!-- Podio --> <div class="podium" id="podium" style="display: none;" data-astro-cid-2edc6foj> <!-- Inyectado por JS --> </div> <!-- Tabla --> <div id="ranking-list-section" style="display: none;" data-astro-cid-2edc6foj> <div id="table-wrap" class="table-collapsed" data-astro-cid-2edc6foj> <table class="ranking-table" data-astro-cid-2edc6foj> <thead data-astro-cid-2edc6foj> <tr data-astro-cid-2edc6foj> <th data-astro-cid-2edc6foj>#</th> <th data-astro-cid-2edc6foj>Participante</th> <th data-astro-cid-2edc6foj>Progreso</th> <th data-astro-cid-2edc6foj>Puntos</th> </tr> </thead> <tbody id="ranking-tbody" data-astro-cid-2edc6foj> <!-- Inyectado por JS --> </tbody> </table> </div> <div class="btn-wrap" id="show-more-wrap" style="display: none;" data-astro-cid-2edc6foj> <button id="show-more-btn" class="hw-btn hw-btn-secondary" data-astro-cid-2edc6foj>Ver más miembros ▼</button> </div> </div> </div> ` })}  ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/ranking.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/ranking.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/ranking.astro";
const $$url = "/ranking";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Ranking,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
