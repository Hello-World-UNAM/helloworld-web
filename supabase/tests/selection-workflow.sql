-- Synthetic fixtures only. All effects stay in the isolated test database.
insert into public.directiva(email) values('admin@example.org');
insert into public.seleccion_config(id,is_open,active_season,progressive_enabled,dispatch_paused,whatsapp_url)
values(true,true,'2027-1',true,false,'https://chat.whatsapp.com/test-only');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);

create function public.test_assert(v boolean,msg text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'TEST FAILED: %',msg; end if; end $$;
create function public.test_app(n integer) returns uuid language plpgsql as $$
declare x uuid;
begin
 insert into public.solicitudes(season,nombre,correo,numero_cuenta,carrera,semestre,proyecto_descripcion,motivacion,experiencia_liderazgo,manejo_conflicto,fortalezas_areas,curiosidad,horas_disponibles)
 values('2027-1','Synthetic '||n,'test'||n||'@example.org',lpad(n::text,9,'0'),'Testing',1,'test','test','test','test','test','test','test') returning id into x;
 return x;
end $$;

do $$
declare a uuid:=public.test_app(1); b uuid:=public.test_app(2); rev integer; cfg integer; p jsonb; q jsonb; job jsonb; request_id uuid:=gen_random_uuid(); token_a text; token_b text; slot_a timestamptz; slot_b timestamptz; booked uuid; old_count integer;
begin
 perform public.test_assert(public.selection_admin('state')->'config'->>'active_season'='2027-1','admin state readable');
 perform public.test_assert((select count(*)=2 from private_selection.messages where kind='receipt'),'new receipts enqueued once');
 perform public.selection_admin('save',jsonb_build_object('id',a,'revision',0,'status','accepted'));
 perform public.selection_admin('save',jsonb_build_object('id',b,'revision',0,'status','accepted'));
 perform public.test_assert(not exists(select 1 from private_selection.messages where kind='initial'),'saving does not send');
 begin
   perform public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',a,'revision',1))));
   raise exception 'TEST FAILED: capacity allowed';
 exception when raise_exception then if sqlerrm<>'INSUFFICIENT_CAPACITY' then raise; end if; end;
 perform public.selection_admin('day',jsonb_build_object('date',((now() at time zone 'America/Mexico_City')::date+10)::text,'start_time','10:00','end_time','11:00','duration_minutes',30,'meet_url','https://meet.google.com/test-only'));
 p:=public.selection_admin('preview',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',a,'revision',1),jsonb_build_object('id',b,'revision',1))));
 q:=jsonb_build_object('kind','initial','items',p->'items','config_revision',p->'config_revision','duration_hours',168,'request_id',request_id);
 p:=public.selection_admin('confirm',q);
 perform public.test_assert((public.selection_admin('confirm',q))->>'batch_id'=request_id::text,'idempotent confirmation');
 perform public.test_assert((select count(*)=2 from private_selection.messages where kind='initial'),'one job per selected applicant');
 perform public.test_assert(private_selection.capacity('2027-1')=0,'outstanding invitations reserve capacity');
 for rev in 1..4 loop
   job:=public.selection_worker('claim');
   perform public.test_assert(job is not null,'claim yields job #'||rev||' states='||(select jsonb_agg(jsonb_build_object('kind',kind,'status',status,'error',last_error))::text from private_selection.messages));
   perform public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body',jsonb_build_object('subject','test')));
   p:=public.selection_worker('prepared',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','request_body',jsonb_build_object('subject','different')));
   perform public.test_assert(p->'request_body'->>'subject'='test','retry body is immutable');
   perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id',gen_random_uuid()));
 end loop;
 select token into token_a from public.interview_booking_tokens where solicitud_id=a;
 select token into token_b from public.interview_booking_tokens where solicitud_id=b;
 select slot_datetime into slot_a from private_selection.slots('2027-1') order by slot_datetime limit 1;
 select slot_datetime into slot_b from private_selection.slots('2027-1') order by slot_datetime desc limit 1;
 p:=public.book_interview(token_a,slot_a); booked:=(p->>'interview_id')::uuid;
 perform public.test_assert((p->>'ok')::boolean,'first booking succeeds');
 perform public.test_assert((public.book_interview(token_b,slot_b)->>'ok')::boolean,'second booking succeeds');
 select reschedule_count into old_count from public.interview_booking_tokens where solicitud_id=a;
 perform public.test_assert(public.book_interview(token_a,slot_b)->>'error'='SLOT_TAKEN','occupied replacement fails');
 perform public.test_assert(exists(select 1 from public.interviews where id=booked and status='confirmed'),'failed replacement retains original');
 perform public.test_assert((select reschedule_count=old_count from public.interview_booking_tokens where solicitud_id=a),'failed replacement retains counter');
 update public.interview_booking_tokens set expires_at=now()-interval '1 second' where solicitud_id=a;
 perform public.test_assert(public.get_booking_state(token_a)->>'booking_blocked_reason'='INVITATION_EXPIRED','expired invitation blocked');
 perform public.test_assert(public.get_booking_state(token_a)->'current_interview'->>'id'=booked::text,'expiry retains reservation');
 begin
   perform public.selection_admin('interview',jsonb_build_object('id',booked,'status','completed'));
   raise exception 'TEST FAILED: future interview completed';
 exception when raise_exception then if sqlerrm<>'INTERVIEW_IN_FUTURE' then raise; end if; end;
 select selection_revision into rev from public.solicitudes where id=a;
 begin
   perform public.selection_admin('save',jsonb_build_object('id',a,'revision',rev,'status','rejected'));
   raise exception 'TEST FAILED: notified decision edited';
 exception when raise_exception then if sqlerrm<>'USE_RECTIFICATION' then raise; end if; end;
 perform public.selection_admin('rectify',jsonb_build_object('id',a,'revision',rev,'status','rejected','reason','test correction','request_id',gen_random_uuid()));
 perform public.test_assert(exists(select 1 from public.interviews where id=booked and status='cancelled'),'rectification cancels booking');
 perform public.test_assert(public.get_booking_state(token_a)->>'error'='INVITATION_REVOKED','rectification revokes token');
 -- Provider events can arrive before the finish call and repeat/out of order.
 job:=public.selection_worker('claim');
 request_id:=gen_random_uuid();
 q:=jsonb_build_object('event_id','delivery-test','event',jsonb_build_object('type','email.delivered','created_at',now(),'data',jsonb_build_object('email_id',request_id)));
 perform public.selection_worker('webhook',q);
 perform public.test_assert((public.selection_worker('webhook',q)->>'duplicate')::boolean,'duplicate webhook ignored');
 perform public.selection_worker('finish',jsonb_build_object('id',job->>'id','lease_token',job->>'lease_token','outcome','accepted','provider_id',request_id));
 perform public.test_assert((select delivery_status='delivered' from private_selection.messages where id=(job->>'id')::uuid),'early delivery webhook reconciled');
 perform public.selection_worker('webhook',jsonb_build_object('event_id','late-sent','event',jsonb_build_object('type','email.sent','created_at',now()-interval '1 minute','data',jsonb_build_object('email_id',request_id))));
 perform public.test_assert((select delivery_status='delivered' from private_selection.messages where id=(job->>'id')::uuid),'late sent does not regress delivery');
 update public.seleccion_config set applications_closed=true;
 begin perform public.test_app(3); raise exception 'TEST FAILED: closed form accepted';
 exception when raise_exception then if sqlerrm<>'APPLICATIONS_CLOSED' then raise; end if; end;
 perform public.test_assert(not has_function_privilege('anon','public.selection_admin(text,jsonb)','execute'),'anon cannot administer');
 perform public.test_assert(not has_function_privilege('authenticated','public.selection_worker(text,jsonb)','execute'),'user cannot send as worker');
 perform public.test_assert(not has_schema_privilege('anon','private_selection','usage'),'private data not exposed');
 raise notice 'All transactional workflow assertions passed';
end $$;
