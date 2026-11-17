// Capturas anotadas del manual de NÓMINAS (persona de ejemplo: ESCOBAR TREJO MARTÍN, analista de nómina). Las llama capturas.mjs. Solo datos ficticios del emulador.
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { capturar } from '../anotar.mjs';
import { LADO_A as LADO, VENTANA_ANCHA, alrededorDelCuadro, claveSemana, entrarComo, intentar } from './comun.mjs';

const valor = (v) => (v && v.result !== undefined ? v.result : v) ?? '';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Dibuja una hoja del Excel descargado como una página (con letras de columna, como se vería en Excel) para anotarla como cualquier pantalla */
async function paginaExcel(page, archivo, hoja, filas, marcas) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(archivo);
  const ws = wb.getWorksheet(hoja);
  const ancho = Math.max(...filas.map(n => ws.getRow(n).actualCellCount ? ws.columnCount : 0), 1);
  const letras = Array.from({ length: ancho }, (_, i) => String.fromCharCode(65 + i));
  const cuerpo = filas.map(n => {
    const celdas = []; const r = ws.getRow(n); let previo = null;
    for (let c = 1; c <= ancho; c++) { const v = String(valor(r.getCell(c).value)); if (v === previo && v !== '') continue; celdas.push(`<td>${esc(v)}</td>`); previo = v; }
    const id = marcas[n] ? ` id="${marcas[n]}"` : '';
    return `<tr${id}><th>${n}</th>${celdas.join('')}</tr>`;
  }).join('');
  const html = `<body style="margin:0;background:#fff;font:15px Calibri,Arial,sans-serif"><table style="border-collapse:collapse;margin:24px"><tr><th></th>${letras.map(l => `<th>${l}</th>`).join('')}</tr>${cuerpo}</table>
    <style>th{background:#e8eaed;border:1px solid #c8ccd2;padding:3px 10px;font-weight:600;color:#555}td{border:1px solid #d5d8dc;padding:5px 10px;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis}</style></body>`;
  await page.setContent(html); await page.waitForTimeout(300);
}

