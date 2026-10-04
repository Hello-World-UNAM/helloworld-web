import { renderSelectionNotice } from './selection-notification-templates.ts';
import {
  legacyBookingTemplate,
  legacyFinalAcceptedTemplate,
  legacyFinalRejectedTemplate,
  legacyInitialAcceptedTemplate,
  legacyInitialRejectedTemplate,
  legacyReceiptTemplate,
  neutralFinalAcceptedTemplate,
  neutralFinalRejectedTemplate,
  noShowFinalRejectedTemplate,
  type SelectionHtmlTemplate,
} from './selection-legacy-templates.ts';

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
export type SelectionInterviewOutcome = 'completed' | 'no_show' | 'none';

export interface SelectionMailPayload {
  nombre: string;
  season: string;
  decision?: SelectionDecision;
  stage?: SelectionStage;
  expires_at?: string;
  booking_url?: string;
  slot_datetime?: string;
  duration_minutes?: number;
  meet_url?: string;
  whatsapp_url?: string;
  interview_outcome?: SelectionInterviewOutcome;
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

function parsedDate(value: unknown, field: string): Date {
  const normalized = requiredText(value, field);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new SelectionMailTemplateError(`invalid_${field}`);
  }
  return parsed;
}

function formatLegacyDateLong(value: unknown, field: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: MEXICO_CITY_TIME_ZONE,
  }).format(parsedDate(value, field));
}

function formatLegacyTime(value: unknown, field: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MEXICO_CITY_TIME_ZONE,
  }).format(parsedDate(value, field));
}

function requiredDurationMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || ![15, 20, 30, 45, 60].includes(value)) {
    throw new SelectionMailTemplateError('invalid_duration_minutes');
  }
  return value;
}

function interviewOutcome(value: unknown): SelectionInterviewOutcome {
  if (value === undefined || value === null || value === '') return 'none';
  if (value === 'completed' || value === 'no_show' || value === 'none') {
    return value;
  }
  throw new SelectionMailTemplateError('invalid_interview_outcome');
}

const SOCIAL_TEXT = [
  'Mantente cerca:',
  'Instagram: https://www.instagram.com/helloworld_unam/',
  'LinkedIn: https://www.linkedin.com/in/hello-world-5243573b5/',
  'GitHub: https://github.com/Hello-World-UNAM',
].join('\n');

const LEGACY_FOOTER_TEXT = ['Club Hello World · FES Aragón, UNAM', 'Si tienes dudas, responde a este correo.'].join('\n');

function firstNameText(name: string): string {
  return name.split(' ')[0] || name;
}

