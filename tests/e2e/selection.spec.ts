import { test, expect } from '@playwright/test';

const fake = 'http://127.0.0.1:55439';
const ANA_ID = '00000000-0000-0000-0000-000000000011';

test.use({ timezoneId: 'Asia/Tokyo' });

test.beforeEach(async ({ request, context }) => {
  await request.post(`${fake}/__reset`);
  const jwt = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.org',
    role: 'authenticated',
    exp: 4102444800,
  })).toString('base64url')}.synthetic`;
  const session = {
    access_token: jwt,
    refresh_token: 'synthetic-refresh',
    token_type: 'bearer',
    expires_at: 4102444800,
    expires_in: 3600,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.org',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
    },
  };
  await context.addCookies([{
    name: 'sb-127-auth-token',
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: '127.0.0.1',
    path: '/',
  }]);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
});

test('Solicitudes comunica sólo las decisiones seleccionadas y elegibles', async ({ page, request }) => {
  await page.goto('/admin/solicitudes');
  await expect(page.locator('#count-all')).toHaveText('2');
  await expect(page.locator('#count-accepted')).toHaveText('1');
  await expect(page.locator('#progressive-select-all')).toHaveText(/Seleccionar todos/);

  await page.locator('#progressive-select-all').click();
  await expect(page.locator('#progressive-preview')).toHaveText(/Previsualizar lote \(1\)/);

  // La primera previsualización se descarta y no debe crear una cola.
  const firstDialog = page.waitForEvent('dialog');
  await page.locator('#progressive-preview').click();
  await (await firstDialog).dismiss();
  await expect(page.locator('#progressive-preview')).toBeEnabled();
  const callsBeforeConfirm = await (await request.get(`${fake}/__calls`)).json();
  expect(callsBeforeConfirm.filter((call: any) => call.action === 'confirm')).toHaveLength(0);

  const confirmDialog = page.waitForEvent('dialog');
  await page.locator('#progressive-preview').click();
  const dialog = await confirmDialog;
  expect(dialog.message()).toContain('Ana');
  await dialog.accept();
  await expect(page.locator('#progressive-preview')).toHaveText(/Previsualizar lote/);

  const calls = await (await request.get(`${fake}/__calls`)).json();
  const confirm = calls.find((call: any) => call.action === 'confirm');
  expect(confirm.data.items).toHaveLength(1);
  expect(confirm.data.items[0].id).toBe(ANA_ID);
  await expect(page.locator('[data-progressive-row]:checked')).toHaveCount(0);
});

test('agenda usa el horario elegido y libera el slot al reagendar', async ({ page, request }) => {
  await page.goto('/seleccion/agendar?t=synthetic');
  await expect(page.locator('#state-picker')).toBeVisible();

  const day = page.locator('.agendar-day-card:not([disabled])').first();
  await day.click();
  const slot = page.locator('.agendar-hour-btn:not([disabled])').first();
  const originalSlot = await slot.getAttribute('data-slot');
  await slot.click();
  await page.locator('#btn-confirm').click();
  await expect(page.locator('#state-success')).toBeVisible();

  await page.goto('/seleccion/agendar?t=synthetic');
  await expect(page.locator('#state-booked')).toBeVisible();
  await page.locator('#btn-reschedule').click();
  await expect(page.locator('#reschedule-dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '¿Buscamos otro momento?' })).toBeVisible();
  await page.locator('#btn-reschedule-confirm').click();
  await expect(page.locator('#state-picker')).toBeVisible();

  await page.locator('.agendar-day-card:not([disabled])').first().click();
  const restoredSlot = page.locator(`.agendar-hour-btn[data-slot="${originalSlot}"]`);
  await restoredSlot.waitFor({ state: 'visible' });
  await expect(restoredSlot).toBeEnabled();
  const calls = await (await request.get(`${fake}/__calls`)).json();
  expect(calls.some((call: any) => call.action === 'cancel_interview')).toBe(true);
});

test('evaluación permite guardar y cambiar decisión sin enviar correo', async ({ page, request }) => {
  await page.goto(`/admin/solicitudes/detalle?id=${ANA_ID}`);
  await expect(page.locator('#eval-card')).toBeVisible();
  await page.locator('#eval-decision label.admin-eval-decision-reject').click();
  await page.locator('#eval-overall').fill('Evaluación sintética guardada.');
  await page.locator('#eval-save').click();
  await expect(page.locator('#eval-feedback')).toContainText('resultado final guardados');

  const calls = await (await request.get(`${fake}/__calls`)).json();
  const save = calls.find((call: any) => call.action === 'save');
  expect(save.data.final_decision).toBe('rejected');
  expect(save.data.complete_interview).toBeUndefined();
  expect(calls.some((call: any) => call.action === 'confirm')).toBe(false);
});

test('Entrevistas sólo comunica personas seleccionadas y ya evaluadas', async ({ page, request }) => {
  await page.goto(`/admin/solicitudes/detalle?id=${ANA_ID}`);
  await page.locator('#eval-decision label.admin-eval-decision-accept').click();
  await page.locator('#eval-save').click();
  await expect(page.locator('#eval-feedback')).toContainText('resultado final guardados');

  await page.goto('/admin/entrevistas');
  const row = page.locator('.admin-agenda-item').filter({ hasText: 'Ana' });
  await expect(row).toBeVisible();
  await expect(page.locator('#final-select-all')).toHaveText(/Seleccionar todos/);
  const checkbox = row.locator('input.admin-final-select');
  await checkbox.check();
  await expect(page.locator('#btn-bulk-final')).toHaveText(/Comunicar listos \(1\)/);

  const confirmDialog = page.waitForEvent('dialog');
  await page.locator('#btn-bulk-final').click();
  const dialog = await confirmDialog;
  expect(dialog.message()).toContain('¡Bienvenida/o al Club Hello World!');
  await dialog.accept();

  await expect.poll(async () => {
    const calls = await (await request.get(`${fake}/__calls`)).json();
    return calls.filter((call: any) => call.action === 'confirm').length;
  }).toBe(1);
  const calls = await (await request.get(`${fake}/__calls`)).json();
  const confirm = calls.find((call: any) => call.action === 'confirm');
  expect(confirm.data.kind).toBe('final');
  expect(confirm.data.items).toHaveLength(1);
});

test('Entrevistas muestra el alta de un aceptado cuando ya se confirmó su correo', async ({ page, request }) => {
  await page.goto(`/admin/solicitudes/detalle?id=${ANA_ID}`);
  await page.locator('#eval-decision label.admin-eval-decision-accept').click();
  await page.locator('#eval-save').click();
  await expect(page.locator('#eval-feedback')).toContainText('resultado final guardados');

  await request.post(`${fake}/__member_status`, { data: {
    final_sent: [ANA_ID],
    rows: [{ solicitud_id: ANA_ID, member_id: 'member-ana', status: 'created', detail: null }],
  } });
  await page.goto('/admin/entrevistas');
  const row = page.locator('.admin-agenda-item').filter({ hasText: 'Ana' });
  await expect(row).toContainText('Alta automática en Miembros completada');
});

test('una bandera ausente bloquea el panel sin activar la implementación legacy', async ({ page, request }) => {
  await request.post(`${fake}/__config`, { data: { progressive_enabled: null } });
  await page.goto('/admin/solicitudes');
  await expect(page.locator('#admin-list-loading')).toContainText('No se pudo verificar el backend');
  await expect(page.locator('#admin-list-content')).toBeHidden();
  const calls = await (await request.get(`${fake}/__calls`)).json();
  expect(calls).toHaveLength(0);
});

test('las rutas actuales de entrevistas y configuración renderizan su contenido', async ({ page }) => {
  await page.goto('/admin/entrevistas');
  await expect(page.locator('#entrevistas-content')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entrevistas' })).toBeVisible();
  await page.goto('/admin/seleccion-config');
  await expect(page.locator('#config-mode-open')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Temporada/ })).toBeVisible();
});

for (const mode of ['progressive', 'legacy-agenda', 'legacy-booking']) {
  test(`Entrevistas busca sin distinguir mayúsculas ni acentos (${mode})`, async ({ page, request }) => {
    const state = await (await request.get(`${fake}/__state`)).json();
    const solicitudes = state.solicitudes.map((row: any, index: number) => ({
      ...row,
      nombre: index === 0 ? 'Ána Muñoz' : 'José Pérez',
      correo: index === 0 ? 'ana@example.org' : 'jose@example.org',
      status: 'accepted',
      email_notification_sent: true,
    }));
    await request.post(`${fake}/__state`, { data: {
      solicitudes,
      config: {
        ...state.config,
        progressive_enabled: mode === 'progressive',
        interview_deadline_at: mode === 'legacy-booking' ? '2099-10-01T18:00:00Z' : null,
      },
      interviews: state.interviews.map((row: any) => ({ ...row, solicitudes: solicitudes[0] })),
      invitations: solicitudes.map((row: any) => ({ ...state.invitations[0], solicitud_id: row.id })),
    } });
    await page.goto('/admin/entrevistas');
    const search = page.getByRole('searchbox', { name: 'Buscar por nombre, correo o carrera' });
    const visibleRows = page.locator('.admin-agenda-item:visible');
    await expect(visibleRows).toHaveCount(2);
    for (const query of ['ANA', 'ána', 'munoz', '  MUÑOZ   ANA  ', 'ANA@EXAMPLE.ORG']) {
      await search.fill(query);
      await expect(visibleRows).toHaveCount(1);
      await expect(visibleRows).toContainText('Ána Muñoz');
    }
    await search.fill('JOSE PEREZ');
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows).toContainText('José Pérez');
    await search.fill('COMPUTACION');
    await expect(visibleRows).toHaveCount(2);
    await search.fill('sin coincidencias');
    await expect(visibleRows).toHaveCount(0);
    await expect(page.locator('#interview-search-empty')).toBeVisible();
    await expect(page.locator('#interview-search-summary')).toHaveText('0 personas encontradas.');
    await search.fill('');
    await expect(visibleRows).toHaveCount(2);
    await expect(page.locator('#interview-search-empty')).toBeHidden();
    await expect(page.locator('#interview-search-summary')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(search).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const calls = await (await request.get(`${fake}/__calls`)).json();
    expect(calls.some((call: any) => ['confirm', 'save', 'update_interview'].includes(call.action))).toBe(false);
  });
}

test('Entrevistas limita seleccionar todos a la búsqueda y conserva las selecciones', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  const solicitudes = state.solicitudes.map((row: any) => ({
    ...row, status: 'accepted', final_decision: 'accepted', evaluated_at: '2030-09-01T12:00:00Z',
  }));
  await request.post(`${fake}/__state`, { data: {
    solicitudes,
    invitations: solicitudes.map((row: any) => ({ ...state.invitations[0], solicitud_id: row.id })),
  } });
  await page.goto('/admin/entrevistas');
  const search = page.getByRole('searchbox');
  await search.fill('ANA');
  await page.locator('#final-select-all').click();
  await expect(page.locator('.admin-final-select:checked')).toHaveCount(1);
  await search.fill('LUIS');
  await expect(page.locator('#final-selection-count')).toHaveText('1 seleccionado (1 fuera de la búsqueda)');
  await expect(page.locator('#final-select-all')).toHaveText(/Seleccionar todos/);
  await page.locator('#final-select-all').click();
  await expect(page.locator('.admin-final-select:checked')).toHaveCount(2);
  await search.fill('');
  await expect(page.locator('#final-selection-count')).toHaveText('2 seleccionados');
  await expect(page.locator('#btn-bulk-final')).toHaveText(/Comunicar listos \(2\)/);
});

test('cronograma publicado aparece en convocatoria abierta y fase de entrevistas, con avisos de la temporada', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/seleccion');
  await expect(page.locator('#state-open')).toBeVisible();
  await expect(page.locator('#selection-schedule')).toBeVisible();
  await expect(page.locator('#selection-schedule-dates')).toContainText('OCT2026');
  await expect(page.locator('#selection-schedule-dates li').first()).toContainText('Cierre de solicitudes');
  await expect(page.locator('.sel-schedule-wish')).toContainText('¡Mucha suerte y mucho éxito en cada etapa de este proceso!');
  await expect(page.locator('#selection-schedule-dates')).toContainText('siete días desde que enviemos el correo');
  await expect(page.locator('.sel-schedule-mail')).toContainText('Te escribiremos por correo con el resultado. Siempre.');
  await expect(page.locator('.sel-schedule-mail')).toContainText('Spam o Correo no deseado');
  await expect(page.locator('#state-open .section-card').first()).toContainText('No buscamos el promedio más alto');
  expect(await page.locator('#state-open .section-card').first().evaluate(el => el.compareDocumentPosition(document.getElementById('selection-schedule')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(page.locator('#selection-schedule-update-list')).not.toContainText('Aviso anterior');
  await expect(page.locator('#selection-schedule-update-list')).not.toContainText('Borrador privado');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#selection-schedule')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 768, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await request.post(`${fake}/__config`, { data: { applications_closed: true } });
  await page.reload();
  await expect(page.locator('#state-interviewing')).toBeVisible();
  await expect(page.locator('#selection-schedule')).toBeVisible();
  expect(await page.locator('#state-interviewing .sel-closed-quote-block').evaluate(el => el.compareDocumentPosition(document.getElementById('selection-schedule')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(page.locator('#selection-schedule-dates li')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#selection-schedule')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('guardar el cronograma y publicar un aviso no altera solicitudes ni envíos', async ({ page, request }) => {
  await page.goto('/admin/seleccion-config');
  await expect(page.locator('#schedule-form')).toBeVisible();
  await page.locator('#schedule-final').fill('2026-10-30');
  await expect(page.locator('#schedule-preview')).toContainText('30 oct 2026');
  await page.locator('#schedule-form button[type="submit"]').click();
  await expect(page.locator('#schedule-feedback')).toContainText('Cronograma guardado');
  await page.locator('#schedule-update-body').fill('Ya enviamos los correos de la primera etapa.');
  await page.locator('#schedule-update-published').check();
  await page.locator('#schedule-update-form button[type="submit"]').click();
  await expect(page.locator('#schedule-updates-admin')).toContainText('Ya enviamos los correos');
  const calls = await (await request.get(`${fake}/__calls`)).json();
  expect(calls.some((call: any) => call.action === 'schedule')).toBe(true);
  expect(calls.some((call: any) => call.action === 'schedule_notice')).toBe(true);
  expect(calls.some((call: any) => call.action === 'confirm' || call.action === 'config')).toBe(false);
});

test('el editor elimina borradores con confirmación y conserva avisos publicados', async ({ page, request }) => {
  await page.goto('/admin/seleccion-config');
  const draft = page.locator('.admin-schedule-update').filter({ hasText: 'Borrador privado' });
  await expect(draft).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await draft.getByRole('button', { name: 'Eliminar' }).click();
  await expect(draft).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await draft.getByRole('button', { name: 'Eliminar' }).click();
  await expect(draft).toHaveCount(0);
  await expect(page.locator('#schedule-update-feedback')).toContainText('Borrador eliminado');

  await page.locator('#schedule-update-body').fill('Aviso publicado de prueba');
  await page.locator('#schedule-update-published').check();
  await page.locator('#schedule-update-form button[type="submit"]').click();
  const published = page.locator('.admin-schedule-update').filter({ hasText: 'Aviso publicado de prueba' });
  await expect(published).toBeVisible();
  await expect(published.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  const calls = await (await request.get(`${fake}/__calls`)).json();
  expect(calls.filter((call: any) => call.action === 'schedule_notice_delete')).toHaveLength(1);
});


test('crear jornada comienza con una sala y permite preparar varias sin publicarlas', async ({ page, request }) => {
  await page.goto('/admin/seleccion-config');
  await expect(page.locator('#selection-rooms')).toBeVisible();
  await expect(page.locator('#room-duration')).toHaveValue('15');
  await page.locator('#room-create-details > summary').click();
  await expect(page.locator('#room-count')).toHaveValue('1');
  await page.locator('#room-date').fill('2030-10-10');
  await page.locator('#room-count').fill('3');
  await page.locator('#room-create-form button[type="submit"]').click();
  await expect(page.locator('.room-card')).toHaveCount(3);
  for (const button of await page.locator('[data-operation="publish"]').all()) await expect(button).toBeDisabled();
  const calls = await (await request.get(`${fake}/__calls`)).json();
  const created = calls.find((call: any) => call.action === 'room' && call.data.operation === 'create');
  expect(created.data.room_count).toBe(3);
  expect(created.data.request_id).toMatch(/^[0-9a-f-]{36}$/);
  const first = page.locator('.room-card').first();
  await expect(first.locator('form[data-action=hosts]')).toBeVisible();
  await first.locator('[name="primary_email"]').fill('titular@example.org');
  await first.locator('[name="backup_email"]').fill('respaldo@example.org');
  await first.getByRole('button', { name: 'Guardar responsables' }).click();
  await expect(first.getByRole('button', { name: 'Conectar con Google' })).toBeEnabled();
  await expect(first.getByRole('button', { name: 'Publicar horarios' })).toBeDisabled();
});

test('postulante ve una opción por horario y duración y reserva la duración elegida', async ({ page, request }) => {
  await request.post(`${fake}/__booking`, { data: { slots: [
    { slot_datetime: '2030-09-10T16:00:00Z', duration_minutes: 15 },
    { slot_datetime: '2030-09-10T16:00:00Z', duration_minutes: 15 },
    { slot_datetime: '2030-09-10T16:00:00Z', duration_minutes: 20 },
  ] } });
  await page.goto('/seleccion/agendar?t=synthetic');
  await page.locator('.agendar-day-card').first().click();
  await expect(page.locator('.agendar-hour-btn')).toHaveCount(2);
  await page.locator('.agendar-hour-btn[data-duration="20"]').click();
  await expect(page.locator('#confirm-duration')).toHaveText('20 minutos');
  await page.locator('#btn-confirm').click();
  await expect(page.locator('#state-success')).toBeVisible();
  const calls = await (await request.get(`${fake}/__calls`)).json();
  const booked = calls.find((call: any) => call.action === 'book_interview');
  expect(booked.data.p_duration_minutes).toBe(20);
});


test('una sala se conecta y publica sin checklist; un fallo permite reintentar', async ({ page, request }) => {
  await page.goto('/admin/seleccion-config');
  await expect(page.getByText('Jornadas anteriores para entrevistas')).toHaveCount(0);
  await expect(page.locator('#day-form')).toHaveCount(0);
  await page.locator('#room-create-details > summary').click();
  await page.locator('#room-date').fill('2030-10-10');
  await page.locator('#room-count').fill('2');
  await expect(page.locator('#room-capacity-preview')).toHaveText(/24 entrevistas posibles/);
  await page.locator('#room-create-form button[type=submit]').click();
  const first = page.locator('.room-card').first();
  await first.locator('[name=primary_email]').fill('titular@example.org');
  await first.locator('[name=backup_email]').fill('respaldo@example.org');
  await first.getByRole('button',{name:'Guardar responsables'}).click();
  await expect(first.getByRole('button',{name:'Conectar con Google'})).toBeEnabled();
  await page.route('**/functions/v1/selection-calendar',route => route.fulfill({status:503,json:{error:'synthetic_google_error'}}));
  await first.getByRole('button',{name:'Conectar con Google'}).click();
  await expect(page.locator('#room-feedback')).toContainText('No pudimos completar');
  await expect(first.getByRole('button',{name:'Publicar horarios'})).toBeDisabled();
  await page.unroute('**/functions/v1/selection-calendar');
  await first.getByRole('button',{name:'Conectar con Google'}).click();
  await expect(first.locator('.room-state')).toHaveText('Lista para publicar');
  await expect(page.locator('[data-action=verify],.room-checks')).toHaveCount(0);
  await first.getByRole('button',{name:'Publicar horarios'}).click();
  await expect(first.locator('.room-state')).toHaveText('Horarios publicados');
  await expect(page.locator('.room-card').nth(1).locator('.room-state')).toHaveText('Faltan responsables');
  const calls = await (await request.get(`${fake}/__calls`)).json();
  const calendar = calls.find((call: any) => call.action === 'calendar');
  expect(calendar.data.room_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(calls.some((call: any) => call.action === 'room' && call.data.operation === 'verify')).toBe(false);
});

test('Sala 2 muestra el conflicto junto a Guardar y permite guardar responsables sin cruce', async ({ page, request }) => {
  await page.goto('/admin/seleccion-config');
  await page.locator('#room-create-details > summary').click();
  await page.locator('#room-date').fill('2030-10-10');
  await page.locator('#room-count').fill('2');
  await page.locator('#room-create-form button[type=submit]').click();
  const first = page.locator('.room-card').nth(0);
  const second = page.locator('.room-card').nth(1);
  await first.locator('[name=primary_email]').fill('titular1@example.org');
  await first.locator('[name=backup_email]').fill('club@example.org');
  await first.getByRole('button',{name:'Guardar responsables'}).click();
  await expect(first.locator('[id^=room-host-feedback]')).toContainText('Responsables guardados');
  await second.locator('[name=primary_email]').fill('titular2@example.org');
  await second.locator('[name=backup_email]').fill('club@example.org');
  await second.getByRole('button',{name:'Guardar responsables'}).click();
  await expect(second.locator('[id^=room-host-feedback]')).toContainText('club@example.org ya está asignado a Sala 1');
  await expect(second.locator('[id^=room-host-feedback]')).toContainText('10:00 a 13:00');
  await expect(second.locator('[name=primary_email]')).toHaveValue('titular2@example.org');
  const failedCalls = await (await request.get(`${fake}/__calls`)).json();
  expect(failedCalls.filter((call: any) => call.action === 'room' && call.data.operation === 'edit')).toHaveLength(1);
  await second.locator('[name=backup_email]').fill('respaldo2@example.org');
  await second.getByRole('button',{name:'Guardar responsables'}).click();
  await expect(second.locator('[id^=room-host-feedback]')).toContainText('Responsables guardados');
  await expect(second.locator('.room-responsibles')).toContainText('respaldo2@example.org');
  await expect(second.locator('[data-operation=connect]')).toBeEnabled();
  await page.route('**/rpc/selection_admin',route => {
    const body = route.request().postDataJSON();
    if (body.p_action === 'room' && body.p_data.operation === 'edit') return route.fulfill({status:400,json:{code:'P0001',message:'INTERVIEWER_CONFLICT'}});
    return route.continue();
  });
  await second.locator('[name=primary_email]').fill('changed@example.org');
  await second.getByRole('button',{name:'Guardar responsables'}).click();
  await expect(second.locator('[id^=room-host-feedback]')).toContainText('Una persona está asignada a otra sala');
  await expect(second.locator('[name=primary_email]')).toHaveValue('changed@example.org');
});

test('la agenda muestra sala, responsables y Meet de cada entrevista en móvil y escritorio', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  await request.post(`${fake}/__state`, { data: {
    rooms: [{ id: 'room-agenda', name: 'Sala 2', primary_email: 'titular@aragon.unam.mx', backup_email: 'respaldo@gmail.com' }],
    interviews: state.interviews.map((interview: any) => ({ ...interview, room_id: 'room-agenda', duration_minutes: 15 })),
  } });
  await page.goto('/admin/entrevistas');
  const card = page.locator('.admin-interview-room-card').first();
  await expect(card.locator('.interview-room-identity')).toHaveText(/Sala asignadaSala 2/);
  await expect(card.locator('.interview-room-summary')).toContainText('titular@aragon.unam.mx');
  await expect(card.locator('.interview-room-summary')).toContainText('respaldo@gmail.com');
  await expect(card.locator('.admin-agenda-time')).toHaveText(/10:00a 10:1515 min/);
  await expect(card.getByRole('link', { name: /Abrir Meet de Sala 2/ })).toHaveAttribute('href', 'https://meet.google.com/testing');
  await expect(card.getByRole('link', { name: 'Evaluar', exact: true })).toHaveAttribute('href', `/admin/solicitudes/detalle?id=${ANA_ID}#evaluacion`);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(card.locator('.interview-room-summary')).toBeVisible();
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await request.post(`${fake}/__state`, { data: { rooms: [{ id: 'room-agenda', name: 'Sala 2', primary_email: 'nuevo@gmail.com', backup_email: 'respaldo@gmail.com' }] } });
  await page.reload();
  await expect(card.locator('.interview-room-summary')).toContainText('nuevo@gmail.com');
  await expect(card.locator('.interview-room-summary')).not.toContainText('titular@aragon.unam.mx');
  await expect(card.getByRole('link', { name: /Abrir Meet/ })).toHaveAttribute('href', 'https://meet.google.com/testing');
});

