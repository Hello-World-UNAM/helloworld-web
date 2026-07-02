import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$Layout } from '../../chunks/Layout_BlbbcZKv.mjs';
export { renderers } from '../../renderers.mjs';

const $$Agendar = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Agendar entrevista | Club Hello World", "description": "Reserva tu entrevista con el Club Hello World.", "activeNav": "seleccion" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="sel-page-header agendar-hero"> <div class="sel-page-header-inner"> <div class="sel-page-header-left"> <h1>Agenda tu entrevista.</h1> <p id="agendar-hero-sub">Elige el día y la hora que mejor te quede.</p> </div> <div class="sel-page-header-right"> <span class="hw-badge sel-badge-open sel-season-badge" style="transform: rotate(-1.5deg);">
✦ ENTREVISTA
</span> </div> </div> </section> <section class="seleccion-main"> <div class="container" style="max-width: 880px;"> <a href="/seleccion" class="sel-back-link"> <i class="bi bi-arrow-left"></i> Volver a Selección
</a> <!-- Loading inicial --> <div id="agendar-loading" class="sel-aplicar-loading"> <i class="bi bi-arrow-clockwise admin-redirect-spin"></i> <p>Validando tu invitación…</p> </div> <!-- Estado: token inválido --> <div id="state-invalid" class="agendar-state-card" style="display:none;"> <i class="bi bi-shield-exclamation agendar-state-icon"></i> <h2>Invitación no válida</h2> <p id="invalid-msg">El enlace que usaste no es válido o ya expiró.</p> <p>Si crees que es un error, escríbenos a <a href="mailto:contacto@helloworld-unam.tech">contacto@helloworld-unam.tech</a>.</p> <a href="/seleccion" class="hw-btn hw-btn-secondary">Volver al inicio</a> </div> <!-- Estado: ya tiene entrevista agendada --> <div id="state-booked" class="agendar-state-card" style="display:none;"> <i class="bi bi-check-circle-fill agendar-state-icon agendar-state-icon-success"></i> <h2>Tu entrevista está agendada.</h2> <p>Te esperamos el <strong id="booked-when">—</strong>.</p> <div class="agendar-meet-row"> <span class="agendar-meet-label">Tu enlace de Meet:</span> <a id="booked-meet-link" href="#" target="_blank" rel="noopener noreferrer" class="agendar-meet-link">—</a> </div> <p class="agendar-reschedule-note" id="reschedule-note">
Si necesitas cambiar de horario, puedes hacerlo abajo.
</p> <div class="agendar-booked-actions"> <button type="button" id="btn-reschedule" class="hw-btn hw-btn-secondary">
Reagendar →
</button> <button type="button" id="btn-cancel" class="admin-action-btn admin-action-btn-danger"> <i class="bi bi-x-circle"></i> Cancelar entrevista
</button> </div> </div> <!-- Estado: sin slots disponibles --> <div id="state-no-slots" class="agendar-state-card" style="display:none;"> <i class="bi bi-calendar-x agendar-state-icon"></i> <h2>Sin horarios disponibles</h2> <p>Todos los espacios están ocupados o aún no se han abierto. Escríbenos para resolver esto:</p> <a href="mailto:contacto@helloworld-unam.tech" class="hw-btn hw-btn-primary">
Escribir al equipo
</a> </div> <!-- Estado: selector activo --> <div id="state-picker" style="display:none;"> <!-- Banner de bienvenida --> <div class="agendar-welcome" id="agendar-welcome"> <span class="agendar-welcome-eyebrow">✓ Avanzaste a la siguiente fase</span> <h2 id="welcome-name">Hola.</h2> <p>Elige el día que mejor te quede y luego un horario disponible.</p> </div> <!-- Selector de día --> <div class="section-card agendar-step"> <h3 class="agendar-step-title"> <span class="agendar-step-num">1</span>
¿Qué día?
</h3> <div id="day-cards" class="agendar-day-cards"></div> </div> <!-- Selector de hora --> <div class="section-card agendar-step" id="hour-section" style="display:none;"> <h3 class="agendar-step-title"> <span class="agendar-step-num">2</span>
¿A qué hora?
</h3> <p class="agendar-step-sub" id="hour-section-sub">—</p> <div id="hour-grid" class="agendar-hour-grid"></div> </div> <!-- Confirmación --> <div class="section-card agendar-step agendar-confirm-card" id="confirm-section" style="display:none;"> <h3 class="agendar-step-title"> <span class="agendar-step-num">3</span>
Confirma
</h3> <div class="agendar-confirm-summary"> <div class="agendar-confirm-line"> <i class="bi bi-calendar-event"></i> <span id="confirm-when">—</span> </div> <div class="agendar-confirm-line"> <i class="bi bi-clock"></i> <span id="confirm-duration">—</span> </div> <div class="agendar-confirm-line"> <i class="bi bi-camera-video"></i> <span>Por Google Meet (recibirás el enlace por correo)</span> </div> </div> <div class="agendar-confirm-actions"> <button type="button" id="btn-confirm-cancel" class="hw-btn hw-btn-secondary">
Cambiar
</button> <button type="button" id="btn-confirm" class="hw-btn hw-btn-primary">
Confirmar entrevista →
</button> </div> <div id="confirm-feedback" class="admin-save-feedback" style="display:none;"></div> </div> </div> <!-- Estado: éxito final --> <div id="state-success" class="agendar-success-screen" style="display:none;"> <div class="agendar-success-inner"> <span class="agendar-success-eyebrow"> <span class="sel-success-check">✓</span> Listo
</span> <h2>Te esperamos.</h2> <p class="agendar-success-when" id="success-when">—</p> <p class="agendar-success-msg">
Te enviamos un correo con tu enlace de Google Meet y los detalles. Si surge algo, escríbenos con al menos 12 h de anticipación.
</p> </div> </div> <canvas id="confetti-canvas" class="sel-confetti-canvas" aria-hidden="true"></canvas> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/agendar.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/agendar.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/seleccion/agendar.astro";
const $$url = "/seleccion/agendar";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Agendar,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
