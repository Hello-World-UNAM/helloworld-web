import fs from 'fs';
import { parse } from 'csv-parse/sync';

const csvData = fs.readFileSync('/home/sebs/Downloads/ranking_web - Respuestas de formulario 1.csv', 'utf8');

const recordsArray = parse(csvData, {
  skip_empty_lines: true
});

const headers = recordsArray[0].map(h => h.trim());
const rows = recordsArray.slice(1);

const categoryMap = {
  "Asistir a una charla": "asistir_charla",
  "Participar en un hackathon": "hackathon_participar",
  "1er lugar en hackathon": "hackathon_1er_lugar",
  "2do lugar en hackathon": "hackathon_2do_lugar",
  "3er lugar en hackathon": "hackathon_3er_lugar",
  "Completar una capacitación/taller": "completar_capacitacion"
};

function parseDate(dateStr) {
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  const time = timePart || '00:00:00';
  const paddedTime = time.split(':').map(t => t.padStart(2, '0')).join(':');
  return new Date(`${year}-${month}-${day}T${paddedTime}-06:00`).toISOString();
}

let sql = `DO $$
DECLARE
  v_member_id UUID;
BEGIN
`;

for (const row of rows) {
  const dateStr = row[0].trim();
  const nombre = row[1].trim().replace(/'/g, "''");
  const cuenta = row[2].trim().replace(/'/g, "''");
  const correo = row[3].trim().replace(/'/g, "''");
  const categoria = row[4].trim();
  const tipoEvento = row[6].trim();
  const duracionStr = row[8].trim();
  const puntosSolicitadosStr = row[10].trim();
  const validacionStr = row[11].trim();

  const url5 = row[5].trim();
  const url7 = row[7].trim();
  const url9 = row[9].trim();

  const configId = categoryMap[categoria];
  if (!configId) {
    console.error(`ERROR: Unknown category: ${categoria}`);
    process.exit(1);
  }

  let url = '';
  if (categoria === 'Completar una capacitación/taller') {
    url = url9;
  } else {
    url = url5 || url7 || url9;
  }

  if (url) {
    url = url.split(',')[0].trim().replace(/'/g, "''");
  }

  const esEventoExterno = (tipoEvento === 'Externo');
  const horasReportadas = duracionStr ? parseInt(duracionStr, 10) : 'NULL';
  const puntosSolicitados = puntosSolicitadosStr ? parseInt(puntosSolicitadosStr, 10) : 0;
  
  let estadoAprobacion = 'pending';
  let puntosAprobados = 0;

  if (validacionStr === '1') {
    estadoAprobacion = 'approved';
    puntosAprobados = puntosSolicitados;
  } else if (validacionStr === '0') {
    estadoAprobacion = 'rejected';
  }

  const createdAt = parseDate(dateStr);

  sql += `
  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = '${correo}';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, '${nombre}', '${correo}', '${cuenta}', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, '${configId}', '${estadoAprobacion}', ${horasReportadas}, ${esEventoExterno}, '${url}', ${puntosSolicitados}, ${puntosAprobados}, '${createdAt}');
`;
}

sql += `
  UPDATE miembros_activos m
  SET puntos_totales = COALESCE((
    SELECT SUM(puntos_aprobados)
    FROM puntos_registros p
    WHERE p.miembro_id = m.id AND p.estado_aprobacion = 'approved'
  ), 0);
END $$;
`;

fs.writeFileSync('migration_output.sql', sql);
console.log("SQL Migration script written to migration_output.sql");
