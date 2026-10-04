begin;
update public.seleccion_config set is_open=true,active_season='2027-1',progressive_enabled=true;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
do $$
declare target_room uuid; other_room uuid; job jsonb; day date:=(now() at time zone 'America/Mexico_City')::date+95;
begin
 update private_selection.rooms set calendar_status='ready';
 insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url) values('2027-1',day-1,'09:00','10:00',15,'https://meet.google.com/old-room');
 perform public.test_assert(not exists(select 1 from private_selection.slots('2027-1') s join public.interview_days d on d.id=s.day_id where d.room_id is null),'retired days cannot offer new booking slots');
 perform public.selection_admin('room',jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','11:00','room_count',2,'request_id',gen_random_uuid()));
 select id into other_room from private_selection.rooms where date=day order by position limit 1;
 select id into target_room from private_selection.rooms where date=day order by position desc limit 1;
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',target_room,'primary_email','new-primary@example.org','backup_email','new-backup@example.org','request_id',gen_random_uuid()));
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',other_room,'primary_email','other-primary@example.org','backup_email','other-backup@example.org','request_id',gen_random_uuid()));
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','publish','id',target_room,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: published without Google readiness';
 exception when raise_exception then if sqlerrm<>'ROOM_NOT_READY' then raise; end if; end;
 perform public.test_assert(public.selection_calendar_worker('claim',jsonb_build_object('bookings_only',true)) is null,'invitation synchronization does not create rooms');
 job:=public.selection_calendar_worker('claim',jsonb_build_object('room_id',target_room));
 perform public.test_assert(job->>'id'=target_room::text,'connecting one room does not claim another room');
 perform public.selection_calendar_worker('finish',job||jsonb_build_object('outcome','ready','meet_url','https://meet.google.com/ggg-hhhh-iii','cohost_emails',jsonb_build_array('new-primary@example.org','new-backup@example.org')));
 perform public.selection_admin('room',jsonb_build_object('operation','publish','id',target_room,'request_id',gen_random_uuid()));
 perform public.test_assert((select published and host_verified_at is null from private_selection.rooms where id=target_room),'publish with technical readiness without a manual checklist');
 perform public.test_assert(exists(select 1 from private_selection.slots('2027-1') s join public.interview_days d on d.id=s.day_id where d.room_id=target_room),'published room offers booking slots without manual verification');
 perform public.test_assert(public.selection_calendar_worker('claim',jsonb_build_object('room_id',target_room)) is null,'targeted retry does not consume unrelated pending jobs');
 perform public.test_assert((select calendar_status='queued' from private_selection.rooms where id=other_room),'other room remains untouched');
 begin
   perform public.selection_admin('day',jsonb_build_object('date',day));
   raise exception 'TEST FAILED: old day writer accepted';
 exception when raise_exception then if sqlerrm<>'LEGACY_AGENDA_RETIRED' then raise; end if; end;
 begin
   perform public.selection_admin('room',jsonb_build_object('operation','verify','id',target_room,'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: obsolete manual verification accepted';
 exception when raise_exception then if sqlerrm<>'UNKNOWN_ROOM_ACTION' then raise; end if; end;
 perform public.test_assert(not has_table_privilege('authenticated','public.interview_days','INSERT'),'old direct day insertion is retired');
 perform public.test_assert(not has_table_privilege('authenticated','public.interview_days','DELETE'),'old direct day deletion is retired');
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',target_room,'primary_email','replacement@example.org','request_id',gen_random_uuid()));
 perform public.test_assert((select not published and calendar_status='queued' and meet_url='https://meet.google.com/ggg-hhhh-iii' from private_selection.rooms where id=target_room),'changing hosts requires Google sync and preserves the Meet');
end $$;
rollback;
