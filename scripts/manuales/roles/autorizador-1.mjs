// Capturas anotadas del manual del AUTORIZADOR 1 (persona de ejemplo: CORTÉS BRAVO HÉCTOR, jefe de Moldes). Las llama capturas.mjs.
import { capturar } from '../anotar.mjs';
import { DETALLE_A as DETALLE, DIALOGO_A as DIALOGO, LADO_A as LADO, VENTANA_ANCHA, alFinalDelCuadro, entrarComo, intentar } from './comun.mjs';

export async function autorizador1({ abrir, ir, BASE }) {
  const R = 'autorizador-1';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  await entrarComo(page, BASE, 'aut1');

  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Por autorizar/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByText(/Por autorizar/).nth(1), n: 2 },
    ]);
  });

  await ir(page, '/tiempo-extra/autorizar', 3000);
  await intentar('bandeja', async () => {
    await capturar(page, `${R}/02-bandeja`, [
      { en: page.getByRole('tab', { name: /Por autorizar/ }), n: 1 },
      { en: page.getByRole('button', { name: 'Revisar', exact: true }).first(), n: 2 },
      { en: page.locator('label').filter({ hasText: /^Todas$/ }).first(), n: 3 },
      { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }), n: 4 },
    ], { recorte: LADO });
  });
  // Varias a la vez: se marcan dos, se captura y se desmarcan (el manual lo explica; aquí no se firma todavía)
  await intentar('varias a la vez', async () => {
    const casillas = page.getByRole('checkbox', { name: /Seleccionar TE-/ });
    await casillas.nth(0).check(); await casillas.nth(1).check(); await page.waitForTimeout(400);
    await capturar(page, `${R}/03-varias`, [
      { en: casillas.nth(0), n: 1 }, { en: casillas.nth(1), n: 1, sinCaja: false },
      { en: page.getByRole('button', { name: /Autorizar .*seleccionadas/ }), n: 2 },
    ], { recorte: LADO });
    await casillas.nth(0).uncheck(); await casillas.nth(1).uncheck();
  });

  await intentar('revisar y autorizar', async () => {
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click(); await page.waitForTimeout(2500);
    await alFinalDelCuadro(page); await page.waitForTimeout(400);
    await capturar(page, `${R}/04-detalle`, [
      { en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }, { en: page.locator('#btn-autorizar'), n: 3 },
    ], { recorte: DETALLE });
    await page.locator('#comentario-firma').fill('Va bien, adelante.');
    await page.locator('#btn-autorizar').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/05-autorizada`, [{ en: page.getByText(/Autorizaste TE-/).first(), n: 1 }], { recorte: LADO });
  });

  await intentar('devolver', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click(); await page.waitForTimeout(2500);
    await page.locator('#comentario-firma').fill('Faltan los horarios del turno de la noche. Corrígelos y reenvía.'); await alFinalDelCuadro(page); await page.waitForTimeout(300);
    await capturar(page, `${R}/06-devolver`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.locator('#btn-devolver').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/07-devuelta`, [{ en: page.getByText(/Devolviste TE-/).first(), n: 1 }], { recorte: LADO });
  });

  await intentar('vencidas', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('tab', { name: /Vencidas/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/08-vencidas`, [{ en: page.getByRole('tab', { name: /Vencidas/ }), n: 1 }, { en: page.getByRole('button', { name: /Ver|Revisar/ }).first(), n: 2 }], { recorte: LADO });
  });
  await intentar('historial', async () => {
    await page.getByRole('tab', { name: /Historial de mi área/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/09-historial`, [{ en: page.getByRole('tab', { name: /Historial de mi área/ }), n: 1 }], { recorte: LADO });
  });
  await intentar('mis solicitudes', async () => {
    await ir(page, '/tiempo-extra/mis-solicitudes', 2500);
    await capturar(page, `${R}/10-mis-solicitudes`, [{ en: page.getByRole('link', { name: /Solicitar tiempo extra/ }).last(), n: 1 }], { recorte: LADO });
  });
  await browser.close();
}
