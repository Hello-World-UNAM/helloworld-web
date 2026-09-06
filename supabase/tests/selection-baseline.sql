-- Sanitized production schema for isolated selection tests. No data, secrets or HTTP triggers.
create schema if not exists auth;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
do $bootstrap_auth_helpers$
begin
  -- A plain Postgres test container does not have Supabase Auth helpers, while
  -- the local Supabase stack does. Never replace the real Auth functions.
  if to_regprocedure('auth.uid()') is null then
    execute $sql$create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'$sql$;
  end if;
  if to_regprocedure('auth.jwt()') is null then
    execute $sql$create function auth.jwt() returns jsonb language sql stable as
      'select coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb'$sql$;
  end if;
end
$bootstrap_auth_helpers$;
create table public.directiva (
id uuid not null default gen_random_uuid(),
email text not null,
nombre text,
role text not null default 'admin'::text,
created_at timestamp with time zone not null default now(),
constraint directiva_email_key UNIQUE (email),
constraint directiva_pkey PRIMARY KEY (id),
constraint directiva_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'reviewer'::text])))
);
create table public.interview_booking_tokens (
id uuid not null default gen_random_uuid(),
solicitud_id uuid not null,
token text not null,
reschedule_count integer not null default 0,
created_at timestamp with time zone not null default now(),
used_at timestamp with time zone,
constraint interview_booking_tokens_pkey PRIMARY KEY (id),
constraint interview_booking_tokens_solicitud_id_key UNIQUE (solicitud_id),
constraint interview_booking_tokens_token_key UNIQUE (token),
constraint interview_tokens_count_nonneg CHECK ((reschedule_count >= 0))
);
create table public.interview_days (
id uuid not null default gen_random_uuid(),
season text not null,
date date not null,
start_time time without time zone not null,
end_time time without time zone not null,
duration_minutes integer not null default 30,
meet_url text,
notes text,
created_at timestamp with time zone not null default now(),
created_by text,
constraint interview_days_duration_check CHECK ((duration_minutes = ANY (ARRAY[15, 20, 30, 45, 60]))),
constraint interview_days_pkey PRIMARY KEY (id),
constraint interview_days_season_format CHECK ((season ~ '^[0-9]{4}-([12]|[0-9]{4})$'::text)),
constraint interview_days_time_order CHECK ((end_time > start_time)),
constraint interview_days_unique_per_season UNIQUE (season, date)
);
create table public.interviews (
id uuid not null default gen_random_uuid(),
solicitud_id uuid not null,
slot_datetime timestamp with time zone not null,
duration_minutes integer not null default 30,
meet_url text,
status text not null default 'confirmed'::text,
reschedule_count integer not null default 0,
email_sent boolean not null default false,
created_at timestamp with time zone not null default now(),
cancelled_at timestamp with time zone,
notes text,
constraint interviews_pkey PRIMARY KEY (id),
constraint interviews_reschedule_nonneg CHECK ((reschedule_count >= 0)),
constraint interviews_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text])))
);
create table public.seleccion_config (
id boolean not null default true,
is_open boolean not null default false,
active_season text,
next_season_hint text,
opened_at timestamp with time zone,
opened_by text,
closed_at timestamp with time zone,
closed_by text,
updated_at timestamp with time zone not null default now(),
interview_deadline_at timestamp with time zone,
whatsapp_url text not null default ''::text,
applications_closed boolean not null default false,
constraint seleccion_config_active_season_format CHECK (((active_season IS NULL) OR (active_season ~ '^[0-9]{4}-[12]$'::text))),
constraint seleccion_config_open_consistency CHECK ((((is_open = true) AND (active_season IS NOT NULL)) OR (is_open = false))),
constraint seleccion_config_pkey PRIMARY KEY (id),
constraint seleccion_config_singleton CHECK ((id = true))
);
create table public.solicitudes (
id uuid not null default gen_random_uuid(),
season text not null,
status text not null default 'pending'::text,
created_at timestamp with time zone not null default now(),
reviewed_at timestamp with time zone,
reviewed_by text,
notes text,
email_notification_sent boolean not null default false,
nombre text not null,
numero_cuenta text not null,
correo text not null,
carrera text not null,
semestre integer not null,
intereses text[],
lenguajes text[],
nivel_experiencia text,
proyecto_descripcion text not null,
github_url text,
linkedin_url text,
portfolio_url text,
cv_storage_path text,
motivacion text not null,
experiencia_liderazgo text not null,
manejo_conflicto text not null,
fortalezas_areas text not null,
curiosidad text not null,
horas_disponibles text not null,
eval_blandas_score integer,
eval_blandas_notes text,
eval_motivacion_score integer,
eval_motivacion_notes text,
eval_proyectos_score integer,
eval_proyectos_notes text,
eval_aporte_score integer,
eval_aporte_notes text,
eval_tecnica_score integer,
eval_tecnica_notes text,
eval_overall_notes text,
evaluated_by text,
evaluated_at timestamp with time zone,
final_decision text,
final_email_sent boolean not null default false,
constraint solicitudes_carrera_check CHECK (((length(TRIM(BOTH FROM carrera)) >= 1) AND (length(TRIM(BOTH FROM carrera)) <= 100))),
constraint solicitudes_correo_check CHECK (((correo ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text) AND (length(correo) <= 200))),
constraint solicitudes_curiosidad_len_check CHECK (((length(curiosidad) >= 1) AND (length(curiosidad) <= 5000))),
constraint solicitudes_cv_path_len_check CHECK (((cv_storage_path IS NULL) OR (length(cv_storage_path) <= 500))),
constraint solicitudes_eval_aporte_score_check CHECK (((eval_aporte_score >= 1) AND (eval_aporte_score <= 5))),
constraint solicitudes_eval_blandas_score_check CHECK (((eval_blandas_score >= 1) AND (eval_blandas_score <= 5))),
constraint solicitudes_eval_motivacion_score_check CHECK (((eval_motivacion_score >= 1) AND (eval_motivacion_score <= 5))),
constraint solicitudes_eval_proyectos_score_check CHECK (((eval_proyectos_score >= 1) AND (eval_proyectos_score <= 5))),
constraint solicitudes_eval_tecnica_score_check CHECK (((eval_tecnica_score >= 1) AND (eval_tecnica_score <= 5))),
constraint solicitudes_experiencia_liderazgo_len_check CHECK (((length(experiencia_liderazgo) >= 1) AND (length(experiencia_liderazgo) <= 5000))),
constraint solicitudes_final_decision_check CHECK ((final_decision = ANY (ARRAY['accepted'::text, 'rejected'::text]))),
constraint solicitudes_fortalezas_areas_len_check CHECK (((length(fortalezas_areas) >= 1) AND (length(fortalezas_areas) <= 5000))),
constraint solicitudes_github_url_len_check CHECK (((github_url IS NULL) OR (length(github_url) <= 500))),
constraint solicitudes_horas_disponibles_len_check CHECK (((length(horas_disponibles) >= 1) AND (length(horas_disponibles) <= 100))),
constraint solicitudes_intereses_size_check CHECK (((intereses IS NULL) OR (array_length(intereses, 1) <= 20))),
constraint solicitudes_lenguajes_size_check CHECK (((lenguajes IS NULL) OR (array_length(lenguajes, 1) <= 20))),
constraint solicitudes_linkedin_url_len_check CHECK (((linkedin_url IS NULL) OR (length(linkedin_url) <= 500))),
constraint solicitudes_manejo_conflicto_len_check CHECK (((length(manejo_conflicto) >= 1) AND (length(manejo_conflicto) <= 5000))),
constraint solicitudes_motivacion_len_check CHECK (((length(motivacion) >= 1) AND (length(motivacion) <= 5000))),
constraint solicitudes_nombre_check CHECK (((length(TRIM(BOTH FROM nombre)) >= 1) AND (length(TRIM(BOTH FROM nombre)) <= 200))),
constraint solicitudes_numero_cuenta_check CHECK ((numero_cuenta ~ '^[0-9]{9}$'::text)),
constraint solicitudes_pkey PRIMARY KEY (id),
constraint solicitudes_portfolio_url_len_check CHECK (((portfolio_url IS NULL) OR (length(portfolio_url) <= 500))),
constraint solicitudes_proyecto_descripcion_len_check CHECK (((length(proyecto_descripcion) >= 1) AND (length(proyecto_descripcion) <= 5000))),
constraint solicitudes_season_check CHECK ((season ~ '^[0-9]{4}-([12]|[0-9]{4})$'::text)),
constraint solicitudes_semestre_check CHECK (((semestre >= 1) AND (semestre <= 10))),
constraint solicitudes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'accepted'::text, 'rejected'::text]))),
constraint solicitudes_unique_cuenta_season UNIQUE (numero_cuenta, season)
);
CREATE OR REPLACE FUNCTION public.auto_complete_interview_on_eval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.evaluated_at is not null and (old.evaluated_at is null or old.evaluated_at != new.evaluated_at) then
    update public.interviews
    set status = 'completed'
    where solicitud_id = new.id and status = 'confirmed';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.book_interview(p_token text, p_slot timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token public.interview_booking_tokens%rowtype;
  v_solicitud public.solicitudes%rowtype;
  v_day public.interview_days%rowtype;
  v_existing public.interviews%rowtype;
  v_new_id uuid;
  v_max_reschedules int := 2;
  v_slot_date date;
  v_slot_time time;
  v_minutes_offset int;
  v_slot_local timestamp;
begin
  select * into v_token from public.interview_booking_tokens where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_INVALID');
  end if;

  select * into v_solicitud from public.solicitudes where id = v_token.solicitud_id;
  if v_solicitud.status != 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'NOT_ACCEPTED');
  end if;

  -- Convertir el timestamptz UTC a hora local México (naive)
  v_slot_local := p_slot AT TIME ZONE 'America/Mexico_City';
  v_slot_date  := v_slot_local::date;
  v_slot_time  := v_slot_local::time;

  select * into v_day
  from public.interview_days
  where season = v_solicitud.season and date = v_slot_date;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'INVALID_SLOT_DAY');
  end if;

  if v_slot_time < v_day.start_time or v_slot_time >= v_day.end_time then
    return jsonb_build_object('ok', false, 'error', 'SLOT_OUT_OF_RANGE');
  end if;

  v_minutes_offset := (extract(epoch from (v_slot_time - v_day.start_time)) / 60)::int;
  if v_minutes_offset % v_day.duration_minutes <> 0 then
    return jsonb_build_object('ok', false, 'error', 'SLOT_NOT_ALIGNED');
  end if;

  if p_slot < now() then
    return jsonb_build_object('ok', false, 'error', 'SLOT_IN_PAST');
  end if;

  if v_day.meet_url is null or length(trim(v_day.meet_url)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'MISSING_MEET_URL');
  end if;

  select * into v_existing
  from public.interviews
  where solicitud_id = v_solicitud.id and status = 'confirmed';

  if found then
    if v_existing.slot_datetime = p_slot then
      return jsonb_build_object('ok', false, 'error', 'SAME_SLOT');
    end if;
    if v_token.reschedule_count >= v_max_reschedules then
      return jsonb_build_object(
        'ok', false, 'error', 'MAX_RESCHEDULES',
        'reschedule_count', v_token.reschedule_count,
        'max_reschedules', v_max_reschedules
      );
    end if;
    update public.interviews
    set status = 'cancelled', cancelled_at = now()
    where id = v_existing.id;
    update public.interview_booking_tokens
    set reschedule_count = reschedule_count + 1
    where id = v_token.id;
  else
    update public.interview_booking_tokens
    set used_at = coalesce(used_at, now())
    where id = v_token.id;
  end if;

  begin
    insert into public.interviews (solicitud_id, slot_datetime, duration_minutes, meet_url)
    values (v_solicitud.id, p_slot, v_day.duration_minutes, v_day.meet_url)
    returning id into v_new_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'SLOT_TAKEN');
  end;

  return jsonb_build_object(
    'ok', true,
    'interview_id', v_new_id,
    'slot_datetime', p_slot,
    'duration_minutes', v_day.duration_minutes,
    'meet_url', v_day.meet_url,
    'was_reschedule', v_existing.id is not null
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancel_interview(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token public.interview_booking_tokens%rowtype;
  v_interview public.interviews%rowtype;
begin
  select * into v_token from public.interview_booking_tokens where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_INVALID');
  end if;

  select * into v_interview
  from public.interviews
  where solicitud_id = v_token.solicitud_id and status = 'confirmed';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NO_ACTIVE_INTERVIEW');
  end if;

  if v_interview.slot_datetime < now() then
    return jsonb_build_object('ok', false, 'error', 'INTERVIEW_IN_PAST');
  end if;

  update public.interviews
  set status = 'cancelled', cancelled_at = now()
  where id = v_interview.id;

  return jsonb_build_object('ok', true, 'cancelled_id', v_interview.id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_booking_state(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token public.interview_booking_tokens%rowtype;
  v_solicitud public.solicitudes%rowtype;
  v_interview public.interviews%rowtype;
  v_days jsonb;
  v_taken_slots jsonb;
begin
  select * into v_token from public.interview_booking_tokens where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'TOKEN_INVALID');
  end if;

  select * into v_solicitud from public.solicitudes where id = v_token.solicitud_id;
  if not found or v_solicitud.status != 'accepted' then
    return jsonb_build_object('ok', false, 'error', 'NOT_ACCEPTED');
  end if;

  select * into v_interview
  from public.interviews
  where solicitud_id = v_solicitud.id and status = 'confirmed'
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'date', d.date,
    'start_time', d.start_time,
    'end_time', d.end_time,
    'duration_minutes', d.duration_minutes
  ) order by d.date), '[]'::jsonb)
  into v_days
  from public.interview_days d
  where d.season = v_solicitud.season;

  -- Convertir slot_datetime UTC a date local México para comparar contra interview_days.date
  select coalesce(jsonb_agg(slot_datetime order by slot_datetime), '[]'::jsonb)
  into v_taken_slots
  from public.interviews i
  where i.status = 'confirmed'
    and exists (
      select 1 from public.interview_days d
      where d.season = v_solicitud.season
        and d.date = (i.slot_datetime AT TIME ZONE 'America/Mexico_City')::date
    );

  return jsonb_build_object(
    'ok', true,
    'solicitud', jsonb_build_object(
      'nombre', v_solicitud.nombre,
      'season', v_solicitud.season
    ),
    'current_interview', case when v_interview.id is not null then jsonb_build_object(
      'id', v_interview.id,
      'slot_datetime', v_interview.slot_datetime,
      'duration_minutes', v_interview.duration_minutes,
      'meet_url', v_interview.meet_url
    ) else null end,
    'days', v_days,
    'taken_slots', v_taken_slots,
    'reschedule_count', v_token.reschedule_count,
    'max_reschedules', 2,
    'can_reschedule', v_token.reschedule_count < 2
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_email_in_directiva(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.directiva
    where email = lower(trim(p_email))
  );
$function$
;
CREATE UNIQUE INDEX interviews_one_active_per_slot ON public.interviews USING btree (slot_datetime) WHERE (status = 'confirmed'::text);
CREATE UNIQUE INDEX interviews_one_active_per_solicitud ON public.interviews USING btree (solicitud_id) WHERE (status = 'confirmed'::text);
