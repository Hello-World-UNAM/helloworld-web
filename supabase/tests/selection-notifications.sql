-- Entire suite rolls back; only runs in the explicitly disposable DB harness.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
update public.seleccion_config set applications_closed=false,is_open=true,dispatch_paused=false,reminder_enabled=true,reminder_hours=array[72,24];
update public.interview_booking_tokens set revoked_at=now();
update private_selection.messages set status='cancelled' where status in ('queued','uncertain');
insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+25,'08:00','20:00',30,'https://meet.google.com/notification-tests');

create function public.test_invitation(n integer,remaining_hours integer,policy integer[] default array[72,24]) returns uuid language plpgsql as $$
declare a uuid:=public.test_app(n);
begin
 update public.solicitudes set status='accepted',email_notification_sent=true where id=a;
 delete from private_selection.messages where solicitud_id=a;
 insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at,duration_hours,reminder_hours)
 values(a,'notification-'||n,now()-interval '96 hours',now()+make_interval(hours=>remaining_hours),168,policy);
 return a;
end $$;

do $$
declare a uuid:=public.test_invitation(201,73); job jsonb; second_job jsonb; rev integer; count_before integer; slot timestamptz; iv uuid; b uuid; token text; stage text; decision text; input jsonb; request_id uuid; n integer:=220;
begin
 perform public.test_assert(public.selection_worker('claim') is null,'no reminder before 72h');
 update public.interview_booking_tokens set expires_at=now()+interval '72 hours' where solicitud_id=a;
 perform public.test_assert(private_selection.reminder_due(a,72),'72h boundary eligible');
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='reminder' and job->'payload'->>'reminder_hours'='72','first reminder threshold');
 perform public.test_assert(job->'payload'->>'booking_url' like '%notification-201','reminder contains personal link');
 perform public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"subject":"frozen 72h"}'::jsonb));
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','reminder-201-72'));
 perform public.test_assert(public.selection_worker('claim') is null,'72h reminder not repeated');
 update public.interview_booking_tokens set expires_at=now()+interval '24 hours' where solicitud_id=a;
 job:=public.selection_worker('claim');
 perform public.test_assert(job->'payload'->>'reminder_hours'='24','24h boundary gets second reminder despite reminder_sent_at');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','reminder-201-24'));
 perform public.test_assert(public.selection_worker('claim') is null,'no third reminder');
 select selection_revision into rev from public.solicitudes where id=a;
 perform public.selection_admin('extend',jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',a,'revision',rev)),'expires_at',now()+interval '20 hours','reason','Synthetic extension'));
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='deadline','extend generates a deadline update, not another reminder');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','extension-201'));
 perform public.test_assert(public.selection_worker('claim') is null,'extension does not reset sent thresholds');
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=a;

 a:=public.test_invitation(202,23);
 job:=public.selection_worker('claim');
 perform public.test_assert(job->'payload'->>'reminder_hours'='24','after a pause only final window is sent');
 perform public.test_assert((select count(*)=1 from private_selection.messages where solicitud_id=a),'no catch-up 72h message');
 -- A queued reminder must be suppressed if booking happens before first preparation.
 update private_selection.messages set status='queued',first_attempt_at=null,lease_token=null,lease_until=null where id=(job->>'id')::uuid;
 select slot_datetime into slot from private_selection.slots('2027-1') order by slot_datetime limit 1;
 perform public.test_assert((public.book_interview('notification-202',slot)->>'ok')::boolean,'candidate books');
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='booking','booking suppresses pending reminder');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','booking-202'));
 perform public.test_assert(not exists(select 1 from private_selection.messages where solicitud_id=a and kind='reminder' and status<>'cancelled'),'queued reminder cancelled on booking');
 -- Admin cancellation captures the original date and uses the same personal link.
 select id into iv from public.interviews where solicitud_id=a and status='confirmed';
 perform public.selection_admin('interview',jsonb_build_object('id',iv,'status','cancelled'));
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='cancellation' and job->'payload'->>'booking_url' like '%notification-202','admin cancellation has rebooking link');
 perform public.test_assert(job->'payload'->>'slot_datetime' is not null,'admin cancellation retains date');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','cancel-202'));
 select count(*) into count_before from private_selection.messages where solicitud_id=a and kind='cancellation';
 begin perform public.selection_admin('interview',jsonb_build_object('id',iv,'status','cancelled')); exception when raise_exception then if sqlerrm<>'STALE_INTERVIEW' then raise; end if; end;
 perform public.test_assert((select count(*)=count_before from private_selection.messages where solicitud_id=a and kind='cancellation'),'repeated cancellation cannot duplicate mail');
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=a;

 a:=public.test_invitation(203,24,array[24]);
 update public.interview_booking_tokens set reminder_sent_at=now() where solicitud_id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'legacy sent reminder remains suppressed');
 a:=public.test_invitation(204,24);
 update public.interview_booking_tokens set duration_hours=24 where solicitud_id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'short invitation skips simultaneous reminder');
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=a;
 a:=public.test_invitation(205,24,'{}'::integer[]);
 perform public.test_assert(not private_selection.reminder_due(a,24),'disabled invitation policy');
 a:=public.test_invitation(206,24);
 update public.seleccion_config set dispatch_paused=true;
 perform public.test_assert(public.selection_worker('claim') is null,'paused dispatcher sends nothing');
 update public.seleccion_config set dispatch_paused=false;
 update public.solicitudes set season='2028-1' where id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'previous season excluded');
 update public.solicitudes set season='2027-1',final_decision='rejected' where id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'final decision excluded');
 update public.solicitudes set final_decision=null where id=a;
 update public.interview_booking_tokens set expires_at=now() where solicitud_id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'expired invitation excluded');

 -- New invitations snapshot configuration on their first attempt, not when the UI saves.
 b:=public.test_app(207); delete from private_selection.messages where solicitud_id=b;
 update public.solicitudes set status='accepted' where id=b;
 insert into public.interview_booking_tokens(solicitud_id,token,duration_hours) values(b,'notification-207',168);
 perform private_selection.enqueue(b,'initial','{"decision":"accepted"}','new-invitation-207');
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='initial','initial invitation claimed');
 perform public.test_assert((select reminder_hours=array[72,24] from public.interview_booking_tokens where solicitud_id=b),'new invitation snapshot');
 select selection_revision into rev from public.seleccion_config where id;
 perform public.selection_admin('config',jsonb_build_object('revision',rev,'reminder_hours',jsonb_build_array(48,12)));
 perform public.test_assert((select reminder_hours=array[72,24] from public.interview_booking_tokens where solicitud_id=b),'config change preserves existing invitation');
 select selection_revision into rev from public.seleccion_config where id;
 begin perform public.selection_admin('config',jsonb_build_object('revision',rev,'reminder_hours',jsonb_build_array(12,48))); raise exception 'TEST FAILED: invalid reminders allowed';
 exception when check_violation then null; end;
 -- A booking between claim and preparation cancels the unprepared reminder.
 a:=public.test_invitation(209,23);
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='reminder','race fixture claims a reminder');
 select slot_datetime into slot from private_selection.slots('2027-1') order by slot_datetime limit 1;
 perform public.test_assert((public.book_interview('notification-209',slot)->>'ok')::boolean,'booking during claim lease');
 second_job:=public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"html":"must not be sent"}'::jsonb));
 perform public.test_assert(second_job->>'skipped'='true','recheck prevents sending after booking');
 perform public.test_assert((select status='cancelled' and request_body is null from private_selection.messages where id=(job->>'id')::uuid),'no provider body is frozen after cancellation');
 update private_selection.messages set status='cancelled' where solicitud_id=a and status='queued';

 -- Once prepared, the exact same provider body survives state changes and retries.
 a:=public.test_invitation(210,23);
 job:=public.selection_worker('claim');
 second_job:=public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"html":"immutable"}'::jsonb));
 select slot_datetime into slot from private_selection.slots('2027-1') order by slot_datetime limit 1;
 perform public.test_assert((public.book_interview('notification-210',slot)->>'ok')::boolean,'booking after preparation');
 second_job:=public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"html":"different"}'::jsonb));
 perform public.test_assert(second_job->'request_body'->>'html'='immutable','prepared HTML remains immutable');
 update private_selection.messages set status='cancelled' where solicitud_id=a and status='queued';

 -- Candidate cancellation also carries the personal link. Expiry is not extended.
 a:=public.test_invitation(211,100);
 select slot_datetime into slot from private_selection.slots('2027-1') order by slot_datetime limit 1;
 perform public.test_assert((public.book_interview('notification-211',slot)->>'ok')::boolean,'candidate books cancellation fixture');
 perform public.test_assert((public.cancel_interview('notification-211')->>'ok')::boolean,'candidate cancels');
 update public.interview_booking_tokens set expires_at=now()-interval '1 second' where solicitud_id=a;
 job:=public.selection_worker('claim');
 perform public.test_assert(job->>'kind'='cancellation' and job->'payload'->>'booking_url' like '%notification-211','candidate cancellation link');
 perform public.test_assert(public.get_booking_state('notification-211')->>'booking_blocked_reason'='INVITATION_EXPIRED','expired cancellation link explains the block');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','cancel-211'));

 -- Explicit correction sends exactly one message for each stage/decision combination.
 foreach stage in array array['initial','final'] loop
   foreach decision in array array['accepted','rejected'] loop
     n:=n+1;
     a:=public.test_invitation(n,100,'{}'::integer[]);
     if stage='initial' then
       update public.solicitudes set status=case when decision='accepted' then 'rejected' else 'accepted' end where id=a;
     else
       update public.solicitudes set final_decision=case when decision='accepted' then 'rejected' else 'accepted' end,
         final_email_sent=true,decision_exception_reason='Synthetic external review' where id=a;
     end if;
     select selection_revision into rev from public.solicitudes where id=a;
     request_id:=gen_random_uuid();
     input:=jsonb_build_object('id',a,'revision',rev,'reason','Synthetic correction','request_id',request_id,
       case when stage='initial' then 'status' else 'final_decision' end,decision);
     perform public.selection_admin('rectify',input);
     perform public.selection_admin('rectify',input);
     perform public.test_assert((select count(*)=1 from private_selection.messages where solicitud_id=a and kind='rectification'),'repeated correction request is idempotent');
     job:=public.selection_worker('claim');
     perform public.test_assert(job->>'kind'='rectification' and job->'payload'->>'stage'=stage and job->'payload'->>'decision'=decision,'correct stage and decision are sent');
     if stage='initial' and decision='accepted' then
       perform public.test_assert(job->'payload'->>'booking_url' is not null and job->'payload'->>'expires_at' is not null,'initial accepted correction includes link and expiry');
     end if;
     perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','rectify-'||n));
     perform public.test_assert(not exists(select 1 from private_selection.messages where solicitud_id=a and kind='cancellation'),'rejection correction does not send a second cancellation');
   end loop;
 end loop;

 a:=public.test_invitation(230,23);
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=a;
 perform public.test_assert(not private_selection.reminder_due(a,24),'revoked invitation excluded');
 update public.interview_booking_tokens set revoked_at=null where solicitud_id=a;
 update public.seleccion_config set is_open=false;
 perform public.test_assert(not private_selection.reminder_due(a,24),'closed season excluded');
 update public.seleccion_config set is_open=true;
 delete from public.interview_days;
 perform public.test_assert(not private_selection.reminder_due(a,24),'no available schedules suppresses reminder');
 raise notice 'Notification workflow tests passed';
end $$;

select set_config('request.jwt.claims','{"email":"outsider@example.org"}',false);
do $$ begin
 begin perform public.selection_admin('config','{"reminder_hours":[48,12]}'); raise exception 'TEST FAILED: outsider changed reminders';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
