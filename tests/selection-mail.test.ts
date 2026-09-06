import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSelectionMailRequestBody,
  escapeHtml,
  formatMexicoCityDate,
  isSelectionMailRequestBody,
  renderSelectionMail,
  SELECTION_MAIL_KINDS,
  type SelectionMailPayload,
} from '../supabase/functions/_shared/selection-mail.ts';

const BASE_PAYLOAD: SelectionMailPayload = {
  nombre: 'Ana María',
  season: '2027-1',
  decision: 'accepted',
  expires_at: '2026-05-21T18:00:00.000Z',
  booking_url: 'https://helloworld-unam.tech/seleccion/agendar?t=test-token',
  slot_datetime: '2026-05-21T18:00:00.000Z',
  duration_minutes: 30,
  meet_url: 'https://meet.google.com/test-room',
  whatsapp_url: 'https://chat.whatsapp.com/test-group',
  reason: 'INTERNAL_REASON_MUST_NOT_BE_SENT',
};

function payload(overrides: Partial<SelectionMailPayload> = {}): SelectionMailPayload {
  return { ...BASE_PAYLOAD, ...overrides };
}

test('escapes names and URLs in HTML output', () => {
  const mail = renderSelectionMail(
    'initial',
    payload({
      nombre: '<Ana & "A">',
      booking_url: 'https://example.test/agendar?a=1&b=2',
    }),
  );

  assert.match(mail.html, /&lt;Ana/);
  assert.match(mail.html, /https:\/\/example\.test\/agendar\?a=1&amp;b=2/);
  assert.doesNotMatch(mail.html, /<Ana/);
});

test('restores the historical receipt template and subject', () => {
  const mail = renderSelectionMail('receipt', payload());

  assert.equal(mail.subject, 'Tu solicitud al Club Hello World — 2027-1');
  assert.match(mail.html, /✦ Solicitud recibida · 2027-1/);
  assert.match(mail.html, /Hola, Ana\./);
  assert.match(mail.html, /Cada solicitud la lee alguien del equipo — no un algoritmo/);
  assert.match(mail.html, /No buscamos el promedio más alto/);
  assert.match(mail.html, /instagram\.com\/helloworld_unam/);
  assert.match(mail.text, /Está oficialmente en nuestras manos/);
});

test('formats UTC dates in America/Mexico_City', () => {
  assert.equal(
    formatMexicoCityDate('2026-05-21T18:00:00.000Z'),
    '21 de mayo de 2026, 12:00 p.m. (hora de Ciudad de México)',
  );
});

test('does not assume an interview happened in final decision messages', () => {
  const accepted = renderSelectionMail('final', payload({ decision: 'accepted' }));
  const rejected = renderSelectionMail('final', payload({ decision: 'rejected' }));

  assert.doesNotMatch(accepted.text.toLowerCase(), /entrevista/);
  assert.doesNotMatch(rejected.text.toLowerCase(), /entrevista/);
});

test('initial accepted sends an invitation while initial rejected does not expose booking data', () => {
  const invitation = renderSelectionMail('initial', payload({ decision: 'accepted' }));
  const rejection = renderSelectionMail('initial', payload({ decision: 'rejected' }));

  assert.match(invitation.text, /Agenda tu entrevista/);
  assert.match(invitation.text, /helloworld-unam\.tech\/seleccion\/agendar/);
  assert.doesNotMatch(rejection.text, /agendar|helloworld-unam\.tech\/seleccion\/agendar/i);
  assert.equal(invitation.subject, 'Avanzaste a la siguiente fase — Club Hello World');
  assert.equal(rejection.subject, 'Sobre tu solicitud al Club Hello World');
  assert.match(invitation.html, /Ana, queremos conocerte/);
  assert.match(invitation.html, /Por Google Meet/);
  assert.doesNotMatch(invitation.html, /30 minutos · por Google Meet/);
  assert.match(rejection.html, /Tu solicitud fue revisada con detenimiento/);
});

test('restores booking confirmation with dynamic Meet details', () => {
  const mail = renderSelectionMail('booking', payload({ duration_minutes: 45 }));

  assert.equal(mail.subject, 'Confirmada: tu entrevista el jueves, 21 de mayo de 2026');
  assert.match(mail.html, /✓ Entrevista confirmada/);
  assert.match(mail.html, /Listo, Ana\./);
  assert.match(mail.html, /12:00 hrs · 45 minutos/);
  assert.match(mail.html, /https:\/\/meet\.google\.com\/test-room/);
  assert.match(mail.html, /Gestiona tu entrevista aquí/);
  assert.match(mail.text, /45 minutos/);
});

test('booking requires a supported dynamic duration', () => {
  assert.throws(
    () => renderSelectionMail('booking', payload({ duration_minutes: undefined })),
    /invalid_duration_minutes/,
  );
  assert.throws(() => renderSelectionMail('booking', payload({ duration_minutes: 25 })), /invalid_duration_minutes/);
});

test('final accepted requires the WhatsApp link only for that variant', () => {
  assert.throws(
    () => renderSelectionMail('final', payload({ decision: 'accepted', whatsapp_url: undefined })),
    /missing_whatsapp_url/,
  );
  assert.doesNotThrow(() => renderSelectionMail('final', payload({ decision: 'rejected', whatsapp_url: undefined })));
});

