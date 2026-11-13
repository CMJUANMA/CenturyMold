// Capturas anotadas del manual de NÓMINAS (persona de ejemplo: ESCOBAR TREJO MARTÍN, analista de nómina). Las llama capturas.mjs.
import { capturar } from '../anotar.mjs';
import { DIALOGO, DIALOGO_ANCHO, LADO, claveSemana, entrarComo, intentar } from './comun.mjs';

export async function nominas({ abrir, ir, BASE }) {
  const R = 'nominas';
  const { browser, page } = await abrir();
  await entrarComo(page, BASE, 'nomina');
  const semana = claveSemana(new Date());

  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Reportes de nómina|Formato de tiempo extra/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.locator('main h1').first(), n: 2, sinCaja: true },
    ]);
  });

  await ir(page, `/nomina/reportes?periodo=${semana}`, 3500);
  await intentar('la semana', async () => {
    await capturar(page, `${R}/02-semana`, [
      { en: page.getByRole('button', { name: 'Semana anterior' }), n: 1 },
      { en: page.getByRole('button', { name: /^Revisar Moldes|Revisar/ }).first(), n: 2 },
      { en: page.locator('#btn-descargar-todas'), n: 3 },
    ], { recorte: LADO });
  });

  await intentar('revisar el área', async () => {
    await ir(page, `/nomina/semana/${semana}/moldes`, 3500);
    await capturar(page, `${R}/03-revisar-area`, [
      { en: page.locator('[data-hoja] thead th').nth(6), n: 1 },
      { en: page.locator('[data-hoja] tbody tr').first().locator('input').nth(3), n: 2 },
      { en: page.locator('#btn-agregar-empleado-nomina'), n: 3 },
      { en: page.locator('#btn-descargar-area'), n: 4 },
    ]);
  });
  await intentar('corregir horas', async () => {
    const celda = page.locator('[data-hoja] tbody tr').first().locator('input:not([disabled])').first();
    await celda.fill('5'); await celda.press('Tab'); await page.waitForTimeout(700);
    await capturar(page, `${R}/04-horas`, [
      { en: celda, n: 1 }, { en: page.locator('#texto-sin-guardar'), n: 2 }, { en: page.locator('#btn-guardar-cambios'), n: 3 },
    ]);
  });
  await intentar('quitar a un empleado', async () => {
    const fila = page.locator('[data-hoja] tbody tr').nth(1);
    await fila.getByRole('button', { name: /Acciones de/ }).click(); await page.waitForTimeout(700);
    await capturar(page, `${R}/05-menu-renglon`, [{ en: page.getByRole('menuitem', { name: /Quitar/ }), n: 1 }]);
    await page.getByRole('menuitem', { name: /Quitar/ }).click(); await page.waitForTimeout(1000);
    await page.locator('[role=dialog] input[type=text], [role=dialog] textarea').first().fill('No asistió');
    await capturar(page, `${R}/06-quitar-motivo`, [
      { en: page.locator('[role=dialog] input[type=text], [role=dialog] textarea').first(), n: 1 }, { en: page.locator('[role=dialog]').getByRole('button', { name: 'Quitar', exact: true }), n: 2 },
    ], { recorte: DIALOGO });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Quitar', exact: true }).click(); await page.waitForTimeout(800);
  });
  await intentar('agregar a un empleado', async () => {
    await page.locator('#btn-agregar-empleado-nomina').click(); await page.waitForTimeout(1200);
    await page.locator('[role=dialog]').getByPlaceholder(/Buscar por nombre o nómina/).first().fill('8061'); await page.waitForTimeout(900);
    await page.locator('[role=dialog]').getByText(/OCAMPO SILVA BERTHA/).first().click(); await page.waitForTimeout(700);
    await page.getByRole('button', { name: /Sí, agregarlo aquí/ }).click().catch(() => {}); await page.waitForTimeout(500); // es de Almacén: se acepta agregarla a Moldes
    await page.locator('[role=dialog] select').first().selectOption({ label: 'Inventario físico' }).catch(() => {});
    await page.locator('[role=dialog]').getByPlaceholder(/Trabajó el sábado/).fill('Trabajó el sábado y no venía en la solicitud');
    await capturar(page, `${R}/07-agregar`, [
      { en: page.locator('[role=dialog]').getByText(/OCAMPO SILVA BERTHA/).first(), n: 1 },
      { en: page.locator('[role=dialog]').getByPlaceholder(/Trabajó el sábado/), n: 2 },
      { en: page.locator('[role=dialog]').getByRole('button', { name: /Agregar al formato/ }), n: 3 },
    ], { recorte: DIALOGO_ANCHO });
    await page.locator('[role=dialog]').getByRole('button', { name: /Agregar al formato/ }).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/08-agregado`, [{ en: page.locator('[data-hoja] tbody tr', { hasText: 'OCAMPO' }).first(), n: 1 }]);
  });
  await intentar('guardar y firmar', async () => {
    const fila = page.locator('[data-hoja] tbody tr', { hasText: 'OCAMPO' }).first();
    await fila.locator('input:not([disabled])').first().fill('4'); await fila.locator('input:not([disabled])').first().press('Tab'); await page.waitForTimeout(600);
    await page.locator('#btn-guardar-cambios').click(); await page.waitForTimeout(1200);
    await page.locator('[role=dialog] input[type=text], [role=dialog] textarea').first().fill('Corrección de asistencia de la semana');
    await capturar(page, `${R}/09-guardar`, [
      { en: page.locator('[role=dialog] input[type=text], [role=dialog] textarea').first(), n: 1 }, { en: page.locator('[role=dialog]').getByRole('button', { name: 'Guardar cambios' }), n: 2 },
    ], { recorte: DIALOGO });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Guardar cambios' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/10-firmar`, [{ en: page.getByRole('button', { name: /Marcar como firmada/ }), n: 1 }, { en: page.locator('#btn-descargar-area'), n: 2 }]);
    await page.getByRole('button', { name: /Marcar como firmada/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/11-firmar-confirmar`, [{ en: page.locator('[role=dialog]').getByRole('button', { name: 'Marcar como firmada' }), n: 1 }], { recorte: DIALOGO });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Marcar como firmada' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/12-firmada`, [{ en: page.getByText(/Esta área ya está firmada/), n: 1 }]);
  });
  await intentar('tiempo extra', async () => {
    await ir(page, '/tiempo-extra/consulta', 3000);
    await capturar(page, `${R}/13-tiempo-extra`, [{ en: page.locator('main h1').first(), n: 1, sinCaja: true }], { recorte: LADO });
  });
  await browser.close();
}
