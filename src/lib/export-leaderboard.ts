// Genera un Excel con las evidencias aprobadas de un período,
// agrupadas por miembro y ordenadas por total de puntos DESC.
// Diseñado como declaración a Jefatura de la Facultad para
// asignación de "Horas de formación complementaria".

import type { SupabaseClient } from '@supabase/supabase-js';

type PuntosRow = {
  id: string;
  created_at: string;
  horas_reportadas: number | null;
  es_evento_externo: boolean | null;
  url_evidencia: string | null;
  puntos_aprobados: number;
  miembros_activos: {
    id: string;
    nombre: string;
    correo: string;
    numero_cuenta: string;
  };
  leaderboard_config: {
    accion: string;
  } | null;
};

type MiembroBucket = {
  id: string;
  nombre: string;
  correo: string;
  numero_cuenta: string;
  totalPts: number;
  registros: PuntosRow[];
};

// Colores del club (ver DESIGN.md)
const COLORS = {
  purple: 'FF6225E6',
  purpleSoft: 'FFF9F3FF',
  purpleLight: 'FFF0E6FF',
  black: 'FF000000',
  white: 'FFFFFFFF',
  yellow: 'FFFEF08A',
  yellowBorder: 'FFCA8A04',
  gray: 'FF666666',
};

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchLogo(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/img/logo.png');
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function exportLeaderboardToExcel(
  supabase: SupabaseClient,
  periodoId: string,
  periodoNombre: string
): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');

  const { data, error } = await supabase
    .from('puntos_registros')
    .select(`
      id, created_at, horas_reportadas, es_evento_externo, url_evidencia, puntos_aprobados,
      miembros_activos!inner(id, nombre, correo, numero_cuenta),
      leaderboard_config(accion)
    `)
    .eq('periodo_id', periodoId)
    .eq('estado_aprobacion', 'approved');

  if (error) throw new Error(`Error obteniendo evidencias: ${error.message}`);

  const rows = (data || []) as unknown as PuntosRow[];

  if (rows.length === 0) {
    throw new Error('No hay evidencias aprobadas en este período. Nada que exportar.');
  }

  // Agrupar por miembro
  const buckets = new Map<string, MiembroBucket>();
  for (const r of rows) {
    const m = r.miembros_activos;
    if (!m) continue;
    let b = buckets.get(m.id);
    if (!b) {
      b = {
        id: m.id,
        nombre: m.nombre,
        correo: m.correo,
        numero_cuenta: m.numero_cuenta,
        totalPts: 0,
        registros: [],
      };
      buckets.set(m.id, b);
    }
    b.registros.push(r);
    b.totalPts += r.puntos_aprobados || 0;
  }

  // Orden: total puntos DESC, tiebreak alfabético
  const grupos = Array.from(buckets.values()).sort((a, b) => {
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Club Hello World';
  workbook.created = new Date();
  const ws = workbook.addWorksheet('Leaderboard', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Column widths (5 columnas: #, Categoría, Tipo, Duración, Evidencia)
  ws.columns = [
    { width: 6 },   // A
    { width: 42 },  // B
    { width: 18 },  // C
    { width: 20 },  // D
    { width: 55 },  // E
  ];

  // ─── ENCABEZADO ────────────────────────────────────────────────
  // Row 1-3: banner morado con logo + título
  ws.mergeCells('A1:E3');
  const titleCell = ws.getCell('A1');
  titleCell.value = `HELLO WORLD — LEADERBOARD ${periodoNombre.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: COLORS.white } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.purple } };
  ws.getRow(1).height = 30;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 30;

  // Logo embebido
  const logoBuf = await fetchLogo();
  if (logoBuf) {
    const imgId = workbook.addImage({ buffer: logoBuf, extension: 'png' });
    ws.addImage(imgId, {
      tl: { col: 0.15, row: 0.2 },
      ext: { width: 70, height: 70 },
    });
  }

  // Row 4: subtítulo
  ws.mergeCells('A4:E4');
  const subCell = ws.getCell('A4');
  subCell.value = `Declaración de evidencias aprobadas · Reporte generado el ${todayStamp()} · ${grupos.length} miembros · ${rows.length} evidencias`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: COLORS.gray } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.purpleSoft } };
  ws.getRow(4).height = 20;

  // Row 5: instrucción para jefatura
  ws.mergeCells('A5:E5');
  const noteCell = ws.getCell('A5');
  noteCell.value = 'Nota: las celdas amarillas al final de cada miembro son para que Jefatura asigne las horas de formación complementaria.';
  noteCell.font = { name: 'Arial', size: 9, color: { argb: COLORS.gray } };
  noteCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(5).height = 18;

  // ─── BLOQUES POR ALUMNO ────────────────────────────────────────
  let row = 7;

  for (const g of grupos) {
    // Banner del alumno (nombre)
    ws.mergeCells(`A${row}:E${row}`);
    const nameCell = ws.getCell(`A${row}`);
    nameCell.value = g.nombre.toUpperCase();
    nameCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: COLORS.white } };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.purple } };
    ws.getRow(row).height = 24;
    row++;

    // Sub-info: cuenta + correo
    ws.mergeCells(`A${row}:E${row}`);
    const infoCell = ws.getCell(`A${row}`);
    infoCell.value = `Cuenta: ${g.numero_cuenta}     ·     Correo: ${g.correo}     ·     Evidencias: ${g.registros.length}`;
    infoCell.font = { name: 'Arial', size: 10, color: { argb: COLORS.black } };
    infoCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.purpleLight } };
    ws.getRow(row).height = 18;
    row++;

    // Headers de la tabla del alumno
    const headers = ['#', 'CATEGORÍA', 'TIPO DE EVENTO', 'DURACIÓN EN HORAS', 'EVIDENCIA'];
    headers.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.white } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.black } };
      c.border = {
        top: { style: 'medium', color: { argb: COLORS.black } },
        bottom: { style: 'medium', color: { argb: COLORS.black } },
        left: { style: 'thin', color: { argb: COLORS.black } },
        right: { style: 'thin', color: { argb: COLORS.black } },
      };
    });
    ws.getRow(row).height = 22;
    row++;

    // Filas de evidencia — ordenadas por categoría alfabéticamente
    const regsSorted = [...g.registros].sort((a, b) =>
      (a.leaderboard_config?.accion || '').localeCompare(b.leaderboard_config?.accion || '', 'es')
    );

    regsSorted.forEach((r, idx) => {
      const isAlt = idx % 2 === 1;
      const bg = isAlt ? COLORS.purpleSoft : COLORS.white;

      const values: (string | number | null)[] = [
        idx + 1,
        r.leaderboard_config?.accion || '—',
        r.es_evento_externo === null ? '' : r.es_evento_externo ? 'Externo' : 'Interno',
        r.horas_reportadas ?? '',
        r.url_evidencia || '',
      ];

      values.forEach((v, i) => {
        const c = ws.getCell(row, i + 1);
        c.value = v;
        c.font = { name: 'Arial', size: 10, color: { argb: COLORS.black } };
        c.alignment = {
          vertical: 'middle',
          horizontal: i === 1 || i === 4 ? 'left' : 'center',
          wrapText: true,
          indent: i === 1 || i === 4 ? 1 : 0,
        };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.border = {
          top: { style: 'thin', color: { argb: COLORS.gray } },
          bottom: { style: 'thin', color: { argb: COLORS.gray } },
          left: { style: 'thin', color: { argb: COLORS.black } },
          right: { style: 'thin', color: { argb: COLORS.black } },
        };
      });

      // Hipervínculo en columna E
      if (r.url_evidencia) {
        const linkCell = ws.getCell(row, 5);
        linkCell.value = { text: r.url_evidencia, hyperlink: r.url_evidencia };
        linkCell.font = {
          name: 'Arial', size: 10, color: { argb: COLORS.purple }, underline: true,
        };
      }

      ws.getRow(row).height = 22;
      row++;
    });

    // Fila de TOTAL HORAS para Jefatura (celda vacía amarilla)
    const labelCell = ws.getCell(row, 1);
    ws.mergeCells(row, 1, row, 3);
    labelCell.value = 'TOTAL HORAS ASIGNADAS POR JEFATURA →';
    labelCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLORS.black } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.purpleLight } };
    labelCell.border = {
      top: { style: 'medium', color: { argb: COLORS.black } },
      bottom: { style: 'medium', color: { argb: COLORS.black } },
      left: { style: 'medium', color: { argb: COLORS.black } },
      right: { style: 'thin', color: { argb: COLORS.black } },
    };

    const inputCell = ws.getCell(row, 4);
    ws.mergeCells(row, 4, row, 5);
    inputCell.value = null;
    inputCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.yellow } };
    inputCell.border = {
      top: { style: 'medium', color: { argb: COLORS.yellowBorder } },
      bottom: { style: 'medium', color: { argb: COLORS.yellowBorder } },
      left: { style: 'medium', color: { argb: COLORS.yellowBorder } },
      right: { style: 'medium', color: { argb: COLORS.yellowBorder } },
    };
    inputCell.alignment = { vertical: 'middle', horizontal: 'center' };
    inputCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: COLORS.black } };
    ws.getRow(row).height = 28;
    row++;

    // Spacer entre alumnos
    ws.getRow(row).height = 12;
    row++;
  }

  // ─── DESCARGA ─────────────────────────────────────────────────
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safePeriodo = periodoNombre.replace(/[^\w\-]+/g, '-');
  const fileName = `HelloWorld_Leaderboard_${safePeriodo}_${fileStamp()}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
