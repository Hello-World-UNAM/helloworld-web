create or replace function public.selection_worker(p_action text,p_data jsonb default '{}') returns jsonb
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
     and bt.duration_hours>24 and bt.expires_at-bt.invited_at>interval '24 hours' and bt.expires_at>now() and bt.expires_at<=now()+interval '24 hours'
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
