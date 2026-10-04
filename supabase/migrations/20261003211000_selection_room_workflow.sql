-- Simplify room operations; preserve historical bookings, links and audit data.
begin;
select pg_advisory_xact_lock(73400001);
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='private_selection.rooms'::regclass
   and contype='c' and pg_get_constraintdef(oid) like '%host_verified_at%' loop
   execute format('alter table private_selection.rooms drop constraint %I',c.conname);
 end loop;
end $$;
alter table private_selection.rooms add constraint rooms_published_ready
 check (not published or (primary_email is not null and backup_email is not null
   and primary_email<>backup_email and meet_url ~ '^https://meet[.]google[.]com/'));
revoke insert,update,delete on public.interview_days from authenticated;
create or replace function public.selection_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; r private_selection.rooms; b public.interview_days;
 result jsonb; v_new_room uuid; n integer; duration integer; op text; v_season text;
 request_id uuid; previous private_selection.requests; fingerprint text:=md5(p_action||p_data::text);
begin
 if auth.uid() is null or not exists(select 1 from public.directiva where lower(email)=lower(auth.jwt()->>'email')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action<>'state' then perform private_selection.lock_workflow(); end if;
 select * into c from public.seleccion_config where id;
 v_season:=coalesce(nullif(p_data->>'season',''),c.active_season);
 if p_action='state' then
   result:=private_selection.admin_before_rooms(p_action,p_data);
   result:=jsonb_set(result,'{interviews}',coalesce((select jsonb_agg(x-'calendar_lease'-'calendar_lease_until') from jsonb_array_elements(result->'interviews') x),'[]'));
   return result || jsonb_build_object('rooms',coalesce((select jsonb_agg(to_jsonb(x)-'calendar_lease'-'calendar_lease_until' order by date,position) from private_selection.rooms x where season=v_season),'[]'));
 end if;
 if p_action='day' then raise exception 'LEGACY_AGENDA_RETIRED'; end if;
 if p_action<>'room' and not (p_action='config' and p_data ? 'interview_duration_minutes') then
   return private_selection.admin_before_rooms(p_action,p_data);
 end if;
 if not c.progressive_enabled then raise exception 'PROGRESSIVE_DISABLED'; end if;
 if not c.is_open or v_season is distinct from c.active_season then raise exception 'HISTORICAL_READ_ONLY'; end if;
 if p_action='config' then
   result:=private_selection.admin_before_rooms(p_action,p_data-'interview_duration_minutes');
   duration:=(p_data->>'interview_duration_minutes')::integer;
   if duration is null or duration not in (15,20,30,45,60) then raise exception 'INVALID_DURATION'; end if;
   update public.seleccion_config set interview_duration_minutes=duration where id;
   update public.interview_days d set duration_minutes=duration where room_id is not null and season=c.active_season
     and (d.date+d.start_time) at time zone 'America/Mexico_City'>now()
     and d.end_time-d.start_time>=make_interval(mins=>duration)
     and not exists(select 1 from public.interviews i where day_id=d.id);
   return result;
 end if;
 op:=p_data->>'operation';
 request_id:=(p_data->>'request_id')::uuid;
 if request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 select * into previous from private_selection.requests where id=request_id;
 if found then
   if previous.actor<>auth.uid() or previous.fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return previous.result;
 end if;
 if op='create' then
   n:=coalesce((p_data->>'room_count')::integer,1);
   duration:=c.interview_duration_minutes;
   if n<1 or (p_data->>'date') is null or (p_data->>'date')::date<(now() at time zone 'America/Mexico_City')::date then raise exception 'INVALID_JOURNEY'; end if;
   -- No arbitrary limit on the number of rooms. All initial blocks share the season duration.
   for idx in 1..n loop
     v_new_room:=gen_random_uuid();
     insert into private_selection.rooms(id,season,date,name,position,calendar_event_id)
     select v_new_room,c.active_season,(p_data->>'date')::date,'Sala '||idx,
       coalesce(max(position),0)+1,'clubroom'||replace(v_new_room::text,'-','')
       from private_selection.rooms where season=c.active_season and date=(p_data->>'date')::date;
     insert into public.interview_days(season,date,start_time,end_time,duration_minutes,room_id,created_by)
     values(c.active_season,(p_data->>'date')::date,(p_data->>'start_time')::time,(p_data->>'end_time')::time,duration,v_new_room,auth.jwt()->>'email');
   end loop;
 else
   select * into r from private_selection.rooms where id=(p_data->>'id')::uuid and season=c.active_season for update;
   if not found then raise exception 'ROOM_NOT_FOUND'; end if;
   if op='edit' then
     update private_selection.rooms set name=coalesce(nullif(btrim(p_data->>'name'),''),name),
       primary_email=case when p_data ? 'primary_email' then nullif(lower(btrim(p_data->>'primary_email')),'') else primary_email end,
       backup_email=case when p_data ? 'backup_email' then nullif(lower(btrim(p_data->>'backup_email')),'') else backup_email end where id=r.id;
     if exists(select 1 from private_selection.rooms x where x.id=r.id and (x.primary_email,x.backup_email) is distinct from (r.primary_email,r.backup_email)) then
       if r.calendar_status='working' and r.calendar_lease_until>now() then raise exception 'CALENDAR_IN_PROGRESS'; end if;
       update private_selection.rooms set published=false,
         calendar_status='queued',calendar_error=null,calendar_revision=calendar_revision+1 where id=r.id;
       -- Revalidate conflicts using the new host/backup, without touching bookings or links.
       update public.interview_days set interviewers=interviewers where room_id=r.id;
     end if;
   elsif op='block' then
     if p_data ? 'block_id' then
       select * into b from public.interview_days where id=(p_data->>'block_id')::uuid and room_id=r.id;
       if not found then raise exception 'BLOCK_NOT_FOUND'; end if;
       if coalesce((p_data->>'delete')::boolean,false) then delete from public.interview_days where id=b.id;
       else
         update public.interview_days set start_time=coalesce((p_data->>'start_time')::time,start_time),
           end_time=coalesce((p_data->>'end_time')::time,end_time),
           interviewers=case when p_data ? 'interviewers' then array(select lower(btrim(value)) from jsonb_array_elements_text(p_data->'interviewers')) else interviewers end where id=b.id;
       end if;
     else
       insert into public.interview_days(season,date,start_time,end_time,duration_minutes,room_id,interviewers,created_by)
       values(r.season,r.date,(p_data->>'start_time')::time,(p_data->>'end_time')::time,c.interview_duration_minutes,r.id,
         array(select lower(btrim(value)) from jsonb_array_elements_text(coalesce(p_data->'interviewers','[]'))),auth.jwt()->>'email');
     end if;
     if (r.verification->>'event_start')::timestamptz is distinct from
         (select (date+min(start_time)) at time zone 'America/Mexico_City' from public.interview_days where room_id=r.id group by date)
       or (r.verification->>'event_end')::timestamptz is distinct from
         (select (date+max(end_time)) at time zone 'America/Mexico_City' from public.interview_days where room_id=r.id group by date) then
       if r.calendar_status='working' and r.calendar_lease_until>now() then raise exception 'CALENDAR_IN_PROGRESS'; end if;
       update private_selection.rooms set calendar_status='queued',calendar_revision=calendar_revision+1 where id=r.id;
     end if;
   elsif op='publish' then
     if r.calendar_status<>'ready' or r.meet_url is null or r.primary_email is null or r.backup_email is null or r.primary_email=r.backup_email
       or not exists(select 1 from public.interview_days where room_id=r.id) then raise exception 'ROOM_NOT_READY'; end if;
     update private_selection.rooms set published=true where id=r.id;
   elsif op='prepare' then
     if r.primary_email is null or r.backup_email is null or r.primary_email=r.backup_email then raise exception 'HOSTS_REQUIRED'; end if;
     if r.calendar_status='working' and r.calendar_lease_until>now() then raise exception 'CALENDAR_IN_PROGRESS'; end if;
     update private_selection.rooms set calendar_status='queued',calendar_error=null,calendar_revision=calendar_revision+1 where id=r.id;
   elsif op='retry_booking' then
     update public.interviews set calendar_status='queued',calendar_error=null where id=(p_data->>'interview_id')::uuid and room_id=r.id and calendar_status='failed' and status in ('confirmed','cancelled');
     if not found then raise exception 'CALENDAR_RETRY_NOT_AVAILABLE'; end if;
   else raise exception 'UNKNOWN_ROOM_ACTION'; end if;
 end if;
 update public.seleccion_config set selection_revision=selection_revision+1 where id;
 perform private_selection.audit(null,'room_'||op,p_data);
 result:=jsonb_build_object('ok',true,'room_id',coalesce(v_new_room,r.id));
 insert into private_selection.requests(id,actor,fingerprint,result) values(request_id,auth.uid(),fingerprint,result);
 return result;
end $$;
create or replace function private_selection.slots(p_season text) returns table(slot_datetime timestamptz,duration_minutes integer,meet_url text,day_id uuid)
language sql stable set search_path='' as $$
 select g.ts,d.duration_minutes,coalesce(r.meet_url,d.meet_url),d.id from public.interview_days d
 left join private_selection.rooms r on r.id=d.room_id
 cross join lateral generate_series((d.date+d.start_time) at time zone 'America/Mexico_City',
   ((d.date+d.end_time) at time zone 'America/Mexico_City')-make_interval(mins=>d.duration_minutes),
   make_interval(mins=>d.duration_minutes)) g(ts)
 where d.season=p_season and g.ts>now()
 and d.room_id is not null and r.published and r.calendar_status='ready'
 and coalesce(r.meet_url,d.meet_url) ~ '^https://meet[.]google[.]com/'
 and not exists(select 1 from public.interviews i where (i.status in ('confirmed','completed') or (i.room_id is not null and i.status='no_show'))
   and (i.room_id is not distinct from d.room_id or
     (d.room_id is not null and i.room_id is not null and exists(select 1 from public.interview_days booked
       where booked.id=i.day_id and private_selection.room_people(d.room_id,d.interviewers) && private_selection.room_people(i.room_id,booked.interviewers))))
   and tstzrange(i.slot_datetime,i.slot_datetime+make_interval(mins=>i.duration_minutes),'[)') &&
       tstzrange(g.ts,g.ts+make_interval(mins=>d.duration_minutes),'[)'));
$$;
create or replace function public.selection_calendar_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private_selection.rooms; i public.interviews; lease uuid:=gen_random_uuid(); result jsonb; start_at timestamptz; end_at timestamptz;
begin
 perform private_selection.lock_workflow();
 if p_action='claim' then
   select * into r from private_selection.rooms where primary_email is not null and backup_email is not null and primary_email<>backup_email
     and exists(select 1 from public.interview_days where room_id=rooms.id)
     and not coalesce((p_data->>'bookings_only')::boolean,false)
     and (nullif(p_data->>'room_id','') is null or id=(p_data->>'room_id')::uuid)
     and (calendar_status='queued' or (calendar_status='working' and calendar_lease_until<now())) order by created_at,id limit 1 for update;
   if found then
     select (d.date+min(d.start_time)) at time zone 'America/Mexico_City',
       (d.date+max(d.end_time)) at time zone 'America/Mexico_City' into start_at,end_at
       from public.interview_days d where room_id=r.id group by d.date;
     update private_selection.rooms set calendar_status='working',calendar_lease=lease,calendar_lease_until=now()+interval '2 minutes',
       verification=coalesce(verification,'{}')||jsonb_build_object('event_start',start_at,'event_end',end_at) where id=r.id;
     return jsonb_build_object('kind','room','id',r.id,'lease',lease,'revision',r.calendar_revision,'event_id',r.calendar_event_id,
       'name',r.name,'start',start_at,'end',end_at,'primary_email',r.primary_email,'backup_email',r.backup_email,'meet_url',r.meet_url,
       'google_space_name',r.google_space_name,'space_creation_started',r.google_space_creation_started_at is not null,'managed_cohosts',r.google_cohosts);
   end if;
   if nullif(p_data->>'room_id','') is not null then return null; end if;
   select x.* into i from public.interviews x join private_selection.rooms room on room.id=x.room_id
     where (x.calendar_status='queued' or (x.calendar_status='working' and x.calendar_lease_until<now())
       or (x.status='cancelled' and x.calendar_status='ready'))
       and room.meet_url is not null order by x.created_at,x.id limit 1 for update of x;
   if not found then return null; end if;
   update public.interviews set calendar_status='working',calendar_lease=lease,calendar_lease_until=now()+interval '2 minutes',
     calendar_event_id=coalesce(calendar_event_id,'clubbooking'||replace(id::text,'-','')) where id=i.id;
   return jsonb_build_object('kind',case when i.status='cancelled' then 'cancel' else 'booking' end,'id',i.id,'lease',lease,
     'event_id',coalesce(i.calendar_event_id,'clubbooking'||replace(i.id::text,'-','')),'start',i.slot_datetime,
     'end',i.slot_datetime+make_interval(mins=>i.duration_minutes),'meet_url',i.meet_url,
     'recipient',(select correo from public.solicitudes where id=i.solicitud_id));
 elsif p_action in ('space_start','space_save','space_hosts') then
   select * into r from private_selection.rooms where id=(p_data->>'id')::uuid for update;
   if not found or r.calendar_status<>'working' or r.calendar_lease is distinct from (p_data->>'lease')::uuid
     or r.calendar_revision is distinct from (p_data->>'revision')::integer then raise exception 'STALE_CALENDAR_LEASE'; end if;
   if p_action='space_hosts' then
     if r.google_space_name is null or jsonb_typeof(p_data->'cohost_emails') is distinct from 'array' then raise exception 'INVALID_COHOST_INTENT'; end if;
     update private_selection.rooms set google_cohosts=array(select distinct lower(jsonb_array_elements_text(p_data->'cohost_emails'))) where id=r.id;
   elsif p_action='space_start' then
     if r.google_space_creation_started_at is not null or r.meet_url is not null then raise exception 'MEET_CREATION_REVIEW_REQUIRED'; end if;
     update private_selection.rooms set google_space_creation_started_at=now() where id=r.id;
   else
     if r.google_space_creation_started_at is null then raise exception 'MEET_CREATION_NOT_STARTED'; end if;
     if coalesce(p_data->>'google_space_name','') !~ '^spaces/[A-Za-z0-9_-]+$'
       or coalesce(p_data->>'meet_url','') !~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$' then raise exception 'INVALID_MEET'; end if;
     if (r.meet_url is not null and r.meet_url<>p_data->>'meet_url')
       or (r.google_space_name is not null and r.google_space_name<>p_data->>'google_space_name') then raise exception 'MEET_CHANGE_REQUIRES_MANUAL_COORDINATION'; end if;
     update private_selection.rooms set meet_url=p_data->>'meet_url',google_space_name=p_data->>'google_space_name' where id=r.id;
   end if;
   return jsonb_build_object('ok',true);
 elsif p_action='finish' then
   if p_data->>'kind'='room' then
     select * into r from private_selection.rooms where id=(p_data->>'id')::uuid;
     if r.calendar_lease is distinct from (p_data->>'lease')::uuid or r.calendar_revision is distinct from (p_data->>'revision')::integer then raise exception 'STALE_CALENDAR_LEASE'; end if;
     if p_data->>'outcome'='ready' then
       if coalesce(p_data->>'meet_url','')!~'^https://meet[.]google[.]com/' then raise exception 'INVALID_MEET'; end if;
       if r.meet_url is not null and r.meet_url<>p_data->>'meet_url' then raise exception 'MEET_CHANGE_REQUIRES_MANUAL_COORDINATION'; end if;
     end if;
     update private_selection.rooms set calendar_status=case when p_data->>'outcome'='ready' then 'ready' else 'failed' end,
       calendar_error=case when p_data->>'outcome'='ready' then null else left(p_data->>'error',300) end,
       meet_url=case when p_data->>'outcome'='ready' then p_data->>'meet_url' else meet_url end,
       google_cohosts=case when p_data->>'outcome'='ready' and p_data ? 'cohost_emails'
         then array(select jsonb_array_elements_text(p_data->'cohost_emails')) else google_cohosts end,
       calendar_lease=null,calendar_lease_until=null where id=r.id;
   else
     select * into i from public.interviews where id=(p_data->>'id')::uuid;
     if i.calendar_lease is distinct from (p_data->>'lease')::uuid then raise exception 'STALE_CALENDAR_LEASE'; end if;
     update public.interviews set calendar_status=case when p_data->>'outcome'='ready' then
       case when p_data->>'kind'='cancel' then 'cancelled' when status='cancelled' then 'queued' else 'ready' end else 'failed' end,
       calendar_error=case when p_data->>'outcome'='ready' then null else left(p_data->>'error',300) end,
       calendar_lease=null,calendar_lease_until=null where id=i.id;
   end if;
   return jsonb_build_object('ok',true);
 else raise exception 'UNKNOWN_CALENDAR_ACTION'; end if;
end $$;
revoke all on function public.selection_calendar_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.selection_calendar_worker(text,jsonb) to service_role;
revoke all on all functions in schema private_selection from public,anon,authenticated,service_role;
commit;
