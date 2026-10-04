/** Google calls stay server-side. IDs belong to the database outbox, never a retry. */
export const ADMISSION_MESSAGE = 'Solicita entrar a tu hora; el equipo te admitirá cuando termine la entrevista anterior';
export interface CalendarCredentials { client_id: string; client_secret: string; refresh_token: string; calendar_id: string; organizer_email?: string }
export interface CalendarJob {
  kind: 'room' | 'booking' | 'cancel'; id: string; lease: string; revision?: number;
  event_id: string; start: string; end: string; name?: string;
  primary_email?: string; backup_email?: string; recipient?: string; meet_url?: string | null;
  google_space_name?: string | null; space_creation_started?: boolean; managed_cohosts?: string[];
}
type GoogleEvent = {
  id: string; status?: string; hangoutLink?: string;
  start?: { dateTime?: string }; end?: { dateTime?: string };
  attendees?: Array<{ email: string }>;
  extendedProperties?: { private?: Record<string, string> };
  conferenceData?: { createRequest?: { status?: { statusCode?: string } }; entryPoints?: Array<{ entryPointType: string; uri: string }> };
};
export class CalendarError extends Error {}

export async function decryptCalendarCredentials(encrypted: string, encodedKey: string): Promise<CalendarCredentials> {
  const bytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const [version, iv, cipher] = encrypted.split('.');
  if (version !== 'v1' || !iv || !cipher || bytes(iv).length !== 12 || bytes(encodedKey).length !== 32) throw new CalendarError('calendar_credentials_invalid');
  const key = await crypto.subtle.importKey('raw', bytes(encodedKey), 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, key, bytes(cipher));
  const parsed = JSON.parse(new TextDecoder().decode(clear)) as CalendarCredentials;
  for (const k of ['client_id', 'client_secret', 'refresh_token', 'calendar_id'] as const) {
    if (typeof parsed[k] !== 'string' || !parsed[k]) throw new CalendarError('calendar_credentials_invalid');
  }
  return parsed;
}

export async function googleAccessToken(credentials: CalendarCredentials, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new CalendarError(`google_authorization_http_${response.status}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new CalendarError('google_authorization_missing_token');
  return data.access_token;
}

export function calendarEventBody(job: CalendarJob): Record<string, unknown> {
  const base = {
    id: job.event_id, summary: job.kind === 'room' ? `Hello World · ${job.name}` : 'Entrevista · Club Hello World',
    start: { dateTime: job.start, timeZone: 'America/Mexico_City' }, end: { dateTime: job.end, timeZone: 'America/Mexico_City' },
    extendedProperties: { private: { selection_id: job.id, selection_kind: job.kind } },
    guestsCanInviteOthers: false, guestsCanModify: false,
  };
  if (job.kind === 'room') return { ...base,
    attendees: [{ email: job.primary_email }, { email: job.backup_email }],
    description: 'Sala de entrevistas de la jornada. Configura titular y respaldo como coanfitriones y verifica admisión manual antes de publicar.',
    conferenceData: { createRequest: { requestId: job.event_id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
  };
  return { ...base, attendees: [{ email: job.recipient }], location: job.meet_url,
    description: `${ADMISSION_MESSAGE}.\n\nGoogle Meet: ${job.meet_url}`,
    // The applicant receives the URL only. Never attach the room's conferenceData.
  };
}

export async function processCalendarJob(job: CalendarJob, calendarId: string, accessToken: string, fetcher: typeof fetch = fetch): Promise<{ meet_url?: string }> {
  if (!/^[0-9a-v]{5,1024}$/.test(job.event_id)) throw new CalendarError('calendar_event_id_invalid');
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const call = (url: string, init: RequestInit = {}) => fetcher(url, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  const eventUrl = `${base}/${encodeURIComponent(job.event_id)}`;
  let response = await call(eventUrl);
  if (job.kind === 'cancel') {
    if (response.status === 404 || response.status === 410) return {};
    if (!response.ok) throw new CalendarError(`calendar_get_http_${response.status}`);
    const existing = await response.json() as GoogleEvent;
    if (existing.extendedProperties?.private?.selection_id !== job.id) throw new CalendarError('calendar_event_id_conflict');
    if (existing.status === 'cancelled') return {};
    response = await call(`${eventUrl}?sendUpdates=all`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404 && response.status !== 410) throw new CalendarError(`calendar_delete_http_${response.status}`);
    return {};
  }
  let event: GoogleEvent;
  if (response.status === 404) {
    response = await call(`${base}?conferenceDataVersion=1&sendUpdates=all`, { method: 'POST', body: JSON.stringify(calendarEventBody(job)) });
    if (response.status === 409) response = await call(eventUrl);
    if (!response.ok) throw new CalendarError(`calendar_insert_http_${response.status}`);
    event = await response.json() as GoogleEvent;
  } else {
    if (!response.ok) throw new CalendarError(`calendar_get_http_${response.status}`);
    event = await response.json() as GoogleEvent;
  }
  if (event.extendedProperties?.private?.selection_id !== job.id || event.status === 'cancelled') throw new CalendarError('calendar_event_id_conflict');
  if (job.kind === 'booking') {
    if (event.conferenceData?.entryPoints?.length || event.hangoutLink) throw new CalendarError('booking_event_has_unexpected_conference');
    return {};
  }
  const meetUrl = event.hangoutLink ?? event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
  if (!meetUrl) throw new CalendarError('calendar_conference_pending_retry');
  if (!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(meetUrl)) throw new CalendarError('calendar_invalid_meet');
  if (job.meet_url && meetUrl !== job.meet_url) throw new CalendarError('meet_change_requires_manual_coordination');
  const attendees = event.attendees?.map(a => a.email.toLowerCase()).sort().join(',');
  const wanted = [job.primary_email!, job.backup_email!].map(e => e.toLowerCase()).sort().join(',');
  const datesMatch = Date.parse(event.start?.dateTime ?? '') === Date.parse(job.start) && Date.parse(event.end?.dateTime ?? '') === Date.parse(job.end);
  if (attendees !== wanted || !datesMatch) {
    // Patch attendees only: retain the original conference, event ID, and communicated URL.
    response = await call(`${eventUrl}?sendUpdates=all`, { method: 'PATCH', body: JSON.stringify({ attendees: [{ email: job.primary_email }, { email: job.backup_email }], start: { dateTime: job.start, timeZone: 'America/Mexico_City' }, end: { dateTime: job.end, timeZone: 'America/Mexico_City' } }) });
    if (!response.ok) throw new CalendarError(`calendar_hosts_http_${response.status}`);
  }
  const meetingCode = meetUrl.split('/').pop()!;
  response = await call(`https://meet.googleapis.com/v2/spaces/${meetingCode}`);
  if (!response.ok) throw new CalendarError(`meet_lookup_http_${response.status}`);
  const located = await response.json() as { name?: string };
  if (!located.name || !/^spaces\/[A-Za-z0-9_-]+$/.test(located.name)) throw new CalendarError('meet_space_missing_name');
  response = await call(`https://meet.googleapis.com/v2/${located.name}?updateMask=config.accessType`, {
    method: 'PATCH', body: JSON.stringify({ config: { accessType: 'RESTRICTED' } }),
  });
  if (!response.ok) throw new CalendarError(`meet_access_http_${response.status}`);
  const space = await response.json() as { config?: { accessType?: string } };
  if (space.config?.accessType !== 'RESTRICTED') throw new CalendarError('meet_access_not_restricted');
  return { meet_url: meetUrl };
}
