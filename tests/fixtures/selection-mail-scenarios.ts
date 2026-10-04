export function mailScenarios() {
  const base = {
    nombre: 'Ana María Ejemplo', season: '2099-1',
    expires_at: '2026-10-08T18:00:00Z', booking_url: 'http://127.0.0.1:4321/seleccion/agendar?t=ejemplo-catalogo',
    slot_datetime: '2026-10-08T18:00:00Z', duration_minutes: 30,
    meet_url: 'https://meet.google.com/ejemplo-catalogo', whatsapp_url: 'https://chat.whatsapp.com/ejemplo-catalogo',
  };
  const rows: { id: string; label: string; kind: string; payload: Record<string, unknown> }[] = [];
  const add = (id: string, label: string, kind: string, extra: Record<string, unknown> = {}) => rows.push({ id, label, kind, payload: { ...base, ...extra } });
  add('receipt', 'Solicitud recibida', 'receipt');
  add('initial-accepted', 'Invitación a entrevista', 'initial', { decision: 'accepted' });
  add('initial-rejected', 'Rechazo en solicitudes', 'initial', { decision: 'rejected' });
  add('booking', 'Entrevista confirmada', 'booking');
  add('rebooking', 'Entrevista reprogramada', 'booking', { slot_datetime: '2026-10-09T19:00:00Z', duration_minutes: 45 });
  for (const [outcome, label] of [['completed', 'entrevista realizada'], ['no_show', 'inasistencia'], ['none', 'sin entrevista']]) {
    for (const decision of ['accepted', 'rejected']) {
      add(`final-${decision}-${outcome}`, `${decision === 'accepted' ? 'Aceptación' : 'Rechazo'} final · ${label}`, 'final', { decision, interview_outcome: outcome });
    }
  }
  for (const stage of ['initial', 'final']) {
    for (const decision of ['accepted', 'rejected']) {
      add(`rectification-${stage}-${decision}`, `Rectificación ${stage === 'initial' ? 'de solicitudes' : 'final'} · ${decision === 'accepted' ? 'aceptación' : 'rechazo'}`, 'rectification', { stage, decision });
    }
  }
  for (const [kind, label] of [['cancellation', 'Entrevista cancelada'], ['deadline', 'Ampliación del plazo para agendar'], ['reminder', 'Recordatorio de agenda']]) {
    add(kind, label, kind);
  }
  return rows;
}
