-- Expand-only installation. Activation is a separate, audited operation.
create schema private_selection;
revoke all on schema private_selection from public, anon, authenticated, service_role;
alter default privileges in schema private_selection revoke execute on functions from public;
alter table public.seleccion_config
  add column progressive_enabled boolean not null default false,
  add column dispatch_paused boolean not null default true,
  add column default_booking_hours integer not null default 168 check(default_booking_hours between 1 and 8760),
  add column selection_revision integer not null default 0,
  add column selection_site_url text not null default 'https://helloworld-unam.tech';
alter table public.solicitudes
  add column selection_revision integer not null default 0,
  add column decision_exception_reason text;
alter table public.interview_booking_tokens
  add column invited_at timestamptz,
  add column expires_at timestamptz,
  add column revoked_at timestamptz,
  add column duration_hours integer not null default 168 check(duration_hours between 1 and 8760),
  add column reminder_sent_at timestamptz;

create table private_selection.messages (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes(id),
  batch_id uuid,
  kind text not null check(kind in ('receipt','initial','final','rectification','booking','cancellation','deadline','reminder')),
  recipient text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'queued' check(status in ('queued','sending','accepted','failed','uncertain','cancelled','manual')),
  delivery_status text not null default 'pending',
  provider_id text unique,
  request_body jsonb,
  first_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index selection_messages_due on private_selection.messages(next_attempt_at) where status in ('queued','uncertain','sending');
create index selection_messages_solicitud on private_selection.messages(solicitud_id,created_at);
create table private_selection.events (
  id bigint generated always as identity primary key,
  solicitud_id uuid references public.solicitudes(id),
  season text,
  action text not null,
  actor text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index selection_events_solicitud on private_selection.events(solicitud_id,created_at);
create table private_selection.requests (
  id uuid primary key,
  actor uuid not null,
  fingerprint text not null,
  result jsonb not null
);
create table private_selection.webhook_events (
  id text primary key,
  provider_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private_selection.messages enable row level security;
alter table private_selection.events enable row level security;
alter table private_selection.requests enable row level security;
alter table private_selection.webhook_events enable row level security;
revoke all on all tables in schema private_selection from public,anon,authenticated,service_role;

create function private_selection.lock_workflow() returns void language sql set search_path='' as $$
  select pg_advisory_xact_lock(73400001);
$$;
create function private_selection.audit(p_id uuid,p_action text,p_details jsonb default '{}') returns void
language sql set search_path='' as $$
  insert into private_selection.events(solicitud_id,season,action,actor,details)
  values(p_id,(select active_season from public.seleccion_config where id),p_action,
    coalesce(auth.jwt()->>'email','system'),p_details);
$$;
create function private_selection.enqueue(p_id uuid,p_kind text,p_payload jsonb,p_key text,p_batch uuid default null) returns uuid
language plpgsql set search_path='' as $$
declare v_id uuid;
begin
  insert into private_selection.messages(solicitud_id,kind,recipient,payload,idempotency_key,batch_id)
  select s.id,p_kind,s.correo,jsonb_build_object('nombre',s.nombre,'season',s.season)||p_payload,p_key,p_batch
  from public.solicitudes s where s.id=p_id
  on conflict(idempotency_key) do nothing returning id into v_id;
  return v_id;
end $$;

create function private_selection.slots(p_season text) returns table(slot_datetime timestamptz,duration_minutes integer,meet_url text,day_id uuid)
language sql stable set search_path='' as $$
 select g.ts,d.duration_minutes,d.meet_url,d.id from public.interview_days d
 cross join lateral generate_series((d.date+d.start_time) at time zone 'America/Mexico_City',
   ((d.date+d.end_time) at time zone 'America/Mexico_City')-make_interval(mins=>d.duration_minutes),
   make_interval(mins=>d.duration_minutes)) g(ts)
 where d.season=p_season and g.ts>now() and d.meet_url ~ '^https://meet[.]google[.]com/'
 and not exists(select 1 from public.interviews i where i.status in ('confirmed','completed')
   and tstzrange(i.slot_datetime,i.slot_datetime+make_interval(mins=>i.duration_minutes),'[)') &&
       tstzrange(g.ts,g.ts+make_interval(mins=>d.duration_minutes),'[)'));
$$;
create function private_selection.capacity(p_season text) returns integer language sql stable set search_path='' as $$
 select (select count(*) from private_selection.slots(p_season))::integer -
 (select count(*) from public.interview_booking_tokens t join public.solicitudes s on s.id=t.solicitud_id
 where s.season=p_season and s.status='accepted' and s.final_decision is null and t.revoked_at is null
 and (t.expires_at is null or t.expires_at>now())
 and not exists(select 1 from public.interviews i where i.solicitud_id=s.id and i.status in ('confirmed','completed')))::integer;
$$;

-- Old RPCs remain private for compatibility until the controlled cutover.
alter function public.book_interview(text,timestamptz) set schema private_selection;
alter function private_selection.book_interview(text,timestamptz) rename to book_interview_legacy;
alter function public.cancel_interview(text) set schema private_selection;
alter function private_selection.cancel_interview(text) rename to cancel_interview_legacy;
alter function public.get_booking_state(text) set schema private_selection;
alter function private_selection.get_booking_state(text) rename to get_booking_state_legacy;
revoke all on all functions in schema private_selection from public,anon,authenticated,service_role;

create function public.get_booking_state(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; t public.interview_booking_tokens; s public.solicitudes; i public.interviews; v_reason text;
begin
 select * into c from public.seleccion_config where id;
 if not c.progressive_enabled then return private_selection.get_booking_state_legacy(p_token); end if;
 select * into t from public.interview_booking_tokens where token=p_token;
 if not found then return jsonb_build_object('ok',false,'error','TOKEN_INVALID'); end if;
 select * into s from public.solicitudes where id=t.solicitud_id;
 if t.revoked_at is not null or s.status<>'accepted' or s.final_decision is not null or s.season is distinct from c.active_season or not c.is_open then
   return jsonb_build_object('ok',false,'error','INVITATION_REVOKED'); end if;
 select * into i from public.interviews where solicitud_id=s.id and status in ('confirmed','completed','no_show') order by created_at desc limit 1;
 v_reason:=case when t.invited_at is null then 'NOT_INVITED' when i.status in ('completed','no_show') then 'TEAM_REVIEW_REQUIRED'
   when t.expires_at<=now() then 'INVITATION_EXPIRED' when t.reschedule_count>=2 and t.used_at is not null then 'MAX_RESCHEDULES' else null end;
 return jsonb_build_object('ok',true,'progressive',true,'solicitud',jsonb_build_object('nombre',s.nombre,'season',s.season),
 'expires_at',t.expires_at,'booking_blocked_reason',v_reason,'reschedule_count',t.reschedule_count,'max_reschedules',2,
 'can_reschedule',v_reason is null,'current_interview',case when i.id is not null then to_jsonb(i)-'solicitud_id'-'notes' else null end,
 'slots',case when v_reason is null then coalesce((select jsonb_agg(to_jsonb(x) order by slot_datetime) from private_selection.slots(s.season) x),'[]') else '[]'::jsonb end,
 'days','[]'::jsonb,'taken_slots','[]'::jsonb);
end $$;

create function public.book_interview(p_token text,p_slot timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; t public.interview_booking_tokens; s public.solicitudes; old_i public.interviews; v_slot record; v_id uuid;
begin
 perform private_selection.lock_workflow();
 select * into c from public.seleccion_config where id;
 if not c.progressive_enabled then return private_selection.book_interview_legacy(p_token,p_slot); end if;
 select * into t from public.interview_booking_tokens where token=p_token for update;
 if not found then return jsonb_build_object('ok',false,'error','TOKEN_INVALID'); end if;
 select * into s from public.solicitudes where id=t.solicitud_id for update;
 if t.revoked_at is not null or s.status<>'accepted' or s.final_decision is not null or s.season is distinct from c.active_season or not c.is_open then
 return jsonb_build_object('ok',false,'error','INVITATION_REVOKED'); end if;
 if t.invited_at is null or t.expires_at is null or t.expires_at<=now() then return jsonb_build_object('ok',false,'error','INVITATION_EXPIRED'); end if;
 if exists(select 1 from public.interviews where solicitud_id=s.id and status in ('completed','no_show')) then return jsonb_build_object('ok',false,'error','TEAM_REVIEW_REQUIRED'); end if;
 select * into old_i from public.interviews where solicitud_id=s.id and status='confirmed';
 if old_i.id is not null and old_i.slot_datetime<=now() then return jsonb_build_object('ok',false,'error','INTERVIEW_IN_PAST'); end if;
 if old_i.slot_datetime=p_slot then return jsonb_build_object('ok',false,'error','SAME_SLOT'); end if;
 if t.used_at is not null and t.reschedule_count>=2 then return jsonb_build_object('ok',false,'error','MAX_RESCHEDULES'); end if;
 select * into v_slot from private_selection.slots(s.season) where slot_datetime=p_slot;
 if not found then return jsonb_build_object('ok',false,'error','SLOT_TAKEN'); end if;
 -- Validate before cancelling; any subsequent error rolls back the entire replacement.
 if old_i.id is not null then
   update public.interviews set status='cancelled',cancelled_at=now() where id=old_i.id;
   update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind='booking' and status='queued';
 end if;
 update public.interview_booking_tokens set used_at=coalesce(used_at,now()),reschedule_count=reschedule_count+case when t.used_at is not null then 1 else 0 end where id=t.id;
 insert into public.interviews(solicitud_id,slot_datetime,duration_minutes,meet_url)
 values(s.id,p_slot,v_slot.duration_minutes,v_slot.meet_url) returning id into v_id;
 update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
 update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind='reminder' and status='queued';
 perform private_selection.audit(s.id,'book',jsonb_build_object('interview_id',v_id,'previous_id',old_i.id));
 return jsonb_build_object('ok',true,'interview_id',v_id,'slot_datetime',p_slot,'duration_minutes',v_slot.duration_minutes,'meet_url',v_slot.meet_url,'was_reschedule',t.used_at is not null);
end $$;

create function public.cancel_interview(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.interview_booking_tokens; i public.interviews; c public.seleccion_config; s public.solicitudes;
begin
 perform private_selection.lock_workflow(); select * into c from public.seleccion_config where id;
 if not c.progressive_enabled then return private_selection.cancel_interview_legacy(p_token); end if;
 select * into t from public.interview_booking_tokens where token=p_token;
 if not found or t.revoked_at is not null then return jsonb_build_object('ok',false,'error','TOKEN_INVALID'); end if;
 select * into s from public.solicitudes where id=t.solicitud_id;
 if s.season is distinct from c.active_season or not c.is_open or s.final_decision is not null then return jsonb_build_object('ok',false,'error','INVITATION_REVOKED'); end if;
 select * into i from public.interviews where solicitud_id=t.solicitud_id and status='confirmed';
 if not found or i.slot_datetime<=now() then return jsonb_build_object('ok',false,'error','NO_ACTIVE_INTERVIEW'); end if;
 update public.interviews set status='cancelled',cancelled_at=now() where id=i.id;
 update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind='booking' and status='queued';
 perform private_selection.enqueue(s.id,'cancellation',jsonb_build_object('slot_datetime',i.slot_datetime),'cancel/'||i.id);
 update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
 perform private_selection.audit(s.id,'cancel',jsonb_build_object('interview_id',i.id));
 return jsonb_build_object('ok',true,'cancelled_id',i.id);
end $$;
revoke all on function public.get_booking_state(text),public.book_interview(text,timestamptz),public.cancel_interview(text) from public;
grant execute on function public.get_booking_state(text),public.book_interview(text,timestamptz),public.cancel_interview(text) to anon,authenticated;

create function public.selection_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare c public.seleccion_config; s public.solicitudes; t public.interview_booking_tokens; m private_selection.messages;
 v_season text; v_id uuid; v_request uuid; v_actor uuid:=auth.uid(); v_item jsonb; v_items jsonb:='[]'; v_result jsonb;
 v_kind text; v_decision text; v_hours integer; v_needed integer:=0; v_capacity integer; v_reason text;
 v_fingerprint text:=md5(p_action||p_data::text); v_existing private_selection.requests; v_eval jsonb; v_email text;
begin
 if v_actor is null or not exists(select 1 from public.directiva where lower(email)=lower(auth.jwt()->>'email')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_action<>'state' then perform private_selection.lock_workflow(); end if;
 select * into c from public.seleccion_config where id;
 v_season:=coalesce(nullif(p_data->>'season',''),c.active_season);
 if p_action='state' then
   return jsonb_build_object('config',to_jsonb(c),'capacity',private_selection.capacity(v_season),
   'solicitudes',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.solicitudes x where season=v_season),'[]'),
   'invitations',coalesce((select jsonb_agg(to_jsonb(t)-'token') from public.interview_booking_tokens t join public.solicitudes x on x.id=t.solicitud_id where x.season=v_season),'[]'),
   'interviews',coalesce((select jsonb_agg(to_jsonb(i) order by slot_datetime) from public.interviews i join public.solicitudes x on x.id=i.solicitud_id where x.season=v_season),'[]'),
   'days',coalesce((select jsonb_agg(to_jsonb(d) order by date,start_time) from public.interview_days d where season=v_season),'[]'),
   'messages',coalesce((select jsonb_agg(to_jsonb(q) order by created_at desc) from (select m.id,m.solicitud_id,m.kind,m.status,m.delivery_status,m.created_at,m.last_error,m.provider_id,m.batch_id from private_selection.messages m join public.solicitudes x on x.id=m.solicitud_id where x.season=v_season) q),'[]'),
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by created_at desc) from private_selection.events e where season=v_season),'[]'));
 end if;
 if not c.progressive_enabled then raise exception 'PROGRESSIVE_DISABLED'; end if;
 if not c.is_open or v_season is distinct from c.active_season then raise exception 'HISTORICAL_READ_ONLY'; end if;
 if p_data ? 'request_id' then
   v_request:=(p_data->>'request_id')::uuid;
   select * into v_existing from private_selection.requests where id=v_request;
   if found then
     if v_existing.actor<>v_actor or v_existing.fingerprint<>v_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
     return v_existing.result;
   end if;
 end if;
 if p_action in ('confirm','rectify','retry') and v_request is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
 if p_action in ('preview','confirm') then
   v_kind:=p_data->>'kind'; v_hours:=coalesce((p_data->>'duration_hours')::integer,c.default_booking_hours);
   if v_kind not in ('initial','final') or v_kind is null or v_hours not between 1 and 8760 then raise exception 'INVALID_REQUEST'; end if;
   if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items') not between 1 and 500 then raise exception 'INVALID_SELECTION'; end if;
   if (select count(distinct x->>'id') from jsonb_array_elements(p_data->'items') x)<>jsonb_array_length(p_data->'items') then raise exception 'DUPLICATE_SELECTION'; end if;
   if p_action='confirm' and (p_data->>'config_revision')::integer is distinct from c.selection_revision then raise exception 'STALE_PREVIEW'; end if;
   for v_item in select * from jsonb_array_elements(p_data->'items') loop
     select * into s from public.solicitudes where id=(v_item->>'id')::uuid and season=c.active_season;
     if not found or s.selection_revision is distinct from (v_item->>'revision')::integer then raise exception 'STALE_SELECTION'; end if;
     v_decision:=case when v_kind='initial' then s.status else s.final_decision end;
     if v_decision is null or v_decision not in ('accepted','rejected') or (v_kind='final' and s.status<>'accepted') then raise exception 'DECISION_REQUIRED'; end if;
     if (v_kind='initial' and s.email_notification_sent) or (v_kind='final' and s.final_email_sent) then raise exception 'ALREADY_NOTIFIED'; end if;
     if exists(select 1 from private_selection.messages where solicitud_id=s.id and kind in (v_kind,'rectification') and status in ('queued','sending','uncertain','accepted','failed')) then raise exception 'COMMUNICATION_EXISTS_USE_RETRY_OR_RECTIFY'; end if;
     if v_kind='final' and v_decision='accepted' and not exists(select 1 from public.interviews where solicitud_id=s.id and status='completed') and nullif(trim(s.decision_exception_reason),'') is null then raise exception 'INTERVIEW_OR_EXCEPTION_REQUIRED'; end if;
     if v_kind='final' and exists(select 1 from public.interviews where solicitud_id=s.id and status='confirmed') then raise exception 'RESOLVE_RESERVATION_FIRST'; end if;
     if v_kind='final' and v_decision='accepted' and c.whatsapp_url !~ '^https://chat[.]whatsapp[.]com/' then raise exception 'WHATSAPP_URL_REQUIRED'; end if;
     if v_kind='initial' and v_decision='accepted' then v_needed:=v_needed+1; end if;
     v_items:=v_items||jsonb_build_array(jsonb_build_object('id',s.id,'revision',s.selection_revision,'nombre',s.nombre,'correo',s.correo,'decision',v_decision,'kind',v_kind,
     'payload',jsonb_build_object('nombre',s.nombre,'season',s.season,'decision',v_decision,'expires_at',now()+make_interval(hours=>v_hours),
       'booking_url',c.selection_site_url||'/seleccion/agendar?t=ENLACE_PERSONAL','whatsapp_url',case when v_kind='final' and v_decision='accepted' then c.whatsapp_url else null end),
     'subject',case when v_kind='initial' and v_decision='accepted' then 'Invitación a entrevista — Club Hello World' when v_kind='final' and v_decision='accepted' then 'Bienvenido al Club Hello World' else 'Actualización de tu solicitud — Club Hello World' end,
     'body',case when v_kind='initial' and v_decision='accepted' then 'Tu solicitud pasa a entrevista. Podrás elegir tu horario mediante un enlace personal. Plazo: '||v_hours||' horas desde que se procese el envío.' when v_kind='final' and v_decision='accepted' then 'Has sido admitido al Club Hello World. Recibirás el enlace para integrarte al grupo.' else 'Gracias por tu interés. En esta ocasión no continuarás en el proceso de selección.' end));
   end loop;
   v_capacity:=private_selection.capacity(c.active_season);
   if v_needed>v_capacity and v_needed>0 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
   v_result:=jsonb_build_object('items',v_items,'duration_hours',v_hours,'config_revision',c.selection_revision,'capacity',v_capacity,'errors','[]'::jsonb);
   if p_action='preview' then return v_result; end if;
   if c.dispatch_paused then raise exception 'DISPATCH_PAUSED'; end if;
   for v_item in select * from jsonb_array_elements(v_items) loop
     v_id:=(v_item->>'id')::uuid;
     if v_kind='initial' and v_item->>'decision'='accepted' then
       insert into public.interview_booking_tokens(solicitud_id,token,duration_hours)
       values(v_id,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),v_hours)
       on conflict(solicitud_id) do update set token=excluded.token,revoked_at=null,invited_at=null,expires_at=null,duration_hours=v_hours,reminder_sent_at=null;
     end if;
     perform private_selection.enqueue(v_id,v_kind,jsonb_build_object('decision',v_item->>'decision','whatsapp_url',case when v_kind='final' and v_item->>'decision'='accepted' then c.whatsapp_url else null end),v_kind||'/'||v_id||'/'||(v_item->>'revision'),v_request);
     update public.solicitudes set selection_revision=selection_revision+1 where id=v_id;
     perform private_selection.audit(v_id,'confirm_'||v_kind,jsonb_build_object('batch_id',v_request));
   end loop;
   v_result:=jsonb_build_object('batch_id',v_request,'queued',jsonb_array_length(v_items));
 elsif p_action='config' then
   if (p_data->>'revision')::integer is distinct from c.selection_revision then raise exception 'STALE_SELECTION'; end if;
   if coalesce((p_data->>'archive')::boolean,false) then
     if exists(select 1 from public.solicitudes x where x.season=c.active_season and
       (x.status in ('pending','reviewing') or (x.status='accepted' and x.final_decision is null) or
       not exists(select 1 from private_selection.messages m where m.solicitud_id=x.id and m.kind in ('initial','final','rectification')
         and m.payload->>'decision'=case when x.status='rejected' then x.status else x.final_decision end
         and ((m.status='accepted' and m.delivery_status='delivered') or m.status='manual'))))
       or exists(select 1 from private_selection.messages m join public.solicitudes x on x.id=m.solicitud_id where x.season=c.active_season and m.status in ('queued','sending','uncertain','failed') and m.kind<>'reminder')
       or exists(select 1 from public.interviews i join public.solicitudes x on x.id=i.solicitud_id where x.season=c.active_season and i.status='confirmed') then raise exception 'UNRESOLVED_CANDIDATES_OR_MESSAGES'; end if;
     update public.seleccion_config set is_open=false,applications_closed=true,closed_at=now(),closed_by=auth.jwt()->>'email' where id;
     update public.interview_booking_tokens set revoked_at=now() where solicitud_id in(select id from public.solicitudes where season=c.active_season);
   else
     update public.seleccion_config set applications_closed=coalesce((p_data->>'applications_closed')::boolean,applications_closed),
       default_booking_hours=coalesce((p_data->>'default_booking_hours')::integer,default_booking_hours),
       dispatch_paused=coalesce((p_data->>'dispatch_paused')::boolean,dispatch_paused) where id;
   end if;
   perform private_selection.audit(null,'config',p_data);
 elsif p_action='day' then
   if p_data ? 'id' then
     if not exists(select 1 from public.interview_days where id=(p_data->>'id')::uuid and season=c.active_season) then raise exception 'DAY_NOT_FOUND'; end if;
     if exists(select 1 from public.interviews i join public.interview_days d on d.id=(p_data->>'id')::uuid where (i.slot_datetime at time zone 'America/Mexico_City')::date=d.date and i.status in ('confirmed','completed')) then raise exception 'DAY_HAS_RESERVATIONS'; end if;
     if (p_data->>'delete')::boolean is true then delete from public.interview_days where id=(p_data->>'id')::uuid;
     else update public.interview_days set date=(p_data->>'date')::date,start_time=(p_data->>'start_time')::time,end_time=(p_data->>'end_time')::time,duration_minutes=(p_data->>'duration_minutes')::integer,meet_url=p_data->>'meet_url',notes=p_data->>'notes' where id=(p_data->>'id')::uuid; end if;
   else
     insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url,notes,created_by) values(c.active_season,(p_data->>'date')::date,(p_data->>'start_time')::time,(p_data->>'end_time')::time,(p_data->>'duration_minutes')::integer,p_data->>'meet_url',p_data->>'notes',auth.jwt()->>'email');
   end if;
   if (p_data->>'delete')::boolean is not true and ((p_data->>'date')::date<(now() at time zone 'America/Mexico_City')::date or coalesce(p_data->>'meet_url','')!~'^https://meet[.]google[.]com/') then raise exception 'INVALID_DAY_OR_MEET'; end if;
   if private_selection.capacity(c.active_season)<0 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
   perform private_selection.audit(null,'day',p_data);
 elsif p_action='extend' then
   v_reason:=nullif(trim(p_data->>'reason'),'');
   if v_reason is null or (p_data->>'expires_at')::timestamptz<=now() then raise exception 'FUTURE_EXPIRY_AND_REASON_REQUIRED'; end if;
   if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items')<1 then raise exception 'INVALID_SELECTION'; end if;
   for v_item in select * from jsonb_array_elements(p_data->'items') loop
     select * into s from public.solicitudes where id=(v_item->>'id')::uuid and season=c.active_season;
     if not found or s.selection_revision is distinct from (v_item->>'revision')::integer then raise exception 'STALE_SELECTION'; end if;
     if s.status<>'accepted' or s.final_decision is not null then raise exception 'NOT_ELIGIBLE'; end if;
     if exists(select 1 from private_selection.messages where solicitud_id=s.id and status in ('sending','uncertain')) then raise exception 'SEND_IN_PROGRESS'; end if;
     update public.interview_booking_tokens set expires_at=(p_data->>'expires_at')::timestamptz where solicitud_id=s.id and revoked_at is null and invited_at is not null;
     if not found then raise exception 'INVITATION_REQUIRED'; end if;
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind in ('deadline','reminder') and status='queued';
     perform private_selection.enqueue(s.id,'deadline',jsonb_build_object('expires_at',p_data->>'expires_at'),'deadline/'||s.id||'/'||s.selection_revision);
     -- Explicit second chance clears the no-show gate; audit retains the original outcome.
     update public.interviews set status='cancelled',cancelled_at=now() where solicitud_id=s.id and status='no_show';
     update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
     perform private_selection.audit(s.id,'extend',jsonb_build_object('reason',v_reason,'expires_at',p_data->>'expires_at'));
   end loop;
   if private_selection.capacity(c.active_season)<0 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
 elsif p_action='interview' then
   select solicitud_id into v_id from public.interviews where id=(p_data->>'id')::uuid;
   select * into s from public.solicitudes where id=v_id and season=c.active_season;
   if not found then raise exception 'INTERVIEW_NOT_FOUND'; end if;
   if s.final_email_sent then raise exception 'ALREADY_NOTIFIED'; end if;
   if p_data->>'status' not in ('completed','no_show','cancelled') or p_data->>'status' is null then raise exception 'INVALID_STATUS'; end if;
   if p_data->>'status' in ('completed','no_show') and exists(select 1 from public.interviews where id=(p_data->>'id')::uuid and slot_datetime>now()) then raise exception 'INTERVIEW_IN_FUTURE'; end if;
   update public.interviews set status=p_data->>'status',cancelled_at=case when p_data->>'status'='cancelled' then now() else cancelled_at end where id=(p_data->>'id')::uuid and status='confirmed';
   if not found then raise exception 'STALE_INTERVIEW'; end if;
   update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
   if p_data->>'status'='cancelled' then
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind='booking' and status='queued';
     perform private_selection.enqueue(s.id,'cancellation','{}','cancel/'||(p_data->>'id'));
   end if;
   perform private_selection.audit(s.id,'interview',p_data);
 elsif p_action='retry' then
   select * into m from private_selection.messages where id=(p_data->>'message_id')::uuid;
   if not found or not exists(select 1 from public.solicitudes where id=m.solicitud_id and season=c.active_season) then raise exception 'MESSAGE_NOT_FOUND'; end if;
   if m.status<>'failed' then raise exception 'RECONCILE_UNCERTAIN_OR_ALREADY_SENT'; end if;
   if m.request_body is not null and m.first_attempt_at<now()-interval '23 hours' then raise exception 'RECONCILIATION_REQUIRED'; end if;
   if private_selection.capacity(c.active_season)<0 and m.kind='initial' and m.payload->>'decision'='accepted' then raise exception 'INSUFFICIENT_CAPACITY'; end if;
   update private_selection.messages set status='queued',next_attempt_at=now(),last_error=null where id=m.id;
   perform private_selection.audit(m.solicitud_id,'retry',jsonb_build_object('message_id',m.id));
 else
   select * into s from public.solicitudes where id=(p_data->>'id')::uuid and season=c.active_season for update;
   if not found or s.selection_revision is distinct from (p_data->>'revision')::integer then raise exception 'STALE_SELECTION'; end if;
   if exists(select 1 from private_selection.messages where solicitud_id=s.id and status in ('sending','uncertain')) then raise exception 'SEND_IN_PROGRESS'; end if;
   v_reason:=nullif(trim(p_data->>'reason'),'');
   if p_action='save' then
     if (p_data ? 'status' and p_data->>'status' is distinct from s.status and s.email_notification_sent) or (p_data ? 'final_decision' and p_data->>'final_decision' is distinct from s.final_decision and s.final_email_sent) then raise exception 'USE_RECTIFICATION'; end if;
     if (p_data ? 'status' and p_data->>'status' is distinct from s.status) or (p_data ? 'final_decision' and p_data->>'final_decision' is distinct from s.final_decision) then
       update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed') and kind<>'receipt';
       if p_data ? 'status' and p_data->>'status'<>'accepted' then
         if exists(select 1 from public.interviews where solicitud_id=s.id and status='confirmed') then raise exception 'RESOLVE_RESERVATION_FIRST'; end if;
         update public.interview_booking_tokens set revoked_at=now() where solicitud_id=s.id;
       end if;
     end if;
     v_eval:=p_data->'evaluation';
     update public.solicitudes set status=coalesce(p_data->>'status',status),notes=case when p_data?'notes' then p_data->>'notes' else notes end,
       reviewed_at=now(),reviewed_by=auth.jwt()->>'email',
       final_decision=case when p_data?'final_decision' then p_data->>'final_decision' else final_decision end,
       decision_exception_reason=case when p_data?'exception_reason' then nullif(trim(p_data->>'exception_reason'),'') else decision_exception_reason end,
       eval_blandas_score=case when v_eval?'eval_blandas_score' then (v_eval->>'eval_blandas_score')::integer else eval_blandas_score end,
       eval_motivacion_score=case when v_eval?'eval_motivacion_score' then (v_eval->>'eval_motivacion_score')::integer else eval_motivacion_score end,
       eval_proyectos_score=case when v_eval?'eval_proyectos_score' then (v_eval->>'eval_proyectos_score')::integer else eval_proyectos_score end,
       eval_aporte_score=case when v_eval?'eval_aporte_score' then (v_eval->>'eval_aporte_score')::integer else eval_aporte_score end,
       eval_tecnica_score=case when v_eval?'eval_tecnica_score' then (v_eval->>'eval_tecnica_score')::integer else eval_tecnica_score end,
       eval_blandas_notes=coalesce(v_eval->>'eval_blandas_notes',eval_blandas_notes),eval_motivacion_notes=coalesce(v_eval->>'eval_motivacion_notes',eval_motivacion_notes),
       eval_proyectos_notes=coalesce(v_eval->>'eval_proyectos_notes',eval_proyectos_notes),eval_aporte_notes=coalesce(v_eval->>'eval_aporte_notes',eval_aporte_notes),
       eval_tecnica_notes=coalesce(v_eval->>'eval_tecnica_notes',eval_tecnica_notes),eval_overall_notes=coalesce(v_eval->>'eval_overall_notes',eval_overall_notes)
       where id=s.id returning * into s;
     if coalesce((p_data->>'complete_interview')::boolean,false) then
       update public.interviews set status='completed' where solicitud_id=s.id and status='confirmed' and slot_datetime<=now();
       if not found then raise exception 'STARTED_INTERVIEW_REQUIRED'; end if;
       update public.solicitudes set evaluated_at=now(),evaluated_by=auth.jwt()->>'email' where id=s.id;
     end if;
     if s.final_decision is not null and s.status<>'accepted' then raise exception 'INITIAL_ACCEPTANCE_REQUIRED'; end if;
     if s.final_decision='accepted' and s.decision_exception_reason is null and not exists(select 1 from public.interviews where solicitud_id=s.id and status='completed') then raise exception 'INTERVIEW_OR_EXCEPTION_REQUIRED'; end if;
   elsif p_action='rectify' then
     if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
     v_kind:=case when p_data?'final_decision' then 'final' else 'initial' end;
     v_decision:=coalesce(p_data->>'final_decision',p_data->>'status');
     if v_decision is null or v_decision not in ('accepted','rejected') then raise exception 'INVALID_DECISION'; end if;
     if v_kind='initial' and (not s.email_notification_sent or s.final_decision is not null) then raise exception 'USE_SAVE_OR_FINAL_RECTIFICATION'; end if;
     if v_kind='final' and not s.final_email_sent then raise exception 'USE_SAVE'; end if;
     if v_kind='final' and v_decision='accepted' and s.decision_exception_reason is null and not exists(select 1 from public.interviews where solicitud_id=s.id and status='completed') then raise exception 'INTERVIEW_OR_EXCEPTION_REQUIRED'; end if;
     if v_kind='initial' and v_decision='accepted' and private_selection.capacity(c.active_season)<1 then raise exception 'INSUFFICIENT_CAPACITY'; end if;
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed') and kind<>'receipt';
     if v_kind='initial' then
       update public.solicitudes set status=v_decision where id=s.id;
       if v_decision='accepted' then
         insert into public.interview_booking_tokens(solicitud_id,token,duration_hours) values(s.id,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),c.default_booking_hours)
         on conflict(solicitud_id) do update set token=excluded.token,revoked_at=null,invited_at=null,expires_at=null,duration_hours=excluded.duration_hours,reminder_sent_at=null;
       end if;
     else update public.solicitudes set final_decision=v_decision where id=s.id; end if;
     if v_decision='rejected' then
       update public.interview_booking_tokens set revoked_at=now() where solicitud_id=s.id;
       update public.interviews set status='cancelled',cancelled_at=now() where solicitud_id=s.id and status='confirmed';
     end if;
     perform private_selection.enqueue(s.id,'rectification',jsonb_build_object('decision',v_decision,'stage',v_kind,'whatsapp_url',case when v_kind='final' and v_decision='accepted' then c.whatsapp_url else null end),'rectify/'||v_request,v_request);
   elsif p_action='manual' then
     if v_reason is null or (p_data->>'communicated_at')::timestamptz>now() or nullif(p_data->>'communicated_at','') is null then raise exception 'COMMUNICATION_DETAILS_REQUIRED'; end if;
     v_kind:=case when s.status='rejected' then 'initial' else 'final' end;
     v_decision:=case when s.status='rejected' then s.status else s.final_decision end;
     if v_decision is null then raise exception 'FINAL_DECISION_REQUIRED'; end if;
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed');
     v_id:=private_selection.enqueue(s.id,v_kind,jsonb_build_object('decision',v_decision),'manual/'||s.id||'/'||s.selection_revision);
     update private_selection.messages set status='manual',delivery_status='manual' where id=v_id;
     update public.solicitudes set email_notification_sent=case when v_kind='initial' then true else email_notification_sent end,final_email_sent=case when v_kind='final' then true else final_email_sent end where id=s.id;
   elsif p_action='email' then
     v_email:=lower(trim(p_data->>'correo'));
     if v_reason is null or v_email is null then raise exception 'EMAIL_AND_REASON_REQUIRED'; end if;
     update public.solicitudes set correo=v_email where id=s.id;
     -- Delivered messages remain immutable. Retarget only definite failures or unsent work.
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and status='queued';
     for m in select * from private_selection.messages where solicitud_id=s.id and (status='failed' or delivery_status in ('bounced','failed')) loop
       perform private_selection.enqueue(s.id,m.kind,m.payload,'address/'||m.id||'/'||s.selection_revision);
       update private_selection.messages set status='cancelled' where id=m.id;
     end loop;
   else raise exception 'UNKNOWN_ACTION'; end if;
   update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
   perform private_selection.audit(s.id,p_action,p_data-'evaluation');
 end if;
 update public.seleccion_config set selection_revision=selection_revision+1 where id;
 v_result:=coalesce(v_result,jsonb_build_object('ok',true));
 if v_request is not null then insert into private_selection.requests(id,actor,fingerprint,result) values(v_request,v_actor,v_fingerprint,v_result); end if;
 return v_result;
