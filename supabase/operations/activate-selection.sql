-- RELEASE GATE. Run only after the production checks in SELECTION-RUNBOOK.md
-- are green. The transaction leaves dispatch paused, so it cannot send mail.
-- It touches only selection configuration/triggers and the private snapshot.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(73400001);

-- The backup table is private and exists outside the application schema. The
-- IF NOT EXISTS clauses make this safe when the standalone backup operation
-- was already run; they do not replace the required fresh snapshot below.
create schema if not exists private_selection_backups;
revoke all on schema private_selection_backups from public, anon, authenticated, service_role;
create table if not exists private_selection_backups.snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  season text not null,
  data jsonb not null,
  manifest jsonb not null
);
alter table private_selection_backups.snapshots enable row level security;
revoke all on private_selection_backups.snapshots from public, anon, authenticated, service_role;

-- Keep this order aligned with backup-selection.sql and the workflow lock.
-- SHARE ROW EXCLUSIVE permits reads but prevents a selection write from
-- interleaving with the final snapshot or trigger switch.
lock table public.seleccion_config, public.solicitudes, public.interviews,
  public.interview_booking_tokens, public.interview_days
  in share row exclusive mode;

do $$
declare
  v_season text;
  v_data jsonb;
  v_manifest jsonb;
  v_snapshot_id uuid;
  v_config public.seleccion_config;