for (const scenario of [
  { name: 'aceptación aún sin correo', sent: false, invited: false, status: null, offset: null, text: 'Aún no se le envía el correo', warning: false },
  { name: 'correo en cola', sent: false, invited: false, status: 'queued', offset: null, text: 'está en cola', warning: false },
  { name: 'envío pendiente con plazo preparado', sent: false, invited: true, status: 'sending', offset: 86400000, text: 'está en cola', warning: false },
  { name: 'invitación vigente', sent: true, invited: true, status: null, offset: 86400000, text: 'En espera de que agende', warning: false },
  { name: 'plazo vencido', sent: true, invited: true, status: null, offset: -86400000, text: 'El plazo para agendar venció', warning: true },
  { name: 'envío fallido', sent: false, invited: false, status: 'failed', offset: null, text: 'problema de envío o entrega', warning: true },
  { name: 'envío incierto', sent: false, invited: false, status: 'uncertain', offset: null, text: 'No se pudo confirmar el envío', warning: true },
]) {
  test(`el aviso de evaluación distingue ${scenario.name}`, async ({ page, request }) => {
    const state = await (await request.get(`${fake}/__state`)).json();
    await request.post(`${fake}/__state`, { data: {
      solicitudes: state.solicitudes.map((row: any) => ({ ...row, email_notification_sent: scenario.sent })),
      interviews: [],
      invitations: scenario.invited ? [{ solicitud_id: ANA_ID, invited_at: new Date().toISOString(), expires_at: new Date(Date.now() + scenario.offset!).toISOString(), revoked_at: null }] : [],
      messages: scenario.status ? [{ id: 'notice-message', solicitud_id: ANA_ID, kind: 'initial', status: scenario.status, created_at: new Date().toISOString() }] : [],
    } });
    await page.goto(`/admin/solicitudes/detalle?id=${ANA_ID}`);
    const banner = page.locator('#eval-banner-noiview');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(scenario.text);
    await expect(banner).toHaveClass(new RegExp(scenario.warning ? 'admin-eval-banner-warn' : 'admin-eval-banner-info'));
    if (!scenario.warning) await expect(banner).not.toContainText('decisión manual antes del cierre');
  });
}

