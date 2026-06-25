// Convención de semestres: "YYYY-N" donde N ∈ {1, 2}.
// Ej: "2027-1" = primer semestre del año 2027.
//
// Asumimos:
//   - Semestre 1: enero–julio (meses 1-7)
//   - Semestre 2: agosto–diciembre (meses 8-12)

export const SEMESTER_REGEX = /^[0-9]{4}-[12]$/;
export const LEGACY_REGEX   = /^[0-9]{4}-[0-9]{4}$/;

export function isSemesterFormat(s: string): boolean {
  return SEMESTER_REGEX.test(s);
}

export function isValidSeasonFormat(s: string): boolean {
  return SEMESTER_REGEX.test(s) || LEGACY_REGEX.test(s);
}

/**
 * Calcula el semestre lectivo correspondiente a una fecha dada.
 * Default: now().
 */
export function currentSemester(d: Date = new Date()): { year: number; sem: 1 | 2 } {
  const month = d.getMonth() + 1; // 1–12
  return {
    year: d.getFullYear(),
    sem: month <= 7 ? 1 : 2,
  };
}

/**
 * Devuelve el siguiente semestre dado uno cualquiera.
 */
export function nextSemester(year: number, sem: 1 | 2): { year: number; sem: 1 | 2 } {
  return sem === 1 ? { year, sem: 2 } : { year: year + 1, sem: 1 };
}

/**
 * Genera una lista de N semestres a partir del actual (incluido).
 * Útil para poblar el dropdown de "Abrir selecciones" en el panel admin.
 */
export function nextSemesters(count = 8, from: Date = new Date()): string[] {
  const result: string[] = [];
  let { year, sem } = currentSemester(from);
  for (let i = 0; i < count; i++) {
    result.push(`${year}-${sem}`);
    ({ year, sem } = nextSemester(year, sem));
  }
  return result;
}

/**
 * Formato amigable para mostrar al usuario.
 * "2027-1" → "Semestre 2027-1"
 */
export function formatSemesterDisplay(s: string): string {
  if (isSemesterFormat(s)) return `Semestre ${s}`;
  if (LEGACY_REGEX.test(s)) return `Ciclo ${s}`;
  return s;
}
