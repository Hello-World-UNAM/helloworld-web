-- Read-only storage check. It compares active-season CV references with
-- objects in the private cvs bucket; it never downloads or deletes files.
with active as (
  select active_season as season
  from public.seleccion_config
  where id=true
), refs as (
  select s.id as solicitud_id, s.cv_storage_path as path
  from public.solicitudes s
  join active a on a.season=s.season
  where s.cv_storage_path is not null
), objects as (
  select o.name as path, o.metadata->>'size' as bytes, o.updated_at
  from storage.objects o
  where o.bucket_id='cvs'
)
select
  (select season from active) as active_season,
  (select count(*) from refs) as cv_references,
  (select count(*) from refs r join objects o using (path)) as referenced_objects_present,
  (select count(*) from refs r left join objects o using (path) where o.path is null) as missing_objects,
  (select md5(coalesce(jsonb_agg(to_jsonb(r) order by r.solicitud_id)::text,'')) from refs r) as references_checksum,
  (select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.path)::text,''))
   from objects o where o.path in (select path from refs)) as objects_checksum;

select o.name as unreferenced_cvs_object, o.metadata->>'size' as bytes, o.updated_at
from storage.objects o
where o.bucket_id='cvs'
  and not exists(select 1 from public.solicitudes s where s.cv_storage_path=o.name);
