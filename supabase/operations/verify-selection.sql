-- Read-only. Outputs counts and integrity checks, never applicant data/tokens.
select c.active_season,c.progressive_enabled,c.dispatch_paused,
  (select count(*) from public.solicitudes where season=c.active_season) applications,
  (select count(*) from private_selection.messages) messages,
  b.id backup_id,b.captured_at,md5(b.data::text)=b.manifest->>'checksum' backup_verified,
  (select count(*) from public.miembros_activos) members,
  (select count(*) from public.puntos_registros) points,
  (select md5(coalesce(jsonb_agg(to_jsonb(m) order by m.id)::text,'')) from public.miembros_activos m)=b.manifest->>'members_checksum' members_unchanged,
  (select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text,'')) from public.puntos_registros p)=b.manifest->>'points_checksum' points_unchanged,
  coalesce(b.manifest->>'cv_missing_objects','0')='0' backup_cv_objects_present
from public.seleccion_config c
cross join lateral (select * from private_selection_backups.snapshots where season=c.active_season order by captured_at desc limit 1) b
where c.id;

select kind,status,delivery_status,count(*) from private_selection.messages group by kind,status,delivery_status;

select not exists(
    select 1 from pg_trigger
    where tgrelid='public.solicitudes'::regclass
      and tgname='email_confirmacion_solicitud'
      and not tgisinternal
      and tgenabled <> 'D'
  ) as legacy_solicitud_mail_trigger_disabled,
  not exists(
    select 1 from pg_trigger
    where tgrelid='public.interviews'::regclass
      and tgname='email_confirmacion_entrevista'
      and not tgisinternal
      and tgenabled <> 'D'
  ) as legacy_interview_mail_trigger_disabled;

select not has_schema_privilege('anon','private_selection','usage') as private_queue_not_public,
  not has_schema_privilege('authenticated','private_selection_backups','usage') as backup_not_client_accessible,
  not has_function_privilege('anon','public.selection_admin(text,jsonb)','execute') as admin_rpc_not_anonymous,
  not has_function_privilege('authenticated','public.selection_worker(text,jsonb)','execute') as worker_service_only;