test('una entrevista confirmada prevalece sobre una cancelación anterior', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  const interview = state.interviews[0];
  await request.post(`${fake}/__state`, { data: { interviews: [
    { ...interview, id: 'old-cancelled', status: 'cancelled', created_at: '2030-09-01T13:00:00Z' },
    { ...interview, status: 'confirmed' },
  ] } });
  await page.goto(`/admin/solicitudes/detalle?id=${ANA_ID}`);
  await expect(page.locator('#eval-card')).toBeVisible();
  await expect(page.locator('#eval-interview-context')).toContainText('programada');
  await expect(page.locator('#eval-banner-noiview')).not.toBeVisible();
  await expect(page.locator('#eval-banner-noshow')).not.toBeVisible();
});

test('Solicitudes separa decisiones de envíos y filtra sin contar pendientes como sin enviar', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  const base = state.solicitudes[0];
  const extras = ['queued', 'sent', 'failed', 'uncertain'].map((status, index) => ({ ...base,
    id: `00000000-0000-0000-0000-${String(index + 20).padStart(12, '0')}`,
    nombre: `Correo ${status}`, email_notification_sent: status === 'sent',
  }));
  await request.post(`${fake}/__state`, { data: {
    solicitudes: [...state.solicitudes, ...extras],
    messages: extras.map((row, index) => ({ id: `message-${index}`, solicitud_id: row.id, kind: 'initial',
      status: ['queued', 'accepted', 'failed', 'uncertain'][index],
      delivery_status: index === 1 ? 'delivered' : 'pending', created_at: new Date().toISOString(),
    })),
  } });
  await page.goto('/admin/solicitudes');
  await expect(page.locator('#comms-count-all')).toHaveText('Todos (6)');
  await expect(page.locator('#comms-count-free')).toHaveText('Sin enviar (1)');
  await expect(page.locator('#comms-count-queued')).toHaveText('En cola / en proceso (1)');
  await expect(page.locator('#comms-count-sent')).toHaveText('Enviados (1)');
  await expect(page.locator('#comms-count-problem')).toHaveText('Revisar envío (2)');
  await expect(page.locator('#initial-comms-hint')).toContainText('1 sin enviar');
  await expect(page.locator('.admin-comms-badge-free')).toHaveCount(1);
  await page.locator('#initial-comms-filter').selectOption('free');
  await expect(page.locator('#admin-tbody tr')).toHaveCount(1);
  await expect(page.locator('#admin-tbody')).toContainText('Ana');
  await expect(page.locator('#initial-comms-filter')).toHaveValue('free');
  await page.locator('#initial-comms-filter').selectOption('problem');
  await expect(page.locator('#admin-tbody tr')).toHaveCount(2);
  await expect(page.locator('#admin-tbody')).toContainText('Correo failed');
  await expect(page.locator('#admin-tbody')).toContainText('Correo uncertain');
  await page.locator('#initial-comms-filter').selectOption('all');
  await expect(page.locator('#admin-tbody tr')).toHaveCount(6);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.locator('#initial-comms-summary').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
});