test('completed interviews use the historical final templates', () => {
  const accepted = renderSelectionMail('final', payload({ decision: 'accepted', interview_outcome: 'completed' }));
  const rejected = renderSelectionMail('final', payload({ decision: 'rejected', interview_outcome: 'completed' }));

  assert.equal(accepted.subject, '¡Bienvenida/o al Club Hello World!');
  assert.match(accepted.html, /Estás dentro, Ana/);
  assert.match(accepted.html, /Después del formulario, la entrevista y la deliberación/);
  assert.match(accepted.html, /Entrar al WhatsApp/);
  assert.equal(rejected.subject, 'Sobre tu proceso de selección — Club Hello World');
  assert.match(rejected.html, /Llegaste hasta la entrevista/);
  assert.match(rejected.html, /Gracias, Ana/);
});

test('no-show rejection uses the dedicated truthful template', () => {
  const mail = renderSelectionMail('final', payload({ decision: 'rejected', interview_outcome: 'no_show' }));

  assert.equal(mail.subject, 'Sobre tu proceso de selección — Club Hello World');
  assert.match(mail.html, /✦ Proceso de selección · 2027-1/);
  assert.match(mail.html, /No registramos tu asistencia/);
  assert.match(mail.html, /responde a este correo para que podamos revisar tu caso/);
  assert.match(mail.text, /No registramos tu asistencia/);
});

test('final decisions without a completed interview keep neutral wording', () => {
  const accepted = renderSelectionMail('final', payload({ decision: 'accepted', interview_outcome: 'none' }));
  const rejected = renderSelectionMail('final', payload({ decision: 'rejected', interview_outcome: 'none' }));

  assert.doesNotMatch(accepted.text.toLowerCase(), /entrevista/);
  assert.doesNotMatch(rejected.text.toLowerCase(), /entrevista/);
  assert.equal(accepted.subject, 'Resultado de tu proceso · 2027-1');
  assert.equal(rejected.subject, 'Resultado de tu proceso · 2027-1');
});

test('rectification uses the stage-specific accepted template', () => {
  const initial = renderSelectionMail(
    'rectification',
    payload({ stage: 'initial', decision: 'accepted', whatsapp_url: undefined }),
  );
  const final = renderSelectionMail(
    'rectification',
    payload({ stage: 'final', decision: 'accepted', booking_url: undefined, expires_at: undefined }),
  );

  assert.match(initial.text, /continuar al proceso de entrevista/);
  assert.match(initial.text, /Agenda tu entrevista/);
  assert.match(final.text, /fuiste admitido\(a\)/);
  assert.match(final.text, /Bienvenido\(a\)/);
  assert.match(final.text, /WhatsApp/);
  assert.doesNotMatch(final.text.toLowerCase(), /entrevista/);
});

test('rectification requires its explicit stage', () => {
  assert.throws(
    () => renderSelectionMail('rectification', payload({ decision: 'accepted', stage: undefined })),
    /missing_stage/,
  );
});

test('prepared request fixture contains the immutable correlation tag', () => {
  const requestBody = buildSelectionMailRequestBody(
    'initial',
    payload(),
    'candidate@example.org',
    'Club Hello World <contacto@helloworld-unam.tech>',
    '00000000-0000-0000-0000-000000000001',
  );

  assert.deepEqual(requestBody.tags, [
    {
      name: 'selection_message_id',
      value: '00000000-0000-0000-0000-000000000001',
    },
  ]);
  assert.deepEqual(requestBody.to, ['candidate@example.org']);
  assert.equal(typeof requestBody.text, 'string');
  assert.equal(typeof requestBody.html, 'string');
  assert.equal(
    isSelectionMailRequestBody(requestBody, '00000000-0000-0000-0000-000000000001'),
    true,
  );
  assert.equal(
    isSelectionMailRequestBody({ ...requestBody, tags: [] }, '00000000-0000-0000-0000-000000000001'),
    false,
  );
  assert.equal(
    isSelectionMailRequestBody(requestBody, '00000000-0000-0000-0000-000000000002'),
    false,
  );
  assert.doesNotMatch(JSON.stringify(requestBody), /INTERNAL_REASON_MUST_NOT_BE_SENT/);
});

test('renders every supported kind and never leaks the internal reason', () => {
  for (const kind of SELECTION_MAIL_KINDS) {
    const mail = renderSelectionMail(
      kind,
      payload({
        decision: kind === 'initial' ? 'rejected' : 'accepted',
        stage: kind === 'rectification' ? 'final' : undefined,
      }),
    );
    assert.ok(mail.subject.length > 0, `${kind} subject`);
    assert.ok(mail.text.length > 0, `${kind} text`);
    assert.ok(mail.html.length > 0, `${kind} html`);
    assert.doesNotMatch(mail.text, /INTERNAL_REASON_MUST_NOT_BE_SENT/);
    assert.doesNotMatch(mail.html, /INTERNAL_REASON_MUST_NOT_BE_SENT/);
  }
});

test('escapeHtml handles all HTML-sensitive characters', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});