function makeLegacyMail(template: SelectionHtmlTemplate, textParagraphs: string[], includeSocials = true): SelectionMail {
  return {
    subject: template.subject,
    text: [...textParagraphs, ...(includeSocials ? [SOCIAL_TEXT] : []), LEGACY_FOOTER_TEXT].join('\n\n'),
    html: template.html,
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
  const shortName = firstNameText(name);

  switch (kind) {
    case 'receipt': {
      const template = legacyReceiptTemplate(name, season);
      return makeLegacyMail(
        template,
        [
          `✦ Solicitud recibida · ${season}`,
          `Hola, ${shortName}.`,
          'Recibimos tu solicitud al Club Hello World. Está oficialmente en nuestras manos.',
          'Cada solicitud la lee alguien del equipo — no un algoritmo. Tomamos lo que escribiste en serio y lo revisaremos con calma.',
          'Te escribiremos a este correo cuando tengamos una decisión, sin importar cuál sea.',
          'Mientras tanto, si quieres ver qué hacemos en el día a día:\n@helloworld_unam — https://www.instagram.com/helloworld_unam/',
        ],
        false,
      );
    }

    case 'initial': {
      const decision = requiredDecision(payload.decision);
      if (decision === 'rejected') {
        const template = legacyInitialRejectedTemplate(name, season);
        return makeLegacyMail(template, [
          `Hola, ${shortName}.`,
          'Gracias por aplicar al Club Hello World. Tu solicitud fue revisada con detenimiento por miembros del equipo — no por un algoritmo.',
          'Lamentamos informarte que en esta temporada no pudimos avanzar con tu candidatura. La decisión no refleja una valoración de tu potencial; el proceso fue altamente competitivo y los espacios limitados.',
          'Te invitamos a postularte nuevamente en la próxima convocatoria. Mientras tanto, te animamos a seguir construyendo y aprendiendo — el crecimiento técnico es un camino que recorres con nosotros o sin nosotros.',
          '“El club no es la única forma de desarrollarse y seguir creciendo. Es solo una de miles.”',
        ]);
      }

      const bookingUrl = requiredUrl(payload.booking_url, 'booking_url');
      const expiresAt = formatLegacyDateLong(payload.expires_at, 'expires_at');
      const template = legacyInitialAcceptedTemplate(name, expiresAt, bookingUrl);
      return makeLegacyMail(template, [
        `${shortName}, queremos conocerte.`,
        'Tu solicitud nos convenció. Lo que escribiste resonó con nosotros: vimos a alguien que vale la pena conocer en persona.',
        'El siguiente paso es una entrevista corta con un par de personas del equipo. Queremos entender quién hay detrás de la solicitud y resolverte dudas que tengas sobre el club.',
        `Agenda tu entrevista:\n${bookingUrl}\n\nPor Google Meet. Tú eliges el horario que mejor te quede.\nTienes hasta el ${expiresAt} para agendar.`,
        'Qué esperar:',
        'Es una conversación corta con un par de personas del equipo. Queremos entender quién hay detrás de la solicitud y resolverte dudas que tengas sobre el club.',
        'No hay nada que preparar — lo que ya hiciste hasta hoy es suficiente.',
        '“El formulario nos dijo lo que has hecho. La entrevista nos dirá quién eres.”',
      ]);
    }

    case 'final': {
      const decision = requiredDecision(payload.decision);
      const outcome = interviewOutcome(payload.interview_outcome);
      if (decision === 'rejected') {
        if (outcome === 'completed') {
          const template = legacyFinalRejectedTemplate(name, season);
          return makeLegacyMail(template, [
            `Gracias, ${shortName}.`,
            'Llegaste hasta la entrevista, y eso ya te separa de la mayoría. Gracias por tomarte el tiempo de aplicar, agendar y conversar con nosotros.',
            'Lamentamos informarte que tras la evaluación del equipo, en esta temporada no pudimos avanzar con tu candidatura. La decisión no refleja una valoración de tu potencial; el proceso fue altamente competitivo y los espacios limitados.',
            'Te invitamos a postularte nuevamente en la próxima convocatoria. Mientras tanto, te animamos a seguir construyendo y aprendiendo — el crecimiento técnico es un camino que recorres con nosotros o sin nosotros.',
            '“El club no es la única forma de desarrollarse y seguir creciendo. Es solo una de miles.”',
          ]);
        }

        if (outcome === 'no_show') {
          const template = noShowFinalRejectedTemplate(name, season);
          return makeLegacyMail(template, [
            `Hola, ${shortName}.`,
            'No registramos tu asistencia a la entrevista que habías agendado con el equipo del Club Hello World.',
            'Como esa conversación forma parte indispensable del proceso, en esta temporada no podremos continuar con tu candidatura.',
            'Si ocurrió un problema o crees que recibiste este mensaje por error, responde a este correo para que podamos revisar tu caso.',
            '“El club no es la única forma de desarrollarse y seguir creciendo. Es solo una de miles.”',
          ]);
        }

        const template = neutralFinalRejectedTemplate(name, season);
        return makeLegacyMail(template, [
          `Hola, ${shortName}.`,
          `Después de concluir la revisión de tu proceso para la temporada ${season}, por esta ocasión no fuiste admitido(a) al Club Hello World.`,
          'Agradecemos sinceramente tu interés y el tiempo que dedicaste a participar.',
        ]);
      }

      const whatsappUrl = requiredUrl(payload.whatsapp_url, 'whatsapp_url');
      if (outcome === 'completed') {
        const template = legacyFinalAcceptedTemplate(name, season, whatsappUrl);
        return makeLegacyMail(template, [
          `Estás dentro, ${shortName}.`,
          `Después del formulario, la entrevista y la deliberación del equipo, quedó claro: te queremos en el Club Hello World, temporada ${season}.`,
          'Lo que escribiste y lo que conversamos contigo nos convenció — ahora sí eres parte de esta generación.',
          `El primer paso para sumarte es entrar al grupo de WhatsApp del club. Ahí coordinamos todo: reuniones, eventos, proyectos, hackatones.\n${whatsappUrl}`,
          'Qué sigue:',
          'En el grupo coordinaremos la primera reunión. Llegarán los detalles de cuando arrancamos y cómo nos organizamos.',
          'Bienvenida/o oficialmente. A construir, competir y dejar huella.',
          '“Ahora sí empieza lo bueno. Nos vemos adentro.”',
        ]);
      }

      const template = neutralFinalAcceptedTemplate(name, season, whatsappUrl);
      return makeLegacyMail(template, [
        `Hola, ${shortName}.`,
        `Nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${season}.`,
        '¡Bienvenido(a) al Club Hello World!',
        `Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp:\n${whatsappUrl}`,
      ]);
    }

    case 'rectification': {
      const decision = requiredDecision(payload.decision);
      const stage = requiredStage(payload.stage);
      const accepted = decision === 'accepted';
      const initial = stage === 'initial';
      const subject = `Corrección de ${initial ? 'tu solicitud' : 'tu resultado final'} · ${season}`;
      const paragraphs = ['Queremos corregir la comunicación que recibiste anteriormente. Disculpa la confusión.'];
      paragraphs.push(initial
        ? (accepted ? `Tu solicitud para la temporada ${season} fue aceptada para continuar a la etapa de entrevistas.` : `Después de actualizar la revisión de tu solicitud para la temporada ${season}, por esta ocasión no continuarás a la etapa de entrevistas. Gracias por el interés y el tiempo que dedicaste a postularte.`)
        : (accepted ? `Nos da mucho gusto confirmarte que fuiste admitido(a) al Club Hello World para la temporada ${season}. ¡Bienvenido(a)!` : `El resultado final de tu proceso para la temporada ${season} es que, por esta ocasión, no fuiste admitido(a) al Club Hello World. Agradecemos sinceramente tu participación.`));
      const expiresAt = accepted && initial ? optionalDate(payload.expires_at, 'expires_at') : null;
      if (accepted && initial && !expiresAt) throw new SelectionMailTemplateError('missing_expires_at');
      return renderSelectionNotice({ subject, heading: accepted ? (initial ? `${shortName}, queremos conocerte.` : `Bienvenido(a), ${shortName}.`) : `Una actualización para ti, ${shortName}.`,
        eyebrow: `✦ Corrección ${initial ? 'de solicitud' : 'final'} · ${season}`, tone: accepted ? 'success' : 'notice', paragraphs,
        detail: expiresAt ? { label: 'Puedes agendar hasta', text: expiresAt } : undefined,
        action: accepted ? (initial
          ? { label: 'Agendar entrevista →', url: requiredUrl(payload.booking_url, 'booking_url'), description: 'Elige el horario que mejor te quede entre las opciones disponibles.' }
          : { label: 'Entrar al WhatsApp →', url: requiredUrl(payload.whatsapp_url, 'whatsapp_url'), description: 'Únete al grupo del club para recibir indicaciones y conocer los siguientes pasos.' }) : undefined,
        closing: 'Este mensaje sustituye la comunicación anterior. Si algo no queda claro, responde a este correo: estamos para ayudarte.',
      });
    }

    case 'booking': {
      const dateLong = formatLegacyDateLong(payload.slot_datetime, 'slot_datetime');
      const time = formatLegacyTime(payload.slot_datetime, 'slot_datetime');
      const durationMinutes = requiredDurationMinutes(payload.duration_minutes);
      const meetUrl = requiredUrl(payload.meet_url, 'meet_url');
      const manageUrl = requiredUrl(payload.booking_url, 'booking_url');
      const template = legacyBookingTemplate({
        nombre: name,
        dateLong,
        time,
        durationMinutes,
        meetUrl,
        manageUrl,
      });
      return makeLegacyMail(
        template,
        [
          `Listo, ${shortName}.`,
          'Tu entrevista con el equipo del Club Hello World está confirmada.',
          `Cuándo:\n${dateLong}\n${time} hrs · ${durationMinutes} minutos`,
          `Dónde:\n${meetUrl}`,
          'Solicita entrar a tu hora; el equipo te admitirá cuando termine la entrevista anterior.',
          'Antes de tu entrevista:',
          '• Llega 1 minuto antes y verifica tu cámara y micrófono.\n• Si surge algo, escríbenos con al menos 12 h de anticipación.\n• Llega tú — nada que preparar.',
          `¿Necesitas cambiar de horario? Gestiona tu entrevista aquí:\n${manageUrl}`,
        ],
        false,
      );
    }

    case 'cancellation': {
      const slot = optionalDate(payload.slot_datetime, 'slot_datetime');
      return renderSelectionNotice({ subject: `Entrevista cancelada · ${season}`, heading: `Tu cita fue cancelada, ${shortName}.`,
        eyebrow: `✦ Entrevista cancelada · ${season}`, tone: 'notice',
        paragraphs: [`Tu entrevista para la temporada ${season} fue cancelada y el horario quedó liberado.`, 'Si deseas elegir otra cita, revisa las opciones de tu invitación.'],
        detail: slot ? { label: 'Cita cancelada', text: slot } : undefined,
        action: { label: 'Revisar opciones para reagendar →', url: requiredUrl(payload.booking_url, 'booking_url'), description: 'Podrás agendar otra entrevista si tu invitación sigue vigente y hay horarios disponibles.' },
        closing: 'Cancelar una cita no amplía el plazo para agendar. Si el plazo venció o necesitas ayuda, responde a este correo para que el equipo revise tu caso.',
      });
    }

    case 'deadline': {
      const expiresAt = formatMexicoCityDate(requiredText(payload.expires_at, 'expires_at'));
      return renderSelectionNotice({ subject: `Ampliamos tu plazo para agendar · ${season}`, heading: `Tienes más tiempo, ${shortName}.`,
        eyebrow: `✦ Ampliación del plazo · ${season}`, tone: 'success',
        paragraphs: [`Ampliamos el plazo de tu invitación a entrevista para la temporada ${season}. Si aún no has elegido horario, puedes hacerlo desde tu enlace personal.`],
        detail: { label: 'Nueva fecha límite para agendar', text: expiresAt },
        action: { label: 'Agendar entrevista →', url: requiredUrl(payload.booking_url, 'booking_url'), description: 'Revisa los horarios disponibles y elige el que mejor te quede.' },
        closing: 'Si ya tienes una cita confirmada, consérvala: no necesitas volver a agendar. Si necesitas ayuda, responde a este correo.',
      });
    }

    case 'reminder': {
      const expiresAt = formatMexicoCityDate(requiredText(payload.expires_at, 'expires_at'));
      return renderSelectionNotice({ subject: `Recordatorio: agenda tu entrevista · ${season}`, heading: `Nos falta tu horario, ${shortName}.`,
        eyebrow: `✦ Recordatorio de agenda · ${season}`, tone: 'notice',
        paragraphs: [`Tu invitación a entrevista para la temporada ${season} sigue pendiente de agendar. Aún puedes elegir un horario entre las opciones disponibles.`],
        detail: { label: 'Tu plazo para agendar termina', text: expiresAt },
        action: { label: 'Agendar entrevista →', url: requiredUrl(payload.booking_url, 'booking_url'), description: 'Elige el horario que mejor te quede antes de que venza tu invitación.' },
        closing: '¿Tienes alguna duda o dificultad para agendar? Responde a este correo y te ayudamos.',
      });
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
