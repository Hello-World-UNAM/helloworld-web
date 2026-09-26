begin;

insert into public.directiva(email) values ('schedule-editor@example.org')
on conflict (email) do nothing;
insert into public.selection_schedules
  (season, first_stage_date, interviews_start_date, interviews_end_date, final_results_date, is_published)
values
  ('2026-2', '2026-04-01', '2026-04-08', '2026-04-22', '2026-04-29', true),
  ('2028-1', '2027-10-01', '2027-10-08', '2027-10-22', '2027-10-29', false);
insert into public.selection_schedule_updates(season, body, is_published)
values
  ('2026-2', 'Aviso anterior', true),
  ('2027-1', 'Aviso actual', true),
  ('2027-1', 'Borrador actual', false),
  ('2028-1', 'Aviso de calendario oculto', true);
insert into public.selection_schedule_updates(season, body, is_published, published_at)
values ('2027-1', 'Aviso oculto anteriormente publicado', false, '2026-09-26T12:00:00Z');

set local role anon;
do $$ begin
  if (select count(*) from public.selection_schedules) <> 2 then
    raise exception 'Visitor sees unpublished schedule';
  end if;
  if (select count(*) from public.selection_schedule_updates) <> 2 then
    raise exception 'Visitor sees drafts or updates of an unpublished schedule';
  end if;
  if (select count(*) from public.selection_schedule_updates where season = '2027-1') <> 1 then
    raise exception 'Current season includes a draft or a previous notice';
  end if;
  begin
    update public.selection_schedules set is_published = false where season = '2027-1';
    raise exception 'Visitor changed schedule';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.selection_schedule_updates where body = 'Borrador actual';
    raise exception 'Visitor deleted draft';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"email":"outsider@example.org"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.selection_schedules) <> 2 then
    raise exception 'Unauthorized account sees unpublished schedule';
  end if;
  if (select count(*) from public.selection_schedule_updates) <> 2 then
    raise exception 'Unauthorized account sees unpublished notice';
  end if;
  update public.selection_schedules set is_published = false where season = '2027-1';
  if found then
    raise exception 'Unauthorized account edited schedule';
  end if;
  delete from public.selection_schedule_updates where body = 'Borrador actual';
  if found then raise exception 'Unauthorized account deleted draft'; end if;
  begin
    insert into public.selection_schedule_updates(season,body) values ('2027-1','Forbidden');
    raise exception 'Unauthorized account created notice';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims', '{"email":"schedule-editor@example.org"}', true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.selection_schedules) <> 3 then
    raise exception 'Authorized editor cannot see draft';
  end if;
  if (select count(*) from public.selection_schedule_updates) <> 5 then
    raise exception 'Authorized editor cannot see notices';
  end if;
end $$;
update public.selection_schedules set final_results_date = '2026-10-30' where season = '2027-1';
insert into public.selection_schedule_updates(season,body,is_published)
values ('2027-1','Se enviaron correos',true);
do $$ begin
  delete from public.selection_schedule_updates where body = 'Aviso actual';
  if found then raise exception 'Editor deleted a published notice'; end if;
  delete from public.selection_schedule_updates where body = 'Borrador actual';
  if not found then raise exception 'Editor could not delete a draft'; end if;
  delete from public.selection_schedule_updates where body = 'Aviso oculto anteriormente publicado';
  if not found then raise exception 'Editor could not delete a hidden notice'; end if;
end $$;
reset role;

do $$ begin
  if (select applications_closed from public.seleccion_config where id) then
    raise exception 'Publishing changed application state';
  end if;
  if (select count(*) from private_selection.messages) <> 0 then
    raise exception 'Publishing queued mail';
  end if;
end $$;
rollback;
