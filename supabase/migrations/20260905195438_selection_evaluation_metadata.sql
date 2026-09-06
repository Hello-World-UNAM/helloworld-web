-- Keep the evaluation metadata truthful when the evaluation is saved through
-- the progressive admin RPC. Entrevistas records the interview outcome first;
-- Detalle then saves the score fields in a separate transaction, so relying
-- only on `complete_interview` leaves evaluated_at empty.

create or replace function public.mark_selection_evaluation_metadata()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if new.eval_blandas_score is distinct from old.eval_blandas_score
    or new.eval_blandas_notes is distinct from old.eval_blandas_notes
    or new.eval_motivacion_score is distinct from old.eval_motivacion_score
    or new.eval_motivacion_notes is distinct from old.eval_motivacion_notes
    or new.eval_proyectos_score is distinct from old.eval_proyectos_score
    or new.eval_proyectos_notes is distinct from old.eval_proyectos_notes
    or new.eval_aporte_score is distinct from old.eval_aporte_score
    or new.eval_aporte_notes is distinct from old.eval_aporte_notes
    or new.eval_tecnica_score is distinct from old.eval_tecnica_score
    or new.eval_tecnica_notes is distinct from old.eval_tecnica_notes
    or new.eval_overall_notes is distinct from old.eval_overall_notes
  then
    -- Cada edición de una evaluación debe representar la última revisión,
    -- no conservar silenciosamente la primera fecha/autor.
    -- `now()` is transaction-stable; use wall-clock time so two saves in the
    -- same transaction/test request still have a truthful ordering.
    new.evaluated_at := clock_timestamp();
    new.evaluated_by := coalesce((select auth.jwt() ->> 'email'), new.evaluated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists selection_evaluation_metadata on public.solicitudes;
create trigger selection_evaluation_metadata
before update on public.solicitudes
for each row execute function public.mark_selection_evaluation_metadata();

revoke all on function public.mark_selection_evaluation_metadata() from public, anon, authenticated;
