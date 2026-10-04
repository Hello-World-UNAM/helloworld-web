begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(73400001);

alter table public.seleccion_config
  add column reminder_enabled boolean not null default true,
  add column reminder_hours integer[] not null default array[72,24],
  add constraint selection_reminder_hours_valid check (
    array_ndims(reminder_hours)=1 and array_lower(reminder_hours,1)=1 and cardinality(reminder_hours)=2
    and reminder_hours[1] between 1 and 8760 and reminder_hours[2] between 1 and 8760
    and reminder_hours[1]>reminder_hours[2]);
alter table public.interview_booking_tokens add column reminder_hours integer[];
-- Existing invitations keep their one-24-hour reminder policy. Unsent invitations
-- receive their snapshot on the first attempt of the invitation mail.
update public.interview_booking_tokens set reminder_hours=array[24] where invited_at is not null;

-- Central eligibility predicate used both at enqueue and immediately before a
-- first send. It runs with the caller's permissions inside the workflow lock.
create function private_selection.reminder_due(p_id uuid,p_hours integer) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select
   c.progressive_enabled and c.is_open and not c.dispatch_paused
   and s.season=c.active_season and s.status='accepted' and s.final_decision is null
   and t.revoked_at is null and t.invited_at is not null and t.expires_at>now()
   and p_hours=any(coalesce(t.reminder_hours,array[24]))
   and t.duration_hours>p_hours
   and t.expires_at-t.invited_at>make_interval(hours=>p_hours)
   and t.expires_at<=now()+make_interval(hours=>p_hours)
   and t.expires_at>now()+make_interval(hours=>coalesce((select max(h) from unnest(coalesce(t.reminder_hours,array[24])) h where h<p_hours),0))
   and not exists(select 1 from public.interviews i where i.solicitud_id=s.id and i.status in ('confirmed','completed','no_show'))
   and not exists(select 1 from private_selection.messages x where x.solicitud_id=s.id
     and (x.kind='initial' or (x.kind='rectification' and x.payload->>'stage'='initial'))
     and x.first_attempt_at>=t.invited_at and (x.status<>'accepted' or x.delivery_status in ('bounced','failed','complained')))
   and not exists(select 1 from private_selection.messages x where x.solicitud_id=s.id and x.kind='reminder'
     and x.payload->>'invitation_started_at'=t.invited_at::text
     and x.status in ('sending','uncertain','accepted','failed')
     and (coalesce((x.payload->>'reminder_hours')::integer,24)=p_hours or x.status in ('sending','uncertain')))
   and not (cardinality(coalesce(t.reminder_hours,array[24]))=1 and t.reminder_sent_at is not null)
   and private_selection.capacity(s.season)>=0
   and exists(select 1 from private_selection.slots(s.season))
 from public.interview_booking_tokens t join public.solicitudes s on s.id=t.solicitud_id
 cross join public.seleccion_config c where t.solicitud_id=p_id and c.id),false);
$$;
revoke all on function private_selection.reminder_due(uuid,integer) from public,anon,authenticated,service_role;

