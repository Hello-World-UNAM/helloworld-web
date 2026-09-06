import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname;
  if (host === '127.0.0.1' || host === 'localhost') return route.continue();
  return route.abort();
});

try {
  await page.goto('http://127.0.0.1:4321/admin/login');
  await page.getByText('ENTORNO LOCAL', { exact: true }).waitFor();
  if (await page.locator('#google-login-btn').isVisible()) {
    throw new Error('Google OAuth no debe mostrarse en Selection Lab.');
  }

  await page.locator('#selection-lab-login-btn').click();
  await page.waitForURL(/\/admin\/solicitudes/);
  await page.locator('#admin-list-content').waitFor({ state: 'visible' });

  const season = (await page.locator('#active-season').textContent())?.trim();
  const total = (await page.locator('#count-all').textContent())?.trim();
  if (season !== '2099-1' || total !== '11') {
    throw new Error(`Escenario visual inesperado: temporada=${season}, total=${total}`);
  }

  await page.screenshot({ path: '/tmp/selection-lab-admin.png', fullPage: true });
  console.log('Smoke UI correcto: login local, banner, temporada 2099-1 y 11 solicitudes.');
  console.log('Captura: /tmp/selection-lab-admin.png');
} finally {
  await browser.close();
}
