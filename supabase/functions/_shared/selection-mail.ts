export const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';

export const SELECTION_MAIL_KINDS = [
  'receipt',
  'initial',
  'final',
  'rectification',
  'booking',
  'cancellation',
  'deadline',
  'reminder',
] as const;

export type SelectionMailKind = (typeof SELECTION_MAIL_KINDS)[number];
export type SelectionDecision = 'accepted' | 'rejected';
export type SelectionStage = 'initial' | 'final';

export interface SelectionMailPayload {
  nombre: string;
  season: string;
  decision?: SelectionDecision;
  stage?: SelectionStage;
  expires_at?: string;
  booking_url?: string;
  slot_datetime?: string;
  meet_url?: string;
  whatsapp_url?: string;
  /** Internal context only. It is deliberately never rendered. */
  reason?: string;
}

export interface SelectionMail {
  subject: string;
  text: string;
  html: string;
}

export interface SelectionMailTag {
  name: string;
  value: string;
}

export interface SelectionMailRequestBody extends SelectionMail {
  from: string;
  to: string[];
  tags: SelectionMailTag[];
}

export class SelectionMailTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelectionMailTemplateError';
  }
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function replaceControlCharacters(value: string): string {
  let normalized = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControl =
      (codePoint >= 0 && codePoint <= 0x1f) ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029;
    normalized += isControl ? ' ' : character;
  }

  return normalized;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new SelectionMailTemplateError(`missing_${field}`);
  }

  const normalized = replaceControlCharacters(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new SelectionMailTemplateError(`missing_${field}`);
  }

  return normalized;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return requiredText(value, field);
}