create or replace function public.selection_admin(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare c public.seleccion_config; s public.solicitudes; t public.interview_booking_tokens; m private_selection.messages;
 v_season text; v_id uuid; v_request uuid; v_actor uuid:=auth.uid(); v_item jsonb; v_items jsonb:='[]'; v_result jsonb;
 v_kind text; v_decision text; v_hours integer; v_needed integer:=0; v_capacity integer; v_reason text;
 v_fingerprint text:=md5(p_action||p_data::text); v_existing private_selection.requests; v_eval jsonb; v_email text; v_communicated_at timestamptz;
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
 if p_action='config' and p_data ? 'open_season' then
   if (p_data->>'revision')::integer is distinct from c.selection_revision then raise exception 'STALE_SELECTION'; end if;
   if c.is_open then raise exception 'ARCHIVE_CURRENT_SEASON_FIRST'; end if;
   v_season:=trim(p_data->>'open_season');
   if v_season is null or v_season !~ '^[0-9]{4}-[12]$' then raise exception 'INVALID_SEASON'; end if;
   if v_season=c.active_season or exists(select 1 from public.solicitudes where season=v_season)
     or exists(select 1 from public.interview_days where season=v_season)
     or exists(select 1 from private_selection.events where season=v_season) then raise exception 'SEASON_ALREADY_EXISTS'; end if;
   update public.seleccion_config set active_season=v_season,is_open=true,applications_closed=false,
     opened_at=now(),opened_by=auth.jwt()->>'email',closed_at=null,closed_by=null,interview_deadline_at=null,
     selection_revision=selection_revision+1 where id;
   perform private_selection.audit(null,'open_season',p_data);
   return jsonb_build_object('ok',true,'season',v_season);
 end if;
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
     if exists(select 1 from private_selection.messages where solicitud_id=s.id and (kind=v_kind or (kind='rectification' and payload->>'stage'=v_kind)) and status in ('queued','sending','uncertain','accepted','failed')) then raise exception 'COMMUNICATION_EXISTS_USE_RETRY_OR_RECTIFY'; end if;
     if v_kind='final' and v_decision='accepted' and not exists(select 1 from public.interviews where solicitud_id=s.id and status='completed') and nullif(trim(s.decision_exception_reason),'') is null then raise exception 'INTERVIEW_OR_EXCEPTION_REQUIRED'; end if;
     if v_kind='final' and exists(select 1 from public.interviews where solicitud_id=s.id and status='confirmed') then raise exception 'RESOLVE_RESERVATION_FIRST'; end if;
     if v_kind='final' and v_decision='accepted' and c.whatsapp_url !~ '^https://chat[.]whatsapp[.]com/' then raise exception 'WHATSAPP_URL_REQUIRED'; end if;
     if v_kind='initial' and v_decision='accepted' then v_needed:=v_needed+1; end if;
     v_items:=v_items||jsonb_build_array(jsonb_build_object('id',s.id,'revision',s.selection_revision,'nombre',s.nombre,'correo',s.correo,'season',s.season,'decision',v_decision,'kind',v_kind,
     'payload',jsonb_build_object('nombre',s.nombre,'season',s.season,'decision',v_decision,
       'expires_at',case when v_kind='initial' and v_decision='accepted' then to_char((now()+make_interval(hours=>v_hours)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else null end,
       'booking_url',case when v_kind='initial' and v_decision='accepted' then c.selection_site_url||'/seleccion/agendar?t=ENLACE_PERSONAL' else null end,
       'whatsapp_url',case when v_kind='final' and v_decision='accepted' then c.whatsapp_url else null end),
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
       not exists(select 1 from private_selection.messages m where m.solicitud_id=x.id and (m.kind=case when x.status='rejected' then 'initial' else 'final' end or (m.kind='rectification' and m.payload->>'stage'=case when x.status='rejected' then 'initial' else 'final' end))
         and m.payload->>'decision'=case when x.status='rejected' then x.status else x.final_decision end
         and ((m.status='accepted' and m.delivery_status='delivered') or m.status='manual'))))
       or exists(select 1 from private_selection.messages m join public.solicitudes x on x.id=m.solicitud_id where x.season=c.active_season and m.status in ('queued','sending','uncertain','failed') and m.kind<>'reminder')
       or exists(select 1 from public.interviews i join public.solicitudes x on x.id=i.solicitud_id where x.season=c.active_season and i.status='confirmed') then raise exception 'UNRESOLVED_CANDIDATES_OR_MESSAGES'; end if;
     update public.seleccion_config set is_open=false,applications_closed=true,closed_at=now(),closed_by=auth.jwt()->>'email' where id;
     update public.interview_booking_tokens set revoked_at=now() where solicitud_id in(select id from public.solicitudes where season=c.active_season);
   else
   if p_data ? 'whatsapp_url' and nullif(trim(p_data->>'whatsapp_url'),'') is not null and p_data->>'whatsapp_url' !~ '^https://chat[.]whatsapp[.]com/' then raise exception 'INVALID_WHATSAPP_URL'; end if;
     update public.seleccion_config set applications_closed=coalesce((p_data->>'applications_closed')::boolean,applications_closed),
       reminder_enabled=coalesce((p_data->>'reminder_enabled')::boolean,reminder_enabled),
       reminder_hours=case when p_data ? 'reminder_hours' then array(select jsonb_array_elements_text(p_data->'reminder_hours')::integer) else reminder_hours end,
       default_booking_hours=coalesce((p_data->>'default_booking_hours')::integer,default_booking_hours),
       dispatch_paused=coalesce((p_data->>'dispatch_paused')::boolean,dispatch_paused),
       whatsapp_url=case when p_data ? 'whatsapp_url' then trim(p_data->>'whatsapp_url') else whatsapp_url end where id;
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
   update public.interviews set status=p_data->>'status',notes=case when p_data ? 'reason' then nullif(trim(p_data->>'reason'),'') else notes end,cancelled_at=case when p_data->>'status'='cancelled' then now() else cancelled_at end where id=(p_data->>'id')::uuid and status='confirmed';
   if not found then raise exception 'STALE_INTERVIEW'; end if;
   update public.solicitudes set selection_revision=selection_revision+1 where id=s.id;
   if p_data->>'status'='cancelled' then
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and kind='booking' and status='queued';
     perform private_selection.enqueue(s.id,'cancellation',jsonb_build_object('slot_datetime',(select slot_datetime from public.interviews where id=(p_data->>'id')::uuid)),'cancel/'||(p_data->>'id'));
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
     if p_data ? 'status' and p_data->>'status' is not null and p_data->>'status' not in ('pending','reviewing','accepted','rejected') then raise exception 'INVALID_STATUS'; end if;
     if p_data ? 'final_decision' and p_data->>'final_decision' is not null and p_data->>'final_decision' not in ('accepted','rejected') then raise exception 'INVALID_DECISION'; end if;
     if p_data ? 'evaluation' and jsonb_typeof(p_data->'evaluation') is distinct from 'object' then raise exception 'INVALID_EVALUATION'; end if;
     if (p_data ? 'status' and p_data->>'status' is distinct from s.status and s.email_notification_sent) or (p_data ? 'final_decision' and p_data->>'final_decision' is distinct from s.final_decision and s.final_email_sent) then raise exception 'USE_RECTIFICATION'; end if;
      if (p_data ? 'status' and p_data->>'status' is distinct from s.status) or (p_data ? 'final_decision' and p_data->>'final_decision' is distinct from s.final_decision) then
        -- Las confirmaciones de eventos (booking/cancellation) describen hechos, no la decisión:
        -- sobreviven al guardado. Sólo mueren si la invitación se revoca (ver rama status<>accepted).
        update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed') and kind not in ('receipt','booking','cancellation');
        if p_data ? 'status' and p_data->>'status'<>'accepted' then
          if exists(select 1 from public.interviews where solicitud_id=s.id and status='confirmed') then raise exception 'RESOLVE_RESERVATION_FIRST'; end if;
          update public.interview_booking_tokens set revoked_at=now() where solicitud_id=s.id;
          update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed') and kind in ('booking','cancellation','deadline','reminder');
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
       eval_blandas_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_blandas_notes' then nullif(v_eval->>'eval_blandas_notes','') else eval_blandas_notes end,
       eval_motivacion_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_motivacion_notes' then nullif(v_eval->>'eval_motivacion_notes','') else eval_motivacion_notes end,
       eval_proyectos_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_proyectos_notes' then nullif(v_eval->>'eval_proyectos_notes','') else eval_proyectos_notes end,
       eval_aporte_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_aporte_notes' then nullif(v_eval->>'eval_aporte_notes','') else eval_aporte_notes end,
       eval_tecnica_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_tecnica_notes' then nullif(v_eval->>'eval_tecnica_notes','') else eval_tecnica_notes end,
       eval_overall_notes=case when coalesce(v_eval,'{}'::jsonb) ? 'eval_overall_notes' then nullif(v_eval->>'eval_overall_notes','') else eval_overall_notes end
       where id=s.id returning * into s;
     if coalesce((p_data->>'complete_interview')::boolean,false) then
       update public.interviews set status='completed' where solicitud_id=s.id and status='confirmed' and slot_datetime<=now();
       if not found and nullif(trim(p_data->>'exception_reason'),'') is null then raise exception 'STARTED_INTERVIEW_REQUIRED'; end if;
       update public.solicitudes set evaluated_at=now(),evaluated_by=auth.jwt()->>'email' where id=s.id;
     end if;
     if s.final_decision is not null and s.status<>'accepted' then raise exception 'INITIAL_ACCEPTANCE_REQUIRED'; end if;
     if s.final_decision='accepted' and s.decision_exception_reason is null and not exists(select 1 from public.interviews where solicitud_id=s.id and status='completed') then raise exception 'INTERVIEW_OR_EXCEPTION_REQUIRED'; end if;
   elsif p_action='rectify' then
     if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
     v_kind:=case when p_data?'final_decision' then 'final' else 'initial' end;
     v_decision:=coalesce(p_data->>'final_decision',p_data->>'status');
     if v_decision is null or v_decision not in ('accepted','rejected') then raise exception 'INVALID_DECISION'; end if;
     if v_decision=(case when v_kind='initial' then s.status else s.final_decision end) then raise exception 'DECISION_UNCHANGED'; end if;
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
     if v_reason is null or nullif(trim(p_data->>'communicated_at'),'') is null or p_data->>'communicated_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?([Zz]|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'COMMUNICATION_DETAILS_REQUIRED'; end if;
     begin v_communicated_at:=(p_data->>'communicated_at')::timestamptz; exception when others then raise exception 'COMMUNICATION_DETAILS_REQUIRED'; end;
     if v_communicated_at>now() then raise exception 'COMMUNICATION_DETAILS_REQUIRED'; end if;
     v_kind:=case when s.status='rejected' then 'initial' else 'final' end;
     v_decision:=case when s.status='rejected' then s.status else s.final_decision end;
     if v_decision is null then raise exception 'FINAL_DECISION_REQUIRED'; end if;
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and status in ('queued','failed');
     v_id:=private_selection.enqueue(s.id,v_kind,jsonb_build_object('decision',v_decision),'manual/'||s.id||'/'||s.selection_revision);
     update private_selection.messages set status='manual',delivery_status='pending' where id=v_id;
     update public.solicitudes set email_notification_sent=case when v_kind='initial' then true else email_notification_sent end,final_email_sent=case when v_kind='final' then true else final_email_sent end where id=s.id;
   elsif p_action='email' then
     v_email:=lower(trim(p_data->>'correo'));
     if v_reason is null or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'EMAIL_AND_REASON_REQUIRED'; end if;
     update public.solicitudes set correo=v_email where id=s.id;
     -- Delivered messages remain immutable. Retarget only definite failures or unsent work.
     update private_selection.messages set status='cancelled' where solicitud_id=s.id and status='queued';
     for m in select * from private_selection.messages where solicitud_id=s.id
       and (status='failed' or (status='accepted' and delivery_status in ('bounced','failed')))
       and (kind not in ('initial','final','rectification') or
         payload->>'decision'=case when kind='initial' or (kind='rectification' and payload->>'stage'='initial') then s.status else s.final_decision end)
       and (kind<>'booking' or exists(select 1 from public.interviews where id=(payload->>'interview_id')::uuid and status='confirmed' and slot_datetime>now()))
       and (kind not in ('reminder','deadline') or exists(select 1 from public.interview_booking_tokens where solicitud_id=s.id and revoked_at is null and expires_at>now()))
       loop
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

create or replace function public.selection_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.seleccion_config; m private_selection.messages; s public.solicitudes; t public.interview_booking_tokens;
 v_event jsonb; v_type text; v_delivery text; v_provider text; v_occurred timestamptz; v_id uuid; v_attempt integer; v_hours integer;
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
   -- Snapshot policy is per invitation; thresholds occupy non-overlapping windows.
   for t in select * from public.interview_booking_tokens where invited_at is not null loop
     for v_hours in select unnest(coalesce(t.reminder_hours,array[24])) loop
       if private_selection.reminder_due(t.solicitud_id,v_hours) then
         perform private_selection.enqueue(t.solicitud_id,'reminder',
           jsonb_build_object('expires_at',t.expires_at,'reminder_hours',v_hours,'invitation_started_at',t.invited_at::text),
           'reminder/'||t.id||'/'||t.invited_at::text||'/'||v_hours);
       end if;
     end loop;
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
       (m.kind='reminder' and (
         (m.payload ? 'invitation_started_at' and m.payload->>'invitation_started_at' is distinct from t.invited_at::text)
         or not private_selection.reminder_due(s.id,coalesce((m.payload->>'reminder_hours')::integer,24)))) or
       (m.kind='deadline' and (t.expires_at is null or t.expires_at<=now() or t.revoked_at is not null or s.final_decision is not null)) or
       (m.kind='booking' and not exists(select 1 from public.interviews where id=(m.payload->>'interview_id')::uuid and status='confirmed')) or
       (m.kind in ('initial','final','rectification') and m.payload->>'decision' is distinct from
         case when m.kind='initial' or m.payload->>'stage'='initial' then s.status else s.final_decision end)) then
       update private_selection.messages set status='cancelled' where id=m.id; continue;
     end if;
     if m.first_attempt_at is null and (m.kind='initial' or (m.kind='rectification' and m.payload->>'stage'='initial')) and m.payload->>'decision'='accepted' then
       if private_selection.capacity(s.season)<0 then
         update private_selection.messages set status='failed',last_error='INSUFFICIENT_CAPACITY' where id=m.id; continue;
       end if;
       update public.interview_booking_tokens set invited_at=now(),expires_at=now()+make_interval(hours=>duration_hours),reminder_hours=case when c.reminder_enabled then c.reminder_hours else '{}'::integer[] end,reminder_sent_at=null where id=t.id returning * into t;
       m.payload:=m.payload||jsonb_build_object('expires_at',t.expires_at);
     end if;
     if m.first_attempt_at is null and t.token is not null and m.kind in ('initial','rectification','booking','deadline','reminder','cancellation') then
       m.payload:=m.payload||jsonb_build_object('booking_url',c.selection_site_url||'/seleccion/agendar?t='||t.token);
     end if;
     if m.first_attempt_at is null and m.kind in ('deadline','reminder') then
       m.payload:=m.payload||jsonb_build_object('expires_at',t.expires_at);
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

commit;
