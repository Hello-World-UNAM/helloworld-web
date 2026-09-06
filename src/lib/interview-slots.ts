// Utilidades para generar y formatear slots de entrevista.

const MEXICO_CITY_TIME_ZONE = 'America/Mexico_City';

export type InterviewDay = {
  id: string;
  date: string;           // "YYYY-MM-DD"
  start_time: string;     // "HH:MM:SS"
  end_time: string;       // "HH:MM:SS"
  duration_minutes: number;
};

/**
 * Genera todos los Date objects de slots para un día dado.
 * Asume que la fecha es local (no UTC) — Supabase devuelve DATE como string.
 */
export function generateSlots(day: InterviewDay): Date[] {
  const slots: Date[] = [];
  const [y, m, d] = day.date.split('-').map(Number);
  const [sh, sm] = day.start_time.split(':').map(Number);
  const [eh, em] = day.end_time.split(':').map(Number);

  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const step     = day.duration_minutes;

  for (let t = startMin; t + step <= endMin; t += step) {
    const hour = Math.floor(t / 60);
    const min  = t % 60;
    slots.push(dateInMexicoCity(y, m, d, hour, min));
  }
  return slots;
}

/** "16:30" */
export function formatSlotTime(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: MEXICO_CITY_TIME_ZONE,
  }).format(date);
}

/** "Lun 12 mayo" */
export function formatDayShort(date: Date | string): string {
  const d = calendarDate(date);
  const wd = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: MEXICO_CITY_TIME_ZONE }).format(d);
  const parts = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'long', timeZone: MEXICO_CITY_TIME_ZONE,
  }).formatToParts(d);
  const dn = parts.find(part => part.type === 'day')?.value || '';
  const mo = parts.find(part => part.type === 'month')?.value || '';
  // Capitalizar primera letra y quitar punto del weekday
  const wdClean = wd.replace('.', '');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(wdClean)} ${dn} ${mo}`;
}

/** "Lunes 12 de mayo de 2027" */
export function formatDayLong(date: Date | string): string {
  const d = calendarDate(date);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: MEXICO_CITY_TIME_ZONE,
  }).format(d);
}

/** "Lunes 12 de mayo · 16:30" */
export function formatSlotFull(d: Date): string {
  const wdMo = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: MEXICO_CITY_TIME_ZONE,
  }).format(d);
  return `${wdMo} · ${formatSlotTime(d)}`;
}

/** Compara si dos fechas son el mismo día calendario */
export function sameDay(a: Date, b: Date): boolean {
  return mexicoDateKey(a) === mexicoDateKey(b);
}

/** Convierte un slot Date a string ISO (lo que Supabase espera) */
export function slotToIso(d: Date): string {
  return d.toISOString();
}

function calendarDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  const [year, month, day] = value.split('-').map(Number);
  return dateInMexicoCity(year, month, day, 12, 0);
}

function mexicoDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: MEXICO_CITY_TIME_ZONE,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateInMexicoCity(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = wallClockUtc;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MEXICO_CITY_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  });

  // Two passes account for offset changes around historical DST boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value || 0);
    const representedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
    candidate += wallClockUtc - representedAsUtc;
  }
  return new Date(candidate);
}
