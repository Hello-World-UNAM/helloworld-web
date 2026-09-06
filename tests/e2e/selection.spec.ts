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