test('Correo final filtra la agenda y cuenta sólo resultados guardados', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  const stages = ['free', 'queued', 'sent', 'failed', 'uncertain'];
  const extra = stages.map((stage, index) => ({ ...state.solicitudes[0],
    id: `00000000-0000-0000-0000-${String(index + 30).padStart(12, '0')}`,
    nombre: `Resultado ${stage}`, final_decision: 'accepted', final_email_sent: stage === 'sent',
  }));
  await request.post(`${fake}/__state`, { data: {
    solicitudes: [...state.solicitudes, ...extra],
    interviews: [...state.interviews, ...extra.map(row => ({ ...state.interviews[0], id: `interview-${row.id}`, solicitud_id: row.id }))],
    messages: extra.filter((_, index) => index > 0).map((row, index) => ({ id: `final-message-${index}`, solicitud_id: row.id, kind: 'final',
      status: ['queued', 'accepted', 'failed', 'uncertain'][index], delivery_status: index === 1 ? 'delivered' : 'pending', created_at: new Date().toISOString(),
    })),
  } });
  await page.goto('/admin/entrevistas');
  await expect(page.locator('#final-comms-count-all')).toHaveText('Todos (6)');
  await expect(page.locator('#final-comms-count-free')).toHaveText('Sin enviar (1)');
  await expect(page.locator('#final-comms-count-queued')).toHaveText('En cola / en proceso (1)');
  await expect(page.locator('#final-comms-count-sent')).toHaveText('Enviados (1)');
  await expect(page.locator('#final-comms-count-problem')).toHaveText('Revisar envío (2)');
  await expect(page.locator('#final-comms-hint')).toContainText('1 sin enviar');
  await page.locator('#final-comms-filter').selectOption('free');
  await expect(page.locator('.admin-agenda-item:not([hidden])')).toHaveCount(1);
  await expect(page.locator('.admin-agenda-item:not([hidden])')).toContainText('Resultado free');
  await page.locator('#final-select-all').click();
  await expect(page.locator('.admin-final-select:checked')).toHaveCount(1);
  await page.locator('#final-comms-filter').selectOption('problem');
  await expect(page.locator('.admin-agenda-item:not([hidden])')).toHaveCount(2);
  await page.locator('#admin-search').fill('no existe');
  await expect(page.locator('#interview-search-empty')).toBeVisible();
  await page.locator('#admin-search').fill('');
  await page.locator('#final-comms-filter').selectOption('all');
  await expect(page.locator('.admin-agenda-item:not([hidden])')).toHaveCount(6);
});

