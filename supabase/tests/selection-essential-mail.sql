-- Essential communications only; disposable harness, fully rolled back.
begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
update public.seleccion_config set applications_closed=false,is_open=true,dispatch_paused=false,reminder_enabled=true;
update public.interview_booking_tokens set revoked_at=now();
update private_selection.messages set status='cancelled' where status in ('queued','uncertain');
insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+35,'08:00','20:00',30,'https://meet.google.com/essential-tests');
do $$
declare a uuid:=public.test_app(301); b uuid:=public.test_app(302); untouched uuid:=public.test_app(303);
  p jsonb; q jsonb; job jsonb; rev integer; token text; slot timestamptz; iv uuid; item uuid; d text; members integer;
begin
  delete from private_selection.messages where solicitud_id in(a,b,untouched);
  perform public.selection_admin('save',jsonb_build_object('id',a,'revision',0,'status','accepted'));
  perform public.selection_admin('save',jsonb_build_object('id',b,'revision',0,'status','rejected'));
  perform public.test_assert(public.selection_worker('claim') is null,'saving initial decisions sends nothing');
  p:=public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',a,'revision',1),jsonb_build_object('id',b,'revision',1))));
  perform public.test_assert(public.selection_worker('claim') is null,'initial preview sends nothing');
  q:=jsonb_build_object('kind','initial','items',p->'items','config_revision',p->'config_revision','duration_hours',168,'request_id',gen_random_uuid());
  perform public.selection_admin('confirm',q);
  perform public.selection_admin('confirm',q);
  perform public.test_assert((select count(*)=2 from private_selection.messages where solicitud_id in(a,b) and kind='initial'),'confirm selected pair exactly once');
  perform public.test_assert(not exists(select 1 from private_selection.messages where solicitud_id=untouched),'unselected applicant gets nothing');
  for rev in 1..2 loop
    job:=public.selection_worker('claim');
    perform public.test_assert(job->>'kind'='initial','only initial decisions are dispatched');
    perform public.test_assert((select email_notification_sent=false from public.solicitudes where id=case when job->'payload'->>'decision'='accepted' then a else b end),'notification flag waits for provider');
    if job->'payload'->>'decision'='accepted' then
      perform public.test_assert(job->'payload'->>'booking_url' is not null and job->'payload'->>'expires_at' is not null,'acceptance contains agenda and expiry');
    else
      perform public.test_assert(not exists(select 1 from public.interview_booking_tokens where solicitud_id=b),'rejection has no booking token');
    end if;
    perform public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"subject":"essential initial"}'::jsonb));
    perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','essential-initial-'||rev));
  end loop;
  perform public.test_assert((select bool_and(email_notification_sent) from public.solicitudes where id in(a,b)),'both initial messages acknowledged');
  perform public.test_assert(public.selection_worker('claim') is null,'no duplicate after initial completion');
  select t.token into token from public.interview_booking_tokens t where solicitud_id=a;
  select slot_datetime into slot from private_selection.slots('2027-1') where meet_url='https://meet.google.com/essential-tests' order by slot_datetime limit 1;
  p:=public.book_interview(token,slot); iv:=(p->>'interview_id')::uuid;
  perform public.test_assert((p->>'ok')::boolean,'accepted applicant can book');
  job:=public.selection_worker('claim');
  perform public.test_assert(job->>'kind'='booking' and job->'payload'->>'meet_url'='https://meet.google.com/essential-tests','booking confirmation captures actual Meet link');
  perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','essential-booking'));
  update public.interview_booking_tokens set expires_at=now()+interval '23 hours' where solicitud_id=a;
  perform public.test_assert(public.selection_worker('claim') is null,'booked applicant gets no scheduling reminders');
  update public.interviews set slot_datetime=now()-interval '1 hour' where id=iv;
  perform public.selection_admin('interview',jsonb_build_object('id',iv,'status','completed'));
  select count(*) into members from public.miembros_activos;
  -- Both final outcomes use a real completed interview; no exception bypass.
  foreach d in array array['accepted','rejected'] loop
    item:=public.test_app(case when d='accepted' then 304 else 305 end);
    delete from private_selection.messages where solicitud_id=item;
    update public.solicitudes set status='accepted',email_notification_sent=true where id=item;
    insert into public.interviews(solicitud_id,slot_datetime,status,meet_url)
    values(item,now()-interval '2 hours','completed','https://meet.google.com/essential-final');
    select selection_revision into rev from public.solicitudes where id=item;
    perform public.selection_admin('save',jsonb_build_object('id',item,'revision',rev,'final_decision',d));
    perform public.test_assert(public.selection_worker('claim') is null,'saving final decision sends nothing');
    select selection_revision into rev from public.solicitudes where id=item;
    p:=public.selection_admin('preview',jsonb_build_object('kind','final','items',jsonb_build_array(jsonb_build_object('id',item,'revision',rev))));
    perform public.test_assert(public.selection_worker('claim') is null,'final preview sends nothing');
    q:=jsonb_build_object('kind','final','items',p->'items','config_revision',p->'config_revision','request_id',gen_random_uuid());
    perform public.selection_admin('confirm',q); perform public.selection_admin('confirm',q);
    job:=public.selection_worker('claim');
    perform public.test_assert(job->>'kind'='final' and job->'payload'->>'decision'=d and job->'payload'->>'interview_outcome'='completed','correct completed-interview final outcome');
    perform public.test_assert((select count(*)=members from public.miembros_activos),'decision and queued email do not grant membership');
    perform public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body','{"subject":"essential final"}'::jsonb));
    perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id','essential-final-'||d));
    perform public.test_assert((select final_email_sent from public.solicitudes where id=item),'final flag acknowledged after provider');
    if d='accepted' then members:=members+1; end if;
    perform public.test_assert((select count(*)=members from public.miembros_activos),'membership granted only for acknowledged final acceptance');
    perform public.test_assert(public.selection_worker('claim') is null,'final confirmation never duplicates');
  end loop;
  perform public.test_assert(not exists(select 1 from private_selection.messages where solicitud_id in(a,b,untouched,item) and kind in('deadline','cancellation','rectification')),'essential flow creates no optional notices');
  raise notice 'Essential initial/final/booking mail tests passed';
end $$;
rollback;
