DO $$
DECLARE
  v_member_id UUID;
BEGIN

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alanarrieta26@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Alan Alejandro Arrieta Flores', 'alanarrieta26@aragon.unam.mx', '321047526', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_3er_lugar', 'approved', NULL, false, 'https://drive.google.com/open?id=1iMOtoHXnjJx0KXJ1P8HwqxnW_QBtdhra', 400, 400, '2026-03-25T23:14:48.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alanarrieta26@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Alan Alejandro Arrieta Flores', 'alanarrieta26@aragon.unam.mx', '321047526', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, true, 'https://drive.google.com/open?id=1hLTxuA_fdJuM4Aj5IjP9tJngfwGdTI-5', 450, 450, '2026-03-27T02:30:50.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'danielcortes86@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Aldo Daniel Ramírez Cortés', 'danielcortes86@aragon.unam.mx', '321304586', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, false, 'https://drive.google.com/open?id=10GV6YmqcFz5qLJA_KJZkauExsJE5_ZYg', 300, 300, '2026-03-24T19:03:44.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'danielcortes86@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Aldo Daniel Ramírez Cortés', 'danielcortes86@aragon.unam.mx', '321304586', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=13BgDhE7LQL91guVQ3EFwa0p3pHHDsruY', 50, 50, '2026-03-24T19:05:49.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'danielcortes86@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Aldo Daniel Ramírez Cortés', 'danielcortes86@aragon.unam.mx', '321304586', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, true, 'https://drive.google.com/open?id=1Z8GZ5igOZaoehIsF90OxY5lXtTAkB4VM', 450, 450, '2026-03-24T19:08:30.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'anamartinez321@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ana Guadalupe Martinez Colón', 'anamartinez321@aragon.unam.mx', '321007861', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=12T0BHAVldrvK1P2VTH-mxrdJV_JQ_buE', 50, 50, '2026-03-24T18:19:26.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'anamartinez321@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ana Guadalupe Martinez Colón', 'anamartinez321@aragon.unam.mx', '321007861', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, true, 'https://drive.google.com/open?id=1-6nUynYtTSaTB0GIv-OzIzEQlA0E9wAb', 450, 450, '2026-03-24T02:54:30.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'anamartinez321@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ana Guadalupe Martinez Colón', 'anamartinez321@aragon.unam.mx', '321007861', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=1-9BfADlNf9P8h3vrIwSce78ZRZAyU2dd', 50, 50, '2026-03-24T18:54:34.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'anamartinez321@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ana Guadalupe Martinez Colón', 'anamartinez321@aragon.unam.mx', '321007861', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=1PZys4HkF9sQ6IdJLl1o-cU9nQhoNnZRP', 50, 50, '2026-03-28T16:07:35.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'angelvelazquez321@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Angel Velazquez Bastida', 'angelvelazquez321@aragon.unam.mx', '321146856', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_3er_lugar', 'approved', NULL, false, 'https://drive.google.com/open?id=1Ap0AqzVPfo1FK6ZpK5b0fePMrxeyVlG9', 400, 400, '2026-03-26T16:02:38.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'davidhernandez911@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'David Hernández Reyes', 'davidhernandez911@aragon.unam.mx', '321678911', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_3er_lugar', 'approved', NULL, false, 'https://drive.google.com/open?id=1HyKWA_OP66Yrh2RClWbgmocGoS5oTyjT', 400, 400, '2026-03-24T19:01:00.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'davidhernandez911@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'David Hernández Reyes', 'davidhernandez911@aragon.unam.mx', '321267911', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=1yWArrgSLgdaXZT8xAavGZfBC_xTUocAd', 50, 50, '2026-03-24T19:03:46.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'erickmartinez20@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Erick Martínez Figueroa', 'erickmartinez20@aragon.unam.mx', '318358820', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, true, 'https://drive.google.com/open?id=1EXa04lHcOsxUrcsf-saOlFq5qGyQMnNW', 450, 450, '2026-03-26T16:08:46.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alejandrolugo45@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ian Alejandro Lugo Flores', 'alejandrolugo45@aragon.unam.mx', '321227445', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=1P29v7YSIXw8Bn0BCW1e4TwzG8hKAlQLm', 50, 50, '2026-03-24T19:07:41.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alejandrolugo45@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ian Alejandro Lugo Flores', 'alejandrolugo45@aragon.unam.mx', '321227445', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_1er_lugar', 'approved', NULL, false, 'https://drive.google.com/open?id=1TJtDsFd_t1GbyoxysbRaXqk8SLiGmw5q', 600, 600, '2026-03-24T19:05:42.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alejandrolugo45@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ian Alejandro Lugo Flores', 'alejandrolugo45@aragon.unam.mx', '321227445', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'asistir_charla', 'approved', NULL, false, 'https://drive.google.com/open?id=1DdPPkbHx8cbmY_YjYL9mqKRQIL9TlBGK', 50, 50, '2026-03-24T19:11:50.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'alejandrolugo45@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Ian Alejandro Lugo Flores', 'alejandrolugo45@aragon.unam.mx', '321227445', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'approved', NULL, true, 'https://drive.google.com/open?id=1BXmlTIP9bQQFV6yRo0RwLjZi9HeSRQoC', 450, 450, '2026-03-24T19:13:53.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'jessicaalmaguer422@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Jessica Almaguer Paredes', 'jessicaalmaguer422@aragon.unam.mx', '422038234', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_2do_lugar', 'approved', NULL, false, '', 500, 500, '2026-03-24T20:18:35.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'julianhall16@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Julian Collado Hall', 'julianhall16@aragon.unam.mx', '320103616', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'rejected', NULL, false, 'https://drive.google.com/open?id=1sSd2YYVUImLQVD06KnpAoSHFMQQCwWzo', 300, 0, '2026-04-14T01:25:12.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'julianhall16@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Julián Collado Hall', 'julianhall16@aragon.unam.mx', '320103616', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_1er_lugar', 'approved', NULL, false, 'https://drive.google.com/open?id=1Uz_NCuF0o1scH2ZDLcZZ_mQsnOLq0qsa', 600, 600, '2026-03-27T23:06:41.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_1er_lugar', 'pending', NULL, false, 'https://drive.google.com/open?id=1PSMxgefcfXM2_o3dYMP7yfo0LXihGk6W', 600, 0, '2026-05-18T06:33:22.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_1er_lugar', 'pending', NULL, true, 'https://drive.google.com/open?id=1MSSDJKLQgMeEPUXiqDhc5y2HdSkdHcb4', 1200, 0, '2026-05-18T06:36:18.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=1aJ59tlhTp4khY8A3aWE2ji7wZl8nK3Co', 10, 0, '2026-05-18T06:48:51.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=1W3IIwFNCbgncL0OHy0eVztNKBCrHIry1', 10, 0, '2026-05-18T06:49:33.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=12SUZv7Q6oewRgjXMxYz2mNFGtbtY4vKh', 10, 0, '2026-05-18T06:50:26.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=13TKdl6Qs7qGPzNWByKpf-UPEACvA4WEQ', 10, 0, '2026-05-18T06:51:11.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=13PFWSl8WBgByX4vwiHBQk8K6W34vul8d', 10, 0, '2026-05-18T06:51:55.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=1VR6OTJhms_obMJOwdjliSwkoDCNVVsME', 10, 0, '2026-05-18T06:52:36.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=1_6lJbj-3p7ujPykhe75-59P_U1Ssvo0a', 10, 0, '2026-05-18T06:53:17.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'completar_capacitacion', 'pending', 2, false, 'https://drive.google.com/open?id=1DigW9LANTOowz35ohiglEe7IHUhMO2Zu', 10, 0, '2026-05-18T06:53:56.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'pending', NULL, true, 'https://drive.google.com/open?id=1FQ8BP_uwvNYS8OEK4-mIXi5hSomJKeHG', 450, 0, '2026-05-18T06:54:44.000Z');

  SELECT id INTO v_member_id FROM miembros_activos WHERE correo = 'federicocaldera39@aragon.unam.mx';
  IF NOT FOUND THEN
    v_member_id := gen_random_uuid();
    INSERT INTO miembros_activos (id, nombre, correo, numero_cuenta, puntos_totales)
    VALUES (v_member_id, 'Victor Federico Caldera Arellano', 'federicocaldera39@aragon.unam.mx', '321222639', 0);
  END IF;

  INSERT INTO puntos_registros (miembro_id, config_id, estado_aprobacion, horas_reportadas, es_evento_externo, url_evidencia, puntos_solicitados, puntos_aprobados, created_at)
  VALUES (v_member_id, 'hackathon_participar', 'pending', NULL, false, 'https://drive.google.com/open?id=1yvE-vdIj_YzNcP961dvs5AOcm0tFnu76', 300, 0, '2026-05-18T06:58:04.000Z');

  UPDATE miembros_activos m
  SET puntos_totales = COALESCE((
    SELECT SUM(puntos_aprobados)
    FROM puntos_registros p
    WHERE p.miembro_id = m.id AND p.estado_aprobacion = 'approved'
  ), 0);
END $$;
