import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead, h as addAttribute } from '../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_BlbbcZKv.mjs';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const valores = [
    {
      icon: "bi-trophy",
      titulo: "Mentalidad competitiva",
      desc: "El reto te activa, no te paraliza. Competir a nivel nacional es tu objetivo, no tu miedo. Empujas tus l\xEDmites porque lo disfrutas."
    },
    {
      icon: "bi-hammer",
      titulo: "Construyes sin que te lo pidan",
      desc: "Tienes proyectos que nadie encarg\xF3. Una idea que probar, algo que lanzar. La brecha entre imaginar y hacer es donde vives."
    },
    {
      icon: "bi-people-fill",
      titulo: "Distinta carrera, mismo equipo",
      desc: "C\xF3mputo, mecatr\xF3nica, electr\xF3nica \u2014 todos suman. Los mejores equipos mezclan perspectivas. T\xFA lo sabes y lo buscas."
    }
  ];
  const pasos = [
    {
      titulo: "Completa la solicitud",
      desc: "Unos 10 minutos. Honestidad ante todo \u2014 no buscamos la respuesta perfecta."
    },
    {
      titulo: "Lo revisamos con cuidado",
      desc: "Gente real, no un algoritmo. Cada solicitud la lee alguien del equipo."
    },
    {
      titulo: "Te escribimos",
      desc: "Por correo, sin importar el resultado. Siempre."
    }
  ];
  const mientrasTanto = [
    {
      icon: "bi-hammer",
      titulo: "Construye algo chiquito",
      desc: "Un proyecto terminado vale m\xE1s que diez en tu cabeza."
    },
    {
      icon: "bi-megaphone",
      titulo: "Aprende en p\xFAblico",
      desc: "Abre tu GitHub, postea lo que est\xE1s haciendo en LinkedIn."
    },
    {
      icon: "bi-trophy",
      titulo: "Compite",
      desc: "El reto te ense\xF1a en horas lo que un curso te ense\xF1ar\xEDa en meses."
    },
    {
      icon: "bi-book",
      titulo: "Lee c\xF3digo mejor que el tuyo",
      desc: "El camino m\xE1s corto para subir de nivel es estudiar a quienes ya est\xE1n m\xE1s arriba."
    }
  ];
  const redes = [
    {
      label: "Instagram",
      handle: "@helloworld_unam",
      href: "https://www.instagram.com/helloworld_unam/",
      icon: "bi-instagram"
    },
    {
      label: "LinkedIn",
      handle: "Hello World UNAM",
      href: "https://www.linkedin.com/in/hello-world-5243573b5/",
      icon: "bi-linkedin"
    },
    {
      label: "GitHub",
      handle: "Hello-World-UNAM",
      href: "https://github.com/Hello-World-UNAM",
      icon: "bi-github"
    }
  ];
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Selecci\xF3n | Club Hello World", "description": "Proceso de selecci\xF3n para nuevos integrantes del Club Hello World FES Arag\xF3n UNAM.", "activeNav": "seleccion" }, { "default": async ($$result2) => renderTemplate`  ${maybeRenderHead()}<section id="hero-open-section" class="sel-page-header" style="display:none;"> <div class="sel-page-header-inner"> <div class="sel-page-header-left"> <h1>Únete al equipo.</h1> <p>
Buscamos personas que construyan, aprendan en público y empujen lo que se creen imposible.
</p> </div> <div class="sel-page-header-right"> <span id="season-badge" class="hw-badge sel-season-badge sel-badge-open" style="transform: rotate(-1.5deg); display: inline-block;">
✦ ABIERTO
</span> <div class="sel-apply-wrap"> <a href="/seleccion/aplicar" class="sel-apply-btn">
Aplicar ahora →
</a> </div> </div> </div> </section>  <section id="hero-loading-section" class="sel-loading-section"> <div class="sel-loading-wrap"> <div class="sel-skeleton-bar" style="width:60%; height:36px;"></div> <div class="sel-skeleton-bar" style="width:80%;"></div> <div class="sel-skeleton-bar" style="width:50%;"></div> </div> </section>  <section class="seleccion-main"> <div class="container" style="max-width: 900px;"> <!-- ═══ ESTADO INTERMEDIO: EN FASE DE ENTREVISTAS ═══ --> <div id="state-interviewing" style="display:none;"> <section class="sel-closed-hero sel-interviewing-hero"> <div class="sel-closed-star" aria-hidden="true">✦</div> <div class="sel-closed-hero-inner"> <span class="sel-closed-eyebrow sel-interviewing-eyebrow"> <i class="bi bi-people-fill"></i> En fase de entrevistas
</span> <h1 class="sel-closed-title">Las inscripciones<br><span>ya cerraron.</span></h1> <p class="sel-closed-subtitle">
Estamos entrevistando a los seleccionados de esta temporada. Si llegaste hasta aquí, mantente cerca: cuando se abra la próxima convocatoria, lo anunciaremos por nuestras redes.
</p> </div> </section> <div class="sel-closed-quote-block"> <span class="sel-closed-quote-mark" aria-hidden="true">"</span> <p>
Lo que hace especial a quien entra al club no es <em>cuándo</em> aplica.<br>
Es lo que ya estaba haciendo antes de saber que existíamos.
</p> </div> <div class="sel-closed-redes-card"> <div class="sel-closed-redes-header"> <h2>Mantente cerca</h2> <p>Anunciamos la próxima convocatoria por aquí primero.</p> </div> <div class="sel-closed-redes-grid"> ${redes.map((r) => renderTemplate`<a${addAttribute(r.href, "href")} target="_blank" rel="noopener noreferrer" class="sel-closed-red-card"> <div class="sel-closed-red-icon"> <i${addAttribute(`bi ${r.icon}`, "class")}></i> </div> <div class="sel-closed-red-text"> <span class="sel-closed-red-label">${r.label}</span> <span class="sel-closed-red-handle">${r.handle}</span> </div> <i class="bi bi-arrow-up-right sel-closed-red-arrow"></i> </a>`)} </div> </div> <div class="sel-closed-farewell"> <p class="sel-closed-farewell-line">
Nos vemos pronto.<br> <strong>Sigue construyendo.</strong> </p> <p class="sel-closed-farewell-sign">— El equipo de Hello World</p> </div> </div> <!-- ═══ ESTADO CERRADO ═══ --> <div id="state-closed" style="display:none;"> <!-- Hero cerrado con estrella flotante --> <section class="sel-closed-hero"> <div class="sel-closed-star" aria-hidden="true">✦</div> <div class="sel-closed-hero-inner"> <span class="sel-closed-eyebrow"> <i class="bi bi-moon-stars-fill"></i> Convocatoria cerrada
</span> <h1 class="sel-closed-title">El semestre próximo<br><span>te esperamos.</span></h1> <p class="sel-closed-subtitle">
Mientras tanto, sigue construyendo. El club no es el destino — es un punto en el camino.
</p> </div> </section> <!-- Quote / manifesto --> <div class="sel-closed-quote-block"> <span class="sel-closed-quote-mark" aria-hidden="true">"</span> <p>
Lo que hace especial a quien entra al club no es <em>cuándo</em> aplica.<br>
Es lo que ya estaba haciendo antes de saber que existíamos.
</p> </div> <!-- Mientras tanto --> <div class="section-card sel-closed-mientras"> <h2> <span class="icon"><i class="bi bi-stars"></i></span>
Mientras tanto
</h2> <p class="sel-closed-mientras-sub">
Cuatro cosas que puedes hacer hoy. Útiles entres o no al club.
</p> <div class="sel-closed-mientras-grid"> ${mientrasTanto.map((m) => renderTemplate`<div class="sel-closed-mientras-card"> <div class="sel-closed-mientras-icon"> <i${addAttribute(`bi ${m.icon}`, "class")}></i> </div> <h3>${m.titulo}</h3> <p>${m.desc}</p> </div>`)} </div> </div> <!-- Mantente cerca / redes --> <div class="sel-closed-redes-card"> <div class="sel-closed-redes-header"> <h2>Mantente cerca</h2> <p>Anunciamos la próxima convocatoria por aquí primero. Síguenos donde te quede mejor.</p> </div> <div class="sel-closed-redes-grid"> ${redes.map((r) => renderTemplate`<a${addAttribute(r.href, "href")} target="_blank" rel="noopener noreferrer" class="sel-closed-red-card"> <div class="sel-closed-red-icon"> <i${addAttribute(`bi ${r.icon}`, "class")}></i> </div> <div class="sel-closed-red-text"> <span class="sel-closed-red-label">${r.label}</span> <span class="sel-closed-red-handle">${r.handle}</span> </div> <i class="bi bi-arrow-up-right sel-closed-red-arrow"></i> </a>`)} </div> </div> <!-- Cierre cálido --> <div class="sel-closed-farewell"> <p class="sel-closed-farewell-line">
Nos vemos pronto.<br> <strong>Sigue construyendo.</strong> </p> <p class="sel-closed-farewell-sign">— El equipo de Hello World</p> </div> </div> <!-- ═══ ESTADO ABIERTO ═══ --> <div id="state-open" style="display:none;"> <!-- Filosofía --> <div class="section-card"> <div class="objetivo-general-block"> <p style="font-family: 'Playfair Display', serif; font-style: italic; font-size: 1.25rem;">
"No buscamos el promedio más alto. Buscamos a quien quiera competir, construir cosas reales y dejar huella desde la UNAM."
</p> </div> </div> <!-- ¿Eres de los nuestros? --> <div class="section-card"> <h2> <span class="icon"><i class="bi bi-stars"></i></span>
¿Eres de los nuestros?
</h2> <p style="margin-bottom: 24px; color: #666; font-size: 0.95rem; line-height: 1.6;">
Esto describe a quien buscamos.
</p> <div class="sel-valores-grid"> ${valores.map((v) => renderTemplate`<div class="sel-valor-card"> <div class="sel-valor-icon"> <i${addAttribute(`bi ${v.icon}`, "class")}></i> </div> <h3>${v.titulo}</h3> <p>${v.desc}</p> </div>`)} </div> </div> <!-- El proceso --> <div class="section-card"> <h2> <span class="icon"><i class="bi bi-list-ol"></i></span>
El proceso
</h2> <p style="margin-bottom: 20px; color: #666; font-size: 0.95rem; line-height: 1.6;">
Sin sustos. Solo tres pasos.
</p> <ol class="sel-steps"> ${pasos.map((paso) => renderTemplate`<li> <div> <strong>${paso.titulo}</strong><br> ${paso.desc} </div> </li>`)} </ol> </div> <!-- CTA --> <div class="cta-section"> <h2>¿Listo para unirte?</h2> <p>La solicitud toma unos 10 minutos. Sin trampa, sin sustos.</p> <div class="cta-actions"> <a href="/seleccion/aplicar" class="hw-btn hw-btn-primary">
Completar solicitud →
</a> </div> </div> </div> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/index.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/index.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/index.astro";
const $$url = "/seleccion";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