test('los contadores de Entrevistas suman decisiones finales y filtran junto con correo y búsqueda', async ({ page, request }) => {
  const state = await (await request.get(`${fake}/__state`)).json();
  const base = state.solicitudes[0];
  const accepted = { ...base, final_decision: 'accepted', evaluated_at: '2030-09-01T13:00:00Z' };
  // El rechazo ya existe, aunque no tenga la marca de tiempo de evaluación.
  const rejected = { ...base, id: '00000000-0000-0000-0000-000000000041', nombre: 'Rechazado prueba', correo: 'rechazado@example.test', final_decision: 'rejected', evaluated_at: null };
  // Guardar notas parciales no equivale a guardar el resultado final.
  const pending = { ...base, id: '00000000-0000-0000-0000-000000000042', nombre: 'Pendiente prueba', correo: 'pendiente@example.test', final_decision: null, evaluated_at: '2030-09-01T13:00:00Z' };
  await request.post(`${fake}/__state`, { data: {
    solicitudes: [accepted, rejected, pending],
    interviews: [accepted, rejected, pending].map(row => ({ ...state.interviews[0], id: `interview-${row.id}`, solicitud_id: row.id })),
    messages: [{ id: 'accepted-final-queued', solicitud_id: accepted.id, kind: 'final', status: 'queued', created_at: new Date().toISOString() }],
  } });
  await page.goto('/admin/entrevistas');
  await expect(page.locator('#stat-total')).toHaveText('3');
  await expect(page.locator('#stat-evaluated')).toHaveText('2');
  await expect(page.locator('#stat-accepted-final')).toHaveText('1');
  await expect(page.locator('#stat-rejected-final')).toHaveText('1');
  await expect(page.locator('#stat-pending')).toHaveText('1');
  const visible = page.locator('.admin-agenda-item:not([hidden])');
  await page.getByRole('button', { name: '2 Evaluados', exact: true }).click();
  await expect(visible).toHaveCount(2);
  await expect(page.locator('[data-evaluation="evaluated"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-evaluation="accepted"]').click();
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText('Ana');
  await page.locator('#final-comms-filter').selectOption('free');
  await expect(visible).toHaveCount(0);
  await expect(page.locator('#interview-search-empty')).toBeVisible();
  await page.locator('#final-comms-filter').selectOption('all');
  await page.locator('[data-evaluation="rejected"]').click();
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText('Rechazado prueba');
  await page.locator('[data-evaluation="pending"]').click();
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText('Pendiente prueba');
  await page.locator('#admin-search').fill('Ana');
  await expect(visible).toHaveCount(0);
  await page.locator('#admin-search').fill('');
  await page.locator('[data-evaluation="all"]').click();
  await expect(visible).toHaveCount(3);
  await expect(page.locator('[data-evaluation="all"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-evaluation="pending"]')).toHaveAttribute('aria-pressed', 'false');
});

test('la agenda muestra progreso, éxito y errores junto a la acción de cada sala', async ({ page }) => {
  await page.goto('/admin/seleccion-config');
  await page.locator('#room-refresh').click();
  await expect(page.locator('#room-feedback')).toHaveText('Agenda actualizada.');
  await page.locator('#room-create-details > summary').click();
  await page.locator('#room-date').fill('2030-10-11');
  await page.locator('#room-create-form button[type=submit]').click();
  await expect(page.locator('#room-create-feedback')).toContainText('Jornada creada');
  const room = page.locator('.room-card').first();
  await room.locator('[name=primary_email]').fill('titular@example.org');
  await room.locator('[name=backup_email]').fill('respaldo@example.org');
  await room.getByRole('button', { name: 'Guardar responsables' }).click();
  await expect(room.locator('[id^=room-host-feedback]')).toContainText('Responsables guardados');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/functions/v1/selection-calendar', async route => {
    await gate;
    await route.fulfill({ status: 503, json: { error: 'synthetic_google_error' } });
  });
  await room.getByRole('button', { name: 'Conectar con Google' }).click();
  const feedback = room.locator('.room-action-feedback');
  await expect(feedback).toContainText('Conectando con Google…');
  await expect(feedback).toHaveAttribute('data-phase', 'working');
  await expect(room.getByRole('button', { name: 'Conectando con Google…', exact: true })).toBeDisabled();
  release();
  await expect(feedback).toContainText('No pudimos completar');
  await expect(feedback).toHaveAttribute('data-error', 'true');
  await page.unroute('**/functions/v1/selection-calendar');
  await room.getByRole('button', { name: 'Conectar con Google', exact: true }).click();
  await expect(feedback).toContainText('Sala conectada');
  await expect(feedback).toHaveAttribute('data-phase', 'success');
  await room.getByRole('button', { name: 'Publicar horarios' }).click();
  await expect(feedback).toContainText('Horarios publicados');
  const meet = await room.locator('.room-meet').getAttribute('href');
  await room.getByRole('button', { name: 'Actualizar en Google' }).click();
  await expect(feedback).toContainText('Sala actualizada en Google');
  await expect(feedback).toContainText('se conserva el mismo enlace');
  await expect(feedback.locator('.room-google-saved')).toContainText('Sala 1');
  await expect(feedback.locator('.room-google-saved')).toContainText('10:00–13:00');
  await expect(feedback.locator('.room-google-saved')).toContainText('titular@example.org');
  await expect(feedback.locator('.room-google-saved')).toContainText('respaldo@example.org');
  await expect(feedback.locator('.room-google-saved a')).toHaveAttribute('href', meet!);
  await expect(room.locator('.room-meet')).toHaveAttribute('href', meet!);
  await page.locator('.rooms-duration > summary').click();
  await page.locator('#room-duration-form button').click();
  await expect(page.locator('#room-duration-feedback')).toContainText('Duración guardada');
  await page.locator('.rooms-queue > summary').click();
  await page.locator('#room-process-calendar').click();
  await expect(page.locator('#room-queue-feedback')).toContainText('Procesamiento terminado');
});

