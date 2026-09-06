insert into public.seleccion_config (
  id,
  is_open,
  active_season,
  next_season_hint,
  applications_closed,
  interview_deadline_at,
  whatsapp_url,
  progressive_enabled,
  dispatch_paused,
  default_booking_hours,
  selection_site_url
)
values (
  true,
  true,
  '2099-1',
  'ENTORNO SINTÉTICO',
  false,
  '2098-12-20T23:59:59-06:00',
  'https://chat.whatsapp.com/selection-lab-only',
  false,
  false,
  168,
  'http://127.0.0.1:4321'
)
on conflict (id) do update
set is_open = excluded.is_open,
    active_season = excluded.active_season,
    next_season_hint = excluded.next_season_hint,
    applications_closed = excluded.applications_closed,
    interview_deadline_at = excluded.interview_deadline_at,
    whatsapp_url = excluded.whatsapp_url,
    progressive_enabled = excluded.progressive_enabled,
    dispatch_paused = excluded.dispatch_paused,
    default_booking_hours = excluded.default_booking_hours,
    selection_site_url = excluded.selection_site_url;

insert into public.directiva (email, nombre, role)
values ('admin@selection.local', 'Administración local', 'admin')
on conflict (email) do update
set nombre = excluded.nombre,
    role = excluded.role;

insert into public.interview_days (
  season,
  date,
  start_time,
  end_time,
  duration_minutes,
  meet_url,
  notes,
  created_by
)
values
  ('2099-1', '2098-12-10', '10:00', '14:00', 30, 'https://meet.google.com/selection-lab-a', 'Datos sintéticos', 'admin@selection.local'),
  ('2099-1', '2098-12-11', '10:00', '14:00', 30, 'https://meet.google.com/selection-lab-b', 'Datos sintéticos', 'admin@selection.local')
on conflict (season, date) do nothing;

insert into public.solicitudes (
  id,
  season,
  status,
  created_at,
  nombre,
  numero_cuenta,
  correo,
  carrera,
  semestre,
  intereses,
  lenguajes,
  nivel_experiencia,
  proyecto_descripcion,
  motivacion,
  experiencia_liderazgo,
  manejo_conflicto,
  fortalezas_areas,
  curiosidad,
  horas_disponibles
)
select
  ('10000000-0000-4000-8000-' || lpad(candidate::text, 12, '0'))::uuid,
  '2099-1',
  case when candidate <= 3 then 'pending' else 'reviewing' end,
  '2098-09-01T12:00:00-06:00'::timestamptz + make_interval(hours => candidate),
  'Postulante Sintético ' || lpad(candidate::text, 2, '0'),
  (900000000 + candidate)::text,
  'postulante' || lpad(candidate::text, 2, '0') || '@example.test',
  case candidate % 4
    when 0 then 'Ingeniería en Computación'
    when 1 then 'Ingeniería Industrial'
    when 2 then 'Pedagogía'
    else 'Relaciones Internacionales'
  end,
  1 + (candidate % 9),
  array['Datos sintéticos', 'Pruebas locales'],
  array['JavaScript', 'SQL'],
  'Principiante',
  'Proyecto ficticio creado exclusivamente para probar el flujo local.',
  'Quiero probar de forma segura el proceso progresivo de selección.',
  'Experiencia sintética de coordinación.',
  'Caso ficticio de resolución de conflictos.',
  'Fortalezas y áreas de mejora sintéticas.',
  'Respuesta sintética para pruebas.',
  '6 horas por semana'
from generate_series(1, 11) as candidate
on conflict (id) do nothing;

-- Activate only after all fixture rows exist. This mirrors the production
-- expand/activate split and lets the write guards validate subsequent actions.
update public.seleccion_config
set progressive_enabled = true,
    dispatch_paused = false,
    selection_revision = 0
where id;
