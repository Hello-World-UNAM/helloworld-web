-- Local-only access model and fake delivery mailbox. This file is copied into
-- .selection-lab and must never be added to the production migration history.

alter table public.directiva enable row level security;
alter table public.seleccion_config enable row level security;
alter table public.solicitudes enable row level security;
alter table public.interview_days enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_booking_tokens enable row level security;

revoke all on table public.directiva from anon, authenticated;
revoke all on table public.seleccion_config from anon, authenticated;
revoke all on table public.solicitudes from anon, authenticated;
revoke all on table public.interview_days from anon, authenticated;
revoke all on table public.interviews from anon, authenticated;
revoke all on table public.interview_booking_tokens from anon, authenticated;

grant select on table public.seleccion_config to anon, authenticated;
grant insert on table public.solicitudes to anon;
grant select on table public.directiva, public.solicitudes, public.interview_days,
  public.interviews, public.interview_booking_tokens to authenticated;

create policy selection_lab_config_read
on public.seleccion_config for select
to anon, authenticated
using (true);

create policy selection_lab_directiva_self_read
on public.directiva for select
to authenticated
using (lower(email) = lower((select auth.jwt()) ->> 'email'));

create policy selection_lab_applications_admin_read
on public.solicitudes for select
to authenticated
using (public.is_email_in_directiva((select auth.jwt()) ->> 'email'));

create policy selection_lab_applications_public_insert
on public.solicitudes for insert
to anon
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and final_decision is null
  and evaluated_at is null
  and exists (
    select 1
    from public.seleccion_config c
    where c.id
      and c.is_open
      and not c.applications_closed
      and c.active_season = solicitudes.season
  )
);

create policy selection_lab_interview_days_admin_read
on public.interview_days for select
to authenticated
using (public.is_email_in_directiva((select auth.jwt()) ->> 'email'));

create policy selection_lab_interviews_admin_read
on public.interviews for select
to authenticated
using (public.is_email_in_directiva((select auth.jwt()) ->> 'email'));

create policy selection_lab_tokens_admin_read
on public.interview_booking_tokens for select
to authenticated
using (public.is_email_in_directiva((select auth.jwt()) ->> 'email'));

