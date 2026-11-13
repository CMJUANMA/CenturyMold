// Capturas anotadas del manual de RECURSOS HUMANOS (persona de ejemplo: NAVARRO PEÑA LUCÍA, analista de RH). Las llama capturas.mjs.
import { capturar } from '../anotar.mjs';
import { DIALOGO, DIALOGO_ANCHO, LADO, entrarComo, intentar } from './comun.mjs';

export async function rh({ abrir, ir, BASE }) {
  const R = 'rh';
  const { browser, page } = await abrir();
  await entrarComo(page, BASE, 'rh');

  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Por enviar al proveedor/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByText('Requieren atención', { exact: true }), n: 2, sinCaja: true },
      { en: page.getByText('Accesos rápidos', { exact: true }), n: 3, sinCaja: true },
    ]);
  });

  await ir(page, '/tiempo-extra/recepcion', 3000);
  await intentar('por enviar al proveedor', async () => {
    await capturar(page, `${R}/02-recepcion`, [
      { en: page.getByRole('button', { name: /Confirmar todas las fechas|Confirmar todas las de esta fecha/ }).first(), n: 1 },
      { en: page.getByRole('button', { name: 'Revisar', exact: true }).first(), n: 2 },
      { en: page.locator('#btn-formato-rutas-recepcion'), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('confirmar una fecha', async () => {
    await page.getByRole('button', { name: /Confirmar todas las de esta fecha/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/03-confirmar-fecha`, [{ en: page.locator('[role=dialog]').getByRole('button').last(), n: 1 }], { recorte: DIALOGO });
    await page.locator('[role=dialog]').getByRole('button').last().click(); await page.waitForTimeout(3500);
    await capturar(page, `${R}/04-confirmada`, [{ en: page.locator('[role=dialog]').getByRole('button', { name: 'Cerrar', exact: true }).last(), n: 1 }], { recorte: DIALOGO });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Cerrar', exact: true }).last().click(); await page.waitForTimeout(600);
  });
  await intentar('formato de rutas', async () => {
    await page.locator('#btn-formato-rutas-recepcion').click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/05-formato-rutas`, [
      { en: page.getByText(/Fecha de servicio/).first(), n: 1, sinCaja: true },
      { en: page.getByRole('button', { name: /Descargar Excel/ }), n: 2 },
    ], { recorte: DIALOGO });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });

  await intentar('usuarios y accesos', async () => {
    await ir(page, '/personal/accesos', 3500);
    await capturar(page, `${R}/06-usuarios`, [
      { en: page.getByRole('button', { name: /Nuevo usuario/ }), n: 1 },
      { en: page.getByRole('button', { name: /^Editar$|Editar/ }).first(), n: 2 },
      { en: page.getByRole('button', { name: /Restablecer contraseña de/ }).first(), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('nuevo usuario', async () => {
    await page.getByRole('button', { name: /Nuevo usuario/ }).click(); await page.waitForTimeout(1200);
    await page.locator('[role=dialog]').getByPlaceholder(/nómina|nombre|Buscar/i).first().fill('8060'); await page.waitForTimeout(900);
    await page.locator('[role=dialog]').getByText(/NÚÑEZ BARRERA GUSTAVO/).first().click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/07-nuevo-usuario`, [
      { en: page.locator('[role=dialog]').getByText(/NÚÑEZ BARRERA GUSTAVO/).first(), n: 1 },
      { en: page.locator('[role=dialog]').getByRole('button', { name: /Crear usuario/ }), n: 2 },
    ], { recorte: DIALOGO_ANCHO });
    await page.locator('[role=dialog]').getByRole('button', { name: /Crear usuario/ }).click(); await page.waitForTimeout(3000);
    await capturar(page, `${R}/08-contrasena-temporal`, [
      { en: page.locator('[role=dialog] .font-mono').first(), n: 1 }, { en: page.locator('#btn-copiar-password'), n: 2 }, { en: page.locator('#btn-cerrar-usuario-creado'), n: 3 },
    ], { recorte: DIALOGO });
    await page.locator('#btn-cerrar-usuario-creado').click(); await page.waitForTimeout(800);
  });
  await intentar('dar un rol (asignación)', async () => {
    const fila = page.locator('tr', { hasText: '8060' }).first();
    await fila.getByRole('button', { name: 'Editar' }).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/09-editar-usuario`, [
      { en: page.locator('[role=dialog]').getByText(/Rol y asignaciones/).first(), n: 1, sinCaja: true },
      { en: page.locator('[role=dialog]').getByRole('button', { name: /Guardar nombre y rol/ }), n: 2 },
    ], { recorte: DIALOGO_ANCHO });
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  });
  await intentar('restablecer contraseña', async () => {
    await page.getByRole('button', { name: /Restablecer contraseña de/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/10-restablecer`, [{ en: page.locator('#btn-restablecer-password'), n: 1 }], { recorte: DIALOGO });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });

  await intentar('todas las solicitudes y descarga', async () => {
    await ir(page, '/tiempo-extra/consulta', 3000);
    await capturar(page, `${R}/11-consulta`, [{ en: page.getByRole('button', { name: /Descargar/ }).first(), n: 1 }], { recorte: LADO });
  });
  await intentar('personal', async () => {
    await ir(page, '/personal/padron', 3000);
    await capturar(page, `${R}/12-personal`, [{ en: page.locator('main h1').first(), n: 1, sinCaja: true }], { recorte: LADO });
  });
  await browser.close();
}
