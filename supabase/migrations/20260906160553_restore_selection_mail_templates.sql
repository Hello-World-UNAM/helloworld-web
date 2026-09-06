begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(73400001);

-- Capture every dynamic value needed by the restored historical templates at
-- enqueue time. This keeps rendering deterministic and preserves the existing
-- immutable request_body/idempotency contract once a send has been prepared.
create or replace function private_selection.enqueue(
  p_id uuid,
  p_kind text,
  p_payload jsonb,
  p_key text,
  p_batch uuid default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_context jsonb := '{}'::jsonb;
begin
  if p_kind = 'booking' then
    v_context := v_context || coalesce((
      select jsonb_build_object('duration_minutes', i.duration_minutes)
      from public.interviews i
      where i.id::text = p_payload->>'interview_id'
    ), '{}'::jsonb);
  end if;

  if p_kind = 'final' then
    v_context := v_context || jsonb_build_object(
      'interview_outcome',
      case
        when exists (
          select 1
          from public.interviews i
          where i.solicitud_id = p_id
            and i.status = 'completed'
        ) then 'completed'
        when exists (
          select 1
          from public.interviews i
          where i.solicitud_id = p_id
            and i.status = 'no_show'
        ) then 'no_show'
        else 'none'
      end
    );
  end if;

  insert into private_selection.messages (
    solicitud_id,
    kind,
    recipient,
    payload,
    idempotency_key,
    batch_id
  )
  select
    s.id,
    p_kind,
    s.correo,
    jsonb_build_object('nombre', s.nombre, 'season', s.season)
      || v_context
      || coalesce(p_payload, '{}'::jsonb),
    p_key,
    p_batch
  from public.solicitudes s
  where s.id = p_id
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function private_selection.enqueue(uuid, text, jsonb, text, uuid)
from public, anon, authenticated, service_role;

-- Backfill only jobs whose provider request has not been frozen. Prepared
-- request bodies must remain byte-for-byte immutable for safe Resend retries.
update private_selection.messages m
set payload = m.payload || jsonb_build_object('duration_minutes', i.duration_minutes)
from public.interviews i
where m.kind = 'booking'
  and m.status in ('queued', 'failed')
  and m.request_body is null
  and not (m.payload ? 'duration_minutes')
  and m.payload->>'interview_id' = i.id::text;

update private_selection.messages m
set payload = m.payload || jsonb_build_object(
  'interview_outcome',
  case
    when exists (
      select 1
      from public.interviews i
      where i.solicitud_id = m.solicitud_id
        and i.status = 'completed'
    ) then 'completed'
    when exists (
      select 1
      from public.interviews i
      where i.solicitud_id = m.solicitud_id
        and i.status = 'no_show'
    ) then 'no_show'
    else 'none'
  end
)
where m.kind = 'final'
  and m.status in ('queued', 'failed')
  and m.request_body is null
  and not (m.payload ? 'interview_outcome');

commit;