revoke all on function public.is_email_in_directiva(text) from public;
grant execute on function public.is_email_in_directiva(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  'cvs',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy selection_lab_cv_insert
on storage.objects for insert
to anon
with check (
  bucket_id = 'cvs'
  and (storage.foldername(name))[1] = (
    select active_season
    from public.seleccion_config
    where id and is_open and not applications_closed
  )
);

create policy selection_lab_cv_cleanup
on storage.objects for delete
to anon
using (bucket_id = 'cvs');

create table public.selection_lab_mailbox (
  provider_id text primary key,
  idempotency_key text not null unique,
  from_address text not null,
  recipients jsonb not null check (jsonb_typeof(recipients) = 'array'),
  subject text not null,
  text_body text not null,
  html_body text not null,
  tags jsonb not null default '[]'::jsonb,
  simulated_delivery_status text not null default 'delivered'
    check (simulated_delivery_status in ('delivered', 'bounced', 'failed', 'delayed', 'complained')),
  webhook_http_status integer,
  created_at timestamptz not null default now()
);

alter table public.selection_lab_mailbox enable row level security;
revoke all on table public.selection_lab_mailbox from public, anon, authenticated;
grant select, insert, update on table public.selection_lab_mailbox to service_role;

create function public.selection_lab_inbox()
returns table (
  provider_id text,
  recipients jsonb,
  subject text,
  text_body text,
  html_body text,
  simulated_delivery_status text,
  webhook_http_status integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select m.provider_id, m.recipients, m.subject, m.text_body, m.html_body,
    m.simulated_delivery_status, m.webhook_http_status, m.created_at
  from public.selection_lab_mailbox m
  order by m.created_at desc;
end
$$;

revoke all on function public.selection_lab_inbox() from public, anon;
grant execute on function public.selection_lab_inbox() to authenticated;

-- Manual testing helper: move confirmed synthetic interviews one minute into
-- the past. They remain confirmed so the normal admin action must still mark
-- them completed and exercise the production workflow.
create function public.selection_lab_advance_interviews()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.interviews
  set slot_datetime = now() - interval '1 minute'
  where status = 'confirmed';
  get diagnostics affected = row_count;
  return affected;
end
$$;

revoke all on function public.selection_lab_advance_interviews() from public, anon;
grant execute on function public.selection_lab_advance_interviews() to authenticated;

-- Local-only clock bypass for manual testing. Production keeps the
-- INTERVIEW_IN_FUTURE guard in selection_admin; this contract is copied only
-- into .selection-lab and lets the lab finish a future synthetic interview
-- without changing the production RPC or its migration history.
create function private_selection.selection_lab_save_evaluation(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_interview_id uuid;
  v_solicitud_id uuid;
  v_interview_status text;
  v_final_email_sent boolean;
  v_active_season text;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform private_selection.lock_workflow();

  v_id := (p_data ->> 'id')::uuid;
  select c.active_season into v_active_season
  from public.seleccion_config c
  where c.id;

  select i.id, i.solicitud_id, i.status, s.final_email_sent
    into v_interview_id, v_solicitud_id, v_interview_status, v_final_email_sent
  from public.interviews i
  join public.solicitudes s on s.id = i.solicitud_id
  where i.solicitud_id = v_id
    and s.season = v_active_season
    and i.status = 'confirmed'
  order by i.created_at desc
  limit 1
    for update of i, s;

  if coalesce(v_final_email_sent, false) then
    raise exception 'ALREADY_NOTIFIED';
  end if;

  -- The UI calls this local contract only when it is intentionally finishing
  -- an interview from the evaluation form. If no confirmed interview exists,
  -- keep the normal selection_admin validation as the source of truth.
  if v_interview_id is not null and v_interview_status = 'confirmed'
     and coalesce((p_data ->> 'complete_interview')::boolean, false) then
    update public.interviews
    set status = 'completed'
    where id = v_interview_id and status = 'confirmed';

    perform private_selection.audit(
      v_solicitud_id,
      'interview',
      jsonb_build_object(
        'id', v_interview_id,
        'status', 'completed',
        'reason', 'Selection Lab: se ignoró la fecha futura para la prueba manual.'
      )
    );
  end if;

  -- Avoid sending complete_interview to the production contract after the
  -- local transaction already completed the synthetic interview.
  v_result := public.selection_admin('save', p_data - 'complete_interview');
  return v_result;
end
$$;

create function public.selection_lab_save_evaluation(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return private_selection.selection_lab_save_evaluation(p_data);
end
$$;

revoke all on function private_selection.selection_lab_save_evaluation(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.selection_lab_save_evaluation(jsonb) from public, anon;
grant execute on function public.selection_lab_save_evaluation(jsonb) to authenticated;

-- The same opt-in bypass powers the explicit "Marcar completada" control in
-- the local Entrevistas page. It is deliberately not wired to production.
create function private_selection.selection_lab_complete_interview(p_interview_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud_id uuid;
  v_status text;
  v_final_email_sent boolean;
  v_active_season text;
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform private_selection.lock_workflow();

  select c.active_season into v_active_season
  from public.seleccion_config c
  where c.id;

  select i.solicitud_id, i.status, s.final_email_sent
    into v_solicitud_id, v_status, v_final_email_sent
  from public.interviews i
  join public.solicitudes s on s.id = i.solicitud_id
  where i.id = p_interview_id
    and s.season = v_active_season
  for update of i, s;

  if not found then raise exception 'INTERVIEW_NOT_FOUND'; end if;
  if coalesce(v_final_email_sent, false) then raise exception 'ALREADY_NOTIFIED'; end if;
  if v_status = 'completed' then
    return jsonb_build_object('ok', true, 'status', 'completed');
  end if;
  if v_status <> 'confirmed' then raise exception 'STALE_INTERVIEW'; end if;

  update public.interviews
  set status = 'completed'
  where id = p_interview_id and status = 'confirmed';
  update public.solicitudes
  set selection_revision = selection_revision + 1
  where id = v_solicitud_id;
  perform private_selection.audit(
    v_solicitud_id,
    'interview',
    jsonb_build_object(
      'id', p_interview_id,
      'status', 'completed',
      'reason', 'Selection Lab: se ignoró la fecha futura para la prueba manual.'
    )
  );
  return jsonb_build_object('ok', true, 'status', 'completed');
end
$$;

create function public.selection_lab_complete_interview(p_interview_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_email_in_directiva(auth.jwt() ->> 'email') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return private_selection.selection_lab_complete_interview(p_interview_id);
end
$$;

revoke all on function private_selection.selection_lab_complete_interview(uuid) from public, anon, authenticated, service_role;
revoke all on function public.selection_lab_complete_interview(uuid) from public, anon;
grant execute on function public.selection_lab_complete_interview(uuid) to authenticated;
