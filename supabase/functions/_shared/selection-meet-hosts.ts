import { CalendarError, calendarEventBody, type CalendarJob } from './selection-calendar.ts';

interface Space { name: string; meetingUri: string; meetingCode: string; config?: { accessType?: string; moderation?: string } }
interface Member { name: string; email: string; role: string }
export interface SpacePersistence {
  start(): Promise<void>;
  trackHosts(emails: string[]): Promise<void>;
  save(space: { google_space_name: string; meet_url: string }): Promise<void>;
}

/** New rooms are app-created so the scoped members API can grant Google roles.
 * Persist creation intent and the resulting URL before sending invitations.
 * An ambiguous spaces.create cannot be automatically retried (no request ID).
 */
export async function processManagedRoom(job: CalendarJob, calendarId: string, organizerEmail: string,
  token: string, persistence: SpacePersistence, fetcher: typeof fetch = fetch,
): Promise<{ meet_url: string; cohost_emails: string[] }> {
  if (!/^[0-9a-v]{5,1024}$/.test(job.event_id)) throw new CalendarError('calendar_event_id_invalid');
  if (!organizerEmail) throw new CalendarError('google_organizer_identity_required');
  const call = (url: string, init: RequestInit = {}) => fetcher(url, { ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000) });
  const checked = async <T>(response: Response, operation: string): Promise<T> => {
    if (!response.ok) throw new CalendarError(`${operation}_http_${response.status}`);
    return await response.json() as T;
  };
  const events = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const eventUrl = `${events}/${job.event_id}`;
  const existingResponse = await call(eventUrl);
  let existing: { hangoutLink?: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string };
    attendees?: Array<{ email: string }>; extendedProperties?: { private?: Record<string, string> } } | null = null;
  if (existingResponse.status !== 404) {
    existing = await checked(existingResponse, 'calendar_get');
    if (existing?.extendedProperties?.private?.selection_id !== job.id || existing?.status === 'cancelled') throw new CalendarError('calendar_event_id_conflict');
    if (existing?.hangoutLink && existing.hangoutLink !== job.meet_url) throw new CalendarError('meet_change_requires_manual_coordination');
  }
  let space: Space;
  if (job.google_space_name) {
    space = await checked(await call(`https://meet.googleapis.com/v2/${job.google_space_name}`), 'meet_lookup');
  } else {
    if (job.meet_url || job.space_creation_started) throw new CalendarError('meet_creation_outcome_unknown_manual_review');
    await persistence.start();
    // Never repeat this POST after a timeout, bad response, or a crash before save.
    space = await checked(await call('https://meet.googleapis.com/v2/spaces', { method: 'POST',
      body: JSON.stringify({ config: { accessType: 'RESTRICTED', moderation: 'ON' } }) }), 'meet_create');
    if (!/^spaces\/[A-Za-z0-9_-]+$/.test(space.name ?? '') || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(space.meetingUri ?? '')) {
      throw new CalendarError('meet_creation_outcome_unknown_manual_review');
    }
    await persistence.save({ google_space_name: space.name, meet_url: space.meetingUri });
  }
  if (job.meet_url && space.meetingUri !== job.meet_url) throw new CalendarError('meet_change_requires_manual_coordination');
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(space.name ?? '') || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(space.meetingUri ?? '')) throw new CalendarError('calendar_invalid_meet');
  const restricted: Space = await checked(await call(`https://meet.googleapis.com/v2/${space.name}?updateMask=config.accessType,config.moderation`, {
    method: 'PATCH', body: JSON.stringify({ config: { accessType: 'RESTRICTED', moderation: 'ON' } }),
  }), 'meet_access');
  if (restricted.config?.accessType !== 'RESTRICTED' || restricted.config?.moderation !== 'ON') throw new CalendarError('meet_access_not_restricted');
  const membersUrl = `https://meet.googleapis.com/v2/${space.name}/members`;
  const listMembers = async () => {
    const all: Member[] = []; let pageToken = ''; const seen = new Set<string>();
    do {
      const page: { members?: Member[]; nextPageToken?: string } = await checked(await call(`${membersUrl}?${new URLSearchParams({ pageSize: '500', ...(pageToken ? { pageToken } : {}) })}`), 'meet_cohosts_list');
      all.push(...(page.members ?? [])); pageToken = page.nextPageToken ?? '';
      if (pageToken && seen.has(pageToken)) throw new CalendarError('meet_cohosts_pagination_invalid');
      seen.add(pageToken);
    } while (pageToken);
    return all;
  };
  const wanted = [...new Set([job.primary_email, job.backup_email].filter((email): email is string => !!email)
    .map(email => email.toLowerCase()))].filter(email => email !== organizerEmail.toLowerCase()).sort();
  let members = await listMembers();
  // Persist role intent before granting: a lost response or later Calendar failure
  // must still allow the next revision to revoke a replaced managed cohost.
  await persistence.trackHosts([...new Set([...(job.managed_cohosts ?? []), ...wanted])].sort());
  for (const email of wanted) {
    let member = members.find(m => m.email?.toLowerCase() === email);
    if (!member) {
      const created = await call(membersUrl, { method: 'POST', body: JSON.stringify({ email, role: 'COHOST' }) });
      if (created.status === 409) { members = await listMembers(); member = members.find(m => m.email?.toLowerCase() === email); }
      else member = await checked(created, 'meet_cohosts_create');
    }
    if (!member || member.email?.toLowerCase() !== email || !member.name?.startsWith(`${space.name}/members/`)) throw new CalendarError('meet_cohost_missing_member');
    if (member.role !== 'COHOST') {
      member = await checked(await call(`https://meet.googleapis.com/v2/${member.name}?updateMask=role`, { method: 'PATCH', body: JSON.stringify({ role: 'COHOST' }) }), 'meet_cohosts_update');
    }
    if (member?.role !== 'COHOST') throw new CalendarError('meet_cohost_role_not_granted');
  }
  // Revoke only roles previously assigned by this integration, never unrelated
  // members configured manually by the organizer. Add replacement coverage first.
  for (const email of job.managed_cohosts ?? []) {
    if (wanted.includes(email.toLowerCase())) continue;
    const member = members.find(m => m.email?.toLowerCase() === email.toLowerCase());
    if (!member || !member.name?.startsWith(`${space.name}/members/`)) continue;
    const deleted = await call(`https://meet.googleapis.com/v2/${member.name}`, { method: 'DELETE' });
    if (!deleted.ok && deleted.status !== 404) throw new CalendarError(`meet_cohosts_delete_http_${deleted.status}`);
  }
  const body = { ...calendarEventBody(job), location: space.meetingUri,
    conferenceData: { conferenceId: space.meetingCode, conferenceSolution: { key: { type: 'hangoutsMeet' }, name: 'Google Meet' },
      entryPoints: [{ entryPointType: 'video', uri: space.meetingUri, label: space.meetingUri.slice(8) }] },
  };
  const attendeesMatch = existing?.attendees?.map(a => a.email.toLowerCase()).sort().join(',') ===
    [job.primary_email!, job.backup_email!].map(email => email.toLowerCase()).sort().join(',');
  if (existing?.hangoutLink === space.meetingUri && attendeesMatch &&
    Date.parse(existing.start?.dateTime ?? '') === Date.parse(job.start) && Date.parse(existing.end?.dateTime ?? '') === Date.parse(job.end)) {
    return { meet_url: space.meetingUri, cohost_emails: wanted };
  }
  let response = await call(existing ? `${eventUrl}?conferenceDataVersion=1&sendUpdates=all` : `${events}?conferenceDataVersion=1&sendUpdates=all`, {
    method: existing ? 'PATCH' : 'POST', body: JSON.stringify(body),
  });
  if (!existing && response.status === 409) response = await call(eventUrl);
  const event: { hangoutLink?: string } = await checked(response, 'calendar_room_save');
  if (event.hangoutLink !== space.meetingUri) throw new CalendarError('calendar_room_conference_not_attached');
  return { meet_url: space.meetingUri, cohost_emails: wanted };
}