test('la invitación inicial avisa si no hay cupos y permite enviar rechazos', async ({ page, request }) => {
  await request.post(`${fake}/__state`, { data: { capacity: 0 } });
  await page.goto('/admin/solicitudes');
  await page.locator('#progressive-select-all').click();
  const warning = page.waitForEvent('dialog');
  await page.locator('#progressive-preview').click();
  const dialog = await warning;
  expect(dialog.message()).toContain('quedan 0 cupos');
  await dialog.accept();
  const calls = await (await request.get(`${fake}/__calls`)).json();
  expect(calls.some((call: any) => call.action === 'confirm')).toBe(false);
  await request.post(`${fake}/__reset`);
  const state = await (await request.get(`${fake}/__state`)).json();
  await request.post(`${fake}/__state`, { data: { capacity: 0, solicitudes: state.solicitudes.map((row: any) => ({ ...row, status: 'rejected' })) } });
  await page.reload();
  await page.locator('#progressive-select-all').click();
  const preview = page.waitForEvent('dialog');
  await page.locator('#progressive-preview').click();
  const rejectDialog = await preview;
  expect(rejectDialog.message()).toContain('PREVISUALIZACIÓN');
  await rejectDialog.dismiss();
});

test('crear jornada informa los lugares faltantes sin contar borradores como publicados', async ({ page, request }) => {
  await request.post(`${fake}/__state`, { data: { capacity_summary: {
    available_slots: 2, committed_applicants: 1, available_for_invitations: 1, accepted_without_booking: 6, missing_slots: 4,
  } } });
  await page.goto('/admin/seleccion-config');
  await page.locator('#room-create-details > summary').click();
  await expect(page.locator('#room-demand-preview')).toContainText('Faltan 4 lugares');
  await expect(page.locator('#room-demand-preview')).toContainText('borrador no cuentan');
  await page.locator('#room-date').fill('2030-10-12');
  await page.locator('#room-start').fill('10:00');
  await page.locator('#room-end').fill('10:30');
  await expect(page.locator('#room-demand-preview')).toContainText('seguirían faltando 2');
  await page.locator('#room-count').fill('2');
  await expect(page.locator('#room-demand-preview')).toContainText('cubriría los lugares faltantes');
  await expect(page.locator('#room-demand-preview')).toContainText('al conectar y publicar');
});

