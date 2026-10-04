import test from 'node:test';
import assert from 'node:assert/strict';
import { processManagedRoom } from '../supabase/functions/_shared/selection-meet-hosts.ts';
import type { CalendarJob } from '../supabase/functions/_shared/selection-calendar.ts';
const job: CalendarJob = { kind: 'room', id: 'room1', lease: 'lease1', event_id: 'clubroom123',
  start: '2026-10-04T16:00:00Z', end: '2026-10-04T17:00:00Z', primary_email: 'host@example.org', backup_email: 'backup@example.org', name: 'Sala 1' };
const space = { name: 'spaces/app-room', meetingUri: 'https://meet.google.com/aaa-bbbb-ccc', meetingCode: 'aaa-bbbb-ccc', config: { accessType: 'RESTRICTED', moderation: 'ON' } };
const member = (email: string, id: string, role = 'COHOST') => ({ name: `${space.name}/members/${id}`, email, role });
const calendar = { hangoutLink: space.meetingUri, start: { dateTime: job.start }, end: { dateTime: job.end },
  attendees: [{ email: job.primary_email }, { email: job.backup_email }], extendedProperties: { private: { selection_id: job.id } } };
function setup(responses: Array<{ status?: number; body?: unknown; failure?: boolean }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [], persisted: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init }); const next = responses.shift();
    if (!next) throw new Error('Unexpected request');
    if (next.failure) throw new Error('Network response lost');
    return new Response(next.status === 204 ? null : JSON.stringify(next.body ?? {}), { status: next.status ?? 200 });
  }) as typeof fetch;
  const persistence = { trackHosts: async (emails: string[]) => { persisted.push('hosts:' + emails.join(',')); }, start: async () => { persisted.push('start'); }, save: async () => { persisted.push('save'); } };
  return { calls, persisted, fetcher, persistence };
}
test('creates an app-owned Meet, persists it, grants both cohosts, and attaches only the principal event', async () => {
  const m = setup([{ status: 404 }, { body: space }, { body: space }, { body: {} },
    { body: member('backup@example.org', 'backup') }, { body: member('host@example.org', 'host') }, { body: calendar }]);
  const result = await processManagedRoom(job, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher);
  assert.deepEqual(m.persisted, ['start', 'save', 'hosts:backup@example.org,host@example.org']);
  assert.deepEqual(result, { meet_url: space.meetingUri, cohost_emails: ['backup@example.org', 'host@example.org'] });
  const body = JSON.parse(String(m.calls.at(-1)?.init?.body));
  assert.equal(body.conferenceData.entryPoints[0].uri, space.meetingUri);
  assert.equal('createRequest' in body.conferenceData, false);
  assert.equal(m.calls.filter(c => c.init?.method === 'POST' && c.url.endsWith('/spaces')).length, 1);
});
test('retry recovers the saved Meet and roles without creating spaces, members, or resending invitations', async () => {
  const m = setup([{ body: calendar }, { body: space }, { body: space },
    { body: { members: [member('host@example.org', 'host'), member('backup@example.org', 'backup')] } }]);
  await processManagedRoom({ ...job, google_space_name: space.name, meet_url: space.meetingUri }, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher);
  assert.deepEqual(m.persisted, ['hosts:backup@example.org,host@example.org']);
  assert.equal(m.calls.filter(c => c.init?.method === 'POST' || c.url.includes('sendUpdates')).length, 0);
});
test('replacing a host revokes only managed roles after granting replacement and preserves the Meet', async () => {
  const changed = { ...job, primary_email: 'replacement@example.org', google_space_name: space.name, meet_url: space.meetingUri,
    managed_cohosts: ['host@example.org', 'backup@example.org'] };
  const m = setup([{ body: calendar }, { body: space }, { body: space }, { body: { members: [
    member('host@example.org', 'host'), member('backup@example.org', 'backup'), member('other@example.org', 'manual'),
  ] } }, { body: member('replacement@example.org', 'replacement') }, { status: 204 }, { body: calendar }]);
  const result = await processManagedRoom(changed, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher);
  assert.equal(result.meet_url, space.meetingUri);
  assert.equal(m.calls[4].init?.method, 'POST');
  assert.equal(m.calls[5].init?.method, 'DELETE');
  assert.match(m.calls[5].url, /members\/host$/);
  assert.equal(m.calls.some(c => c.init?.method === 'DELETE' && c.url.endsWith('/manual')), false);
});
test('ambiguous creation records intent and retry stops for review instead of duplicating a Meet', async () => {
  const m = setup([{ status: 404 }, { failure: true }]);
  await assert.rejects(processManagedRoom(job, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher));
  assert.deepEqual(m.persisted, ['start']);
  const retry = setup([{ status: 404 }]);
  await assert.rejects(processManagedRoom({ ...job, space_creation_started: true }, 'primary', 'organizer@example.org', 'token', retry.persistence, retry.fetcher), /meet_creation_outcome_unknown_manual_review/);
  assert.equal(retry.calls.length, 1);
});
test('cohost failure keeps persisted Meet and never sends Calendar invitations', async () => {
  const m = setup([{ status: 404 }, { body: space }, { body: space }, { status: 403 }]);
  await assert.rejects(processManagedRoom(job, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher), /meet_cohosts_list_http_403/);
  assert.deepEqual(m.persisted, ['start', 'save']);
  assert.equal(m.calls.some(c => c.url.includes('sendUpdates')), false);
});
test('the organizer retains ownership and is never redundantly assigned a cohost role', async () => {
  const m = setup([{ status: 404 }, { body: space }, { body: space }, { body: {} }, { body: member('backup@example.org', 'backup') }, { body: calendar }]);
  const result = await processManagedRoom(job, 'primary', 'host@example.org', 'token', m.persistence, m.fetcher);
  assert.deepEqual(result.cohost_emails, ['backup@example.org']);
});

test('Calendar failure after granting roles retains tracked role intent for a later replacement', async () => {
  const m = setup([{ status: 404 }, { body: space }, { body: space }, { body: {} },
    { body: member('backup@example.org', 'backup') }, { body: member('host@example.org', 'host') }, { status: 500 }]);
  await assert.rejects(processManagedRoom(job, 'primary', 'organizer@example.org', 'token', m.persistence, m.fetcher), /calendar_room_save_http_500/);
  assert.deepEqual(m.persisted, ['start', 'save', 'hosts:backup@example.org,host@example.org']);
});