end $$;
revoke all on function public.selection_admin(text,jsonb) from public,anon;
grant execute on function public.selection_admin(text,jsonb) to authenticated;

create function public.selection_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; m private_selection.messages; s public.solicitudes; t public.interview_booking_tokens;
 v_event jsonb; v_type text; v_delivery text; v_provider text; v_occurred timestamptz; v_id uuid; v_attempt integer;
begin
 perform private_selection.lock_workflow();
 select * into c from public.seleccion_config where id;
 if p_action='webhook' then
   v_event:=p_data->'event'; v_type:=v_event->>'type'; v_provider:=v_event->'data'->>'email_id';
   if nullif(p_data->>'event_id','') is null or nullif(v_provider,'') is null then raise exception 'INVALID_WEBHOOK'; end if;
   if v_type not in ('email.sent','email.delivered','email.bounced','email.failed','email.delivery_delayed','email.complained') then return jsonb_build_object('ignored',true); end if;
   select * into m from private_selection.messages where provider_id=v_provider;
   if not found and coalesce(v_event->'data'->'tags'->>'selection_message_id','') ~ '^[0-9a-f-]{36}$' then
     select * into m from private_selection.messages where id=(v_event->'data'->'tags'->>'selection_message_id')::uuid and first_attempt_at is not null and provider_id is null;
     if found then
       update private_selection.messages set provider_id=v_provider where id=m.id;
     end if;
   end if;
   v_occurred:=coalesce((v_event->>'created_at')::timestamptz,now());
   insert into private_selection.webhook_events(id,provider_id,event_type,occurred_at)
   values(p_data->>'event_id',v_provider,v_type,v_occurred) on conflict do nothing;
   if not found then return jsonb_build_object('duplicate',true); end if;
   -- Append-only events reconcile even if the webhook beat the send response.
   select * into m from private_selection.messages where provider_id=v_provider;
   if found then
     select case when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.complained') then 'complained'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.bounced') then 'bounced'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.failed') then 'failed'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.delivered') then 'delivered'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.delivery_delayed') then 'delayed' else 'sent' end into v_delivery;
     update private_selection.messages set delivery_status=v_delivery where id=m.id;
     -- Signed provider acknowledgement settles a timeout without another send.
     if m.status in ('sending','uncertain','queued') and m.first_attempt_at is not null then
       update private_selection.messages set status='accepted',accepted_at=coalesce(accepted_at,now()),lease_token=null,lease_until=null,last_error=null where id=m.id;
       if m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial') then update public.solicitudes set email_notification_sent=true where id=m.solicitud_id; end if;
       if m.kind='final' or (m.kind='rectification' and m.payload->>'stage'='final') then update public.solicitudes set final_email_sent=true where id=m.solicitud_id; end if;
       if m.kind='booking' then update public.interviews set email_sent=true where id=(m.payload->>'interview_id')::uuid; end if;
       if m.kind='reminder' then update public.interview_booking_tokens set reminder_sent_at=now() where solicitud_id=m.solicitud_id; end if;
     end if;
   end if;
   return jsonb_build_object('ok',true);
 elsif p_action='claim' then
   if not c.progressive_enabled or c.dispatch_paused then return null; end if;
   -- Only one reminder per invitation; a new expiry does not resend an accepted reminder.
   for t in select bt.* from public.interview_booking_tokens bt join public.solicitudes app on app.id=bt.solicitud_id
     where app.season=c.active_season and app.status='accepted' and app.final_decision is null and bt.revoked_at is null and bt.invited_at is not null
     and bt.expires_at-bt.invited_at>interval '24 hours' and bt.expires_at>now() and bt.expires_at<=now()+interval '24 hours'
     and bt.reminder_sent_at is null and not exists(select 1 from public.interviews i where i.solicitud_id=app.id and i.status in ('confirmed','completed','no_show'))
     and not exists(select 1 from private_selection.messages x where x.solicitud_id=app.id and x.kind='initial' and (x.status<>'accepted' or x.delivery_status in ('bounced','failed','complained')))
   loop
     if private_selection.capacity(c.active_season)>=0 and exists(select 1 from private_selection.slots(c.active_season)) then
       perform private_selection.enqueue(t.solicitud_id,'reminder',jsonb_build_object('expires_at',t.expires_at),
       'reminder/'||t.id||'/'||t.expires_at::text);
     end if;
   end loop;
   update private_selection.messages set status='uncertain',lease_token=null,lease_until=null,last_error='Lease expired; reconcile with same idempotency key'
     where status='sending' and lease_until<now();
   update private_selection.messages set status='uncertain',next_attempt_at='infinity',last_error='RECONCILIATION_REQUIRED: safe retry window ended'
     where status in ('queued','uncertain') and first_attempt_at<now()-interval '23 hours' and request_body is not null;
   for v_attempt in 1..100 loop
     select * into m from private_selection.messages where status in ('queued','uncertain') and next_attempt_at<=now()
       order by created_at,id for update skip locked limit 1;
     if not found then return null; end if;
     select * into s from public.solicitudes where id=m.solicitud_id;
     select * into t from public.interview_booking_tokens where solicitud_id=s.id;
     -- An uncertain send must be reconciled, not silently cancelled.
     if m.first_attempt_at is null and (s.season is distinct from c.active_season or not c.is_open or
       (m.kind='reminder' and (t.expires_at<=now() or t.revoked_at is not null or s.final_decision is not null or t.reminder_sent_at is not null or
         exists(select 1 from public.interviews where solicitud_id=s.id and status in ('confirmed','completed','no_show')))) or
       (m.kind='booking' and not exists(select 1 from public.interviews where id=(m.payload->>'interview_id')::uuid and status='confirmed')) or
       (m.kind in ('initial','final','rectification') and m.payload->>'decision' is distinct from
         case when m.kind='initial' or m.payload->>'stage'='initial' then s.status else s.final_decision end)) then
       update private_selection.messages set status='cancelled' where id=m.id; continue;
     end if;
     if m.first_attempt_at is null and (m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial')) and m.payload->>'decision'='accepted' then
       if private_selection.capacity(s.season)<0 then
         update private_selection.messages set status='failed',last_error='INSUFFICIENT_CAPACITY' where id=m.id; continue;
       end if;
       update public.interview_booking_tokens set invited_at=now(),expires_at=now()+make_interval(hours=>duration_hours) where id=t.id returning * into t;
       m.payload:=m.payload||jsonb_build_object('expires_at',t.expires_at);
     end if;
     if m.first_attempt_at is null and t.token is not null and m.kind in ('initial','rectification','booking','deadline','reminder') then
       m.payload:=m.payload||jsonb_build_object('booking_url',c.selection_site_url||'/seleccion/agendar?t='||t.token);
     end if;
     update private_selection.messages set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',
       first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1,payload=m.payload where id=m.id returning * into m;
     return to_jsonb(m);
   end loop;
   return null;
 elsif p_action in ('prepared','finish') then
   select * into m from private_selection.messages where id=(p_data->>'id')::uuid and lease_token=(p_data->>'lease_token')::uuid and status='sending' for update;
   if not found then
     if p_action='finish' and exists(select 1 from private_selection.messages where id=(p_data->>'id')::uuid and status='accepted' and provider_id=p_data->>'provider_id') then return jsonb_build_object('ok',true); end if;
     raise exception 'STALE_LEASE';
   end if;
   if p_action='prepared' then
     if jsonb_typeof(p_data->'request_body') is distinct from 'object' then raise exception 'INVALID_BODY'; end if;
     update private_selection.messages set request_body=coalesce(request_body,p_data->'request_body') where id=m.id returning * into m;
     return jsonb_build_object('request_body',m.request_body);
   end if;
   if p_data->>'outcome'='accepted' then
     v_provider:=nullif(p_data->>'provider_id',''); if v_provider is null then raise exception 'PROVIDER_ID_REQUIRED'; end if;
     select case when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.complained') then 'complained'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.bounced') then 'bounced'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.failed') then 'failed'
       when exists(select 1 from private_selection.webhook_events where provider_id=v_provider and event_type='email.delivered') then 'delivered' else 'pending' end into v_delivery;
     update private_selection.messages set status='accepted',provider_id=v_provider,delivery_status=v_delivery,accepted_at=now(),lease_token=null,lease_until=null,last_error=null where id=m.id;
     if m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial') then update public.solicitudes set email_notification_sent=true where id=m.solicitud_id; end if;
     if m.kind='final' or (m.kind='rectification' and m.payload->>'stage'='final') then update public.solicitudes set final_email_sent=true where id=m.solicitud_id; end if;
     if m.kind='booking' then update public.interviews set email_sent=true where id=(m.payload->>'interview_id')::uuid; end if;
     if m.kind='reminder' then update public.interview_booking_tokens set reminder_sent_at=now() where solicitud_id=m.solicitud_id; end if;
   elsif p_data->>'outcome' in ('retry','failed','uncertain') then
     update private_selection.messages set status=case when p_data->>'outcome'='retry' then 'queued' else p_data->>'outcome' end,
       last_error=left(p_data->>'error',500),lease_token=null,lease_until=null,
       next_attempt_at=now()+make_interval(secs=>greatest(60,least(3600,coalesce((p_data->>'retry_after_seconds')::integer,(power(2,least(m.attempts,10))*30)::integer)))) where id=m.id;
   else raise exception 'INVALID_OUTCOME'; end if;
   return jsonb_build_object('ok',true);
 else raise exception 'UNKNOWN_ACTION'; end if;
