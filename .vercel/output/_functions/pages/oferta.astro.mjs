import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_BlbbcZKv.mjs';
export { renderers } from '../renderers.mjs';

const hackathones = [{"title":"Deloitte: Hack & Defend","tag":"Hackathon","date":"📅 12 Mar 2026 · CDMX","description":"Deloitte te invita al Hackathon: Hack and Defend. Una oportunidad única para poner a prueba tus habilidades en hacking ético, análisis forense e inteligencia de amenazas, ¡acompañado de verdaderos ciberexpertos!","url":"https://encuestas.deloittemx.com/Answer/AnswerPoll.aspx?token=brqYcbS7i3gqb7LKbA9pVT4ZxBeT","accent":"#c8a96e"},{"title":"HackHW: 24h Build","tag":"Hackathon","date":"📅 5 Abr 2026 · Campus Central","description":"Construye un proyecto en 24 horas. Premios y menciones para los mejores equipos.","url":"https://ejemplo.com/evento3","accent":"#c86e9a"},{"title":"Hello World Open Night","tag":"Hackathon","date":"📅 18 Abr 2026 · Sala de Cómputo","description":"Sesión abierta para nuevos miembros. Conoce al equipo y resuelve tu primer reto de programación competitiva.","url":"https://ejemplo.com/evento4","accent":"#8bc86e"}];
const cursos = [{"title":"GCI World - Matsuo Iwasawa Lab UTokyo","tag":"Curso","date":"📅 Límite de Registro: 2 Abr 2026 · Online","description":"El curso GCI Global, desarrollado por el Laboratorio Matsuo-Iwasawa de la Universidad de Tokio, ofrece formación integral en ciencia de datos, desde fundamentos de Python hasta su aplicación en entornos empresariales.","url":"https://weblab.t.u-tokyo.ac.jp/en/lecture/gci/","accent":"#6eb5c8"},{"title":"Taller de Algoritmos Avanzados","tag":"Curso","date":"📅 22 Mar 2026 · Online","description":"Sesión intensiva sobre grafos, DP y estructuras de datos para competencias de programación.","url":"https://ejemplo.com/evento2","accent":"#c8a96e"},{"title":"HackHW: 24h Build","tag":"Curso","date":"📅 5 Abr 2026 · Campus Central","description":"Construye un proyecto en 24 horas. Premios y menciones para los mejores equipos.","url":"https://ejemplo.com/evento3","accent":"#c86e9a"}];
const eventos = [{"title":"Beca Talent Land México 2026","tag":"Evento","date":"📅 Abril 2026 · Santa Fe, CDMX","description":"Conferencias con ponentes nacionales e internacionales, espacios de networking, vinculación con empresas y ecosistemas de innovación en tecnología, ciencia e innovación.","url":"https://becas.talent-land.mx/secihti?utm_source=talent-comms&utm_medium=email&utm_campaign=becas-innovacion-federal-1&utm_content=2d95748a-4a0f-4932-8d72-398a460bca00","accent":"#c8a96e"},{"title":"ICPC Regional 2026","tag":"Evento","date":"📅 15 Mar 2026 · CDMX, México","description":"Clasificatorio regional para el ICPC World Finals. Equipos de 3 integrantes resuelven problemas de algoritmia bajo presión de tiempo.","url":"https://ejemplo.com/evento1","accent":"#6eb5c8"},{"title":"Hello World Open Night","tag":"Evento","date":"📅 18 Abr 2026 · Sala de Cómputo","description":"Sesión abierta para nuevos miembros. Conoce al equipo y resuelve tu primer reto de programación competitiva.","url":"https://ejemplo.com/evento4","accent":"#8bc86e"}];
const eventsData = {
  hackathones,
  cursos,
  eventos,
};

const $$Oferta = createComponent(($$result, $$props, $$slots) => {
  const { hackathones, cursos, eventos } = eventsData;
  const sections = [
    { title: "Hackathones", items: hackathones },
    { title: "Cursos", items: cursos },
    { title: "Eventos", items: eventos }
  ];
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Oferta | Club Hello World", "activeNav": "oferta" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="events-section"> <h1 class="events-title">Próximos Eventos</h1> ${sections.map((section) => renderTemplate`<div class="carousel-block"> <h3 class="events-subtitle">${section.title}</h3> <div class="carousel-wrapper"> <button class="carousel-btn prev" aria-label="Anterior">&#8592;</button> <div class="cards-grid"> ${section.items.map((item) => renderTemplate`<div class="card"${addAttribute(`--accent:${item.accent}`, "style")}${addAttribute(item.url, "data-url")}> <div class="card-tag">${item.tag}</div> <div class="card-title">${item.title}</div> <div class="card-date">${item.date}</div> <div class="card-desc">${item.description}</div> <div class="card-arrow">Abrir ↗️</div> </div>`)} </div> <button class="carousel-btn next" aria-label="Siguiente">&#8594;</button> </div> </div>`)} </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/oferta.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/oferta.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/oferta.astro";
const $$url = "/oferta";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Oferta,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