export async function nominas({ abrir, ir, BASE }) {
  const R = 'nominas';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  const cuadro = () => page.locator('[role=dialog]');
  const cerrarTodo = async () => { for (let i = 0; i < 3; i++) { if (!(await cuadro().count())) break; const b = cuadro().last().getByRole('button', { name: /^(Cancelar|Cerrar|Seguir editando)$/ }).first(); if (await b.count()) await b.click().catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(500); } };
  const semana = claveSemana(new Date());
  mkdirSync('.tmp/archivos', { recursive: true });
  await entrarComo(page, BASE, 'nomina');

  // ── Primeros pasos ──
  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Formato de tiempo extra/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Abrir el formato de la semana/ }), n: 2 },
      { en: page.getByRole('link', { name: /Por enviar al proveedor \(/ }), n: 3 },
    ]);
  });
  await intentar('menu', async () => {
    await capturar(page, `${R}/02-menu`, [
      { en: page.getByRole('link', { name: 'Formato de tiempo extra' }), n: 1, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Por enviar al proveedor/ }), n: 2, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Formato de rutas' }), n: 3, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Personal', exact: true }), n: 4, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 345, height: 900 } });
  });

  // ── Reportes de nómina: la semana ──
  await ir(page, `/nomina/reportes?periodo=${semana}`, 3500);
  await intentar('la semana', async () => {
    await capturar(page, `${R}/03-semana`, [
      { en: page.getByRole('button', { name: 'Semana anterior' }), n: 1 },
      { en: page.getByRole('button', { name: 'Semana siguiente' }), n: 2 },
      { en: page.getByRole('button', { name: /Rango de fechas/ }), n: 3 },
      { en: page.getByRole('button', { name: /Descargar áreas con tiempo extra/ }), n: 4 },
      { en: page.getByRole('button', { name: /Más opciones/ }), n: 5 },
    ], { recorte: LADO });
  });
  await intentar('avisos y áreas', async () => {
    await page.setViewportSize({ width: 1600, height: 1300 }); await page.waitForTimeout(500);
    await capturar(page, `${R}/04-areas`, [
      { en: page.getByText(/Hay [0-9]+ solicitudes? de este periodo sin autorizar/), n: 1, sinCaja: true },
      { en: page.getByRole('button', { name: 'Revisar Moldes' }), n: 2 },
      { en: page.getByRole('button', { name: 'Descargar Moldes' }), n: 3 },
      { en: page.getByText('Sin tiempo extra esta semana').first(), n: 4, sinCaja: true },
    ], { recorte: { ...LADO, height: 1300 } });
    await page.getByRole('button', { name: 'Semana anterior' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/05-vencidas`, [{ en: page.getByText(/vencieron sin autorizarse|venció sin autorizarse/).first(), n: 1, sinCaja: true }], { recorte: { ...LADO, height: 1300 } });
    await page.setViewportSize({ width: 1600, height: 900 });
    await ir(page, `/nomina/reportes?periodo=${semana}`, 3000);
  });
  await intentar('más opciones', async () => {
    await page.getByRole('button', { name: /Más opciones/ }).click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/05-mas-opciones`, [{ en: page.getByText(/Descargar todas las áreas/), n: 1 }], { recorte: LADO });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  });
  await intentar('rango', async () => {
    await page.getByRole('button', { name: /Rango de fechas/ }).click(); await page.waitForTimeout(800);
    await capturar(page, `${R}/06-rango`, [
      { en: page.locator('input[type=date]').first(), n: 1 }, { en: page.locator('input[type=date]').nth(1), n: 2 }, { en: page.getByRole('button', { name: 'Por semana' }), n: 3 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: 'Por semana' }).click(); await page.waitForTimeout(600);
  });

  // ── Revisar un área ──
  await ir(page, `/nomina/semana/${semana}/moldes`, 3500);
  await intentar('revisar el área', async () => {
    await capturar(page, `${R}/07-revisar-area`, [
      { en: page.locator('[data-hoja] thead th').nth(5), n: 1 },
      { en: page.locator('[data-hoja] tbody tr').first().locator('input').nth(2), n: 2 },
      { en: page.locator('[data-hoja] tbody tr').first().getByRole('button', { name: /Acciones de/ }), n: 3 },
      { en: page.locator('#btn-agregar-empleado-nomina'), n: 4 },
      { en: page.locator('#btn-descargar-area'), n: 5 },
    ], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
  });
  await intentar('corregir horas', async () => {
    const celda = page.locator('[data-hoja] tbody tr').first().locator('input:not([disabled])').nth(2);
    await celda.fill('8'); await celda.press('Tab'); await page.waitForTimeout(700);
    await capturar(page, `${R}/08-horas`, [
      { en: celda, n: 1 }, { en: page.locator('#texto-sin-guardar'), n: 2 }, { en: page.locator('#btn-descartar-cambios'), n: 3 }, { en: page.locator('#btn-guardar-cambios'), n: 4 },
    ], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
  });
  await intentar('menú del renglón', async () => {
    const fila = page.locator('[data-hoja] tbody tr').nth(1);
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(700);
    await capturar(page, `${R}/09-menu-renglon`, [
      { en: page.getByRole('menuitem').nth(0), n: 1 }, { en: page.getByRole('menuitem').nth(1), n: 2 }, { en: page.getByRole('menuitem').nth(2), n: 3 }, { en: page.getByRole('menuitem').nth(3), n: 4 },
    ], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  });
  await intentar('quitar a un empleado', async () => {
    const fila = page.locator('[data-hoja] tbody tr').nth(1);
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /Quitar/ }).click(); await page.waitForTimeout(1000);
    await cuadro().locator('input[type=text], textarea').first().fill('No asistió');
    await capturar(page, `${R}/10-quitar-motivo`, [{ en: cuadro().locator('input[type=text], textarea').first(), n: 1 }, { en: cuadro().getByRole('button', { name: 'Quitar', exact: true }), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button', { name: 'Quitar', exact: true }).click(); await page.waitForTimeout(900);
    await capturar(page, `${R}/11-quitado`, [{ en: page.locator('[data-hoja] tbody tr').nth(1), n: 1 }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(500);
    await capturar(page, `${R}/12-restaurar`, [{ en: page.getByRole('menuitem', { name: /Restaurar/ }), n: 1 }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  });
  await intentar('reemplazar', async () => {
    const fila = page.locator('[data-hoja] tbody tr').nth(2);
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /Reemplazar/ }).click(); await page.waitForTimeout(1200);
    await cuadro().getByPlaceholder(/Buscar/).first().fill('8061'); await page.waitForTimeout(900);
    await cuadro().getByText(/OCAMPO SILVA BERTHA/).first().click(); await page.waitForTimeout(600);
    await cuadro().getByRole('button', { name: /Sí, /i }).click().catch(() => {}); await page.waitForTimeout(400);
    await capturar(page, `${R}/13-reemplazar`, [
      { en: cuadro().getByText(/OCAMPO SILVA BERTHA/).first(), n: 1 }, { en: cuadro().getByRole('button').last(), n: 2 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrarTodo();
  });
  await intentar('cambiar motivo y P.O.', async () => {
    const fila = page.locator('[data-hoja] tbody tr').nth(3);
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /Cambiar motivo/ }).click(); await page.waitForTimeout(1000);
    await cuadro().locator('select').first().selectOption({ label: 'Cargo a P.O.' }).catch(() => {}); await page.waitForTimeout(500);
    await cuadro().locator('input').first().fill('4551099797').catch(() => {}); await page.waitForTimeout(300);
    await capturar(page, `${R}/14-motivo-po`, [
      { en: cuadro().locator('select').first(), n: 1 }, { en: cuadro().locator('input').first(), n: 2 }, { en: cuadro().getByRole('button', { name: 'Aplicar al renglón' }), n: 3 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button', { name: 'Aplicar al renglón' }).click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(800); await cerrarTodo();
  });
  await intentar('agregar a un empleado', async () => {
    await cerrarTodo();
    await page.locator('#btn-agregar-empleado-nomina').click(); await page.waitForTimeout(1200);
    await cuadro().getByPlaceholder(/Buscar por nombre o nómina/).first().fill('8061'); await page.waitForTimeout(900);
    await cuadro().getByText(/OCAMPO SILVA BERTHA/).first().click(); await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Sí, agregarlo aquí/ }).click().catch(() => {}); await page.waitForTimeout(500);
    await cuadro().locator('select').first().selectOption({ label: 'Inventario físico' }).catch(() => {});
    await cuadro().getByPlaceholder(/Trabajó el sábado/).fill('Trabajó el sábado y no venía en la solicitud');
    await capturar(page, `${R}/15-agregar`, [
      { en: cuadro().getByText(/OCAMPO SILVA BERTHA/).first(), n: 1 }, { en: cuadro().getByPlaceholder(/Trabajó el sábado/), n: 2 }, { en: cuadro().getByRole('button', { name: /Agregar al formato/ }), n: 3 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cuadro().getByRole('button', { name: /Agregar al formato/ }).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/16-agregado`, [{ en: page.locator('[data-hoja] tbody tr', { hasText: 'OCAMPO' }).first(), n: 1 }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
  });
  await intentar('guardar', async () => {
    await cerrarTodo();
    const fila = page.locator('[data-hoja] tbody tr', { hasText: 'OCAMPO' }).first();
    await fila.locator('input:not([disabled])').first().fill('4'); await fila.locator('input:not([disabled])').first().press('Tab'); await page.waitForTimeout(600);
    await page.locator('#btn-guardar-cambios').click(); await page.waitForTimeout(1200);
    await cuadro().locator('input[type=text], textarea').first().fill('Corrección de asistencia de la semana');
    await capturar(page, `${R}/17-guardar`, [
      { en: cuadro().locator('input[type=text], textarea').first(), n: 1 }, { en: cuadro().getByRole('button', { name: 'Guardar cambios' }), n: 2 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button', { name: 'Guardar cambios' }).click(); await page.waitForTimeout(2500);
  });
  await intentar('deshacer ajustes', async () => {
    await cerrarTodo();
    await capturar(page, `${R}/18-guardado`, [{ en: page.locator('#btn-deshacer-ajustes'), n: 1 }, { en: page.getByRole('button', { name: /Marcar como firmada/ }), n: 2 }, { en: page.locator('#btn-descargar-area'), n: 3 }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
    await page.locator('#btn-deshacer-ajustes').click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/19-deshacer`, [{ en: cuadro().getByRole('button', { name: 'Deshacer ajustes' }), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('firmar', async () => {
    await cerrarTodo();
    await page.getByRole('button', { name: /Marcar como firmada/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/20-firmar-confirmar`, [{ en: cuadro().getByRole('button', { name: 'Marcar como firmada' }), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button', { name: 'Marcar como firmada' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/21-firmada`, [{ en: page.getByText(/Esta área ya está firmada/), n: 1 }, { en: page.locator('#btn-descargar-area'), n: 2 }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
  });
  await intentar('descargar el área y ver el Excel', async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.locator('#btn-descargar-area').click()]);
    const ruta = '.tmp/archivos/area-moldes.xlsx'; await d.saveAs(ruta); await page.waitForTimeout(1500);
    await capturar(page, `${R}/22-descargada`, [{ en: page.getByText(/Se descargó/).first(), n: 1, sinCaja: true }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } }).catch(() => {});
    const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1500, height: 560 });
    await paginaExcel(p2, ruta, 'Moldes', [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 23, 27, 31], { 6: 'x-dias', 8: 'x-fila', 23: 'x-total', 27: 'x-firmas', 31: 'x-pie' });
    await capturar(p2, `${R}/23-excel-area`, [
      { en: p2.locator('#x-dias'), n: 1 }, { en: p2.locator('#x-fila'), n: 2 }, { en: p2.locator('#x-total'), n: 3 }, { en: p2.locator('#x-firmas'), n: 4 },
    ]);
    await p2.close();
  });

  // ── Todas las áreas y la hoja Resumen ──
  await ir(page, `/nomina/reportes?periodo=${semana}`, 3500);
  await intentar('descargar todas y ver el Resumen', async () => {
    await capturar(page, `${R}/24-area-firmada`, [{ en: page.getByText(/Firmada/).first(), n: 1, sinCaja: true }], { recorte: LADO });
    await page.getByRole('button', { name: /Más opciones/ }).click(); await page.waitForTimeout(500);
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByText(/Descargar todas las áreas/).click()]);
    const ruta = '.tmp/archivos/todas.xlsx'; await d.saveAs(ruta); await page.waitForTimeout(1200);
    const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1000, height: 900 });
    await paginaExcel(p2, ruta, 'Resumen', [1, 2, 4, 5, 6, 7, 8, 12, 14, 15, 16, 17, 18, 26, 28, 29, 30, 31, 33, 35, 36, 37, 38], { 4: 'x-areas', 12: 'x-total-areas', 14: 'x-emp', 28: 'x-motivo', 35: 'x-po' });
    await capturar(p2, `${R}/25-excel-resumen`, [
      { en: p2.locator('#x-areas'), n: 1 }, { en: p2.locator('#x-emp'), n: 2 }, { en: p2.locator('#x-motivo'), n: 3 }, { en: p2.locator('#x-po'), n: 4 },
    ]);
    await p2.close();
  });

  // ── Lo que Nóminas también ve y hace ──
  await ir(page, '/tiempo-extra/recepcion', 3000);
  await intentar('por enviar al proveedor', async () => {
    await page.setViewportSize({ width: 1600, height: 1400 }); await page.waitForTimeout(500);
    await capturar(page, `${R}/26-por-enviar`, [
      { en: page.locator('#btn-formato-rutas-recepcion'), n: 1 }, { en: page.getByRole('button', { name: /Confirmar todas las de esta fecha/ }).first(), n: 2 },
      { en: page.getByRole('button', { name: /Revisar/ }).first(), n: 3 },
    ], { recorte: { ...LADO, height: 1400 } });
    await page.setViewportSize({ width: 1600, height: 900 });
  });
  await ir(page, '/transporte/formato-rutas', 2500);
  await intentar('formato de rutas', async () => {
    await capturar(page, `${R}/27-formato-rutas`, [{ en: page.locator('#btn-formato-rutas-pagina'), n: 1 }], { recorte: LADO });
  });
  await ir(page, '/transporte/solicitudes', 3000);
  await intentar('solicitudes de transporte', async () => {
    await capturar(page, `${R}/28-solicitudes-transporte`, [{ en: page.getByRole('button', { name: 'Esta semana' }), n: 1 }, { en: page.locator('select').first(), n: 2 }], { recorte: LADO });
  });
  await ir(page, '/tiempo-extra/consulta', 3000);
  await intentar('tiempo extra', async () => {
    await page.setViewportSize({ width: 1600, height: 1150 }); await page.waitForTimeout(500);
    await capturar(page, `${R}/29-tiempo-extra`, [
      { en: page.getByRole('button', { name: /Exportar consulta/ }), n: 1 }, { en: page.locator('label').filter({ hasText: /^Turno$/ }), n: 2 }, { en: page.locator('label').filter({ hasText: /^Estatus$/ }), n: 3 },
    ], { recorte: { ...LADO, height: 1150 } });
    await page.setViewportSize({ width: 1600, height: 900 });
  });
  await ir(page, '/personal/padron', 3000);
  await intentar('personal', async () => {
    await capturar(page, `${R}/30-personal`, [{ en: page.getByRole('button', { name: /Exportar padrón/ }), n: 1 }, { en: page.locator('th').filter({ hasText: /Teléfono/ }), n: 2 }], { recorte: LADO });
  });
  await ir(page, '/personal/estructura', 3000);
  await intentar('estructura', async () => {
    await capturar(page, `${R}/31-estructura`, [{ en: page.getByRole('tab', { name: 'Puestos' }), n: 1 }, { en: page.getByRole('tab', { name: 'Turnos' }), n: 2 }], { recorte: LADO });
  });
  await browser.close();
}
