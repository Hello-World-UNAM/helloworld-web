-- Run once before changing a live selection workflow. The advisory/table locks
-- make the snapshot self-consistent without disabling the public form.
begin isolation level repeatable read;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(73400001);
lock table public.seleccion_config, public.solicitudes, public.interviews,
  public.interview_booking_tokens, public.interview_days
  in share row exclusive mode;
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
do $$
declare v_season text; v_data jsonb; v_manifest jsonb;
begin
  if to_regclass('public.miembros_activos') is null
    or to_regclass('public.puntos_registros') is null then
    raise exception 'PROTECTED_TABLES_REQUIRED';
  end if;
  select active_season into strict v_season from public.seleccion_config where id=true;
  if v_season is null then raise exception 'NO_ACTIVE_SEASON'; end if;
  select jsonb_build_object(
    'solicitudes',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.solicitudes s where season=v_season),'[]'::jsonb),
    'config',(select to_jsonb(c) from public.seleccion_config c where id=true),
    'interviews',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.interviews i join public.solicitudes s on s.id=i.solicitud_id where s.season=v_season),'[]'::jsonb),
    'tokens',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.interview_booking_tokens i join public.solicitudes s on s.id=i.solicitud_id where s.season=v_season),'[]'::jsonb),
    'days',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.interview_days d where season=v_season),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from private_selection.messages m join public.solicitudes s on s.id=m.solicitud_id where s.season=v_season),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from private_selection.events e where e.season=v_season),'[]'::jsonb),
    'cv_references',coalesce((select jsonb_agg(jsonb_build_object('solicitud_id',s.id,'path',s.cv_storage_path) order by s.id) from public.solicitudes s where s.season=v_season and s.cv_storage_path is not null),'[]'::jsonb),
    'cv_objects',coalesce((select jsonb_agg(jsonb_build_object('bucket_id',o.bucket_id,'name',o.name,'metadata',o.metadata,'updated_at',o.updated_at) order by o.name)
      from storage.objects o
      where o.bucket_id='cvs' and o.name in (select s.cv_storage_path from public.solicitudes s where s.season=v_season and s.cv_storage_path is not null)),'[]'::jsonb)
  ) into v_data;
  select jsonb_build_object('format_version',2,'checksum',md5(v_data::text),
    'solicitudes',jsonb_array_length(v_data->'solicitudes'),
    'interviews',jsonb_array_length(v_data->'interviews'),
    'tokens',jsonb_array_length(v_data->'tokens'),
    'days',jsonb_array_length(v_data->'days'),
    'messages',jsonb_array_length(v_data->'messages'),
    'events',jsonb_array_length(v_data->'events'),
    'cv_references',(select count(*) from public.solicitudes where season=v_season and cv_storage_path is not null),
    'cv_objects',jsonb_array_length(v_data->'cv_objects'),
    'cv_missing_objects',jsonb_array_length(v_data->'cv_references')-jsonb_array_length(v_data->'cv_objects'),
    'members_count',(select count(*) from public.miembros_activos),
    'members_checksum',(select md5(coalesce(jsonb_agg(to_jsonb(m) order by m.id)::text,'')) from public.miembros_activos m),
    'points_count',(select count(*) from public.puntos_registros),
    'points_checksum',(select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from public.puntos_registros p)
  ) into v_manifest;
  insert into private_selection_backups.snapshots(season,data,manifest) values(v_season,v_data,v_manifest);
end $$;
commit;
-- Return metadata only, never applicants' records or tokens.
select id,captured_at,season,manifest,md5(data::text)=manifest->>'checksum' as verified
from private_selection_backups.snapshots
where season=(select active_season from public.seleccion_config where id=true)
order by captured_at desc limit 1;
