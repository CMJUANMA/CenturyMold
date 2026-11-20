// Acciones de pantalla compartidas por las etapas de la prueba de punta a punta.
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { BASE, SALIDA, esperar } from './infra.mjs';

export const cuadro = (page) => page.locator('[role=dialog]').last();

export async function ir(page, ruta, espera = 800) {
  await page.goto(BASE + ruta);
  await page.waitForLoadState('domcontentloaded');
  await esperar(espera);
}

/** Entra con nómina y contraseña. Devuelve 'inicio' o 'cambiar-password' según adónde lo manda la app. */
export async function entrar(page, nomina, password) {
  await page.goto(BASE + '/login');
  await page.fill('#login-nomina', String(nomina));
  await page.fill('#login-password', password);
  await page.click('#btn-ingresar');
  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await esperar(1200);
  return page.url().includes('/cambiar-password') ? 'cambiar-password' : 'inicio';
}

/** El intento de entrar que debe fallar (la cuenta ya no existe o la contraseña no es): devuelve el mensaje que ve la persona */
export async function entrarFallido(page, nomina, password) {
  await page.goto(BASE + '/login');
  await page.fill('#login-nomina', String(nomina));
  await page.fill('#login-password', password);
  await page.click('#btn-ingresar');
  await esperar(2500);
  if (!page.url().includes('/login')) throw new Error(`La nómina ${nomina} NO debía poder entrar y entró (URL ${page.url()}).`);
  return (await page.locator('[role=alert]').first().innerText().catch(() => '')).trim();
}

export async function cerrarSesion(page) {
  const boton = page.locator('#btn-cerrar-sesion');
  if (!(await boton.isVisible().catch(() => false))) await page.locator('#btn-menu-movil').click().catch(() => {});
  await boton.click();
  await page.waitForURL(u => u.pathname.includes('/login'), { timeout: 15000 });
}

/** Primer ingreso: la contraseña temporal obliga a crear una propia */
export async function cambiarPasswordObligatorio(page, temporal, nueva) {
  await page.waitForURL(u => u.pathname.includes('/cambiar-password'));
  const claves = page.locator('input[type=password]');
  const n = await claves.count();
  for (let i = 0; i < n; i++) await claves.nth(i).fill(i === 0 && n === 3 ? temporal : nueva);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u => !u.pathname.includes('/cambiar-password'), { timeout: 20000 });
  await esperar(1500);
}

/** Descarga lo que dispare `accion` y lo guarda en .tmp/piloto; devuelve la ruta */
export async function descargar(page, accion, nombre) {
  mkdirSync(`${SALIDA}/descargas`, { recursive: true });
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), accion()]);
  const ruta = `${SALIDA}/descargas/${nombre ?? d.suggestedFilename()}`;
  await d.saveAs(ruta);
  return ruta;
}

export const valorCelda = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') { if ('result' in v) return valorCelda(v.result); if ('richText' in v) return v.richText.map(t => t.text).join(''); if ('text' in v) return String(v.text); if (v instanceof Date) return v.toISOString(); }
  return String(v);
};
/** Hojas de un Excel como matrices de texto: { nombreHoja: [[celdas…], …] } */
export async function leerExcel(ruta) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const salida = {};
  for (const ws of wb.worksheets) {
    const filas = [];
    ws.eachRow({ includeEmpty: false }, (row) => { const celdas = []; for (let c = 1; c <= ws.columnCount; c++) celdas.push(valorCelda(row.getCell(c).value).trim()); filas.push(celdas); });
    salida[ws.name] = filas;
  }
  return salida;
}
/** Todo el texto de un Excel junto (para buscar nombres, rutas y teléfonos sin depender de la posición de la celda) */
export const textoDeExcel = (hojas) => Object.values(hojas).flat(2).join(' | ');

/** Escribe un .xlsx de prueba con exceljs */
export async function escribirExcel(ruta, hoja, filas) {
  mkdirSync(`${SALIDA}/archivos`, { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(hoja);
  for (const f of filas) ws.addRow(f);
  const destino = `${SALIDA}/archivos/${ruta}`;
  await wb.xlsx.writeFile(destino);
  return destino;
}

/** Hoy a cierta hora local escrito como lo muestran los selectores de hora de la app (7:00 a. m.) */
export const texto = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim();

/** Clave ISO de la semana de una fecha AAAA-MM-DD ("2026-47"), como la usa la pantalla de Nóminas */
export function claveSemanaDe(ymd) {
  const [a, m, d] = ymd.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  const dia = f.getUTCDay() || 7;
  f.setUTCDate(f.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(f.getUTCFullYear(), 0, 1));
  return `${f.getUTCFullYear()}-${String(Math.ceil(((f - inicio) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

export function sumarDiasYmd(ymd, n) {
  const [a, m, d] = ymd.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, '0')}-${String(f.getUTCDate()).padStart(2, '0')}`;
}
