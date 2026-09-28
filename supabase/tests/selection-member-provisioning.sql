begin;
do $$
declare
  accepted_id uuid := public.test_app(801);
  rejected_id uuid := public.test_app(802);
  pending_id uuid := public.test_app(803);
  existing_id uuid := public.test_app(804);
  conflict_id uuid := public.test_app(805);
  changed_id uuid := public.test_app(806);
  unverified_id uuid := public.test_app(807);
  missing_account_id uuid := public.test_app(808);
  v_created_member_id uuid;
  v_existing_member_id uuid;
  v_message_id uuid;
  v_lease uuid;
  v_initial_members integer;
begin
  select count(*) into v_initial_members from public.miembros_activos;
  update public.solicitudes set status = 'accepted', final_decision = 'accepted',
    email_notification_sent = true, decision_exception_reason = 'Entrevista externa sintética'
    where id in (accepted_id, pending_id, existing_id, conflict_id, changed_id, unverified_id, missing_account_id);
  update public.solicitudes set status = 'accepted', final_decision = 'rejected',
    email_notification_sent = true where id = rejected_id;

  perform private_selection.enqueue(accepted_id, 'final', '{"decision":"accepted"}', 'member-test-accepted');
  perform private_selection.enqueue(rejected_id, 'final', '{"decision":"rejected"}', 'member-test-rejected');
  perform private_selection.enqueue(pending_id, 'final', '{"decision":"accepted"}', 'member-test-pending');
  perform private_selection.enqueue(unverified_id, 'final', '{"decision":"accepted"}', 'member-test-unverified');
  update private_selection.messages set status = 'accepted' where idempotency_key = 'member-test-unverified';
  perform public.test_assert(not exists (select 1 from public.miembros_activos where correo = 'test807@example.org'),
    'a status change without provider acknowledgement grants no access');
  perform public.test_assert((select count(*) = v_initial_members from public.miembros_activos),
    'enqueuing and deciding do not add members');

  update private_selection.messages
    set status = 'sending', lease_token = gen_random_uuid(), first_attempt_at = now()
    where idempotency_key = 'member-test-accepted'
    returning id, lease_token into v_message_id, v_lease;
  perform public.selection_worker('finish', jsonb_build_object(
    'id', v_message_id, 'lease_token', v_lease, 'outcome', 'accepted', 'provider_id', 'member-test-provider-801'));
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-802',
    first_attempt_at = now() where idempotency_key = 'member-test-rejected';
  perform public.test_assert((select count(*) = v_initial_members + 1 from public.miembros_activos),
    'only accepted final mail adds a member');
  perform public.test_assert((select m.nombre = s.nombre and m.numero_cuenta = s.numero_cuenta
    and m.semestre = s.semestre and m.rol = 'member' and m.puntos_totales = 0
    from public.miembros_activos m join public.solicitudes s on lower(m.correo) = lower(s.correo)
    where s.id = accepted_id), 'application data is copied without inventing account data');
  perform public.test_assert(not exists (select 1 from private_selection.member_provisioning where solicitud_id = pending_id),
    'queued accepted mail has no access');
  perform public.test_assert(not exists (select 1 from private_selection.member_provisioning where solicitud_id = rejected_id),
    'rejected final mail never creates a member');

  update private_selection.messages set status = 'sending', first_attempt_at = now()
    where idempotency_key = 'member-test-pending' returning id into v_message_id;
  perform public.selection_worker('webhook', jsonb_build_object(
    'event_id', 'member-test-webhook-803',
    'event', jsonb_build_object('type', 'email.delivered', 'created_at', now(),
      'data', jsonb_build_object('email_id', 'member-test-provider-803',
        'tags', jsonb_build_object('selection_message_id', v_message_id)))));
  perform public.test_assert((select status = 'created' from private_selection.member_provisioning
    where solicitud_id = pending_id), 'provider webhook settles an uncertain acceptance and adds the member');
  perform public.test_assert((select final_email_sent from public.solicitudes where id = pending_id),
    'provider webhook also settles final email status');

  select id into v_created_member_id from public.miembros_activos where correo = 'test801@example.org';
  update public.miembros_activos set puntos_totales = 42 where id = v_created_member_id;
  update private_selection.messages set status = 'sending' where idempotency_key = 'member-test-accepted';
  update private_selection.messages set status = 'accepted' where idempotency_key = 'member-test-accepted';
  perform public.test_assert((select count(*) = 1 from public.miembros_activos where correo = 'test801@example.org'
    and puntos_totales = 42), 'replayed acceptance does not duplicate or reset points');

  insert into public.miembros_activos(nombre, correo, numero_cuenta, semestre, puntos_totales)
    values ('Existing Name', 'test804@example.org', '000000804', 8, 99) returning id into v_existing_member_id;
  perform private_selection.enqueue(existing_id, 'final', '{"decision":"accepted"}', 'member-test-existing');
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-804',
    first_attempt_at = now() where idempotency_key = 'member-test-existing';
  perform public.test_assert((select status = 'existing' and member_id = v_existing_member_id
    from private_selection.member_provisioning where solicitud_id = existing_id), 'existing member is linked');
  perform public.test_assert((select nombre = 'Existing Name' and puntos_totales = 99
    from public.miembros_activos where id = v_existing_member_id), 'existing member data and points stay untouched');

  insert into public.miembros_activos(nombre, correo, numero_cuenta, puntos_totales)
    values ('Member Without Account', 'test808@example.org', null, 57);
  perform private_selection.enqueue(missing_account_id, 'final', '{"decision":"accepted"}', 'member-test-missing-account');
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-808',
    first_attempt_at = now() where idempotency_key = 'member-test-missing-account';
  perform public.test_assert((select numero_cuenta = '000000808' and puntos_totales = 57
    from public.miembros_activos where correo = 'test808@example.org'),
    'existing member receives missing account number without losing points');

  insert into public.miembros_activos(nombre, correo, numero_cuenta)
    values ('Different Person', 'other@example.org', '000000805');
  perform private_selection.enqueue(conflict_id, 'final', '{"decision":"accepted"}', 'member-test-conflict');
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-805',
    first_attempt_at = now() where idempotency_key = 'member-test-conflict';
  perform public.test_assert((select status = 'conflict' from private_selection.member_provisioning
    where solicitud_id = conflict_id), 'account collision is recorded for review');
  perform public.test_assert(not exists (select 1 from public.miembros_activos where correo = 'test805@example.org'),
    'account collision grants no access');
  update public.solicitudes set final_email_sent = true where id = conflict_id;
  update public.miembros_activos set correo = 'test805@example.org' where correo = 'other@example.org';
  perform public.test_assert((select status = 'existing' and member_id is not null
    from private_selection.member_provisioning where solicitud_id = conflict_id),
    'admin correction resolves the pending collision without resending');

  perform private_selection.enqueue(changed_id, 'final', '{"decision":"accepted"}', 'member-test-changed');
  update public.solicitudes set correo = 'updated806@example.org' where id = changed_id;
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-806',
    first_attempt_at = now() where idempotency_key = 'member-test-changed';
  perform public.test_assert((select status = 'conflict' from private_selection.member_provisioning
    where solicitud_id = changed_id), 'changed recipient cannot gain access under another address');

  select id into v_message_id from private_selection.messages where idempotency_key = 'member-test-accepted';
  perform public.test_assert((select message_id = v_message_id and status = 'created'
    from private_selection.member_provisioning where solicitud_id = accepted_id), 'source final message is recorded');
  perform private_selection.enqueue(accepted_id, 'rectification',
    '{"stage":"final","decision":"rejected"}', 'member-test-rectification');
  update private_selection.messages set status = 'accepted', provider_id = 'member-test-provider-rectification',
    first_attempt_at = now() where idempotency_key = 'member-test-rectification';
  perform public.test_assert((select status = 'review_required' from private_selection.member_provisioning
    where solicitud_id = accepted_id), 'sent rejection rectification requests manual review');
  perform public.test_assert((select puntos_totales = 42 from public.miembros_activos where id = v_created_member_id),
    'rectification leaves member records untouched');
  raise notice 'Automatic member provisioning tests passed';
end $$;

select set_config('request.jwt.claims', '{"email":"outsider@example.org"}', false);
set role authenticated;
do $$ begin
  begin
    insert into public.miembros_activos(nombre, correo) values ('Intruder', 'intruder@example.org');
    raise exception 'TEST FAILED: outsider inserted a member';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.selection_member_status('2027-1')) then
    raise exception 'TEST FAILED: outsider read provisioning status';
  end if;
end $$;
reset role;
rollback;
