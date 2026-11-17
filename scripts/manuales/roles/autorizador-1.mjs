// Capturas anotadas del manual del AUTORIZADOR 1 (persona de ejemplo: CORTÉS BRAVO HÉCTOR, jefe de Moldes). Las llama capturas.mjs. Solo datos ficticios del emulador.
import { capturar } from '../anotar.mjs';
import { DETALLE_A as DETALLE, LADO_A as LADO, VENTANA_ANCHA, alFinalDelCuadro, alrededorDelCuadro, entrarComo, intentar } from './comun.mjs';

export async function autorizador1({ abrir, ir, BASE }) {
  const R = 'autorizador-1';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  const cuadro = () => page.locator('[role=dialog]');
  const cerrarTodo = async () => { for (let i = 0; i < 3; i++) { if (!(await cuadro().count())) break; const b = cuadro().last().getByRole('button', { name: /^(Cancelar|Cerrar)$/ }).first(); if (await b.count()) await b.click().catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(500); } };
  await entrarComo(page, BASE, 'aut1');

  // ── Primeros pasos ──
  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Por autorizar/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByText('Ir a la bandeja'), n: 2 },
      { en: page.getByText('Personal de mi área').first(), n: 3 },
      { en: page.getByText('Últimas solicitudes de mi área'), n: 4, sinCaja: true },
    ]);
  });
  await intentar('menu', async () => {
    await capturar(page, `${R}/02-menu`, [
      { en: page.getByRole('link', { name: 'Solicitar tiempo extra' }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Mis solicitudes' }), n: 2, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Por autorizar/ }).first(), n: 3, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Mi área' }), n: 4, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Ayuda y manuales/ }), n: 5, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 345, height: 900 } });
  });

  // ── Por autorizar ──
  await ir(page, '/tiempo-extra/autorizar', 3000);
  await intentar('bandeja', async () => {
    await capturar(page, `${R}/03-bandeja`, [
      { en: page.getByRole('tab', { name: /Por autorizar/ }), n: 1 },
      { en: page.getByRole('tab', { name: /Vencidas/ }), n: 2 },
      { en: page.getByRole('tab', { name: /Historial de mi área/ }), n: 3 },
      { en: page.getByText('Vence hoy').first(), n: 4 },
      { en: page.getByRole('button', { name: /Revisar/ }).first(), n: 5 },
    ], { recorte: LADO });
  });
  await intentar('filtros y selección', async () => {
    await capturar(page, `${R}/04-filtros`, [
      { en: page.locator('select').first(), n: 1 }, { en: page.locator('input[type=date]').first(), n: 2 },
      { en: page.locator('label').filter({ hasText: /^Todas$/ }).first(), n: 3 },
      { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first(), n: 4 },
    ], { recorte: LADO });
  });
  await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
  await intentar('detalle arriba', async () => {
    await capturar(page, `${R}/05-detalle-arriba`, [
      { en: cuadro().locator('h2').first(), n: 1 }, { en: cuadro().getByText(/Empleados por horario/), n: 2 },
    ], { recorte: DETALLE });
  });
  await intentar('detalle empleados', async () => {
    await cuadro().getByText(/^Empleados \(/).scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await capturar(page, `${R}/06-detalle-empleados`, [
      { en: cuadro().getByText(/^Empleados \(/), n: 1 },
      { en: cuadro().locator('th').filter({ hasText: /^Horario$/ }), n: 2 },
      { en: cuadro().locator('th').filter({ hasText: /^Alimentos$/ }), n: 3 },
    ], { recorte: DETALLE });
  });
  await intentar('detalle abajo', async () => {
    await alFinalDelCuadro(page); await page.waitForTimeout(400);
    await capturar(page, `${R}/07-detalle-abajo`, [
      { en: cuadro().getByText(/^Historial$/), n: 1 },
      { en: page.locator('#comentario-firma'), n: 2 }, { en: page.locator('#btn-devolver'), n: 3 }, { en: page.locator('#btn-autorizar'), n: 4 },
    ], { recorte: DETALLE });
  });
  await intentar('autorizar', async () => {
    await page.locator('#btn-autorizar').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/08-autorizada`, [{ en: page.getByText(/Autorizaste TE-|Lista|Listo/).first(), n: 1 }], { recorte: LADO });
  });
  await intentar('devolver', async () => {
    await cerrarTodo(); await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await alFinalDelCuadro(page); await page.waitForTimeout(300);
    await capturar(page, `${R}/09-devolver-sin-motivo`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.locator('#comentario-firma').fill('Faltan los horarios del turno de la noche. Corrígelos y reenvía.'); await page.waitForTimeout(300);
    await capturar(page, `${R}/10-devolver`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.locator('#btn-devolver').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/11-devuelta`, [{ en: page.getByText(/Devolviste|devuelta|Devuelta/).first(), n: 1 }], { recorte: LADO });
  });
  await intentar('autorizar varias', async () => {
    await cerrarTodo(); await ir(page, '/tiempo-extra/autorizar', 2500);
    const casillas = page.locator('input[type=checkbox]');
    const n = await casillas.count();
    for (let i = 0; i < Math.min(n, 2); i++) await casillas.nth(i).check();
    await capturar(page, `${R}/12-varias`, [{ en: casillas.first(), n: 1 }, { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first(), n: 2 }], { recorte: LADO });
    await page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/13-varias-confirmar`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });

  // ── Vencidas e historial ──
  await intentar('vencidas', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('tab', { name: /Vencidas/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/14-vencidas`, [{ en: page.getByRole('tab', { name: /Vencidas/ }), n: 1 }, { en: page.getByText(/No se autorizó antes de la fecha/).first(), n: 2 }, { en: page.getByRole('button', { name: /^Ver/ }).first(), n: 3 }], { recorte: LADO });
    await page.getByRole('button', { name: /^Ver/ }).first().click(); await page.waitForTimeout(2200);
    await capturar(page, `${R}/15-vencida-detalle`, [{ en: cuadro().getByText('Vencida', { exact: true }).first(), n: 1 }], { recorte: DETALLE });
    await cerrarTodo();
  });
  await intentar('historial', async () => {
    await page.getByRole('tab', { name: /Historial de mi área/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/16-historial`, [{ en: page.getByRole('tab', { name: /Historial de mi área/ }), n: 1 }, { en: page.getByRole('button', { name: /^Ver/ }).first(), n: 2 }], { recorte: LADO });
  });

  // ── Mi área y personal ──
  await ir(page, '/personal/accesos/organigrama', 3000);
  await intentar('mi área', async () => {
    await capturar(page, `${R}/17-mi-area`, [{ en: page.getByText('Nivel 2 · Planta'), n: 1 }, { en: page.getByText(/Autoriza nivel 1/).first(), n: 2 }, { en: page.getByText(/Solicitantes/).first(), n: 3, sinCaja: true }], { recorte: LADO });
  });
  await ir(page, '/personal/lista', 2500);
  await intentar('lista de personal', async () => {
    await capturar(page, `${R}/18-lista-personal`, [{ en: page.getByPlaceholder(/Buscar/), n: 1 }, { en: page.locator('th').first(), n: 2 }], { recorte: LADO });
  });

  // ── Si tú también pides tiempo extra ──
  await ir(page, '/tiempo-extra/nueva', 2500);
  await intentar('solicitar', async () => {
    await capturar(page, `${R}/19-solicitar`, [{ en: page.getByText(/Al enviarla pasa directo a Autorización 2/).first(), n: 1, sinCaja: true }, { en: page.getByText('Datos generales').first(), n: 2, sinCaja: true }], { recorte: LADO });
  });
  await ir(page, '/tiempo-extra/mis-solicitudes', 2500);
  await intentar('mis solicitudes', async () => {
    await capturar(page, `${R}/20-mis-solicitudes`, [{ en: page.getByText('Solicitar tiempo extra', { exact: true }).first(), n: 1 }, { en: page.getByRole('tab', { name: /Devueltas/ }), n: 2 }], { recorte: LADO });
  });
  await browser.close();
}