begin
  select * into strict v_config from public.seleccion_config where id=true;
  v_season := v_config.active_season;
  if v_season is null then raise exception 'NO_ACTIVE_SEASON'; end if;
  if v_config.progressive_enabled then raise exception 'ALREADY_ACTIVE'; end if;
  if not v_config.dispatch_paused then raise exception 'PAUSE_REQUIRED'; end if;
  if to_regclass('public.miembros_activos') is null
    or to_regclass('public.puntos_registros') is null then
    raise exception 'PROTECTED_TABLES_REQUIRED';
  end if;

  -- Fail closed if migrations or the private queue are incomplete.
  if to_regclass('private_selection.messages') is null
    or to_regclass('private_selection.events') is null
    or to_regclass('public.interview_booking_tokens') is null then
    raise exception 'SELECTION_SCHEMA_INCOMPLETE';
  end if;
  if to_regclass('vault.secrets') is null or to_regclass('cron.job') is null then
    raise exception 'SCHEDULER_REQUIRED';
  end if;
  if not exists(select 1 from vault.secrets where name='selection_worker_secret')
    or not exists(select 1 from vault.secrets where name='selection_project_url') then
    raise exception 'SCHEDULER_SECRETS_REQUIRED';
  end if;
  if not exists(select 1 from cron.job where jobname='selection-dispatch-minute' and active) then
    raise exception 'SCHEDULER_REQUIRED';
  end if;

  -- The legacy flow has not been allowed to create a token or communicate a
  -- decision for this season. Any such row needs human reconciliation first.
  if exists(
    select 1
    from public.interview_booking_tokens t
    join public.solicitudes s on s.id=t.solicitud_id
    where s.season=v_season and t.invited_at is null
  ) or exists(
    select 1
    from public.solicitudes
    where season=v_season and (email_notification_sent or final_email_sent)
  ) then
    raise exception 'LEGACY_ACTIVITY_DETECTED: refresh backup and reconcile before cutover';
  end if;

  -- Capture a complete database-side copy of the selection state. CV binary
  -- contents are intentionally not embedded; cv_objects records the exact
  -- referenced storage objects and the external archive is checked separately.
  select jsonb_build_object(
    'solicitudes',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.solicitudes s where s.season=v_season),'[]'::jsonb),
    'config',(select to_jsonb(c) from public.seleccion_config c where c.id=true),
    'interviews',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.interviews i join public.solicitudes s on s.id=i.solicitud_id where s.season=v_season),'[]'::jsonb),
    'tokens',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.interview_booking_tokens t join public.solicitudes s on s.id=t.solicitud_id where s.season=v_season),'[]'::jsonb),
    'days',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.interview_days d where d.season=v_season),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from private_selection.messages m join public.solicitudes s on s.id=m.solicitud_id where s.season=v_season),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from private_selection.events e where e.season=v_season),'[]'::jsonb),
    'cv_references',coalesce((select jsonb_agg(jsonb_build_object('solicitud_id',s.id,'path',s.cv_storage_path) order by s.id) from public.solicitudes s where s.season=v_season and s.cv_storage_path is not null),'[]'::jsonb),
    'cv_objects',coalesce((select jsonb_agg(jsonb_build_object('bucket_id',o.bucket_id,'name',o.name,'metadata',o.metadata,'updated_at',o.updated_at) order by o.name)
      from storage.objects o
      where o.bucket_id='cvs' and o.name in (select s.cv_storage_path from public.solicitudes s where s.season=v_season and s.cv_storage_path is not null)),'[]'::jsonb)
  ) into v_data;

  v_manifest := jsonb_build_object(
    'format_version',2,
    'checksum',md5(v_data::text),
    'solicitudes',jsonb_array_length(v_data->'solicitudes'),
    'interviews',jsonb_array_length(v_data->'interviews'),
    'tokens',jsonb_array_length(v_data->'tokens'),
    'days',jsonb_array_length(v_data->'days'),
    'messages',jsonb_array_length(v_data->'messages'),
    'events',jsonb_array_length(v_data->'events'),
    'cv_references',jsonb_array_length(v_data->'cv_references'),
    'cv_objects',jsonb_array_length(v_data->'cv_objects'),
    'cv_missing_objects',jsonb_array_length(v_data->'cv_references')-jsonb_array_length(v_data->'cv_objects'),
    'members_count',(select count(*) from public.miembros_activos),
    'members_checksum',(select md5(coalesce(jsonb_agg(to_jsonb(m) order by m.id)::text,'')) from public.miembros_activos m),
    'points_count',(select count(*) from public.puntos_registros),
    'points_checksum',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from public.puntos_registros p)
  );
  if v_manifest->>'checksum' <> md5(v_data::text) then raise exception 'BACKUP_CHECKSUM_FAILED'; end if;
  if (v_manifest->>'cv_missing_objects')::integer <> 0 then raise exception 'CV_BACKUP_INCOMPLETE'; end if;

  insert into private_selection_backups.snapshots(season,data,manifest)
  values(v_season,v_data,v_manifest)
  returning id into v_snapshot_id;
  if not exists(
    select 1 from private_selection_backups.snapshots b
    where b.id=v_snapshot_id and md5(b.data::text)=b.manifest->>'checksum'
  ) then raise exception 'BACKUP_VERIFY_FAILED'; end if;

  -- Confirm the expected legacy hooks are present before disabling exactly
  -- those hooks. No broad trigger disable/drop is permitted here.
  if not exists(select 1 from pg_trigger where tgrelid='public.solicitudes'::regclass and tgname='email_confirmacion_solicitud' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgrelid='public.interviews'::regclass and tgname='email_confirmacion_entrevista' and not tgisinternal) then
    raise exception 'LEGACY_TRIGGERS_NOT_FOUND';
  end if;

  alter table public.solicitudes disable trigger email_confirmacion_solicitud;
  alter table public.interviews disable trigger email_confirmacion_entrevista;
  update public.seleccion_config
  set progressive_enabled=true,
      dispatch_paused=true,
      selection_revision=selection_revision+1
  where id=true;
  perform private_selection.audit(null,'activate',jsonb_build_object('sending_paused',true,'backup_id',v_snapshot_id));
end;
$$;
commit;

-- Metadata only; never print applicants, tokens, message bodies or CV paths.
select b.id,b.captured_at,b.season,b.manifest,
  md5(b.data::text)=b.manifest->>'checksum' as verified
from private_selection_backups.snapshots b
where b.season=(select active_season from public.seleccion_config where id=true)
order by b.captured_at desc
limit 1;
