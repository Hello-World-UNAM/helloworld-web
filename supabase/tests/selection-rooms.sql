-- All room fixtures roll back. Calendar outcomes are simulated; real-account rehearsal remains mandatory.
begin;
update public.seleccion_config set is_open=true,active_season='2027-1',applications_closed=false;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
do $$
declare target_room uuid; room_a uuid; room_b uuid; block_a uuid; block_b uuid; day date:=(now() at time zone 'America/Mexico_City')::date+40;
 slot timestamptz; a uuid; b uuid; applicant_c uuid; applicant_d uuid; result jsonb; job jsonb; create_payload jsonb; request_id uuid:=gen_random_uuid(); booking_a uuid;
begin
 create_payload:=jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','11:00','room_count',2,'request_id',request_id);
 perform public.selection_admin('room',create_payload);
 perform public.selection_admin('room',create_payload);
 perform public.test_assert((select count(*)=2 from private_selection.rooms where date=day),'create journey is idempotent');
 perform public.test_assert(not exists(select 1 from private_selection.rooms where date=day and (calendar_event_id !~ '^[0-9a-v]+$' or length(calendar_event_id) not between 5 and 1024)),'room Calendar IDs use base32hex');
 select id into room_a from private_selection.rooms where date=day order by position limit 1;
 select id into room_b from private_selection.rooms where date=day order by position desc limit 1;
 select id into block_a from public.interview_days where room_id=room_a;
 select id into block_b from public.interview_days where room_id=room_b;
 perform public.test_assert((select duration_minutes=15 from public.interview_days where id=block_a),'season defaults to 15 minutes with no buffer');
 perform public.test_assert(not exists(select 1 from private_selection.slots('2027-1') where day_id=block_a),'drafts have no public slots');
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','publish','id',room_a,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: unverified published';
 exception when raise_exception then if sqlerrm<>'HOST_VERIFICATION_REQUIRED' then raise; end if; end;
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',room_a,'primary_email','host-a@example.org','backup_email','backup-a@example.org','request_id',gen_random_uuid()));
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',room_b,'primary_email','host-b@example.org','backup_email','backup-b@example.org','request_id',gen_random_uuid()));
 for n in 1..2 loop
   job:=public.selection_calendar_worker('claim');
   perform public.test_assert(job->>'kind'='room','room job claimed');
   perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','ready','meet_url',case when (job->>'id')::uuid=room_a then 'https://meet.google.com/aaa-bbbb-ccc' else 'https://meet.google.com/ddd-eeee-fff' end));
 end loop;
 for target_room in select id from private_selection.rooms where date=day loop
   perform public.selection_admin('room',jsonb_build_object('operation','verify','id',target_room,'request_id',gen_random_uuid(),'evidence','Synthetic fixture; not a real account rehearsal',
     'checks',jsonb_build_object('long_call',true,'external_admission',true,'unam_admission',true,'backup_without_creator',true,'parallel_rooms',true,'stable_authorization',true,'restricted_access',true)));
   perform public.selection_admin('room',jsonb_build_object('operation','publish','id',target_room,'request_id',gen_random_uuid()));
 end loop;
 perform public.test_assert((select count(*)=8 from private_selection.slots('2027-1') where day_id in (block_a,block_b)),'two rooms provide eight separate 15-minute seats');
 a:=public.test_app(801); b:=public.test_app(802);
 update public.solicitudes set status='accepted' where id in (a,b);
 insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at) values(a,'rooms-a',now(),now()+interval '7 days'),(b,'rooms-b',now(),now()+interval '7 days');
 result:=public.get_booking_state('rooms-a');
 perform public.test_assert((select count(*)=4 from jsonb_array_elements(result->'slots') x where (x->>'slot_datetime')::timestamptz >= day::timestamp at time zone 'America/Mexico_City' and (x->>'slot_datetime')::timestamptz < (day+1)::timestamp at time zone 'America/Mexico_City'),'public choices deduplicate rooms');
 perform public.test_assert(not exists(select 1 from jsonb_array_elements(result->'slots') x where x ? 'meet_url' or x ? 'day_id'),'public choices do not reveal unreserved Meet');
 slot:=(day+time '10:00') at time zone 'America/Mexico_City';
 perform public.test_assert(public.book_interview('rooms-a',slot,20)->>'error'='SLOT_TAKEN','cannot book a duration different from the displayed option');
 result:=public.book_interview('rooms-a',slot,15); booking_a:=(result->>'interview_id')::uuid;
 perform public.test_assert((result->>'ok')::boolean,'first room booked');
 perform public.test_assert((select room_id=room_a from public.interviews where id=booking_a),'stable room order breaks ties');
 result:=public.book_interview('rooms-b',slot);
 perform public.test_assert((result->>'ok')::boolean,'second simultaneous room booked');
 perform public.test_assert((select room_id=room_b from public.interviews where id=(result->>'interview_id')::uuid),'same time assigned to other room');
 applicant_c:=public.test_app(803); applicant_d:=public.test_app(804);
 update public.solicitudes set status='accepted' where id in (applicant_c,applicant_d);
 insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at) values(applicant_c,'rooms-c',now(),now()+interval '7 days'),(applicant_d,'rooms-d',now(),now()+interval '7 days');
 result:=public.book_interview('rooms-c',slot+interval '15 minutes',15);
 perform public.test_assert((select room_id=room_a from public.interviews where id=(result->>'interview_id')::uuid),'tie remains stable across different time choices');
 result:=public.book_interview('rooms-d',slot+interval '30 minutes',15);
 perform public.test_assert((select room_id=room_b from public.interviews where id=(result->>'interview_id')::uuid),'less booked room takes priority over stable order');
 perform public.test_assert((select calendar_status='queued' from public.interviews where id=booking_a),'calendar invitation separate from reservation');
 perform public.test_assert((select payload->>'meet_url'='https://meet.google.com/aaa-bbbb-ccc' and payload->>'duration_minutes'='15' from private_selection.messages where kind='booking' and payload->>'interview_id'=booking_a::text),'mail snapshot matches room and duration');
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','block','id',room_a,'block_id',block_a,'start_time','10:15','end_time','11:00','request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: reserved block edited';
 exception when raise_exception then if sqlerrm<>'BLOCK_HAS_RESERVATIONS' then raise; end if; end;
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','block','id',room_a,'block_id',block_a,'delete',true,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: reserved block deleted';
 exception when raise_exception then if sqlerrm<>'BLOCK_HAS_RESERVATIONS' then raise; end if; end;
 perform public.selection_admin('room',jsonb_build_object('operation','block','id',room_a,'block_id',block_a,'interviewers',jsonb_build_array('rotating@example.org'),'request_id',gen_random_uuid()));
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','block','id',room_b,'block_id',block_b,'interviewers',jsonb_build_array('rotating@example.org'),'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: interviewer double assigned';
 exception when raise_exception then if sqlerrm<>'INTERVIEWER_CONFLICT' then raise; end if; end;
 perform public.test_assert((select slot_datetime=slot and meet_url='https://meet.google.com/aaa-bbbb-ccc' from public.interviews where id=booking_a),'rotation keeps booking and link');
 perform public.selection_admin('room',jsonb_build_object('operation','block','id',room_a,'start_time','11:30','end_time','12:30','request_id',gen_random_uuid()));
 perform public.selection_admin('config',jsonb_build_object('revision',(select selection_revision from public.seleccion_config where id),'interview_duration_minutes',20));
 perform public.test_assert((select duration_minutes=15 from public.interview_days where id=block_a),'booked block keeps duration');
 perform public.test_assert((select duration_minutes=20 from public.interview_days where room_id=room_a and start_time='11:30'),'unreserved future block gets new duration');
 perform public.test_assert((select count(*)=3 from private_selection.slots('2027-1') x join public.interview_days d on d.id=x.day_id where d.room_id=room_a and d.start_time='11:30'),'breaks and new duration respected');
 job:=public.selection_calendar_worker('claim');
 perform public.test_assert(job->>'kind'='room' and (job->>'start')::timestamptz=((day+time '10:00') at time zone 'America/Mexico_City') and (job->>'end')::timestamptz=((day+time '12:30') at time zone 'America/Mexico_City'),'expanded blocks update room event range');
 perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','ready','meet_url','https://meet.google.com/aaa-bbbb-ccc'));
 job:=public.selection_calendar_worker('claim');
 perform public.test_assert(job->>'kind'='booking','booking Calendar job claimed');
 perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','failed','error','synthetic_google_error'));
 perform public.test_assert((select status='confirmed' from public.interviews where id=(job->>'id')::uuid),'Calendar failure preserves reservation');
 perform public.selection_admin('room',jsonb_build_object('operation','retry_booking','id',(select room_id from public.interviews where id=(job->>'id')::uuid),'interview_id',job->>'id','request_id',gen_random_uuid()));
 result:=public.selection_calendar_worker('claim');
 perform public.test_assert(result->>'event_id'=job->>'event_id','retry reuses deterministic Calendar event');
 perform public.test_assert((job->>'event_id') ~ '^[0-9a-v]+$' and length(job->>'event_id') between 5 and 1024,'booking Calendar IDs use base32hex');
 perform public.selection_calendar_worker('finish',result||jsonb_build_object('outcome','ready'));
 begin
   perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','ready'));
   raise exception 'TEST FAILED: stale lease accepted';
 exception when raise_exception then if sqlerrm<>'STALE_CALENDAR_LEASE' then raise; end if; end;
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',room_a,'primary_email','new-host@example.org','request_id',gen_random_uuid()));
 perform public.test_assert((select not published and host_verified_at is null from private_selection.rooms where id=room_a),'new hosts require new verification');
 perform public.test_assert((select meet_url='https://meet.google.com/aaa-bbbb-ccc' from public.interviews where id=booking_a),'host replacement keeps communicated Meet');
 perform public.test_assert(not has_function_privilege('anon','public.selection_calendar_worker(text,jsonb)','execute'),'anon cannot process Calendar');
 perform public.test_assert(not has_function_privilege('authenticated','public.selection_calendar_worker(text,jsonb)','execute'),'authenticated cannot lease/finish server jobs');
 perform public.test_assert(not has_table_privilege('authenticated','private_selection.rooms','select'),'room internals remain private');
 raise notice 'Room agenda assertions passed';
