-- Serialize deletion with mail claims; retain durable Calendar cancellation jobs.
begin;
select private_selection.lock_workflow();
create function private_selection.room_deletion_locked(p_season text) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.solicitudes s where s.season=p_season and s.email_notification_sent)
 or exists(select 1 from private_selection.messages m join public.solicitudes s on s.id=m.solicitud_id
   where s.season=p_season and (m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial'))
   and m.status in ('sending','uncertain','accepted','manual'));
$$;
revoke all on function private_selection.room_deletion_locked(text) from public,anon,authenticated,service_role;
create table private_selection.room_cancellations (
 id uuid primary key, season text not null, event_id text not null,
 status text not null default 'queued' check(status in ('queued','working','failed','done')),
 lease uuid, lease_until timestamptz, last_error text, created_at timestamptz not null default now()
);
alter table private_selection.room_cancellations enable row level security;
revoke all on private_selection.room_cancellations from public,anon,authenticated,service_role;
create function private_selection.guard_room_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private_selection.lock_workflow();
 if private_selection.room_deletion_locked(old.season) then raise exception 'INITIAL_MAIL_LOCKS_AGENDA'; end if;
 if tg_table_name='rooms' then
   if old.calendar_status='working' and old.calendar_lease_until>now() then raise exception 'CALENDAR_IN_PROGRESS'; end if;
   if exists(select 1 from public.interviews where room_id=old.id) then raise exception 'BLOCK_HAS_RESERVATIONS'; end if;
   -- A queued/failed room may already have an event from a previous attempt.
   insert into private_selection.room_cancellations(id,season,event_id) values(old.id,old.season,old.calendar_event_id);
 end if;
 return old;
end $$;
revoke all on function private_selection.guard_room_deletion() from public,anon,authenticated,service_role;
create trigger selection_room_deletion_guard before delete on private_selection.rooms
 for each row execute function private_selection.guard_room_deletion();
create trigger selection_block_deletion_guard before delete on public.interview_days
 for each row when (old.room_id is not null) execute function private_selection.guard_room_deletion();
create function private_selection.guard_deleted_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private_selection.lock_workflow();
 if private_selection.capacity(old.season)<0 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
 return old;
end $$;
revoke all on function private_selection.guard_deleted_capacity() from public,anon,authenticated,service_role;
create trigger selection_deleted_capacity_guard after delete on public.interview_days
 for each row when (old.room_id is not null) execute function private_selection.guard_deleted_capacity();
alter function public.selection_admin(text,jsonb) set schema private_selection;
alter function private_selection.selection_admin(text,jsonb) rename to admin_before_deletion;
revoke all on function private_selection.admin_before_deletion(text,jsonb) from public,anon,authenticated,service_role;
create function public.selection_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; r private_selection.rooms; result jsonb; req uuid;
 previous private_selection.requests; fingerprint text:=md5(p_action||p_data::text);
begin
 if auth.uid() is null or not exists(select 1 from public.directiva where lower(email)=lower(auth.jwt()->>'email')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action<>'state' then perform private_selection.lock_workflow(); end if;
 if p_action='state' then
   result:=private_selection.admin_before_deletion(p_action,p_data);
   return result||jsonb_build_object('room_deletion_locked',private_selection.room_deletion_locked(coalesce(nullif(p_data->>'season',''),result->'config'->>'active_season')),
     'room_cancellations_pending',(select count(*) from private_selection.room_cancellations where status<>'done'));
 end if;
 if p_action<>'room' or p_data->>'operation' is distinct from 'delete' then
   return private_selection.admin_before_deletion(p_action,p_data);
 end if;
 select * into c from public.seleccion_config where id;
 if not c.progressive_enabled then raise exception 'PROGRESSIVE_DISABLED'; end if;
 if not c.is_open or coalesce(nullif(p_data->>'season',''),c.active_season)<>c.active_season then raise exception 'HISTORICAL_READ_ONLY'; end if;
 req:=(p_data->>'request_id')::uuid;
 if req is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 select * into previous from private_selection.requests where id=req;
 if found then
   if previous.actor<>auth.uid() or previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return previous.result;
 end if;
 select * into r from private_selection.rooms where id=(p_data->>'id')::uuid and season=c.active_season for update;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if private_selection.room_deletion_locked(r.season) then raise exception 'INITIAL_MAIL_LOCKS_AGENDA'; end if;
 if exists(select 1 from public.interviews where room_id=r.id) then raise exception 'BLOCK_HAS_RESERVATIONS'; end if;
 if r.calendar_status='working' and r.calendar_lease_until>now() then raise exception 'CALENDAR_IN_PROGRESS'; end if;
 delete from public.interview_days where room_id=r.id;
 delete from private_selection.rooms where id=r.id;
 -- Queued invitations still require their promised capacity; roll back the whole deletion.
 if private_selection.capacity(r.season)<0 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
 update public.seleccion_config set selection_revision=selection_revision+1 where id;
 perform private_selection.audit(null,'room_delete',p_data);
 result:=jsonb_build_object('ok',true,'room_id',r.id);
 insert into private_selection.requests(id,actor,fingerprint,result) values(req,auth.uid(),fingerprint,result);
 return result;
end $$;
revoke all on function public.selection_admin(text,jsonb) from public,anon;
grant execute on function public.selection_admin(text,jsonb) to authenticated;
-- Extend the existing worker without changing room creation or booking jobs.
alter function public.selection_calendar_worker(text,jsonb) set schema private_selection;
alter function private_selection.selection_calendar_worker(text,jsonb) rename to calendar_before_deletion;
revoke all on function private_selection.calendar_before_deletion(text,jsonb) from public,anon,authenticated,service_role;
create function public.selection_calendar_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private_selection.room_cancellations; token uuid:=gen_random_uuid();
begin
 perform private_selection.lock_workflow();
 if p_action='claim' and not coalesce((p_data->>'bookings_only')::boolean,false) then
   select * into job from private_selection.room_cancellations
   where (status='queued' or (status='failed' and lease_until<now()) or (status='working' and lease_until<now()))
   and (not (p_data ? 'room_id') or id=(p_data->>'room_id')::uuid)
   order by created_at,id limit 1 for update;
   if found then
     update private_selection.room_cancellations set status='working',lease=token,lease_until=now()+interval '2 minutes' where id=job.id;
     return jsonb_build_object('kind','cancel','room_deleted',true,'id',job.id,'event_id',job.event_id,'lease',token);
   end if;
 elsif p_action='finish' and coalesce((p_data->>'room_deleted')::boolean,false) then
   update private_selection.room_cancellations set status=case when p_data->>'outcome'='ready' then 'done' else 'failed' end,
     last_error=case when p_data->>'outcome'='ready' then null else left(p_data->>'error',300) end,lease=null,lease_until=case when p_data->>'outcome'='ready' then null else now()+interval '1 minute' end
   where id=(p_data->>'id')::uuid and status='working' and lease=(p_data->>'lease')::uuid;
   if not found then raise exception 'STALE_CALENDAR_LEASE'; end if;
   return jsonb_build_object('ok',true);
 end if;
 return private_selection.calendar_before_deletion(p_action,p_data);
end $$;
revoke all on function public.selection_calendar_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.selection_calendar_worker(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
