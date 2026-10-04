begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(73400001);
create function private_selection.reminder_due(p_id uuid,p_hours integer,p_ignore uuid) returns boolean
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
     and x.id is distinct from p_ignore
     and x.status in ('sending','uncertain','accepted','failed')
     and (coalesce((x.payload->>'reminder_hours')::integer,24)=p_hours or x.status in ('sending','uncertain')))
   and not (cardinality(coalesce(t.reminder_hours,array[24]))=1 and t.reminder_sent_at is not null)
   and private_selection.capacity(s.season)>=0
   and exists(select 1 from private_selection.slots(s.season))
 from public.interview_booking_tokens t join public.solicitudes s on s.id=t.solicitud_id
 cross join public.seleccion_config c where t.solicitud_id=p_id and c.id),false);
$$;
revoke all on function private_selection.reminder_due(uuid,integer,uuid) from public,anon,authenticated,service_role;
create or replace function private_selection.reminder_due(p_id uuid,p_hours integer) returns boolean
language sql stable security invoker set search_path='' as $$
 select private_selection.reminder_due(p_id,p_hours,null::uuid);
$$;
revoke all on function private_selection.reminder_due(uuid,integer) from public,anon,authenticated,service_role;
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
     if m.request_body is null and (s.season is distinct from c.active_season or not c.is_open or
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
     if m.request_body is null and c.dispatch_paused then
       update private_selection.messages set status='queued',lease_token=null,lease_until=null,next_attempt_at=now()+interval '60 seconds' where id=m.id;
       return jsonb_build_object('skipped',true,'reason','dispatch_paused');
     end if;
     if m.request_body is null and m.kind='reminder' then
       select * into t from public.interview_booking_tokens where solicitud_id=m.solicitud_id;
       if not private_selection.reminder_due(m.solicitud_id,coalesce((m.payload->>'reminder_hours')::integer,24),m.id)
         or (m.payload ? 'invitation_started_at' and m.payload->>'invitation_started_at' is distinct from t.invited_at::text) then
         update private_selection.messages set status='cancelled',lease_token=null,lease_until=null,last_error='reminder_no_longer_actionable' where id=m.id;
         return jsonb_build_object('skipped',true,'reason','reminder_no_longer_actionable');
       end if;
     end if;
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