test('las salas se pueden eliminar antes del correo inicial y muestran el aviso al publicar', async ({ page, request }) => {
  await request.post(`${fake}/__state`, { data: { room_deletion_locked: false } });
  await page.goto('/admin/seleccion-config');
  await page.locator('#room-create-details > summary').click();
  await page.locator('#room-date').fill('2030-10-11');
  await page.locator('#room-create-form button[type=submit]').click();
  const room = page.locator('.room-card').first();
  await expect(room.locator('.room-publish-notice')).toContainText('primer envío de correo inicial de la temporada');
  await expect(room.getByRole('button', { name: 'Eliminar sala', exact: true })).toBeEnabled();
  await room.locator('[name=primary_email]').fill('titular@example.org');
  await room.locator('[name=backup_email]').fill('respaldo@example.org');
  await room.getByRole('button', { name: 'Guardar responsables' }).click();
  await room.getByRole('button', { name: 'Conectar con Google', exact: true }).click();
  await expect(room.getByRole('button', { name: 'Publicar horarios' })).toBeEnabled();
  await room.getByRole('button', { name: 'Publicar horarios' }).click();
  await expect(room.locator('.room-state')).toHaveText('Horarios publicados');
  await expect(room.getByRole('button', { name: 'Eliminar sala', exact: true })).toBeEnabled();
  page.once('dialog', dialog => dialog.accept());
  await room.getByRole('button', { name: 'Eliminar sala', exact: true }).click();
  await expect(page.locator('.room-card')).toHaveCount(0);
  await expect(page.locator('#room-feedback')).toContainText('Evento cancelado en Google Calendar');
});

test('el primer envío inicial bloquea eliminar salas y horarios con un motivo visible', async ({ page, request }) => {
  await request.post(`${fake}/__state`, { data: { room_deletion_locked: true } });
  await page.goto('/admin/seleccion-config');
  await page.locator('#room-create-details > summary').click();
  await page.locator('#room-date').fill('2030-10-11');
  await page.locator('#room-create-form button[type=submit]').click();
  const room = page.locator('.room-card').first();
  await expect(room.getByRole('button', { name: 'Eliminar sala', exact: true })).toBeDisabled();
  await expect(room.locator('.room-deletion-note')).toContainText('esta temporada');
  await expect(room.locator('.room-publish-notice')).toContainText('Ya hubo un envío inicial');
  await room.locator('[data-panel^="blocks-"] > summary').click();
  await expect(room.getByRole('button', { name: 'Eliminar horario', exact: true })).toBeDisabled();
});
