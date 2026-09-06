-- POST-CUTOVER CLEANUP. Run only after at least one full production cycle
-- has been observed, all legacy messages have been reconciled, and the
-- progressive workflow is paused. This removes exactly the two old HTTP
-- mail triggers; it does not drop the Supabase HTTP extension or any member,
-- points, application, interview, or private-selection data.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(73400001);
lock table public.seleccion_config, public.solicitudes, public.interviews
  in share row exclusive mode;

do $$
declare
  v_config public.seleccion_config;
begin
  select * into strict v_config from public.seleccion_config where id=true;
  if not v_config.progressive_enabled then raise exception 'PROGRESSIVE_NOT_ACTIVE'; end if;
  if not v_config.dispatch_paused then raise exception 'PAUSE_DISPATCH_FIRST'; end if;

  drop trigger if exists email_confirmacion_solicitud on public.solicitudes;
  drop trigger if exists email_confirmacion_entrevista on public.interviews;
  perform private_selection.audit(null,'decommission_legacy_triggers',
    jsonb_build_object('dispatch_paused',true));
end;
$$;
commit;

-- Metadata only; both values should be true.
select not exists(
    select 1 from pg_trigger
    where tgrelid='public.solicitudes'::regclass
      and tgname='email_confirmacion_solicitud'
      and not tgisinternal
  ) as solicitud_trigger_removed,
  not exists(
    select 1 from pg_trigger
    where tgrelid='public.interviews'::regclass
      and tgname='email_confirmacion_entrevista'
      and not tgisinternal
  ) as interview_trigger_removed;
