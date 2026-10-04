begin;
update public.seleccion_config set active_season='2027-1',applications_closed=false,is_open=true,progressive_enabled=true,interview_duration_minutes=15;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
do $$
declare a uuid:=public.test_app(401); room uuid; block uuid; job jsonb; req jsonb;
 day date:=(now() at time zone 'America/Mexico_City')::date+170;
begin
 update public.seleccion_config set active_season='2095-1';
 update public.solicitudes set season='2095-1',status='accepted' where id=a;
 perform public.selection_admin('room',jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','11:00','request_id',gen_random_uuid()));
 select id into room from private_selection.rooms where season='2095-1';
 req:=jsonb_build_object('operation','delete','id',room,'request_id',gen_random_uuid());
 perform public.selection_admin('room',req);
 perform public.selection_admin('room',req);
 perform public.test_assert(not exists(select 1 from private_selection.rooms where id=room),'draft deleted idempotently');
 job:=public.selection_calendar_worker('claim',jsonb_build_object('room_id',room));
 perform public.test_assert(job->>'kind'='cancel' and (job->>'room_deleted')::boolean,'durable cancellation claimed');
 perform public.selection_calendar_worker('finish',job||'{"outcome":"failed","error":"fixture retry"}'::jsonb);
 perform public.test_assert(public.selection_calendar_worker('claim',jsonb_build_object('room_id',room)) is null,'failed cancellation has retry backoff');
 update private_selection.room_cancellations set lease_until=now()-interval '1 second' where id=room;
 job:=public.selection_calendar_worker('claim',jsonb_build_object('room_id',room));
 perform public.selection_calendar_worker('finish',job||'{"outcome":"ready"}'::jsonb);
 perform public.test_assert((select status='done' from private_selection.room_cancellations where id=room),'cancellation completes');
 perform public.selection_admin('room',jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','11:00','request_id',gen_random_uuid()));
 select id into room from private_selection.rooms where season='2095-1';
 update private_selection.rooms set calendar_status='ready',meet_url='https://meet.google.com/aaa-bbbb-ccc',primary_email='delete-host@example.org',backup_email='delete-backup@example.org',published=true where id=room;
 select id into block from public.interview_days where room_id=room;
 insert into private_selection.messages(solicitud_id,kind,recipient,payload,idempotency_key,status)
 values(a,'initial','a@example.org','{"decision":"accepted"}','delete-test','sending');
 perform public.test_assert((public.selection_admin('state')->>'room_deletion_locked')::boolean,'in-flight initial email protects season');
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','delete','id',room,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: room deletion during sending';
 exception when raise_exception then if sqlerrm<>'INITIAL_MAIL_LOCKS_AGENDA' then raise; end if; end;
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','block','id',room,'block_id',block,'delete',true,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: block deletion during sending';
 exception when raise_exception then if sqlerrm<>'INITIAL_MAIL_LOCKS_AGENDA' then raise; end if; end;
 update private_selection.messages set status='accepted' where idempotency_key='delete-test';
 begin
   delete from public.interview_days where id=block;
   raise exception 'TEST FAILED: direct deletion after sending';
 exception when raise_exception then if sqlerrm<>'INITIAL_MAIL_LOCKS_AGENDA' then raise; end if; end;
 update private_selection.messages set status='cancelled' where idempotency_key='delete-test';
 perform public.test_assert(not (public.selection_admin('state')->>'room_deletion_locked')::boolean,'cancelled never-sent messages do not freeze agenda');
 insert into public.interview_booking_tokens(solicitud_id,token,expires_at) values(a,'delete-capacity-token',now()+interval '7 days');
 update private_selection.messages set status='queued' where idempotency_key='delete-test';
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','block','id',room,'block_id',block,'delete',true,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: deletion removed committed capacity';
 exception when raise_exception then if sqlerrm<>'INSUFFICIENT_CAPACITY' then raise; end if; end;
 perform public.test_assert(exists(select 1 from public.interview_days where id=block),'capacity failure rolls back block deletion');
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=a;
 update private_selection.messages set status='cancelled' where idempotency_key='delete-test';
 insert into public.interviews(solicitud_id,room_id,day_id,slot_datetime,duration_minutes,meet_url) values(a,room,block,(day+time '10:00') at time zone 'America/Mexico_City',15,'https://meet.google.com/aaa-bbbb-ccc');
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','delete','id',room,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: reserved room deleted';
 exception when raise_exception then if sqlerrm<>'BLOCK_HAS_RESERVATIONS' then raise; end if; end;
 delete from public.interviews where room_id=room;
 perform public.selection_admin('room',jsonb_build_object('operation','delete','id',room,'request_id',gen_random_uuid()));
 perform public.test_assert(not exists(select 1 from private_selection.rooms where id=room),'published room deletable before first initial mail');
 perform public.test_assert(not has_function_privilege('authenticated','private_selection.admin_before_deletion(text,jsonb)','execute'),'cannot bypass deletion through private admin');
end $$;
rollback;
