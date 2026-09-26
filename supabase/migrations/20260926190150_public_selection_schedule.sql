-- Public dates are editorial targets. They never drive selection workflow actions.
create table public.selection_schedules (
  season text primary key check (season ~ '^[0-9]{4}-[12]$'),
  first_stage_date date not null,
  interviews_start_date date not null,
  interviews_end_date date not null,
  final_results_date date not null,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint selection_schedule_date_order check (
    first_stage_date <= interviews_start_date
    and interviews_start_date <= interviews_end_date
    and interviews_end_date <= final_results_date
  )
);

create table public.selection_schedule_updates (
  id uuid primary key default gen_random_uuid(),
  season text not null references public.selection_schedules(season),
  body text not null check (length(btrim(body)) between 1 and 500),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint selection_update_publication_date check (not is_published or published_at is not null)
);

create index selection_schedule_updates_season_publication_idx
  on public.selection_schedule_updates (season, published_at desc);

-- A publication timestamp is assigned by the database on first publication.
create function public.stamp_selection_update_publication() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := now();
  end if;
  return new;
end $$;

create trigger stamp_selection_update_publication
before insert or update on public.selection_schedule_updates
for each row execute function public.stamp_selection_update_publication();

revoke all on function public.stamp_selection_update_publication() from public, anon, authenticated;
alter table public.selection_schedules enable row level security;
alter table public.selection_schedule_updates enable row level security;
revoke all on table public.selection_schedules, public.selection_schedule_updates from anon, authenticated;
grant select on table public.selection_schedules, public.selection_schedule_updates to anon;
grant select, insert, update on table public.selection_schedules, public.selection_schedule_updates to authenticated;

create policy selection_schedules_public_read on public.selection_schedules for select
to anon, authenticated using (is_published);
create policy selection_schedules_editor_read on public.selection_schedules for select
to authenticated using (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create policy selection_schedules_insert on public.selection_schedules for insert
to authenticated with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create policy selection_schedules_update on public.selection_schedules for update
to authenticated using (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'))
with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));

create policy selection_schedule_updates_public_read on public.selection_schedule_updates for select
to anon, authenticated using (is_published and exists (
  select 1 from public.selection_schedules s where s.season = selection_schedule_updates.season and s.is_published
));
create policy selection_schedule_updates_editor_read on public.selection_schedule_updates for select
to authenticated using (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create policy selection_schedule_updates_insert on public.selection_schedule_updates for insert
to authenticated with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create policy selection_schedule_updates_update on public.selection_schedule_updates for update
to authenticated using (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'))
with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));

insert into public.selection_schedules
  (season, first_stage_date, interviews_start_date, interviews_end_date, final_results_date, is_published)
values ('2027-1', '2026-10-01', '2026-10-08', '2026-10-22', '2026-10-29', true)
on conflict (season) do nothing;
