import { createServer } from 'node:http';

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const ANA_ID = '00000000-0000-0000-0000-000000000011';
const LUIS_ID = '00000000-0000-0000-0000-000000000012';
const SEASON = '2027-1';
const FIXED_SLOT = {
  slot_datetime: '2030-09-10T16:00:00Z',
  duration_minutes: 30,
  meet_url: 'https://meet.google.com/testing',
};

const user = {
  id: ADMIN_ID,
  email: 'admin@example.org',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

function app(id, nombre, status) {
  return {
    id,
    nombre,
    status,
    correo: `${nombre.toLowerCase()}@example.org`,
    season: SEASON,
    carrera: 'Computación',
    semestre: 3,
    numero_cuenta: '123456789',
    selection_revision: 0,
    created_at: '2026-09-01T18:00:00Z',
    reviewed_at: status === 'accepted' ? '2026-09-02T18:00:00Z' : null,
    reviewed_by: status === 'accepted' ? user.email : null,
    email_notification_sent: false,
    final_email_sent: false,
    final_decision: null,
    decision_exception_reason: null,
    evaluated_at: null,
    evaluated_by: null,
    eval_blandas_score: null,
    eval_blandas_notes: null,
    eval_motivacion_score: null,
    eval_motivacion_notes: null,
    eval_proyectos_score: null,
    eval_proyectos_notes: null,
    eval_aporte_score: null,
    eval_aporte_notes: null,
    eval_tecnica_score: null,
    eval_tecnica_notes: null,
    eval_overall_notes: null,
    notes: '',
    proyecto_descripcion: 'Ejemplo sintético',
    motivacion: 'Aprender',
    experiencia_liderazgo: 'Coordinar un proyecto de clase.',
    manejo_conflicto: 'Escuchar y acordar una solución.',
    fortalezas_areas: 'Organización y comunicación.',
    curiosidad: 'Nuevas herramientas.',
    horas_disponibles: '6 horas por semana',
    intereses: ['Desarrollo web'],
    lenguajes: ['TypeScript'],
    nivel_experiencia: 'Intermedio',
    github_url: null,
    linkedin_url: null,
    portfolio_url: null,
    cv_storage_path: null,
  };
}

let state;
let calls;
let booking;

function reset() {
  state = {
    config: {
      id: true,
      progressive_enabled: true,
      dispatch_paused: false,
      is_open: true,
      applications_closed: false,
      active_season: SEASON,
      default_booking_hours: 168,
      selection_revision: 0,
      whatsapp_url: 'https://chat.whatsapp.com/testing',
      interview_deadline_at: null,
    },
    solicitudes: [
      app(ANA_ID, 'Ana', 'accepted'),
      app(LUIS_ID, 'Luis', 'reviewing'),
    ],
    invitations: [{
      solicitud_id: ANA_ID,
      invited_at: '2030-09-01T12:00:00Z',
      expires_at: '2030-09-08T12:00:00Z',
      revoked_at: null,
      reschedule_count: 0,
    }],
    interviews: [{
      id: 'interview-synthetic-ana',
      solicitud_id: ANA_ID,
      slot_datetime: FIXED_SLOT.slot_datetime,
      duration_minutes: FIXED_SLOT.duration_minutes,
      meet_url: FIXED_SLOT.meet_url,
      status: 'completed',
      notes: null,
      created_at: '2030-09-01T12:00:00Z',
    }],
    days: [],
    messages: [],
    events: [],
    capacity: 3,
  };
  calls = [];
  booking = {
    ok: true,
    progressive: true,
    solicitud: { nombre: 'Ana Sintética', season: SEASON },
    expires_at: '2030-09-08T18:00:00Z',
    booking_blocked_reason: null,
    current_interview: null,
    can_reschedule: true,
    reschedule_count: 0,
    max_reschedules: 2,
    slots: [{ ...FIXED_SLOT }],
    days: [],
    taken_slots: [],
  };
}

reset();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseFilter(value) {
  if (!value) return null;
  const match = value.match(/^eq\.(.*)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function restRows(pathname, url) {
  if (pathname === '/rest/v1/solicitudes') {
    let rows = state.solicitudes;
    const season = parseFilter(url.searchParams.get('season'));
    const status = parseFilter(url.searchParams.get('status'));
    const id = parseFilter(url.searchParams.get('id'));
    if (season) rows = rows.filter((row) => row.season === season);
    if (status) rows = rows.filter((row) => row.status === status);
    if (id) rows = rows.filter((row) => row.id === id);
    if (url.searchParams.get('order')?.startsWith('created_at')) {
      rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return rows;
  }

  if (pathname === '/rest/v1/interviews') {
    let rows = state.interviews;
    const solicitudId = parseFilter(url.searchParams.get('solicitud_id'));
    if (solicitudId) rows = rows.filter((row) => row.solicitud_id === solicitudId);
    const season = parseFilter(url.searchParams.get('solicitudes.season'));
    if (season) rows = rows.filter((row) => state.solicitudes.some((sol) => sol.id === row.solicitud_id && sol.season === season));
    if (url.searchParams.get('order')?.startsWith('slot_datetime')) {
      rows = [...rows].sort((a, b) => a.slot_datetime.localeCompare(b.slot_datetime));
    }
    return rows;
  }

  if (pathname === '/rest/v1/interview_days') {
    const season = parseFilter(url.searchParams.get('season'));
    return season ? state.days.filter((day) => day.season === season) : state.days;
  }

  return null;
}

function updateInterviewStatus(id, status) {
  const interview = state.interviews.find((row) => row.id === id);
  if (interview) interview.status = status;
}

function applyEvaluation(solicitud, evaluation) {
  if (!evaluation || typeof evaluation !== 'object') return;
  for (const [key, value] of Object.entries(evaluation)) {
    if (key.startsWith('eval_')) solicitud[key] = value;
  }
  solicitud.evaluated_at = new Date().toISOString();
  solicitud.evaluated_by = user.email;
}

function previewItems(items, kind) {
  return items.map((item) => {
    const solicitud = state.solicitudes.find((row) => row.id === item.id);
    return {
      id: item.id,
      revision: solicitud?.selection_revision ?? item.revision ?? 0,
      nombre: solicitud?.nombre ?? 'Persona sintética',
      correo: solicitud?.correo ?? 'synthetic@example.org',
      season: solicitud?.season ?? SEASON,
      kind,
      decision: kind === 'final' ? solicitud?.final_decision : solicitud?.status,
      subject: kind === 'final' ? 'Resultado de tu proceso' : 'Siguiente paso de tu solicitud',
      body: 'Mensaje de prueba',
      payload: {
        nombre: solicitud?.nombre,
        season: solicitud?.season ?? SEASON,
        decision: kind === 'final' ? solicitud?.final_decision : solicitud?.status,
        expires_at: '2030-09-08T18:00:00Z',
        booking_url: 'http://127.0.0.1:4329/seleccion/agendar?t=synthetic',
        whatsapp_url: kind === 'final' && solicitud?.final_decision === 'accepted'
          ? 'https://chat.whatsapp.com/testing'
          : undefined,
      },
    };
  });
}

function handleSelectionAdmin(data) {
  const action = data.p_action;
  const payload = data.p_data || {};
  if (action === 'state') return clone(state);

  calls.push({ action, data: clone(payload) });

  if (action === 'preview') {
    return {
      items: previewItems(payload.items || [], payload.kind),
      duration_hours: payload.duration_hours ?? 168,
      config_revision: state.config.selection_revision,
      capacity: state.capacity,
      errors: [],
    };
  }

  if (action === 'confirm') {
    for (const item of payload.items || []) {
      const solicitud = state.solicitudes.find((row) => row.id === item.id);
      if (!solicitud) continue;
      solicitud.selection_revision += 1;
      state.messages.push({
        id: `message-${payload.kind}-${solicitud.id}-${state.messages.length}`,
        solicitud_id: solicitud.id,
        kind: payload.kind,
        status: 'queued',
        delivery_status: 'pending',
        created_at: new Date().toISOString(),
      });
    }
    return { batch_id: payload.request_id || 'synthetic-batch', queued: (payload.items || []).length };
  }

  if (action === 'save') {
    const solicitud = state.solicitudes.find((row) => row.id === payload.id);
    if (!solicitud) return { ok: false, error: 'NOT_FOUND' };
    if (payload.status) {
      solicitud.status = payload.status;
      solicitud.reviewed_at = new Date().toISOString();
      solicitud.reviewed_by = user.email;
    }
    if ('notes' in payload) solicitud.notes = payload.notes;
    applyEvaluation(solicitud, payload.evaluation);
    if (payload.final_decision) solicitud.final_decision = payload.final_decision;
    if (payload.exception_reason) solicitud.decision_exception_reason = payload.exception_reason;
    if (payload.complete_interview) {
      const interview = state.interviews.find((row) => row.solicitud_id === solicitud.id && row.status === 'confirmed');
      if (interview) interview.status = 'completed';
    }
    solicitud.selection_revision += 1;
    return { ok: true };
  }

  if (action === 'interview') {
    updateInterviewStatus(payload.id, payload.status);
    return { ok: true };
  }

  return { ok: true };
}

function writeJson(res, value, status = 200) {
  res.statusCode = status;
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4329');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let text = '';
  for await (const chunk of req) text += chunk;
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { writeJson(res, { error: 'invalid json' }, 400); return; }

  const url = new URL(req.url, 'http://127.0.0.1:55439');
  const { pathname } = url;

  if (pathname === '/__health') return writeJson(res, { ok: true });
  if (pathname === '/__reset') { reset(); return writeJson(res, { ok: true }); }
  if (pathname === '/__calls') return writeJson(res, calls);
  if (pathname === '/__booking') { Object.assign(booking, data); return writeJson(res, booking); }
  if (pathname === '/__config') { Object.assign(state.config, data); return writeJson(res, state.config); }
  if (pathname === '/__state') { Object.assign(state, data); return writeJson(res, state); }

  if (pathname === '/auth/v1/user') return writeJson(res, user);
  if (pathname === '/rest/v1/rpc/is_email_in_directiva') return writeJson(res, true);
  if (pathname === '/rest/v1/seleccion_config') return writeJson(res, state.config);
  if (pathname === '/rest/v1/directiva') return writeJson(res, { email: user.email });

  const rows = restRows(pathname, url);
  if (rows) {
    const wantsObject = req.headers.accept?.includes('vnd.pgrst.object');
    return writeJson(res, wantsObject ? (rows[0] ?? null) : rows);
  }

  if (pathname === '/rest/v1/rpc/get_booking_state') return writeJson(res, clone(booking));

  if (pathname === '/rest/v1/rpc/cancel_interview') {
    calls.push({ action: 'cancel_interview', data });
    booking.current_interview = null;
    booking.booking_blocked_reason = null;
    booking.can_reschedule = true;
    booking.reschedule_count += 1;
    booking.slots = [{ ...FIXED_SLOT }];
    return writeJson(res, { ok: true });
  }

  if (pathname === '/rest/v1/rpc/book_interview') {
    calls.push({ action: 'book_interview', data });
    const requested = data.p_slot || FIXED_SLOT.slot_datetime;
    const slot = booking.slots.find((candidate) => candidate.slot_datetime === requested) || { ...FIXED_SLOT, slot_datetime: requested };
    booking.current_interview = { ...slot, id: 'test-booking', status: 'confirmed' };
    booking.slots = [];
    return writeJson(res, { ok: true, interview_id: 'test-booking' });
  }

  if (pathname === '/rest/v1/rpc/selection_admin') return writeJson(res, handleSelectionAdmin(data));

  return writeJson(res, { error: `Unmocked route: ${pathname}` }, 404);
}).listen(55439, '127.0.0.1');
