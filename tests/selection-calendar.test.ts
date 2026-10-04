import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv } from 'node:crypto';
import { ADMISSION_MESSAGE, calendarEventBody, decryptCalendarCredentials, googleAccessToken, processCalendarJob, type CalendarJob } from '../supabase/functions/_shared/selection-calendar.ts';
const room: CalendarJob = { kind: 'room', id: 'room-1', lease: 'lease-1', event_id: 'clubroom123', start: '2026-10-10T16:00:00Z', end: '2026-10-10T19:00:00Z', name: 'Sala 1', primary_email: 'host@example.org', backup_email: 'backup@example.org' };
const booking: CalendarJob = { ...room, kind: 'booking', id: 'booking-1', event_id: 'clubbooking123', end: '2026-10-10T16:15:00Z', recipient: 'applicant@unam.mx', meet_url: 'https://meet.google.com/aaa-bbbb-ccc' };
const event = (job: CalendarJob = room) => ({ id: job.event_id, start: { dateTime: job.start }, end: { dateTime: job.end }, extendedProperties: { private: { selection_id: job.id } }, ...(job.kind === 'room' ? { hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc' } : {}), attendees: [{ email: room.primary_email }, { email: room.backup_email }] });
test('Calendar IDs use base32hex and invalid IDs fail before making provider requests', async () => {
  for (const job of [room, booking]) assert.match(job.event_id, /^[0-9a-v]{5,1024}$/);
  const m = mock([]);
  await assert.rejects(processCalendarJob({ ...room, event_id: 'hwroom123' }, 'primary', 'token', m.fetcher), /calendar_event_id_invalid/);
  assert.equal(m.calls.length, 0);
});
function mock(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init }); const next = responses.shift();
    if (!next) throw new Error('Unexpected fetch');
    return new Response(next.status === 204 ? null : JSON.stringify(next.body ?? {}), { status: next.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}
test('applicant invitation includes URL and 15 minute time range, without shared conference or hosts', () => {
  const body = calendarEventBody(booking);
  assert.equal('conferenceData' in body, false);
  assert.equal(body.location, booking.meet_url);
  assert.match(String(body.description), new RegExp(ADMISSION_MESSAGE));
  assert.deepEqual(body.attendees, [{ email: booking.recipient }]);
  assert.deepEqual(body.end, { dateTime: booking.end, timeZone: 'America/Mexico_City' });
});
test('room principal event only invites its two responsible hosts and creates a new conference', () => {
  const body = calendarEventBody(room);
  assert.deepEqual(body.attendees, [{ email: room.primary_email }, { email: room.backup_email }]);
  assert.deepEqual(body.conferenceData, { createRequest: { requestId: room.event_id, conferenceSolutionKey: { type: 'hangoutsMeet' } } });
});
test('booking creates one event with stable database ID', async () => {
  const m = mock([{ status: 404 }, { body: event(booking) }]);
  await processCalendarJob(booking, 'primary', 'token', m.fetcher);
  assert.equal(m.calls.length, 2);
  assert.equal(m.calls[1].init?.method, 'POST');
  assert.equal(JSON.parse(String(m.calls[1].init?.body)).id, booking.event_id);
});
test('ambiguous insert followed by retry recovers existing booking without sending a second invitation', async () => {
  const m = mock([{ body: event(booking) }]);
  await processCalendarJob(booking, 'primary', 'token', m.fetcher);
  assert.equal(m.calls.length, 1); assert.equal(m.calls[0].init?.method, undefined);
});
test('insert conflict recovers the same event', async () => {
  const m = mock([{ status: 404 }, { status: 409 }, { body: event(booking) }]);
  await processCalendarJob(booking, 'primary', 'token', m.fetcher);
  assert.equal(m.calls[2].url.endsWith(booking.event_id), true);
});
test('room restricts access and preserves its conference on retry', async () => {
  const m = mock([{ body: event() }, { body: { name: 'spaces/actual-space-id' } }, { body: { config: { accessType: 'RESTRICTED' } } }]);
  const result = await processCalendarJob(room, 'primary', 'token', m.fetcher);
  assert.equal(result.meet_url, event().hangoutLink);
  assert.match(m.calls[1].url, /meet.googleapis.com\/v2\/spaces\/aaa-bbbb-ccc/);
  assert.deepEqual(JSON.parse(String(m.calls[2].init?.body)), { config: { accessType: 'RESTRICTED' } });
});
test('host replacement updates attendees and keeps shared conference unchanged', async () => {
  const changed = { ...room, primary_email: 'replacement@example.org', meet_url: event().hangoutLink };
  const m = mock([{ body: event() }, { body: event() }, { body: { name: 'spaces/actual-space-id' } }, { body: { config: { accessType: 'RESTRICTED' } } }]);
  await processCalendarJob(changed, 'primary', 'token', m.fetcher);
  const patch = JSON.parse(String(m.calls[1].init?.body));
  assert.equal('conferenceData' in patch, false);
  assert.deepEqual(patch.attendees, [{ email: changed.primary_email }, { email: room.backup_email }]);
});
test('provider cannot silently replace a communicated Meet', async () => {
  const m = mock([{ body: { ...event(), hangoutLink: 'https://meet.google.com/ddd-eeee-fff' } }]);
  await assert.rejects(processCalendarJob({ ...room, meet_url: event().hangoutLink }, 'primary', 'token', m.fetcher), /meet_change_requires_manual_coordination/);
  assert.equal(m.calls.length, 1);
});
test('conference still being created is recoverable with the same event', async () => {
  const m = mock([{ body: { id: room.event_id, extendedProperties: { private: { selection_id: room.id } } } }]);
  await assert.rejects(processCalendarJob(room, 'primary', 'token', m.fetcher), /conference_pending_retry/);
  assert.equal(m.calls.length, 1);
});
test('failed restricted access never returns a verified room', async () => {
  const m = mock([{ body: event() }, { body: { name: 'spaces/actual-space-id' } }, { status: 403 }]);
  await assert.rejects(processCalendarJob(room, 'primary', 'token', m.fetcher), /meet_access_http_403/);
});
test('event ID collision with an unrelated event is refused', async () => {
  const m = mock([{ body: { ...event(booking), extendedProperties: { private: { selection_id: 'someone-else' } } } }]);
  await assert.rejects(processCalendarJob(booking, 'primary', 'token', m.fetcher), /event_id_conflict/);
});
test('cancel retry after successful deletion does not send another cancellation', async () => {
  const m = mock([{ status: 410 }]);
  await processCalendarJob({ ...booking, kind: 'cancel' }, 'primary', 'token', m.fetcher);
  assert.equal(m.calls.length, 1);
});
test('AES-256-GCM credentials decrypt and reject tampering', async () => {
  const credentials = { client_id: 'client', client_secret: 'secret', refresh_token: 'refresh', calendar_id: 'primary' };
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(credentials)), cipher.final(), cipher.getAuthTag()]);
  const encrypted = `v1.${iv.toString('base64')}.${data.toString('base64')}`;
  assert.deepEqual(await decryptCalendarCredentials(encrypted, key.toString('base64')), credentials);
  data[0] ^= 1;
  await assert.rejects(decryptCalendarCredentials(`v1.${iv.toString('base64')}.${data.toString('base64')}`, key.toString('base64')));
});
test('revoked authorization returns a safe error with no credential details', async () => {
  const m = mock([{ status: 401, body: { error: 'bad client secret content' } }]);
  await assert.rejects(googleAccessToken({ client_id: 'client', client_secret: 'secret', refresh_token: 'refresh', calendar_id: 'primary' }, m.fetcher), { message: 'google_authorization_http_401' });
});


test('unexpected conference on an applicant event fails for review', async () => {
  const m = mock([{ body: { ...event(booking), hangoutLink: booking.meet_url } }]);
  await assert.rejects(processCalendarJob(booking, 'primary', 'token', m.fetcher), /booking_event_has_unexpected_conference/);
});
