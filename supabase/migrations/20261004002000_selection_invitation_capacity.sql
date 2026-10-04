-- Capacity commitments are shared by preview, confirmation and the mail worker.
-- The booking deadline limits when a person reserves, not the interview date.
begin;
select private_selection.lock_workflow();
create or replace function private_selection.capacity_summary(p_season text) returns jsonb
language sql stable set search_path='' as $$
 with waiting as (
   select s.id from public.solicitudes s
   where s.season=p_season and s.status='accepted' and s.final_decision is null
   and not exists(select 1 from public.interviews i where i.solicitud_id=s.id
     and i.status in ('confirmed','completed','no_show'))
 ), committed as (
   select w.id from waiting w join public.interview_booking_tokens t on t.solicitud_id=w.id
   where t.revoked_at is null and (t.expires_at is null or t.expires_at>now())
   and (t.invited_at is not null or exists(
     select 1 from private_selection.messages m where m.solicitud_id=w.id
     and (m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial'))
     and m.payload->>'decision'='accepted'
     and m.status in ('queued','sending','uncertain','accepted','failed')
   ))
 ), counts as (
   select (select count(*) from private_selection.slots(p_season))::integer slots,
     (select count(*) from waiting)::integer demand,
     (select count(*) from committed)::integer commitments
 )
 select jsonb_build_object('available_slots',slots,'committed_applicants',commitments,
   'available_for_invitations',slots-commitments,'accepted_without_booking',demand,
   'missing_slots',greatest(demand-slots,0)) from counts;
$$;
revoke all on function private_selection.capacity_summary(text) from public,anon,authenticated,service_role;
create or replace function private_selection.capacity(p_season text) returns integer
language sql stable set search_path='' as $$
 select (private_selection.capacity_summary(p_season)->>'available_for_invitations')::integer;
$$;
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
   return result || jsonb_build_object('capacity_summary',private_selection.capacity_summary(v_season),'rooms',coalesce((select jsonb_agg(to_jsonb(x)-'calendar_lease'-'calendar_lease_until' order by date,position) from private_selection.rooms x where season=v_season),'[]'));
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
commit;
