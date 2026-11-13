// Capturas anotadas del manual del AUTORIZADOR 2 (persona de ejemplo: IBARRA SALAZAR ROBERTO, gerente de operaciones). Las llama capturas.mjs.
import { capturar } from '../anotar.mjs';
import { DETALLE_A as DETALLE, DIALOGO_A as DIALOGO, LADO_A as LADO, VENTANA_ANCHA, alFinalDelCuadro, entrarComo, intentar } from './comun.mjs';

export async function autorizador2({ abrir, ir, BASE }) {
  const R = 'autorizador-2';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  await entrarComo(page, BASE, 'aut2');

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
      { en: page.getByRole('button', { name: /Revisar/ }).first(), n: 2 },
      { en: page.locator('label').filter({ hasText: /^Todas$/ }).first(), n: 3 },
      { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first(), n: 4 },
    ], { recorte: LADO });
  });
  await intentar('revisar y autorizar', async () => {
    await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await alFinalDelCuadro(page); await page.waitForTimeout(400);
    await capturar(page, `${R}/03-detalle`, [
      { en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }, { en: page.locator('#btn-autorizar'), n: 3 },
    ], { recorte: DETALLE });
    await page.locator('#btn-autorizar').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/04-autorizada`, [{ en: page.getByText(/Autorizaste TE-|Recursos Humanos ya/).first(), n: 1 }], { recorte: LADO });
  });
  await intentar('devolver', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await page.locator('#comentario-firma').fill('El horario no coincide con el pedido. Revisa y reenvía.'); await alFinalDelCuadro(page); await page.waitForTimeout(300);
    await capturar(page, `${R}/05-devolver`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });

  await intentar('vencidas y fuera de tiempo', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('tab', { name: /Vencidas/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/06-vencidas`, [{ en: page.getByRole('tab', { name: /Vencidas/ }), n: 1 }, { en: page.getByRole('button', { name: /Ver|Revisar/ }).first(), n: 2 }], { recorte: LADO });
    await page.getByRole('button', { name: /Ver|Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/07-fuera-de-tiempo`, [{ en: page.locator('[role=dialog]').getByRole('button', { name: /Autorizar fuera de tiempo/ }), n: 1 }], { recorte: DETALLE });
    await page.locator('[role=dialog]').getByRole('button', { name: /Autorizar fuera de tiempo/ }).click(); await page.waitForTimeout(1200);
    await page.locator('[role=dialog] textarea').last().fill('Sí se trabajó; la autorización no se alcanzó a firmar a tiempo.');
    await capturar(page, `${R}/08-fuera-de-tiempo-motivo`, [
      { en: page.locator('[role=dialog] textarea').last(), n: 1 }, { en: page.locator('[role=dialog]').getByRole('button').last(), n: 2 },
    ], { recorte: DIALOGO });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });

  await intentar('consulta', async () => {
    await ir(page, '/tiempo-extra/consulta', 3000);
    await capturar(page, `${R}/09-consulta`, [{ en: page.getByRole('link', { name: /Todas las solicitudes|Tiempo extra/ }).first(), n: 1, flecha: 'derecha' }], { recorte: LADO });
  });
  await intentar('asignaciones', async () => {
    await ir(page, '/personal/accesos/asignaciones', 3000);
    await capturar(page, `${R}/10-asignaciones`, [{ en: page.locator('main h1').first(), n: 1, sinCaja: true }], { recorte: LADO });
  });
  await browser.close();
}
