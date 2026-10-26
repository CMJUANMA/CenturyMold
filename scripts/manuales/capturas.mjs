// Capturas ANOTADAS de los manuales, con Playwright: entra con cada rol (datos de ejemplo de datos-demo.mjs), recorre cada tarea y guarda en docs/manuales/capturas/<rol>/.
// Necesita los emuladores con los datos de ejemplo y un servidor con la app en modo emulador (npm run manuales lo prepara todo).
// Uso: node scripts/manuales/capturas.mjs [solicitante …]   (sin rol: todos los definidos)
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { PASSWORD, USUARIOS } from './datos-demo-usuarios.mjs';
import { solicitante, solicitanteCelular } from './roles/solicitante.mjs';

export const BASE = process.env.BASE ?? 'http://localhost:4174';
export const ESCRITORIO = { width: 1366, height: 820 };
export const CELULAR = { width: 390, height: 844 };

export async function abrir(viewport = ESCRITORIO, movil = false) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport, colorScheme: 'light', deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => console.error('  [pageerror]', e.message));
  return { browser, page };
}
export async function entrar(page, clave) {
  await page.goto(BASE + '/login');
  await page.fill('#login-nomina', USUARIOS[clave][0]);
  await page.fill('#login-password', PASSWORD);
  await page.click('#btn-ingresar');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(1500);
}
export const ir = async (page, ruta, ms = 2000) => { await page.goto(BASE + ruta); await page.waitForTimeout(ms); };

const roles = { solicitante, 'solicitante-celular': solicitanteCelular };
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pedidos = process.argv.slice(2).filter(a => !a.startsWith('--'));
  for (const r of (pedidos.length ? pedidos : Object.keys(roles))) { console.log('Capturas de', r); await roles[r]({ abrir, entrar, ir, BASE, CELULAR }); }
}
