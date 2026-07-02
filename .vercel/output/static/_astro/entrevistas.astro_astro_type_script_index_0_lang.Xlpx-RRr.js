import{s as m}from"./supabase.ByhH4n-l.js";import{f as y}from"./interview-slots.BOuV2aLK.js";const w={confirmed:"Confirmada",completed:"Completada",no_show:"No show",cancelled:"Cancelada"};let g="";document.addEventListener("DOMContentLoaded",async()=>{const{data:{session:e}}=await m.auth.getSession();if(!e?.user?.email){window.location.replace("/admin/login");return}const{data:a}=await m.from("directiva").select("email").eq("email",e.user.email.toLowerCase()).maybeSingle();if(!a){await m.auth.signOut(),window.location.replace("/admin/login");return}const{data:s}=await m.from("seleccion_config").select("active_season, interview_deadline_at").eq("id",!0).maybeSingle();g=s?.active_season||"",document.getElementById("active-season").textContent=g||"—";const d=s?.interview_deadline_at?new Date(s.interview_deadline_at):null;if(!g){document.getElementById("entrevistas-loading").innerHTML='<p>Sin temporada activa. Abre una desde <a href="/admin/seleccion-config">configuración</a>.</p>';return}const{data:i,error:n}=await m.from("solicitudes").select("id, nombre, correo, carrera, semestre, final_decision, final_email_sent, evaluated_at").eq("season",g).eq("status","accepted"),{data:o,error:c}=await m.from("interviews").select(`
        id, solicitud_id, slot_datetime, duration_minutes, meet_url, status, notes,
        solicitudes!inner ( id, nombre, correo, carrera, semestre, final_decision, final_email_sent, evaluated_at, season )
      `).eq("solicitudes.season",g).order("slot_datetime",{ascending:!0});if(document.getElementById("entrevistas-loading").style.display="none",document.getElementById("entrevistas-content").style.display="block",n||c){document.getElementById("agenda-by-day").innerHTML=`<div class="admin-empty admin-empty-error">Error: ${n?.message||c?.message}</div>`;return}const t=i||[],r=o||[];!d||Date.now()>=d.getTime()?(_(t),E(r),B(t,r),I(t)):$(t,r,d)});function $(e,a,s){document.getElementById("entrevistas-stats").style.display="none",document.getElementById("booking-phase-section").style.display="";const d=document.getElementById("btn-bulk-final");d.disabled=!0,d.innerHTML='<i class="bi bi-hourglass-split"></i> Esperando fin de agendado',d.title="Disponible una vez que pase la fecha límite de agendado";const i=new Set(a.filter(t=>t.status!=="cancelled").map(t=>t.solicitud_id)),n=e.filter(t=>i.has(t.id)),o=e.filter(t=>!i.has(t.id)),c=s.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Mexico_City"});document.getElementById("booking-phase-banner").innerHTML=`
      <div class="admin-booking-banner">
        <div class="admin-booking-banner-text">
          <i class="bi bi-hourglass-split"></i>
          <span>Periodo de agendado activo — los candidatos tienen hasta el <strong>${c}</strong> para elegir su horario.</span>
        </div>
        <div class="admin-booking-banner-counts">
          <span class="admin-booking-count admin-booking-count-done"><i class="bi bi-check2"></i> ${n.length} agendados</span>
          <span class="admin-booking-count admin-booking-count-pending"><i class="bi bi-hourglass"></i> ${o.length} pendientes</span>
        </div>
      </div>`,document.getElementById("booking-with-interview").innerHTML=`
      <section class="admin-agenda-day" style="margin-top:20px;">
        <h2 class="admin-agenda-day-header">
          <i class="bi bi-check2-circle"></i> Con entrevista agendada
          <span class="admin-agenda-day-count">${n.length}</span>
        </h2>
        <div class="admin-agenda-list">
          ${n.length===0?'<div class="admin-empty">Ningún candidato ha agendado aún.</div>':n.map(t=>{const r=a.find(v=>v.solicitud_id===t.id&&v.status!=="cancelled"),u=r?f(r.slot_datetime):"—",h=r?.meet_url?`<a href="${b(r.meet_url)}" target="_blank" rel="noopener noreferrer" class="admin-agenda-meet" title="Abrir Meet"><i class="bi bi-camera-video-fill"></i></a>`:"";return`<article class="admin-agenda-item">
                  <div class="admin-agenda-time">${u}</div>
                  <div class="admin-agenda-info">
                    <div class="admin-agenda-name">${l(t.nombre)}</div>
                    <div class="admin-agenda-sub">${l(t.carrera)} · ${t.semestre}° sem</div>
                  </div>
                  <div class="admin-agenda-actions">${h}</div>
                </article>`}).join("")}
        </div>
      </section>`,document.getElementById("booking-without-interview").innerHTML=`
      <section class="admin-agenda-day" style="margin-top:16px;">
        <h2 class="admin-agenda-day-header">
          <i class="bi bi-hourglass"></i> Pendiente de agendar
          <span class="admin-agenda-day-count">${o.length}</span>
        </h2>
        ${o.length===0?'<p class="admin-no-interview-hint">Todos han agendado su entrevista.</p>':`<p class="admin-no-interview-hint">Aún no han elegido horario. Tienen hasta el deadline para hacerlo.</p>
             <div class="admin-agenda-list">
               ${o.map(t=>`<article class="admin-agenda-item admin-agenda-no-interview">
                 <div class="admin-agenda-time">—</div>
                 <div class="admin-agenda-info">
                   <div class="admin-agenda-name">${l(t.nombre)}</div>
                   <div class="admin-agenda-sub">${l(t.carrera)} · ${t.semestre}° sem</div>
                 </div>
               </article>`).join("")}
             </div>`}
      </section>`}function _(e){const a=e.length,s=e.filter(o=>o.evaluated_at).length,d=e.filter(o=>o.final_decision==="accepted").length,i=e.filter(o=>o.final_decision==="rejected").length,n=e.filter(o=>!o.final_decision).length;document.getElementById("stat-total").textContent=String(a),document.getElementById("stat-evaluated").textContent=String(s),document.getElementById("stat-accepted-final").textContent=String(d),document.getElementById("stat-rejected-final").textContent=String(i),document.getElementById("stat-pending").textContent=String(n)}function E(e){const a=document.getElementById("agenda-by-day");if(e.length===0){a.innerHTML='<div class="admin-empty">Sin entrevistas agendadas todavía.</div>';return}const s=new Map;e.forEach(i=>{const n=i.slot_datetime.slice(0,10);s.has(n)||s.set(n,[]),s.get(n).push(i)});const d=[...s.entries()].map(([i,n])=>{const o=y(i),c=n.map(t=>k(t)).join("");return`
        <section class="admin-agenda-day">
          <h2 class="admin-agenda-day-header">${l(o)} <span class="admin-agenda-day-count">${n.length}</span></h2>
          <div class="admin-agenda-list">${c}</div>
        </section>
      `}).join("");a.innerHTML=d,a.querySelectorAll(".admin-mini-btn").forEach(i=>{i.addEventListener("click",()=>L(i.dataset.id,i.dataset.action))})}function k(e){const a=f(e.slot_datetime),s=e.solicitudes,d=p(s);return`
      <article class="admin-agenda-item admin-agenda-status-${e.status}">
        <div class="admin-agenda-time">${a}</div>
        <div class="admin-agenda-info">
          <div class="admin-agenda-name">${l(s?.nombre||"Sin nombre")}</div>
          <div class="admin-agenda-sub">${l(s?.carrera||"—")} · ${s?.semestre||"?"}° sem</div>
        </div>
        <div class="admin-agenda-status-cell">
          <span class="admin-status admin-status-${e.status==="confirmed"?"reviewing":e.status==="completed"?"accepted":e.status==="cancelled"?"rejected":"pending"}">
            ${w[e.status]}
          </span>
          ${d}
        </div>
        <div class="admin-agenda-actions">
          ${e.meet_url?`<a href="${b(e.meet_url)}" target="_blank" rel="noopener noreferrer" class="admin-agenda-meet" title="Abrir Meet"><i class="bi bi-camera-video-fill"></i></a>`:""}
          <a href="/admin/solicitudes/detalle?id=${e.solicitud_id}#evaluacion" class="admin-agenda-detail admin-agenda-evaluate" title="Evaluar / Ver solicitud">
            <i class="bi bi-clipboard-data"></i>
          </a>
        </div>
        ${e.status==="confirmed"?`
          <div class="admin-agenda-row-actions">
            <button type="button" class="admin-mini-btn admin-mini-btn-success" data-id="${e.id}" data-action="completed">
              <i class="bi bi-check2"></i> Marcar completada
            </button>
            <button type="button" class="admin-mini-btn admin-mini-btn-warn" data-id="${e.id}" data-action="no_show">
              <i class="bi bi-person-x"></i> No show
            </button>
          </div>
        `:""}
      </article>
    `}function p(e){return e?e.final_decision==="accepted"?'<span class="admin-eval-pill admin-eval-pill-accept"><i class="bi bi-check-circle-fill"></i> Aceptado</span>':e.final_decision==="rejected"?'<span class="admin-eval-pill admin-eval-pill-reject"><i class="bi bi-x-circle-fill"></i> Rechazado</span>':'<span class="admin-eval-pill admin-eval-pill-pending"><i class="bi bi-hourglass-split"></i> Sin evaluar</span>':""}function B(e,a){const s=new Set(a.map(n=>n.solicitud_id)),d=e.filter(n=>!s.has(n.id));if(d.length===0)return;document.getElementById("no-interview-section").style.display="",document.getElementById("no-interview-count").textContent=String(d.length);const i=document.getElementById("no-interview-list");i.innerHTML=d.map(n=>`
      <article class="admin-agenda-item admin-agenda-no-interview">
        <div class="admin-agenda-time">—</div>
        <div class="admin-agenda-info">
          <div class="admin-agenda-name">${l(n.nombre)}</div>
          <div class="admin-agenda-sub">${l(n.carrera)} · ${n.semestre}° sem</div>
        </div>
        <div class="admin-agenda-status-cell">
          ${p(n)}
        </div>
        <div class="admin-agenda-actions">
          <a href="/admin/solicitudes/detalle?id=${n.id}#evaluacion" class="admin-agenda-detail" title="Evaluar / Ver solicitud">
            <i class="bi bi-clipboard-data"></i>
          </a>
        </div>
      </article>
    `).join("")}function I(e){const a=document.getElementById("btn-bulk-final"),s=e.filter(i=>!i.final_decision).length,d=e.filter(i=>i.final_decision&&!i.final_email_sent).length;if(s>0){a.disabled=!0,a.title=`Faltan ${s} decisión(es) finales. Evalúa a todos antes de mandar.`,a.innerHTML=`<i class="bi bi-exclamation-triangle"></i> Faltan ${s} por evaluar`;return}if(d===0){a.disabled=!0,a.title="No hay correos finales pendientes de enviar.",a.innerHTML='<i class="bi bi-check-all"></i> Resultados enviados';return}a.disabled=!1,a.title=`Enviar ${d} correo(s) finales (bienvenida / agradecimiento)`,a.innerHTML=`<i class="bi bi-send-fill"></i> Enviar resultados finales (${d})`,a.addEventListener("click",async()=>{if(!confirm(`Vas a enviar ${d} correo(s) finales de la temporada ${g}.

Aceptados reciben bienvenida + link de WhatsApp.
Rechazados reciben mensaje de agradecimiento.

Esto NO se puede deshacer. ¿Confirmar?`))return;a.disabled=!0,a.innerHTML='<i class="bi bi-arrow-clockwise admin-redirect-spin"></i> Enviando…';const{data:n,error:o}=await m.functions.invoke("send-final-decisions-bulk",{body:{season:g}});if(o){alert(`Error al enviar: ${o.message}`),a.disabled=!1;return}const c=n?.sent??0,t=n?.failed??0;if(t>0)alert(`Enviados: ${c}
Fallidos: ${t}

Revisa la consola.`),console.warn("Bulk final errors:",n?.errors);else if(confirm(`✓ ${c} correo(s) enviado(s).

El proceso de selección de la temporada ${g} ha concluido.

¿Ir al panel de configuración para cerrar formalmente el ciclo?`)){window.location.replace("/admin/seleccion-config");return}location.reload()})}async function L(e,a){if(!confirm(`¿Marcar esta entrevista como ${a==="completed"?"completada":"no show"}?`))return;const{error:i}=await m.from("interviews").update({status:a}).eq("id",e);if(i){alert(`Error: ${i.message}`);return}location.reload()}function f(e){return new Intl.DateTimeFormat("es-MX",{hour:"2-digit",minute:"2-digit",hour12:!1,timeZone:"America/Mexico_City"}).format(new Date(e))}function l(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function b(e){return l(e)}
