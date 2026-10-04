import { supabase } from './supabase';
import { getSelectionState, newRequestId, selectionAdmin, selectionErrorMessage, type SelectionState, type SelectionRoom } from './selection-client';

const statusLabels: Record<string, string> = {
  queued: 'Pendiente', working: 'Procesando', ready: 'Lista', failed: 'Falló', cancelled: 'Cancelada', not_required: 'Jornada anterior',
};
function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function members(value: FormDataEntryValue | null): string[] {
  return String(value ?? '').split(/[;,\n]/).map(e => e.trim().toLowerCase()).filter(Boolean);
}
function localTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(iso));
}

export function initSelectionRooms(season: () => string | undefined): void {
  const root = document.getElementById('selection-rooms');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true'; root.hidden = false;
  let state: SelectionState;
  let busy = false;
  let readOnly = false;
  const feedback = (message: string, failed = false, localId?: string, phase = failed ? 'error' : 'success') => {
    const el = document.getElementById('room-feedback')!;
    el.hidden = !message; el.textContent = message; el.dataset.error = String(failed); el.dataset.phase = phase;
    const local = localId ? document.getElementById(localId) : null;
    if (local) { local.hidden = !message; local.textContent = message; local.dataset.error = String(failed); local.dataset.phase = phase; }
  };
  const refresh = async () => {
    state = await getSelectionState(season());
    document.dispatchEvent(new CustomEvent('selection-rooms-state', { detail: state.config.selection_revision }));
    readOnly = !state.config.is_open || (!!season() && season() !== state.config.active_season);
    (document.getElementById('room-duration') as HTMLSelectElement).value = String(state.config.interview_duration_minutes ?? 15);
    document.getElementById('room-duration-label')!.textContent = `${state.config.interview_duration_minutes ?? 15} min`;
    updateCapacity();
    const cancellationStatus = document.getElementById('room-cancellation-status');
    if (cancellationStatus) {
      cancellationStatus.hidden = !state.room_cancellations_pending;
      cancellationStatus.textContent = `${state.room_cancellations_pending ?? 0} cancelación(es) de salas pendientes en Google. Sincroniza para reintentar; si hubo un error, espera un minuto.`;
      if (state.room_cancellations_pending) (cancellationStatus.closest('details') as HTMLDetailsElement).open = true;
    }
    const panels = [...root.querySelectorAll<HTMLDetailsElement>('details[data-panel][open]')].map(el => el.dataset.panel);
    const dates = [...new Set((state.rooms ?? []).map(room => room.date))].sort();
    document.getElementById('room-list')!.innerHTML = dates.map(date => {
      const rooms = (state.rooms ?? []).filter(room => room.date === date).sort((a,b) => a.position - b.position);
      return `<section class="rooms-day"><div class="rooms-day-heading"><h3>${dayLabel(date)}</h3><span>${rooms.length} ${rooms.length === 1 ? 'sala' : 'salas'} · ${rooms.filter(r => r.published).length} publicadas</span></div>${rooms.map(room => renderRoom(room,state)).join('')}</section>`;
    }).join('') || '<div class="rooms-empty"><i class="bi bi-calendar-plus" aria-hidden="true"></i><strong>Tu agenda empieza aquí</strong><p>Crea una jornada para añadir salas y sus horarios.</p></div>';
    root.querySelectorAll<HTMLDetailsElement>('details[data-panel]').forEach(el => { if(panels.includes(el.dataset.panel)) el.open = true; });
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea').forEach(el => {
      if (readOnly && el.id !== 'room-refresh') el.disabled = true;
    });
  };
  const run = async (action: () => Promise<void>, message: string, localId?: string, trigger?: HTMLButtonElement, progress = 'Guardando cambios…', onSuccess?: () => void) => {
    if (busy) return;
    const original = trigger?.innerHTML;
    const controls = [...root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea')]
      .map(control => ({ control, disabled: control.disabled }));
    busy = true; root.setAttribute('aria-busy', 'true');
    controls.forEach(({ control }) => { control.disabled = true; });
    if (trigger) { trigger.textContent = progress; trigger.setAttribute('aria-busy', 'true'); }
    feedback(progress, false, localId, 'working');
    try { await action(); await refresh(); feedback(message, false, localId); onSuccess?.(); }
    catch (error) { feedback(selectionErrorMessage(error), true, localId); }
    finally {
      busy = false; root.removeAttribute('aria-busy');
      controls.forEach(({ control, disabled }) => { if (control.isConnected) control.disabled = disabled || (readOnly && control.id !== 'room-refresh'); });
      if (trigger?.isConnected) { trigger.innerHTML = original ?? ''; trigger.removeAttribute('aria-busy'); }
    }
  };
  const mutate = async (data: Record<string, unknown>) => { await selectionAdmin('room', { ...data, request_id: newRequestId() }); };
  root.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? '');
    const roomId = form.dataset.roomId;
    const trigger = form.querySelector<HTMLButtonElement>('button[type="submit"],button:not([type])') ?? undefined;
    const localId = form.dataset.action === 'hosts' ? `room-host-feedback-${roomId}`
      : form.dataset.action === 'block' ? `room-block-feedback-${form.dataset.blockId ?? `${roomId}-new`}`
      : form.id === 'room-create-form' ? 'room-create-feedback' : 'room-duration-feedback';
    const success = form.dataset.action === 'hosts' ? 'Responsables guardados. Actualiza la sala en Google para aplicar sus permisos.'
      : form.dataset.action === 'block' ? 'Horario guardado.'
      : form.id === 'room-create-form' ? 'Jornada creada. Asigna un titular y un respaldo a cada sala.' : 'Duración guardada. Las reservas existentes conservan su duración.';
    void run(async () => {
      if (form.id === 'room-create-form') {
        await mutate({ operation: 'create', date: value('date'), start_time: value('start_time'), end_time: value('end_time'), room_count: Number(value('room_count')) });
        (document.getElementById('room-create-details') as HTMLDetailsElement).open = false;
      } else if (form.id === 'room-duration-form') {
        await selectionAdmin('config', { revision: state.config.selection_revision, interview_duration_minutes: Number(value('duration')) });
      } else if (form.dataset.action === 'hosts') {
        const conflict = hostConflict(roomId, value('primary_email'), value('backup_email'));
        if (conflict) throw new Error(conflict);
        await mutate({ operation: 'edit', id: roomId, name: value('name'), primary_email: value('primary_email'), backup_email: value('backup_email') });
      } else if (form.dataset.action === 'block') {
        await mutate({ operation: 'block', id: roomId, ...(form.dataset.blockId ? { block_id: form.dataset.blockId } : {}), start_time: value('start_time'), end_time: value('end_time'), interviewers: members(data.get('interviewers')) });

      }
    }, success, localId, trigger, form.id === 'room-create-form' ? 'Creando jornada…' : 'Guardando…');
  });
  root.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || button.type === 'submit') return;
    if (button.id === 'room-refresh') { void run(async () => {}, 'Agenda actualizada.', undefined, button, 'Actualizando agenda…'); return; }
    if (button.id === 'room-process-calendar') {
      void run(() => syncCalendar(), 'Procesamiento terminado. Revisa el estado de cada invitación en Reservas y envíos.', 'room-queue-feedback', button, 'Sincronizando invitaciones…'); return;
    }
    if (button.dataset.operation === 'connect') {
      const updating = state.rooms?.find(room => room.id === button.dataset.roomId)?.calendar_status === 'ready';
      void run(async () => {
        await mutate({ operation: 'prepare', id: button.dataset.roomId });
        await syncCalendar(button.dataset.roomId);
      }, updating ? 'Sala actualizada en Google. Evento y coanfitriones sincronizados; se conserva el mismo enlace de Meet.' : 'Sala conectada: Meet y coanfitriones listos. Ya puedes publicar sus horarios.', `room-action-feedback-${button.dataset.roomId}`, button, updating ? 'Actualizando en Google…' : 'Conectando con Google…', () => showGoogleSaved(button.dataset.roomId)); return;
    }
    const operation = button.dataset.operation;
    if (!operation) return;
    if (operation === 'delete_block' && !window.confirm('¿Eliminar este horario sin reservas?')) return;
    if (operation === 'delete' && !window.confirm('¿Eliminar esta sala y todos sus horarios? Se cancelará su evento en Google Calendar.')) return;
    void run(async () => {
      await mutate({ operation: operation === 'delete_block' ? 'block' : operation, id: button.dataset.roomId,
        ...(operation === 'delete_block' ? { block_id: button.dataset.blockId, delete: true } : {}),
        ...(operation === 'retry_booking' ? { interview_id: button.dataset.interviewId } : {}),
      });
      if (operation === 'delete') {
        await refresh();
        const result = await supabase.functions.invoke('selection-calendar', { body: { room_id: button.dataset.roomId } });
        if (result.error || result.data?.failed) throw new Error('Sala eliminada de la agenda. La cancelación en Google quedó pendiente; usa Sincronizar invitaciones pendientes para reintentar.');
      }
      if (operation === 'retry_booking') await syncCalendar();
    }, operation === 'publish' ? 'Horarios publicados. Los postulantes ya pueden reservar.' : operation === 'delete' ? 'Sala y horarios eliminados. Evento cancelado en Google Calendar.' : operation === 'delete_block' ? 'Horario eliminado.' : 'Invitación procesada. Revisa su estado en Reservas y envíos.', operation === 'delete' ? undefined : `room-action-feedback-${button.dataset.roomId}`, button, operation === 'publish' ? 'Publicando horarios…' : operation === 'delete' ? 'Eliminando sala…' : operation === 'delete_block' ? 'Eliminando horario…' : 'Reintentando invitación…');
  });
  function showGoogleSaved(roomId: string | undefined) {
    const room = state.rooms?.find(row => row.id === roomId);
    const target = document.getElementById(`room-action-feedback-${roomId}`);
    if (!room || !target || room.calendar_status !== 'ready') return;
    const blocks = state.days.filter(day => day.room_id === roomId);
    const starts = blocks.map(day => day.start_time.slice(0, 5)).sort();
    const ends = blocks.map(day => day.end_time.slice(0, 5)).sort();
    const values = [
      ['Sala', room.name],
      ['Fecha', dayLabel(room.date)],
      ['Horario del evento', blocks.length ? `${starts[0]}–${ends[ends.length - 1]} · Ciudad de México` : 'Sin horario'],
      ['Titular', room.primary_email ?? 'Sin asignar'],
      ['Respaldo', room.backup_email ?? 'Sin asignar'],
    ];
    const details = document.createElement('dl');
    details.className = 'room-google-saved';
    details.innerHTML = values.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('') +
      (room.google_cohosts?.length ? `<div><dt>Coanfitriones en Google Meet</dt><dd>${escape(room.google_cohosts.join(', '))}</dd></div>` : '') +
      (room.meet_url ? `<div><dt>Meet de la sala</dt><dd><a href="${escape(room.meet_url)}" target="_blank" rel="noopener noreferrer">${escape(room.meet_url)} ↗</a></dd></div>` : '');
    target.append(details);
  }

  function hostConflict(roomId: string | undefined, primary: string, backup: string): string | null {
    const normalize = (email: string) => email.trim().toLowerCase();
    if (normalize(primary) === normalize(backup)) return 'El titular y el respaldo deben usar correos distintos.';
    const room = state.rooms?.find(r => r.id === roomId);
    if (!room) return null;
    const ownBlocks = state.days.filter(b => b.room_id === roomId);
    for (const block of ownBlocks) {
      const people = [primary, backup, ...(block.interviewers ?? [])].map(normalize);
      for (const other of state.days.filter(b => b.room_id && b.room_id !== roomId && b.date === room.date && b.start_time < block.end_time && b.end_time > block.start_time)) {
        const otherRoom = state.rooms?.find(r => r.id === other.room_id);
        if (!otherRoom) continue;
        const assigned = [otherRoom.primary_email ?? '', otherRoom.backup_email ?? '', ...(other.interviewers ?? [])].map(normalize);
        const email = people.find(email => !!email && assigned.includes(email));
        if (email) return `${email} ya está asignado a ${otherRoom.name}, de ${other.start_time.slice(0,5)} a ${other.end_time.slice(0,5)}. Usa otra cuenta o ajusta los horarios para que no se crucen.`;
      }
    }
    return null;
  }
  async function syncCalendar(roomId?: string) {
    const result = await supabase.functions.invoke('selection-calendar', { body: roomId ? { room_id: roomId } : state.room_cancellations_pending ? {} : { bookings_only: true } });
    if (result.error || result.data?.failed) { await refresh(); throw new Error('No pudimos completar la conexión con Google. Revisa la sala y vuelve a intentar.'); }
    if (roomId) {
      await refresh();
      if (state.rooms?.find(r => r.id === roomId)?.calendar_status !== 'ready') throw new Error('La sala aún no está lista. Actualiza la agenda e intenta conectar de nuevo.');
    }
  }
  function updateCapacity() {
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    const minutes = (time: string) => { const [h,m] = time.split(':').map(Number); return h*60+m; };
    const length = minutes(value('room-end')) - minutes(value('room-start'));
    const duration = state?.config.interview_duration_minutes ?? 15;
    const count = Number(value('room-count'));
    document.getElementById('room-capacity-preview')!.textContent = length > 0 && count > 0 ? `${Math.floor(length/duration)*count} entrevistas posibles · ${duration} min por entrevista · hora de Ciudad de México` : 'La hora de fin debe ser posterior al inicio.';
    const summary = state?.capacity_summary;
    const help = document.getElementById('room-demand-preview')!;
    help.hidden = !summary;
    if (summary) {
      const date = value('room-date');
      let futureSlots = 0;
      if (date && count > 0 && length > 0) {
        for (let minute = minutes(value('room-start')); minute + duration <= minutes(value('room-end')); minute += duration) {
          const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
          if (Date.parse(`${date}T${time}:00-06:00`) > Date.now()) futureSlots += count;
        }
      }
      const remaining = Math.max(0, summary.missing_slots - futureSlots);
      help.textContent = `${summary.available_slots} cupos publicados libres · ${summary.accepted_without_booking} aceptado${summary.accepted_without_booking === 1 ? '' : 's'} aún sin entrevista. ${summary.missing_slots ? `${summary.missing_slots === 1 ? 'Falta 1 lugar' : `Faltan ${summary.missing_slots} lugares`}.` : 'La capacidad actual alcanza.'}` +
        (date && futureSlots ? ` Esta jornada prevé ${futureSlots} lugares adicionales; ${summary.missing_slots === 0 ? 'ampliaría la capacidad' : remaining ? `seguirían faltando ${remaining}` : 'cubriría los lugares faltantes'} al conectar y publicar sus salas.` : ' Las salas en borrador no cuentan para enviar invitaciones.');
      help.dataset.warning = String(summary.missing_slots > 0);
    }
  }
  root.addEventListener('input', event => { if (event.target instanceof Element && event.target.closest('#room-create-form')) updateCapacity(); });
  void run(async () => {}, '', undefined, undefined, 'Cargando agenda…');
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
function renderRoom(room: SelectionRoom, state: SelectionState): string {
  const blocks = state.days.filter(day => day.room_id === room.id).sort((a,b) => a.start_time.localeCompare(b.start_time));
  const bookings = state.interviews.filter(i => i.room_id === room.id);
  const activeBookings = bookings.filter(i => i.status !== 'cancelled');
  const id = escape(room.id);
  const hasHosts = !!room.primary_email && !!room.backup_email && room.primary_email !== room.backup_email;
  const ready = room.calendar_status === 'ready' && hasHosts && !!room.meet_url && blocks.length > 0;
  const working = room.calendar_status === 'working';
  const deletionLocked = state.room_deletion_locked === true;
  const deletionReason = deletionLocked ? 'Ya se inició o completó un envío de correo inicial en esta temporada. Las salas y horarios ya no se pueden eliminar.' : bookings.length ? 'Esta sala tiene reservas y no se puede eliminar.' : working ? 'Espera a que termine la sincronización con Google para eliminar esta sala.' : '';
  const label = working ? 'Conectando con Google' : room.calendar_status === 'failed' ? 'Revisar conexión' : room.published && ready ? 'Horarios publicados' : ready ? 'Lista para publicar' : !hasHosts ? 'Faltan responsables' : 'Por conectar con Google';
  const next = !hasHosts ? 'Asigna un titular y un respaldo para preparar esta sala.' : !blocks.length ? 'Añade un horario para habilitar la sala.' : working ? 'Google está preparando la sala. Actualiza en unos segundos.' : ready ? room.published ? 'Los postulantes ya pueden reservar estos horarios.' : 'El Meet está listo. Publica para que los postulantes puedan reservar.' : 'Conecta la sala: se crea su Meet y se asignan los coanfitriones.';
  const action = (operation: string, text: string, disabled = false, primary = false) => `<button type="button" class="rooms-button ${primary ? 'rooms-button-primary' : ''}" data-operation="${operation}" data-room-id="${id}" ${disabled ? 'disabled' : ''}>${text}</button>`;
  const capacity = blocks.reduce((sum,b) => { const minutes = (t:string) => { const [h,m] = t.split(':').map(Number);return h*60+m; }; return sum + Math.floor((minutes(b.end_time)-minutes(b.start_time))/b.duration_minutes); },0);
  const blockForm = (block?: typeof blocks[number]) => {
    const key = block?.id ?? `${room.id}-new`;
    const frozen = !!block && bookings.some(i => i.day_id === block.id);
    return `<form class="room-block" data-action="block" data-room-id="${id}" ${block ? `data-block-id="${escape(block.id)}"` : ''}>
      <div class="rooms-fields"><label for="start-${key}">Inicio<input id="start-${key}" type="time" name="start_time" value="${escape(block?.start_time.slice(0,5) ?? '')}" ${frozen ? 'readonly' : ''} required></label><label for="end-${key}">Fin<input id="end-${key}" type="time" name="end_time" value="${escape(block?.end_time.slice(0,5) ?? '')}" ${frozen ? 'readonly' : ''} required></label><label class="room-full-field" for="members-${key}">Otros entrevistadores (opcional)<input id="members-${key}" name="interviewers" placeholder="correo@ejemplo.com, otro@ejemplo.com" value="${escape(block?.interviewers?.join(', ') ?? '')}"></label></div>
      <p class="rooms-help">${frozen ? 'Este horario tiene reservas. Puedes cambiar entrevistadores; las citas conservan su hora.' : block ? `${block.duration_minutes} minutos por entrevista. Añade horarios separados para dejar descansos.` : 'Deja un espacio entre horarios para reservar un descanso.'}</p><div class="room-inline-actions"><button type="submit" class="rooms-button">${block ? 'Guardar horario' : 'Añadir horario'}</button>${block ? `<button type="button" class="rooms-button rooms-button-quiet" data-operation="delete_block" data-room-id="${id}" data-block-id="${escape(block.id)}" ${frozen || deletionLocked || working ? 'disabled' : ''}>Eliminar horario</button>` : ''}</div><p id="room-block-feedback-${escape(key)}" class="room-form-feedback" role="status" aria-live="polite" hidden></p></form>`;
  };
  return `<article class="room-card" data-room-id="${id}"><header class="room-card-header"><h4>${escape(room.name)}</h4><span class="room-state" data-tone="${room.calendar_status === 'failed' ? 'error' : ready ? 'ready' : 'pending'}">${escape(label)}</span></header><div class="room-card-body">
    <div class="room-overview"><span><i class="bi bi-clock" aria-hidden="true"></i>${blocks.length ? blocks.map(b => `${escape(b.start_time.slice(0,5))}–${escape(b.end_time.slice(0,5))}`).join(' · ') : 'Sin horarios'}</span><span>${capacity} cupos · ${activeBookings.length} reservas</span></div>
    <dl class="room-responsibles"><div><dt>Titular</dt><dd>${escape(room.primary_email || 'Sin asignar')}</dd></div><div><dt>Respaldo</dt><dd>${escape(room.backup_email || 'Sin asignar')}</dd></div></dl>
    ${room.meet_url ? `<a class="room-meet" href="${escape(room.meet_url)}" target="_blank" rel="noopener noreferrer"><i class="bi bi-camera-video" aria-hidden="true"></i>Abrir Meet de la sala ↗</a>` : ''}
    ${room.calendar_error ? `<div class="room-error" role="status">La conexión no se completó. El enlace y las reservas se conservan.<details><summary>Detalle de la incidencia</summary>${escape(room.calendar_error)}</details></div>` : ''}
    <details class="room-panel" data-panel="hosts-${id}" ${!hasHosts ? 'open' : ''}><summary>Responsables y nombre de sala</summary><form data-action="hosts" data-room-id="${id}" class="rooms-form"><div class="rooms-fields"><label class="room-full-field" for="name-${id}">Nombre de sala<input id="name-${id}" name="name" maxlength="120" value="${escape(room.name)}" required></label><label for="host-${id}">Correo del titular<input id="host-${id}" name="primary_email" type="email" value="${escape(room.primary_email)}" required></label><label for="backup-${id}">Correo del respaldo<input id="backup-${id}" name="backup_email" type="email" value="${escape(room.backup_email)}" required></label></div><button type="submit" class="rooms-button">Guardar responsables</button><p id="room-host-feedback-${id}" class="room-form-feedback" role="status" aria-live="polite" hidden></p><p class="rooms-help">Ambos tendrán permisos para gestionar el Meet. Al cambiarlos, conecta de nuevo la sala para actualizar sus permisos.</p></form></details>
    <details class="room-panel" data-panel="blocks-${id}"><summary>Horarios y descansos · ${blocks.length} ${blocks.length === 1 ? 'horario' : 'horarios'}</summary>${blocks.map(b => blockForm(b)).join('')}<details class="room-panel" data-panel="new-block-${id}"><summary>Añadir horario</summary>${blockForm()}</details></details>
    <details class="room-panel" data-panel="bookings-${id}"><summary>Reservas y envíos · ${activeBookings.length} citas</summary>${bookings.map(i => {
      const applicant = state.solicitudes.find(s => s.id === i.solicitud_id);
      const mail = state.messages.find(m => m.solicitud_id === i.solicitud_id && m.kind === 'booking');
      return `<div class="room-booking"><strong>${escape(applicant?.nombre)} · ${localTime(i.slot_datetime)} · ${i.duration_minutes} min</strong><br>Invitación Calendar: ${escape(statusLabels[i.calendar_status ?? 'not_required'] ?? i.calendar_status)} · Correo: ${escape(mail ? `${mail.status} / ${mail.delivery_status}` : 'Pendiente')}${i.calendar_status === 'failed' && ['confirmed','cancelled'].includes(i.status) ? `<div class="room-inline-actions"><button type="button" class="rooms-button" data-operation="retry_booking" data-room-id="${id}" data-interview-id="${escape(i.id)}">Reintentar invitación</button></div>` : ''}</div>`;
    }).join('') || '<p class="rooms-help">Las reservas aparecerán aquí cuando los postulantes agenden.</p>'}</details>
    <footer class="room-footer">${!room.published ? `<p class="room-publish-notice"><strong>Antes de publicar:</strong> los horarios estarán disponibles para reservar. ${deletionLocked ? 'Ya hubo un envío inicial en esta temporada: esta sala y sus horarios quedarán protegidos contra eliminación.' : 'Podrás eliminar esta sala o sus horarios hasta que se inicie el primer envío de correo inicial de la temporada. Después quedarán protegidos.'}</p>` : ''}<p class="room-next">${escape(next)}</p><div class="room-footer-buttons">${action('connect',working ? 'Conectando…' : ready ? 'Actualizar en Google' : room.calendar_status === 'failed' ? 'Reintentar conexión' : 'Conectar con Google',!hasHosts || !blocks.length || working,!ready)}${!room.published ? action('publish','Publicar horarios',!ready,true) : ''}</div>${action('delete','Eliminar sala',!!deletionReason)}${deletionReason ? `<p class="room-deletion-note">${escape(deletionReason)}</p>` : ''}<div id="room-action-feedback-${id}" class="room-form-feedback room-action-feedback" role="status" aria-live="polite" hidden></div></footer>
  </div></article>`;
}
