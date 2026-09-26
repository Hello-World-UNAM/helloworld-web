-- Only a current draft can be removed. Published notices remain in the season's history.
grant delete on table public.selection_schedule_updates to authenticated;

create policy selection_schedule_updates_delete_draft
on public.selection_schedule_updates for delete
to authenticated
using (
  not is_published
  and auth.uid() is not null
  and public.is_email_in_directiva(auth.jwt()->>'email')
);
