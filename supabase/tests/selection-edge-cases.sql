select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
update public.seleccion_config set applications_closed=false;
-- Make room for synthetic invitations; the earlier workflow fixtures are preserved.
insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+15,'10:00','18:00',30,'https://meet.google.com/testing');
do $$
declare a uuid:=public.test_app(4); b uuid:=public.test_app(5); c uuid:=public.test_app(6); p jsonb; job jsonb; rev integer; expiry timestamptz; token text; msg uuid; first_evaluation timestamptz; second_evaluation timestamptz;
begin
 -- Isolate the queue from the previous scenario; these are synthetic rows only.
 update private_selection.messages set status='cancelled' where status in ('queued','sending','uncertain','failed');
 update public.solicitudes set status='accepted' where id in(a,b,c);
 insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at)
 values(a,'reminder-a',now()-interval '6 days',now()+interval '23 hours'),(b,'reminder-b',now(),now()+interval '20 hours');
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='reminder' and job->>'solicitud_id'=a::text,'one reminder due only for long invitation');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id',gen_random_uuid()));
 update public.interview_booking_tokens set expires_at=now()+interval '22 hours' where solicitud_id=a;
 update public.interview_booking_tokens set invited_at=now()-interval '4 days',expires_at=now()+interval '23 hours',duration_hours=20 where solicitud_id=b;
 perform public.test_assert(public.selection_worker('claim') is null,'no second reminder after deadline edit');
 select selection_revision into rev from public.solicitudes where id=c;
 begin perform public.selection_admin('save',jsonb_build_object('id',c,'revision',rev,'final_decision','accepted')); raise exception 'TEST FAILED: admission without interview';
 exception when raise_exception then if sqlerrm<>'INTERVIEW_OR_EXCEPTION_REQUIRED' then raise; end if; end;
 perform public.selection_admin('save',jsonb_build_object('id',c,'revision',rev,'final_decision','accepted','exception_reason','Interview held externally'));
 select selection_revision into rev from public.solicitudes where id=c;
 perform public.selection_admin('save',jsonb_build_object('id',c,'revision',rev,'evaluation',jsonb_build_object('eval_overall_notes','First evaluation')));
 select evaluated_at into first_evaluation from public.solicitudes where id=c;
 perform public.test_assert(first_evaluation is not null and (select evaluated_by='admin@example.org' from public.solicitudes where id=c),'evaluation metadata records the admin');
 perform pg_sleep(0.01);
 select selection_revision into rev from public.solicitudes where id=c;
 perform public.selection_admin('save',jsonb_build_object('id',c,'revision',rev,'evaluation',jsonb_build_object('eval_overall_notes','Updated evaluation')));
 select evaluated_at into second_evaluation from public.solicitudes where id=c;
 perform public.test_assert(second_evaluation>first_evaluation and (select eval_overall_notes='Updated evaluation' from public.solicitudes where id=c),'evaluation metadata tracks the latest edit');
 select selection_revision into rev from public.solicitudes where id=c;
 p:=public.selection_admin('preview',jsonb_build_object('kind','final','items',jsonb_build_array(jsonb_build_object('id',c,'revision',rev))));
 perform public.selection_admin('confirm',jsonb_build_object('kind','final','items',p->'items','config_revision',p->'config_revision','request_id',gen_random_uuid()));
 job:=public.selection_worker('claim'); msg:=(job->>'id')::uuid;
 perform public.selection_worker('prepared',jsonb_build_object('id',msg,'lease_token',job->>'lease_token','request_body','{"test":true}'::jsonb));
 perform public.selection_worker('finish',jsonb_build_object('id',msg,'lease_token',job->>'lease_token','outcome','uncertain','error','timeout'));
 update private_selection.messages set first_attempt_at=now()-interval '25 hours',next_attempt_at=now() where id=msg;
 perform public.test_assert(public.selection_worker('claim') is null,'do not blindly retry after retention');
 perform public.test_assert((select status='uncertain' and next_attempt_at='infinity'::timestamptz from private_selection.messages where id=msg),'uncertain requires reconciliation');
 select selection_revision into rev from public.solicitudes where id=c;
 begin perform public.selection_admin('save',jsonb_build_object('id',c,'revision',rev,'final_decision','rejected')); raise exception 'TEST FAILED: uncertain send edited';
 exception when raise_exception then if sqlerrm<>'SEND_IN_PROGRESS' then raise; end if; end;
 -- Signed webhook tag can reconcile a lost provider response.
 perform public.selection_worker('webhook',jsonb_build_object('event_id','tagged-event','event',jsonb_build_object('type','email.delivered','created_at',now(),
   'data',jsonb_build_object('email_id',gen_random_uuid(),'tags',jsonb_build_object('selection_message_id',msg)))));
 perform public.test_assert((select status='accepted' and delivery_status='delivered' from private_selection.messages where id=msg),'tagged event settles uncertainty');
 -- Closing input never sends decisions; archive refuses pending candidates.
 select selection_revision into rev from public.seleccion_config where id;
 begin perform public.selection_admin('config',jsonb_build_object('revision',rev,'archive',true)); raise exception 'TEST FAILED: unresolved archive';
 exception when raise_exception then if sqlerrm<>'UNRESOLVED_CANDIDATES_OR_MESSAGES' then raise; end if; end;
 -- Changing defaults leaves existing expiries untouched.
 select expires_at into expiry from public.interview_booking_tokens where solicitud_id=a;
 perform public.selection_admin('config',jsonb_build_object('revision',rev,'default_booking_hours',48));
 perform public.test_assert((select expires_at=expiry from public.interview_booking_tokens where solicitud_id=a),'default change is not retroactive');
 raise notice 'Reminder, exception, uncertainty and archive tests passed';
end $$;

-- Exercise guards with the same role used by the browser, not postgres.
grant usage on schema auth to authenticated,anon;
grant select on public.seleccion_config,public.solicitudes to authenticated,anon;
grant update on public.solicitudes,public.seleccion_config to authenticated;
set role authenticated;
do $$ begin
 begin update public.solicitudes set status='rejected'; raise exception 'TEST FAILED: direct update succeeded';
 exception when insufficient_privilege then null; end;
 begin update public.seleccion_config set progressive_enabled=false; raise exception 'TEST FAILED: direct flag update succeeded';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"email":"outsider@example.org"}',false);
do $$ begin
 begin perform public.selection_admin('state'); raise exception 'TEST FAILED: outsider access'; exception when insufficient_privilege then null; end;
end $$;