end $$;
do $$
declare room_id uuid; job jsonb; retry jsonb; day date:=(now() at time zone 'America/Mexico_City')::date+91;
begin
 update private_selection.rooms set calendar_status='ready';
 perform public.selection_admin('room',jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','11:00','room_count',1,'request_id',gen_random_uuid()));
 select id into room_id from private_selection.rooms where date=day;
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',room_id,'primary_email','primary@example.org','backup_email','backup@example.org','request_id',gen_random_uuid()));
 job:=public.selection_calendar_worker('claim');
 perform public.test_assert(job->>'id'=room_id::text and (job->>'space_creation_started')::boolean=false,'new room has no Meet creation intent');
 perform public.selection_calendar_worker('space_start',job);
 begin
   perform public.selection_calendar_worker('space_start',job);
   raise exception 'TEST FAILED: duplicate space creation started';
 exception when raise_exception then if sqlerrm<>'MEET_CREATION_REVIEW_REQUIRED' then raise; end if; end;
 perform public.selection_calendar_worker('space_save',job||jsonb_build_object('google_space_name','spaces/appowned','meet_url','https://meet.google.com/ddd-eeee-fff'));
 perform public.selection_calendar_worker('space_hosts',job||jsonb_build_object('cohost_emails',jsonb_build_array('attempted@example.org')));
 perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','failed','error','synthetic_calendar_network_error'));
 perform public.selection_admin('room',jsonb_build_object('operation','prepare','id',room_id,'request_id',gen_random_uuid()));
 retry:=public.selection_calendar_worker('claim');
 perform public.test_assert(retry->>'google_space_name'='spaces/appowned' and retry->>'meet_url'='https://meet.google.com/ddd-eeee-fff','Calendar failure retains persisted app-owned Meet');
 perform public.test_assert((retry->>'space_creation_started')::boolean,'retry must not repeat spaces.create');
 perform public.test_assert(retry->'managed_cohosts' ? 'attempted@example.org','retry retains attempted roles for revocation after Calendar failure');
 perform public.selection_calendar_worker('finish',retry||jsonb_build_object('outcome','ready','meet_url','https://meet.google.com/ddd-eeee-fff','cohost_emails',jsonb_build_array('primary@example.org','backup@example.org')));
 perform public.test_assert((select google_cohosts=array['primary@example.org','backup@example.org'] from private_selection.rooms where id=room_id),'persist granted Google roles independently of human verification');
end $$;
rollback;
