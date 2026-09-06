import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:4321';
const candidateName = 'Postulante Sintético 03';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const dialogs = [];

page.on('dialog', async (dialog) => {
  dialogs.push({ type: dialog.type(), message: dialog.message() });
  await dialog.accept();
});

await page.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  if (host === '127.0.0.1' || host === 'localhost') return route.continue();
  return route.abort();
});

async function waitForReload(action) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    action(),
  ]);
}

try {
  await page.goto(`${baseUrl}/admin/login`);
  await page.getByText('ENTORNO LOCAL', { exact: true }).waitFor();
  await page.locator('#selection-lab-login-btn').click();
  await page.waitForURL(/\/admin\/solicitudes/);
  await page.locator('#admin-list-content').waitFor({ state: 'visible' });

  if ((await page.locator('#count-all').textContent())?.trim() !== '11') {
    throw new Error('El escenario no inició con 11 solicitudes sintéticas. Ejecuta selection:lab:reset.');
  }
  await page.getByRole('link', { name: /Buzón de pruebas/i }).waitFor();

  const candidateRow = page.locator('#admin-tbody tr').filter({ hasText: candidateName });
  await candidateRow.getByTitle('Ver detalle').click();
  await page.locator('#detalle-content').waitFor({ state: 'visible' });
  await page.locator('#status-select').selectOption('accepted');
  await page.locator('#notes-textarea').fill('Aceptación sintética para prueba integral local.');
  await waitForReload(() => page.locator('#btn-save').click());
  await page.locator('#detalle-content').waitFor({ state: 'visible' });
  await page.locator('#btn-communicate-initial').waitFor({ state: 'visible' });

  await waitForReload(() => page.locator('#btn-communicate-initial').click());
  await page.locator('#detalle-content').waitFor({ state: 'visible' });
  if (!dialogs.some((dialog) => dialog.type === 'confirm' && dialog.message.includes(candidateName))) {
    throw new Error('No se mostró la previsualización confirmable de la decisión inicial.');
  }

  await page.goto(`${baseUrl}/admin/selection-lab`);
  await page.locator('#lab-loading').waitFor({ state: 'hidden' });
  await page.locator('#lab-dispatch').click();
  const initialMessage = page.locator('.lab-message').filter({ hasText: 'Siguiente paso de tu solicitud' });
  await initialMessage.waitFor({ state: 'visible' });
  const bookingUrl = await initialMessage.getByRole('link', { name: /Abrir enlace de agenda/i }).getAttribute('href');
  if (!bookingUrl?.startsWith(`${baseUrl}/seleccion/agendar?t=`)) {
    throw new Error(`El buzón no expuso un enlace local de agenda válido: ${bookingUrl}`);
  }

  await page.goto(bookingUrl);
  await page.locator('#state-picker').waitFor({ state: 'visible' });
  const firstDay = page.locator('.agendar-day-card:not([disabled])').first();
  const originalDayId = await firstDay.getAttribute('data-day-id');
  await firstDay.click();
  const originalHour = page.locator('.agendar-hour-btn:not([disabled])').first();
  const originalSlot = await originalHour.getAttribute('data-slot');
  await originalHour.click();
  await page.locator('#btn-confirm').click();
  await page.locator('#state-success').waitFor({ state: 'visible' });

  // La confirmación sólo es enviable mientras la entrevista sigue confirmed
  // (el worker cancela booking de entrevistas ya completadas): se procesa
  // la cola aquí, igual que haría el cron cada minuto en producción.
  await page.goto(`${baseUrl}/admin/selection-lab`);
  await page.locator('#lab-loading').waitFor({ state: 'hidden' });
  await page.locator('#lab-dispatch').click();
  await page.locator('.lab-message').filter({ hasText: 'Entrevista agendada' }).last().waitFor({ state: 'visible' });

  // Reagendar libera primero la reserva anterior y sólo después vuelve a
  // mostrar horarios. El diálogo debe permitir conservarla sin mutaciones.
  await page.goto(bookingUrl);
  await page.locator('#state-booked').waitFor({ state: 'visible' });
  await page.locator('#btn-reschedule').click();
  await page.locator('#reschedule-dialog').waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: '¿Buscamos otro momento?' }).waitFor();
  await page.locator('#btn-reschedule-back').click();
  await page.locator('#reschedule-dialog').waitFor({ state: 'hidden' });
  await page.locator('#state-booked').waitFor({ state: 'visible' });

  await page.locator('#btn-reschedule').click();
  await page.locator('#btn-reschedule-confirm').click();
  await page.locator('#state-picker').waitFor({ state: 'visible' });
  const restoredDay = page.locator(`.agendar-day-card[data-day-id="${originalDayId}"]`);
  await restoredDay.click();
  const restoredHour = page.locator(`.agendar-hour-btn[data-slot="${originalSlot}"]`);
  await restoredHour.waitFor({ state: 'visible' });
  if (await restoredHour.isDisabled()) {
    throw new Error('El horario anterior siguió ocupado después de confirmar el reagendado.');
  }
  await restoredHour.click();
  await page.locator('#btn-confirm').click();
  await page.locator('#state-success').waitFor({ state: 'visible' });

  await page.goto(`${baseUrl}/admin/selection-lab`);
  await page.locator('#lab-loading').waitFor({ state: 'hidden' });
  await page.locator('#lab-dispatch').click();
  await page.locator('.lab-message').filter({ hasText: 'Entrevista agendada' }).last().waitFor({ state: 'visible' });

  await page.goto(`${baseUrl}/admin/entrevistas`);
  const interviewRow = page.locator('.admin-agenda-item:not(.admin-agenda-status-cancelled)').filter({ hasText: candidateName });
  await interviewRow.waitFor({ state: 'visible' });
  await interviewRow.getByTitle('Evaluar / Ver solicitud').click();
  await page.locator('#eval-card').waitFor({ state: 'visible' });
  for (const area of ['blandas', 'motivacion', 'proyectos', 'aporte', 'tecnica']) {
    await page.locator(`.admin-eval-scale[data-score-for="${area}"] [data-score="4"]`).click();
  }
  await page.locator('#eval-overall').fill('Evaluación sintética completada durante la prueba integral.');
  await page.locator('#eval-decision label.admin-eval-decision-accept').click();
  await waitForReload(() => page.locator('#eval-save').click());

  // La vista de detalle puede guardar evaluación + decisión final en una
  // sola operación y completar la entrevista confirmada ya realizada.
  await page.waitForFunction(() => (
    document.querySelector('#eval-decision input[name="final_decision"][value="accepted"]')?.checked === true
  ));

  // La decisión sigue siendo editable hasta que se comunica. Cambiarla y
  // devolverla a aceptado prueba que no se bloquea por sólo haber guardado.
  await page.locator('#eval-decision label.admin-eval-decision-reject').click();
  await waitForReload(() => page.locator('#eval-save').click());
  await page.waitForFunction(() => (
    document.querySelector('#eval-decision input[name="final_decision"][value="rejected"]')?.checked === true
  ));
  await page.locator('#eval-decision label.admin-eval-decision-accept').click();
  await waitForReload(() => page.locator('#eval-save').click());

  await page.goto(`${baseUrl}/admin/entrevistas`);
  const finalRow = page.locator('.admin-agenda-item:not(.admin-agenda-status-cancelled)').filter({ hasText: candidateName });
  await finalRow.waitFor({ state: 'visible' });
  const finalCheckbox = finalRow.locator('input.admin-final-select');
  await finalCheckbox.waitFor({ state: 'visible' });
  await finalRow.locator('label.admin-agenda-select').click();
  if (!(await finalCheckbox.isChecked())) {
    throw new Error('La casilla visual no seleccionó el resultado final.');
  }
  const bulkFinalButton = page.locator('#btn-bulk-final');
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('#btn-bulk-final');
    return button !== null && !button.disabled;
  });
  await waitForReload(() => bulkFinalButton.click());

  await page.goto(`${baseUrl}/admin/selection-lab`);
  await page.locator('#lab-loading').waitFor({ state: 'hidden' });
  await page.locator('#lab-dispatch').click();
  await page.locator('.lab-message').filter({ hasText: 'Resultado de tu proceso' }).waitFor({ state: 'visible' });
  await page.locator('.lab-message').filter({ hasText: 'Entrevista agendada' }).last().waitFor({ state: 'visible' });

  await page.screenshot({ path: '/tmp/selection-lab-complete.png', fullPage: true });
  console.log('Flujo E2E local correcto: revisión, comunicación inicial, entrega simulada, agenda, entrevista, evaluación y resultado final.');
  console.log(`Diálogos confirmados: ${dialogs.length}. Captura: /tmp/selection-lab-complete.png`);
} finally {
  await browser.close();
}
