// Utilidades para generar y formatear slots de entrevista.

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
    slots.push(new Date(y, m - 1, d, hour, min, 0, 0));
  }
  return slots;
}

/** "16:30" */
export function formatSlotTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "Lun 12 mayo" */
export function formatDayShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const wd = new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(d);
  const dn = d.getDate();
  const mo = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(d);
  // Capitalizar primera letra y quitar punto del weekday
  const wdClean = wd.replace('.', '');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(wdClean)} ${dn} ${mo}`;
}

/** "Lunes 12 de mayo de 2027" */
export function formatDayLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

/** "Lunes 12 de mayo · 16:30" */
export function formatSlotFull(d: Date): string {
  const wdMo = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
  return `${wdMo} · ${formatSlotTime(d)}`;
}

/** Compara si dos fechas son el mismo día calendario */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

/** Convierte un slot Date a string ISO (lo que Supabase espera) */
export function slotToIso(d: Date): string {
  return d.toISOString();
}