end $$;
revoke all on function public.selection_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.selection_worker(text,jsonb) to service_role;

-- HTTP triggers are disabled only by the separate activation script.
create function private_selection.capture_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select progressive_enabled from public.seleccion_config where id),false) then return new; end if;
 if tg_table_name='solicitudes' then
   perform private_selection.enqueue(new.id,'receipt','{}','receipt/'||new.id);
 elsif tg_table_name='interviews' and new.status='confirmed' then
   perform private_selection.enqueue(new.solicitud_id,'booking',jsonb_build_object('interview_id',new.id,'slot_datetime',new.slot_datetime,'meet_url',new.meet_url),'booking/'||new.id);
 end if;
 return new;
end $$;
create trigger selection_receipt_queue after insert on public.solicitudes for each row execute function private_selection.capture_event();
create trigger selection_booking_queue after insert on public.interviews for each row execute function private_selection.capture_event();

create or replace function public.auto_complete_interview_on_eval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select progressive_enabled from public.seleccion_config where id),false) and new.evaluated_at is not null and new.evaluated_at is distinct from old.evaluated_at then
   update public.interviews set status='completed' where solicitud_id=new.id and status='confirmed';
 end if;
 return new;
end $$;

create function private_selection.guard_selection_write() returns trigger language plpgsql set search_path='' as $$
declare c public.seleccion_config;
begin
 select * into c from public.seleccion_config where id;
 if tg_table_name='seleccion_config' and tg_op='UPDATE' and current_user not in ('postgres','supabase_admin') then
   if new.progressive_enabled is distinct from old.progressive_enabled or new.dispatch_paused is distinct from old.dispatch_paused or new.selection_site_url is distinct from old.selection_site_url then
     raise exception 'PROTECTED_CONFIGURATION' using errcode='42501';
   end if;
 end if;
 if not c.progressive_enabled then return coalesce(new,old); end if;
 if tg_table_name='solicitudes' and tg_op='INSERT' then
   -- Serialize with closure to avoid accepting after a concurrent archive/close.
   perform pg_advisory_xact_lock(73400001);
   select * into c from public.seleccion_config where id;
   if not c.is_open or c.applications_closed or new.season is distinct from c.active_season then raise exception 'APPLICATIONS_CLOSED'; end if;
   if new.status<>'pending' or new.email_notification_sent or new.final_email_sent or new.final_decision is not null or
     new.reviewed_at is not null or new.reviewed_by is not null or new.notes is not null or new.evaluated_at is not null or new.evaluated_by is not null or
     new.selection_revision<>0 or new.decision_exception_reason is not null or
     new.eval_blandas_score is not null or new.eval_motivacion_score is not null or new.eval_proyectos_score is not null or new.eval_aporte_score is not null or new.eval_tecnica_score is not null or
     new.eval_blandas_notes is not null or new.eval_motivacion_notes is not null or new.eval_proyectos_notes is not null or new.eval_aporte_notes is not null or new.eval_tecnica_notes is not null or new.eval_overall_notes is not null then raise exception 'INVALID_PUBLIC_FIELDS'; end if;
 elsif current_user not in ('postgres','supabase_admin') then
   raise exception 'USE_SELECTION_RPC' using errcode='42501';
 end if;
 return coalesce(new,old);
end $$;
create trigger selection_guard_solicitudes before insert or update or delete on public.solicitudes for each row execute function private_selection.guard_selection_write();
create trigger selection_guard_config before update or delete on public.seleccion_config for each row execute function private_selection.guard_selection_write();
create trigger selection_guard_days before insert or update or delete on public.interview_days for each row execute function private_selection.guard_selection_write();
create trigger selection_guard_interviews before insert or update or delete on public.interviews for each row execute function private_selection.guard_selection_write();
create trigger selection_guard_tokens before insert or update or delete on public.interview_booking_tokens for each row execute function private_selection.guard_selection_write();
revoke all on all functions in schema private_selection from public,anon,authenticated,service_role;
