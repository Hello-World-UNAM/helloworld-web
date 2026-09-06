begin;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
do $$
declare a uuid:=public.test_app(70); rev integer; p jsonb; n integer;
begin
 -- Dedicated synthetic season isolates archive assertions from other scenarios.
 update public.seleccion_config set active_season='2031-1',applications_closed=false;
 update public.solicitudes set season='2031-1',status='accepted',final_decision='accepted',
   decision_exception_reason='Synthetic external interview',email_notification_sent=true where id=a;
 update private_selection.messages set status='cancelled' where solicitud_id=a;
 insert into private_selection.messages(solicitud_id,kind,recipient,payload,idempotency_key,status,delivery_status)
 values(a,'rectification','test70@example.org','{"stage":"initial","decision":"accepted"}','lifecycle-initial','accepted','delivered');
 select selection_revision into rev from public.solicitudes where id=a;
 p:=public.selection_admin('preview',jsonb_build_object('kind','final','items',jsonb_build_array(jsonb_build_object('id',a,'revision',rev))));
 perform public.test_assert(jsonb_array_length(p->'items')=1,'initial rectification does not block final notice');
 select selection_revision into rev from public.seleccion_config where id;
 begin perform public.selection_admin('config',jsonb_build_object('revision',rev,'archive',true)); raise exception 'TEST FAILED: initial invitation satisfied final notice';
 exception when raise_exception then if sqlerrm<>'UNRESOLVED_CANDIDATES_OR_MESSAGES' then raise; end if; end;
 begin perform public.selection_admin('config',jsonb_build_object('revision',rev,'open_season','2032-1')); raise exception 'TEST FAILED: open before archive';
 exception when raise_exception then if sqlerrm<>'ARCHIVE_CURRENT_SEASON_FIRST' then raise; end if; end;
 select selection_revision into rev from public.solicitudes where id=a;
 perform public.selection_admin('manual',jsonb_build_object('id',a,'revision',rev,'reason','Synthetic external communication','communicated_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 select selection_revision into rev from public.seleccion_config where id;
 perform public.selection_admin('config',jsonb_build_object('revision',rev,'archive',true));
 select selection_revision into rev from public.seleccion_config where id;
 begin perform public.selection_admin('config',jsonb_build_object('revision',rev,'open_season','2027-1')); raise exception 'TEST FAILED: reused historic season';
 exception when raise_exception then if sqlerrm<>'SEASON_ALREADY_EXISTS' then raise; end if; end;
 perform public.selection_admin('config',jsonb_build_object('revision',rev,'open_season','2032-1'));
 perform public.test_assert((select is_open and not applications_closed and active_season='2032-1' from public.seleccion_config where id),'new season opens independently');
 select selection_revision into rev from public.seleccion_config where id;
 perform public.selection_admin('config',jsonb_build_object('revision',rev,'whatsapp_url',''));
 perform public.test_assert((select whatsapp_url='' from public.seleccion_config where id),'empty group URL may be saved before decisions');
 raise notice 'Season lifecycle and phase-specific communication tests passed';
end $$;
rollback;
