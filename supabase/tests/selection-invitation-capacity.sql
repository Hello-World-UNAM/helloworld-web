begin;
update public.seleccion_config set active_season='2027-1',applications_closed=false,is_open=true,progressive_enabled=true,dispatch_paused=false,interview_duration_minutes=15;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
do $$
declare a uuid:=public.test_app(201); b uuid:=public.test_app(202); c uuid:=public.test_app(203); rejected uuid:=public.test_app(204);
 room uuid; p jsonb; batch jsonb; stats jsonb; day date:=(now() at time zone 'America/Mexico_City')::date+150;
begin
 update public.seleccion_config set active_season='2097-2';
 update public.solicitudes set season='2097-2',status=case when id=rejected then 'rejected' else 'accepted' end where id in(a,b,c,rejected);
 perform public.selection_admin('room',jsonb_build_object('operation','create','date',day,'start_time','10:00','end_time','10:30','room_count',1,'request_id',gen_random_uuid()));
 select id into room from private_selection.rooms where season='2097-2';
 stats:=public.selection_admin('state')->'capacity_summary';
 perform public.test_assert((stats->>'missing_slots')::integer=3,'draft rooms do not cover planning demand');
 begin
   perform public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',a,'revision',0))));
   raise exception 'TEST FAILED: draft room counted as capacity';
 exception when raise_exception then if sqlerrm<>'INSUFFICIENT_CAPACITY' then raise; end if; end;
 perform public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',rejected,'revision',0))));
 perform public.selection_admin('room',jsonb_build_object('operation','edit','id',room,'primary_email','capacity-primary@example.org','backup_email','capacity-backup@example.org','request_id',gen_random_uuid()));
 update private_selection.rooms set calendar_status='ready',meet_url='https://meet.google.com/aaa-bbbb-ccc',published=true where id=room;
 stats:=public.selection_admin('state')->'capacity_summary';
 perform public.test_assert((stats->>'available_slots')::integer=2 and (stats->>'missing_slots')::integer=1,'two seats for three pending accepted applicants');
 -- The seven-day booking window permits choosing this later interview date now.
 p:=public.selection_admin('preview',jsonb_build_object('kind','initial','duration_hours',168,'items',jsonb_build_array(jsonb_build_object('id',a,'revision',0),jsonb_build_object('id',b,'revision',0))));
 batch:=jsonb_build_object('kind','initial','items',p->'items','config_revision',p->'config_revision','duration_hours',168,'request_id',gen_random_uuid());
 perform public.selection_admin('confirm',batch);
 perform public.selection_admin('confirm',batch);
 stats:=public.selection_admin('state')->'capacity_summary';
 perform public.test_assert((stats->>'committed_applicants')::integer=2 and (stats->>'available_for_invitations')::integer=0,'queued invitations reserve capacity once');
 begin
   perform public.selection_admin('confirm',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',c,'revision',0)),'config_revision',(select selection_revision from public.seleccion_config where id),'request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: server confirmation oversubscribed';
 exception when raise_exception then if sqlerrm<>'INSUFFICIENT_CAPACITY' then raise; end if; end;
 perform public.test_assert(not exists(select 1 from private_selection.messages where solicitud_id=c and kind='initial'),'failed confirmation never enqueues mail');
 update public.interview_booking_tokens set invited_at=now()-interval '8 days',expires_at=now()-interval '1 day' where solicitud_id=a;
 stats:=public.selection_admin('state')->'capacity_summary';
 perform public.test_assert((stats->>'committed_applicants')::integer=1 and private_selection.capacity('2097-2')=1,'expired invitation releases commitment');
 update public.interview_booking_tokens set revoked_at=now() where solicitud_id=b;
 perform public.test_assert(private_selection.capacity('2097-2')=2,'revoked invitation releases commitment');
 update public.solicitudes set final_decision='rejected' where id=a;
 perform public.selection_admin('preview',jsonb_build_object('kind','final','items',jsonb_build_array(jsonb_build_object('id',a,'revision',1))));
 -- A slot lost after a valid preview must still block confirmation.
 p:=public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',c,'revision',0))));
 update private_selection.rooms set published=false where id=room;
 begin
   perform public.selection_admin('confirm',jsonb_build_object('kind','initial','items',p->'items','config_revision',p->'config_revision','request_id',gen_random_uuid()));
   raise exception 'TEST FAILED: stale capacity accepted at confirmation';
 exception when raise_exception then if sqlerrm<>'INSUFFICIENT_CAPACITY' then raise; end if; end;
 perform public.selection_admin('preview',jsonb_build_object('kind','final','items',jsonb_build_array(jsonb_build_object('id',a,'revision',1))));
 perform public.test_assert(not has_function_privilege('authenticated','private_selection.capacity_summary(text)','execute'),'capacity helper is private');
end $$;
rollback;
