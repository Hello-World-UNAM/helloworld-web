-- A final acceptance becomes a member only after Resend accepts that person's
-- final message. Keep this separate from the admin click, which only enqueues.
create table private_selection.member_provisioning (
  solicitud_id uuid primary key references public.solicitudes(id),
  message_id uuid not null references private_selection.messages(id),
  member_id uuid references public.miembros_activos(id) on delete set null,
  status text not null check (status in ('created', 'existing', 'conflict', 'error', 'review_required')),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index selection_member_provisioning_status
  on private_selection.member_provisioning(status) where status in ('conflict', 'error', 'review_required');
alter table private_selection.member_provisioning enable row level security;
revoke all on private_selection.member_provisioning from public, anon, authenticated, service_role;

-- The existing members table is also the /mi-cuenta email allowlist. Refuse
-- ambiguous addresses before enforcing uniqueness; this migration never edits
-- existing members or their points.
do $$
begin
  if exists (
    select 1 from public.miembros_activos
    group by lower(btrim(correo)) having count(*) > 1
  ) then
    raise exception 'MEMBER_EMAIL_DUPLICATES_REQUIRE_REVIEW';
  end if;
end $$;
create unique index if not exists miembros_activos_correo_normalized_unique
  on public.miembros_activos (lower(btrim(correo)));

alter table public.miembros_activos enable row level security;
revoke insert on public.miembros_activos from public, anon;
grant insert on public.miembros_activos to authenticated;
create policy selection_member_admin_insert on public.miembros_activos
  for insert to authenticated
  with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create policy selection_member_admin_insert_guard on public.miembros_activos
  as restrictive for insert to authenticated
  with check (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));

create function private_selection.on_final_message_accepted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.solicitudes;
  v_member_id uuid;
  v_email text;
  v_account text;
  v_status text;
  v_detail text;
begin
  if old.status = 'accepted' or new.status <> 'accepted' then return new; end if;
  if new.provider_id is null or new.first_attempt_at is null then return new; end if;

  if new.kind = 'rectification' and new.payload->>'stage' = 'final'
     and new.payload->>'decision' = 'rejected' then
    update private_selection.member_provisioning
      set status = 'review_required', detail = 'Aceptación final rectificada: revisar acceso y puntos', updated_at = now()
      where solicitud_id = new.solicitud_id and status in ('created', 'existing');
    return new;
  end if;

  if new.kind <> 'final' or new.payload->>'decision' <> 'accepted' then return new; end if;
  select * into s from public.solicitudes where id = new.solicitud_id;
  if not found or s.status <> 'accepted' or s.final_decision <> 'accepted' then return new; end if;
  if exists (select 1 from private_selection.member_provisioning where solicitud_id = s.id) then return new; end if;

  v_email := lower(btrim(s.correo));
  v_account := btrim(s.numero_cuenta);
  if v_email <> lower(btrim(new.recipient)) then
    v_status := 'conflict'; v_detail := 'El correo de la solicitud cambió después de encolar el mensaje';
  elsif v_email = '' or v_account !~ '^[0-9]{9}$' then
    v_status := 'conflict'; v_detail := 'Correo o número de cuenta inválido';
  else
    -- Serialize with other selection sends. The unique email index also guards
    -- concurrent/manual inserts made outside this workflow.
    select id into v_member_id from public.miembros_activos
      where lower(btrim(correo)) = v_email;
    if found then
      if exists (
        select 1 from public.miembros_activos
        where id = v_member_id and numero_cuenta is not null
          and btrim(numero_cuenta) <> '' and btrim(numero_cuenta) <> v_account
      ) then
        v_status := 'conflict'; v_detail := 'El correo ya pertenece a un miembro con otro número de cuenta';
        v_member_id := null;
      elsif exists (
        select 1 from public.miembros_activos
        where id <> v_member_id and numero_cuenta = v_account
      ) then
        v_status := 'conflict'; v_detail := 'El número de cuenta ya pertenece a otro correo';
        v_member_id := null;
      else
        update public.miembros_activos set numero_cuenta = v_account
          where id = v_member_id and (numero_cuenta is null or btrim(numero_cuenta) = '');
        v_status := 'existing'; v_detail := 'Miembro preexistente; se conservaron sus datos y puntos';
      end if;
    elsif exists (
      select 1 from public.miembros_activos
      where numero_cuenta = v_account and lower(btrim(correo)) <> v_email
    ) then
      v_status := 'conflict'; v_detail := 'El número de cuenta ya pertenece a otro correo';
    else
      insert into public.miembros_activos(nombre, correo, numero_cuenta, semestre, rol)
      values (s.nombre, v_email, v_account, s.semestre, 'member')
      returning id into v_member_id;
      v_status := 'created'; v_detail := null;
    end if;
  end if;

  insert into private_selection.member_provisioning
    (solicitud_id, message_id, member_id, status, detail)
  values (s.id, new.id, v_member_id, v_status, v_detail)
  on conflict (solicitud_id) do nothing;
  return new;
exception when others then
  -- Resend already accepted the email. Keep its acknowledgement and make the
  -- provisioning failure visible instead of risking another send.
  insert into private_selection.member_provisioning
    (solicitud_id, message_id, status, detail)
  values (new.solicitud_id, new.id, 'error', left(sqlerrm, 300))
  on conflict (solicitud_id) do nothing;
  return new;
end $$;
revoke execute on function private_selection.on_final_message_accepted() from public, anon, authenticated, service_role;
create trigger selection_final_member_provisioning
  after update of status on private_selection.messages
  for each row execute function private_selection.on_final_message_accepted();

-- A reviewer can resolve a collision using the existing Miembros editor. Once
-- the corrected member matches the application, clear the pending alert.
create function private_selection.reconcile_member_edit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private_selection.member_provisioning p
    set member_id = new.id, status = 'existing', detail = 'Datos corregidos desde Miembros', updated_at = now()
  from public.solicitudes s
  where p.solicitud_id = s.id
    and p.status in ('conflict', 'error')
    and s.status = 'accepted' and s.final_decision = 'accepted'
    and s.final_email_sent
    and lower(btrim(s.correo)) = lower(btrim(new.correo))
    and btrim(s.numero_cuenta) = btrim(new.numero_cuenta);
  return new;
end $$;
revoke execute on function private_selection.reconcile_member_edit() from public, anon, authenticated, service_role;
create trigger selection_reconcile_member_edit
  after insert or update of correo, numero_cuenta on public.miembros_activos
  for each row execute function private_selection.reconcile_member_edit();

-- Admin-only status query. The private schema is not exposed by PostgREST.
grant usage on schema private_selection to authenticated;
grant select on private_selection.member_provisioning to authenticated;
create policy selection_member_provisioning_admin_read on private_selection.member_provisioning
  for select to authenticated
  using (auth.uid() is not null and public.is_email_in_directiva(auth.jwt()->>'email'));
create function public.selection_member_status(p_season text)
returns table (solicitud_id uuid, member_id uuid, status text, detail text)
language sql stable security invoker set search_path = '' as $$
  select p.solicitud_id, p.member_id, p.status, p.detail
  from private_selection.member_provisioning p
  join public.solicitudes s on s.id = p.solicitud_id
  where s.season = p_season
    and auth.uid() is not null
    and public.is_email_in_directiva(auth.jwt()->>'email');
$$;
revoke execute on function public.selection_member_status(text) from public, anon;
grant execute on function public.selection_member_status(text) to authenticated;