function requiredUrl(value: unknown, field: string): string {
  const normalized = requiredText(value, field);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new SelectionMailTemplateError(`invalid_${field}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SelectionMailTemplateError(`invalid_${field}`);
  }

  return normalized;
}

function optionalUrl(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return requiredUrl(value, field);
}

function requiredDecision(value: unknown): SelectionDecision {
  if (value !== 'accepted' && value !== 'rejected') {
    throw new SelectionMailTemplateError('missing_decision');
  }

  return value;
}

function requiredStage(value: unknown): SelectionStage {
  if (value !== 'initial' && value !== 'final') {
    throw new SelectionMailTemplateError('missing_stage');
  }

  return value;
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new SelectionMailTemplateError('invalid_datetime');
  }

  return value;
}

export function formatMexicoCityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SelectionMailTemplateError('invalid_datetime');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(parsed);

  const monthIndex = Number(datePart(parts, 'month')) - 1;
  const month = MONTHS_ES[monthIndex];
  if (!month) {
    throw new SelectionMailTemplateError('invalid_datetime');
  }

  const day = datePart(parts, 'day');
  const year = datePart(parts, 'year');
  const hour = datePart(parts, 'hour');
  const minute = datePart(parts, 'minute').padStart(2, '0');
  const period = datePart(parts, 'dayPeriod').toUpperCase() === 'AM' ? 'a.m.' : 'p.m.';

  return `${day} de ${month} de ${year}, ${hour}:${minute} ${period} (hora de Ciudad de México)`;
}

function optionalDate(value: unknown, field: string): string | undefined {
  const normalized = optionalText(value, field);
  return normalized ? formatMexicoCityDate(normalized) : undefined;
}

function linkHtml(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
}

function htmlShell(heading: string, paragraphs: string[]): string {
  const body = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');

  return [
    '<!doctype html>',
    '<html lang="es">',
    '<body style="margin:0;background:#f7f5ff;color:#111;font-family:Arial,sans-serif;line-height:1.55;">',
    '<main style="max-width:640px;margin:0 auto;padding:32px 24px;background:#fff;">',
    `<h1 style="font-size:24px;line-height:1.2;margin:0 0 24px;">${escapeHtml(heading)}</h1>`,
    body,
    '<p style="margin-top:32px;color:#666;font-size:13px;">Club Hello World · FES Aragón UNAM</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
}

function makeMail(subject: string, textParagraphs: string[], htmlParagraphs: string[]): SelectionMail {
  return {
    subject,
    text: [...textParagraphs, 'Club Hello World · FES Aragón UNAM'].join('\n\n'),
    html: htmlShell(subject, htmlParagraphs),
  };
}

export function renderSelectionMail(
  kind: SelectionMailKind,
  payload: SelectionMailPayload,
): SelectionMail {
  const name = requiredText(payload.nombre, 'nombre');
  const season = requiredText(payload.season, 'season');
  const safeName = escapeHtml(name);
  const safeSeason = escapeHtml(season);

  switch (kind) {
    case 'receipt': {
      const subject = `Recibimos tu solicitud · ${season}`;
      return makeMail(
        subject,
        [
          `Hola, ${name}.`,
          `Recibimos tu solicitud para ingresar al Club Hello World en la temporada ${season}.`,
          'El equipo la revisará y te avisará por correo cuando haya una actualización.',
        ],
        [
          `Hola, ${safeName}.`,
          `Recibimos tu solicitud para ingresar al Club Hello World en la temporada ${safeSeason}.`,
          'El equipo la revisará y te avisará por correo cuando haya una actualización.',
        ],
      );
    }

    case 'initial': {
      const decision = requiredDecision(payload.decision);
      if (decision === 'rejected') {
        const subject = `Actualización de tu solicitud · ${season}`;
        return makeMail(
          subject,
          [
            `Hola, ${name}.`,
            `Después de revisar tu solicitud para la temporada ${season}, por esta ocasión no continuarás a la siguiente etapa.`,
            'Agradecemos el tiempo que dedicaste a participar.',
          ],
          [
            `Hola, ${safeName}.`,
            `Después de revisar tu solicitud para la temporada ${safeSeason}, por esta ocasión no continuarás a la siguiente etapa.`,
            'Agradecemos el tiempo que dedicaste a participar.',
          ],
        );
      }

      const bookingUrl = requiredUrl(payload.booking_url, 'booking_url');
      const expiresAt = optionalDate(payload.expires_at, 'expires_at');
      if (!expiresAt) {
        throw new SelectionMailTemplateError('missing_expires_at');
      }

      const subject = `Siguiente paso de tu solicitud · ${season}`;
      return makeMail(
        subject,
        [
          `Hola, ${name}.`,
          `Tu solicitud para la temporada ${season} fue aceptada para continuar al proceso de entrevista.`,
          `Agenda tu entrevista aquí:\n${bookingUrl}`,
          `El enlace estará disponible hasta ${expiresAt}.`,
        ],
        [
          `Hola, ${safeName}.`,
          `Tu solicitud para la temporada ${safeSeason} fue aceptada para continuar al proceso de entrevista.`,
          `Agenda tu entrevista aquí: ${linkHtml(bookingUrl, 'Agendar entrevista')}`,
          `El enlace estará disponible hasta ${escapeHtml(expiresAt)}.`,
        ],
      );
    }

    case 'final': {
      const decision = requiredDecision(payload.decision);
      if (decision === 'rejected') {
        const subject = `Resultado de tu proceso · ${season}`;
        return makeMail(
          subject,
          [
            `Hola, ${name}.`,
            `Después de concluir la revisión de tu proceso para la temporada ${season}, por esta ocasión no fuiste admitido(a) al Club Hello World.`,
            'Agradecemos sinceramente tu interés y el tiempo que dedicaste a participar.',
          ],
          [
            `Hola, ${safeName}.`,
            `Después de concluir la revisión de tu proceso para la temporada ${safeSeason}, por esta ocasión no fuiste admitido(a) al Club Hello World.`,
            'Agradecemos sinceramente tu interés y el tiempo que dedicaste a participar.',
          ],
        );
      }

      const whatsappUrl = requiredUrl(payload.whatsapp_url, 'whatsapp_url');
      const subject = `Resultado de tu proceso · ${season}`;
      return makeMail(
        subject,
        [
          `Hola, ${name}.`,
          `Nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${season}.`,
          '¡Bienvenido(a) al Club Hello World!',
          `Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp:\n${whatsappUrl}`,
        ],
        [
          `Hola, ${safeName}.`,
          `Nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${safeSeason}.`,
          '¡Bienvenido(a) al Club Hello World!',
          `Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp: ${linkHtml(whatsappUrl, 'Unirme al grupo de WhatsApp')}`,
        ],
      );
    }

    case 'rectification': {
      const decision = requiredDecision(payload.decision);
      const stage = requiredStage(payload.stage);
      const subject = `Actualización corregida de tu proceso · ${season}`;
      if (decision === 'rejected') {
        return makeMail(
          subject,
          [
            `Hola, ${name}.`,
            `Actualizamos la decisión vigente sobre tu proceso de selección para la temporada ${season}: por esta ocasión no continuarás en el proceso.`,
            'Este mensaje sustituye la comunicación anterior.',
          ],
          [
            `Hola, ${safeName}.`,
            `Actualizamos la decisión vigente sobre tu proceso de selección para la temporada ${safeSeason}: por esta ocasión no continuarás en el proceso.`,
            'Este mensaje sustituye la comunicación anterior.',
          ],
        );
      }

      if (stage === 'initial') {
        const bookingUrl = requiredUrl(payload.booking_url, 'booking_url');
        const expiresAt = optionalDate(payload.expires_at, 'expires_at');
        if (!expiresAt) {
          throw new SelectionMailTemplateError('missing_expires_at');
        }

        return makeMail(
          subject,
          [
            `Hola, ${name}.`,
            `Corregimos la comunicación anterior: tu solicitud para la temporada ${season} fue aceptada para continuar al proceso de entrevista.`,
            `Agenda tu entrevista aquí:\n${bookingUrl}`,
            `El enlace estará disponible hasta ${expiresAt}.`,
            'Este mensaje sustituye la comunicación anterior.',
          ],
          [
            `Hola, ${safeName}.`,
            `Corregimos la comunicación anterior: tu solicitud para la temporada ${safeSeason} fue aceptada para continuar al proceso de entrevista.`,
            `Agenda tu entrevista aquí: ${linkHtml(bookingUrl, 'Agendar entrevista')}`,
            `El enlace estará disponible hasta ${escapeHtml(expiresAt)}.`,
            'Este mensaje sustituye la comunicación anterior.',
          ],
        );
      }

      const whatsappUrl = requiredUrl(payload.whatsapp_url, 'whatsapp_url');
      return makeMail(
        subject,
        [
          `Hola, ${name}.`,
          `Corregimos la comunicación anterior: nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${season}.`,
          '¡Bienvenido(a) al Club Hello World!',
          `Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp:\n${whatsappUrl}`,
          'Este mensaje sustituye la comunicación anterior.',
        ],
        [
          `Hola, ${safeName}.`,
          `Corregimos la comunicación anterior: nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${safeSeason}.`,
          '¡Bienvenido(a) al Club Hello World!',
          `Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp: ${linkHtml(whatsappUrl, 'Unirme al grupo de WhatsApp')}`,
          'Este mensaje sustituye la comunicación anterior.',
        ],
      );
    }

    case 'booking': {
      const slot = formatMexicoCityDate(requiredText(payload.slot_datetime, 'slot_datetime'));
      const meetUrl = requiredUrl(payload.meet_url, 'meet_url');
      const manageUrl = optionalUrl(payload.booking_url, 'booking_url');
      const subject = `Entrevista agendada · ${season}`;
      const textParagraphs = [
        `Hola, ${name}.`,
        `Tu entrevista para la temporada ${season} quedó agendada para el ${slot}.`,
        `Enlace de la entrevista:\n${meetUrl}`,
      ];
      const htmlParagraphs = [
        `Hola, ${safeName}.`,
        `Tu entrevista para la temporada ${safeSeason} quedó agendada para el ${escapeHtml(slot)}.`,
        `Enlace de la entrevista: ${linkHtml(meetUrl, 'Abrir enlace de entrevista')}`,
      ];

      if (manageUrl) {
        textParagraphs.push(`Para revisar o gestionar tu reserva:\n${manageUrl}`);
        htmlParagraphs.push(`Para revisar o gestionar tu reserva: ${linkHtml(manageUrl, 'Gestionar reserva')}`);
      }

      return makeMail(subject, textParagraphs, htmlParagraphs);
    }

    case 'cancellation': {
      const slot = optionalDate(payload.slot_datetime, 'slot_datetime');
      const bookingUrl = optionalUrl(payload.booking_url, 'booking_url');
      const subject = `Entrevista cancelada · ${season}`;
      const textParagraphs = [
        `Hola, ${name}.`,
        slot
          ? `La entrevista que estaba agendada para el ${slot} fue cancelada y el horario quedó liberado.`
          : `Tu entrevista para la temporada ${season} fue cancelada y el horario quedó liberado.`,
        'Si el proceso sigue vigente, el equipo te indicará los siguientes pasos.',
      ];
      const htmlParagraphs = [
        `Hola, ${safeName}.`,
        slot
          ? `La entrevista que estaba agendada para el ${escapeHtml(slot)} fue cancelada y el horario quedó liberado.`
          : `Tu entrevista para la temporada ${safeSeason} fue cancelada y el horario quedó liberado.`,
        'Si el proceso sigue vigente, el equipo te indicará los siguientes pasos.',
      ];

      if (bookingUrl) {
        textParagraphs.push(`Puedes revisar las opciones disponibles aquí:\n${bookingUrl}`);
        htmlParagraphs.push(`Puedes revisar las opciones disponibles aquí: ${linkHtml(bookingUrl, 'Revisar opciones')}`);
      }

      return makeMail(subject, textParagraphs, htmlParagraphs);
    }

    case 'deadline': {
      const expiresAt = formatMexicoCityDate(requiredText(payload.expires_at, 'expires_at'));
      const bookingUrl = optionalUrl(payload.booking_url, 'booking_url');
      const subject = `Tu plazo para agendar termina pronto · ${season}`;
      const textParagraphs = [
        `Hola, ${name}.`,
        `Tu invitación para agendar entrevista de la temporada ${season} vence el ${expiresAt}.`,
      ];
      const htmlParagraphs = [
        `Hola, ${safeName}.`,
        `Tu invitación para agendar entrevista de la temporada ${safeSeason} vence el ${escapeHtml(expiresAt)}.`,
      ];

      if (bookingUrl) {
        textParagraphs.push(`Si aún no tienes una cita, agenda aquí:\n${bookingUrl}`);
        htmlParagraphs.push(`Si aún no tienes una cita, agenda aquí: ${linkHtml(bookingUrl, 'Agendar entrevista')}`);
      }

      return makeMail(subject, textParagraphs, htmlParagraphs);
    }

    case 'reminder': {
      const expiresAt = formatMexicoCityDate(requiredText(payload.expires_at, 'expires_at'));
      const bookingUrl = optionalUrl(payload.booking_url, 'booking_url');
      const subject = `Recordatorio: agenda tu entrevista · ${season}`;
      const textParagraphs = [
        `Hola, ${name}.`,
        `Este es un recordatorio de que tu invitación para agendar entrevista sigue pendiente y vence el ${expiresAt}.`,
      ];
      const htmlParagraphs = [
        `Hola, ${safeName}.`,
        `Este es un recordatorio de que tu invitación para agendar entrevista sigue pendiente y vence el ${escapeHtml(expiresAt)}.`,
      ];

      if (bookingUrl) {
        textParagraphs.push(`Agenda aquí:\n${bookingUrl}`);
        htmlParagraphs.push(`Agenda aquí: ${linkHtml(bookingUrl, 'Agendar entrevista')}`);
      }

      return makeMail(subject, textParagraphs, htmlParagraphs);
    }

    default: {
      const exhaustiveKind: never = kind;
      throw new SelectionMailTemplateError(`unsupported_kind_${exhaustiveKind}`);
    }
  }
}

export function buildSelectionMailRequestBody(
  kind: SelectionMailKind,
  payload: SelectionMailPayload,
  recipient: string,
  from: string,
  messageId: string | number,
): SelectionMailRequestBody {
  if (
    typeof recipient !== 'string' ||
    !recipient ||
    /[\r\n]/.test(recipient) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
  ) {
    throw new SelectionMailTemplateError('invalid_recipient');
  }

  if (typeof from !== 'string' || !from.trim() || /[\r\n]/.test(from)) {
    throw new SelectionMailTemplateError('invalid_from');
  }

  if (
    (typeof messageId !== 'string' && typeof messageId !== 'number') ||
    (typeof messageId === 'number' && !Number.isSafeInteger(messageId)) ||
    !String(messageId) ||
    /[\r\n]/.test(String(messageId))
  ) {
    throw new SelectionMailTemplateError('invalid_message_id');
  }

  const mail = renderSelectionMail(kind, payload);
  return {
    from,
    to: [recipient],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    tags: [{ name: 'selection_message_id', value: String(messageId) }],
  };
}

export function isSelectionMailRequestBody(
  value: unknown,
  messageId: string | number,
): value is SelectionMailRequestBody {
  if (
    (typeof messageId !== 'string' && typeof messageId !== 'number') ||
    (typeof messageId === 'number' && !Number.isSafeInteger(messageId))
  ) {
    return false;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const body = value as Record<string, unknown>;
  return (
    typeof body.from === 'string' &&
    !/[\r\n]/.test(body.from) &&
    Array.isArray(body.to) &&
    body.to.length > 0 &&
    body.to.every((recipient) => typeof recipient === 'string') &&
    typeof body.subject === 'string' &&
    typeof body.text === 'string' &&
    typeof body.html === 'string' &&
    Array.isArray(body.tags) &&
    body.tags.some(
      (tag) =>
        typeof tag === 'object' &&
        tag !== null &&
        !Array.isArray(tag) &&
        (tag as Record<string, unknown>).name === 'selection_message_id' &&
        (tag as Record<string, unknown>).value === String(messageId),
    )
  );
}
