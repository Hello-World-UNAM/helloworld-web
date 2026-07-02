import { f as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_SrH9OeBg.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_RuqIj_rO.mjs';
export { renderers } from '../../renderers.mjs';

const $$SeleccionConfig = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Selecciones \xB7 Panel Hello World" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<section class="admin-config"> <div id="config-loading" class="admin-redirect"> <i class="bi bi-arrow-clockwise admin-redirect-spin"></i> <p>Cargando…</p> </div> <!-- ═══ MODO: SELECCIONES CERRADAS — Abrir selecciones ═══ --> <div id="config-mode-closed" style="display:none;"> <div class="admin-config-card"> <div class="admin-config-eyebrow"> <i class="bi bi-lock-fill"></i> Sin selecciones activas
</div> <h1>Abrir nueva temporada</h1> <p class="admin-config-sub">
Cuando abras las selecciones, el sitio público mostrará el flujo de aplicación con la temporada que elijas.
          Los aspirantes podrán enviar su solicitud, y aquí podrás revisarlas.
</p> <form id="open-form" class="admin-config-form" novalidate> <div> <label class="admin-field-label" for="season-select">
Temporada a abrir <span class="sel-req">*</span> </label> <select id="season-select" class="admin-select admin-select-block" required> <option value="" disabled selected>Selecciona un semestre…</option> </select> </div> <button type="submit" id="open-submit" class="hw-btn hw-btn-primary admin-save-btn">
Abrir selecciones →
</button> <div id="open-feedback" class="admin-save-feedback" style="display:none;"></div> </form> <div class="admin-config-meta"> <p> <i class="bi bi-info-circle"></i>
Esta acción es manual y reversible — puedes cerrar las selecciones en cualquier momento.
</p> </div> </div> </div> <!-- ═══ MODO: SELECCIONES ABIERTAS — Info + cerrar ═══ --> <div id="config-mode-open" style="display:none;"> <div class="admin-config-card"> <div class="admin-config-eyebrow admin-config-eyebrow-active"> <i class="bi bi-broadcast"></i> Selecciones activas
</div> <h1>Temporada <span id="active-season-display">—</span></h1> <p class="admin-config-sub">
El sitio público está mostrando el flujo de aplicación. Los aspirantes pueden enviar su solicitud ahora mismo.
</p> <dl class="admin-dl admin-dl-config"> <dt>Abierta desde</dt> <dd id="opened-at-display">—</dd> <dt>Por</dt> <dd id="opened-by-display">—</dd> </dl> <!-- ═══ Estado del formulario público ═══ --> <div class="admin-forms-section"> <h3 class="admin-deadline-title"> <i class="bi bi-clipboard-check"></i>
Formulario de inscripciones
</h3> <p class="admin-deadline-hint">
Cuando el form está abierto, cualquiera puede aplicar desde la web pública.
            Cuando se cierra (manual o al enviar el bulk a entrevista), el sitio público
            muestra "En fase de entrevistas" hasta que se reabra o se cierre el ciclo.
</p> <div class="admin-forms-row"> <div class="admin-forms-status"> <span class="admin-forms-label">Estado actual:</span> <span id="forms-status-pill" class="admin-forms-pill admin-forms-pill-open"> <i class="bi bi-unlock-fill"></i> Abierto
</span> </div> <button type="button" id="forms-toggle-btn" class="admin-action-btn admin-action-btn-primary"> <i class="bi bi-lock-fill"></i> Cerrar inscripciones
</button> </div> <div id="forms-feedback" class="admin-save-feedback" style="display:none;"></div> </div> <!-- ═══ Fecha límite entrevista (configurable) ═══ --> <div class="admin-deadline-section"> <h3 class="admin-deadline-title"> <i class="bi bi-calendar-event"></i>
Fecha límite para agendar entrevista
</h3> <p class="admin-deadline-hint">
Esta fecha aparece en el correo de aceptación. Debe ser futura.
            Sin ella, el botón "Cierre de inscripciones" estará bloqueado.
</p> <div class="admin-deadline-row"> <input type="datetime-local" id="deadline-input" class="admin-text-input admin-deadline-input"> <div class="admin-deadline-presets"> <button type="button" class="admin-preset-btn" data-days="7">+7 días</button> <button type="button" class="admin-preset-btn" data-days="14">+14 días</button> <button type="button" class="admin-preset-btn" data-days="21">+21 días</button> </div> </div> <div class="admin-deadline-preview" id="deadline-preview"> <i class="bi bi-envelope-paper"></i> <span>El correo dirá: <strong id="deadline-preview-text">—</strong></span> </div> <button type="button" id="deadline-save" class="hw-btn hw-btn-primary admin-deadline-save">
Guardar fecha
</button> <div id="deadline-feedback" class="admin-save-feedback" style="display:none;"></div> </div> <!-- ═══ URL del grupo de WhatsApp ═══ --> <div class="admin-deadline-section"> <h3 class="admin-deadline-title"> <i class="bi bi-whatsapp"></i>
Grupo de WhatsApp del club
</h3> <p class="admin-deadline-hint">
Se incluye en el correo de bienvenida final que reciben los aceptados al
            terminar el proceso de selección. Cada generación nueva debería crear su propio
            link y actualizarlo aquí.
</p> <input type="url" id="whatsapp-input" class="admin-text-input" placeholder="https://chat.whatsapp.com/..."> <div class="admin-deadline-preview" id="whatsapp-preview" style="margin-top:14px;"> <i class="bi bi-envelope-paper"></i> <span>El correo dirá: <strong>Únete al grupo de WhatsApp →</strong> (link a <span id="whatsapp-preview-text">—</span>)</span> </div> <button type="button" id="whatsapp-save" class="hw-btn hw-btn-primary admin-deadline-save">
Guardar URL
</button> <div id="whatsapp-feedback" class="admin-save-feedback" style="display:none;"></div> </div> <div class="admin-config-actions"> <a href="/admin/solicitudes" class="hw-btn hw-btn-primary">
Ver solicitudes →
</a> <a href="/admin/entrevistas" class="admin-action-btn"> <i class="bi bi-calendar-week"></i> Ver entrevistas
</a> </div> </div> <!-- ═══════════════ DIVISOR FUERTE ═══════════════ --> <div class="admin-section-divider"> <span class="admin-section-divider-label"> <i class="bi bi-calendar-week-fill"></i> Configuración de entrevistas
</span> </div> <!-- ═══ Card: configuración de días de entrevista ═══ --> <div class="admin-config-card"> <h2 class="admin-interviews-title">Días disponibles para entrevistas</h2> <p class="admin-config-sub">
Define los días en los que el equipo podrá entrevistar. Los slots se generan
          automáticamente desde el rango horario y la duración elegida. Cada día tiene una
          sala de Google Meet única que todos los entrevistados ese día usarán.
</p> <!-- Stats de capacidad --> <div class="admin-stats-row" id="interview-stats"> <div class="admin-stat-pill"> <span class="admin-stat-pill-num" id="stat-slots">0</span> <span class="admin-stat-pill-label">Slots</span> </div> <div class="admin-stat-pill"> <span class="admin-stat-pill-num" id="stat-accepted">0</span> <span class="admin-stat-pill-label">Aceptados</span> </div> <div class="admin-stat-pill" id="stat-warning-pill" style="display:none;"> <span class="admin-stat-pill-num" id="stat-missing">0</span> <span class="admin-stat-pill-label">Faltan</span> </div> </div> <!-- Lista de días configurados --> <div id="interview-days-list" class="admin-days-list"> <div class="admin-empty admin-days-empty">Sin días configurados todavía.</div> </div> <!-- Form: añadir día --> <details class="admin-add-day-details"> <summary class="admin-add-day-summary"> <i class="bi bi-plus-circle"></i> Agregar día de entrevista
</summary> <form id="day-form" class="admin-day-form" novalidate> <div id="day-deadline-hint" style="display:none; padding:12px 16px; background:#fef3c7; border:3px solid #92400e; color:#92400e; font-weight:700; margin-bottom:16px; font-size:14px;"> <i class="bi bi-exclamation-triangle-fill"></i>
Primero guarda la <strong>Fecha límite para agendar entrevista</strong> (sección de arriba).
              Los días de entrevista deben ser <em>posteriores</em> a esa fecha.
</div> <div class="admin-day-form-row"> <div class="admin-day-form-field"> <label class="admin-field-label" for="day-date">Fecha</label> <input type="date" id="day-date" class="admin-text-input" required> </div> <div class="admin-day-form-field"> <label class="admin-field-label" for="day-start">Hora inicio</label> <input type="time" id="day-start" class="admin-text-input" required> </div> <div class="admin-day-form-field"> <label class="admin-field-label" for="day-end">Hora fin</label> <input type="time" id="day-end" class="admin-text-input" required> </div> </div> <div class="admin-day-form-row admin-day-form-row-meet"> <div class="admin-day-form-field"> <label class="admin-field-label" for="day-duration">Duración</label> <select id="day-duration" class="admin-select admin-select-block"> <option value="15">15 min</option> <option value="20">20 min</option> <option value="30" selected>30 min</option> <option value="45">45 min</option> <option value="60">60 min</option> </select> </div> <div class="admin-day-form-field"> <label class="admin-field-label" for="day-meet">URL de Google Meet</label> <input type="url" id="day-meet" class="admin-text-input" required placeholder="https://meet.google.com/abc-defg-hij"> </div> </div> <div id="day-slots-preview" class="admin-slots-preview" style="display:none;"> <span class="admin-slots-preview-label">Slots que se generarán:</span> <span id="day-slots-list"></span> </div> <button type="submit" id="day-add-btn" class="hw-btn hw-btn-primary admin-deadline-save">
Agregar día
</button> <div id="day-feedback" class="admin-save-feedback" style="display:none;"></div> </form> </details> </div> <!-- ═══════════════ DIVISOR FUERTE ═══════════════ --> <div class="admin-section-divider"> <span class="admin-section-divider-label"> <i class="bi bi-slash-circle-fill"></i> Cierre del proceso
</span> </div> <!-- ═══ Card: Cerrar ciclo de selección ═══ --> <div class="admin-config-card"> <div class="admin-config-eyebrow" style="background:#fee2e2;border-color:#991b1b;color:#991b1b;"> <i class="bi bi-x-octagon-fill"></i> Fin del ciclo de selección
</div> <h2>Cerrar el proceso de selección</h2> <p class="admin-config-sub">
Una vez enviados todos los correos finales, cierra el ciclo formalmente. El sitio público
          dejará de mostrar cualquier estado de selecciones activo. Los datos del ciclo se conservan
          en el histórico para consulta futura.
</p> <p class="admin-config-sub" style="font-weight:700;">
Esta acción es reversible — puedes abrir un nuevo ciclo en cualquier momento desde este mismo panel.
</p> <button type="button" id="close-btn" class="admin-action-btn admin-action-btn-danger" style="margin-top:4px;"> <i class="bi bi-x-circle"></i> Cerrar ciclo de selección
</button> <div id="close-feedback" class="admin-save-feedback" style="display:none;"></div> </div> </div> </section> ` })} ${renderScript($$result, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/seleccion-config.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/seleccion-config.astro", void 0);

const $$file = "/home/sebs/Documents/GitHub/helloworld-web/src/pages/admin/seleccion-config.astro";
const $$url = "/admin/seleccion-config";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$SeleccionConfig,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
