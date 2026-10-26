// Capturas anotadas del manual del SOLICITANTE (persona de ejemplo: VARGAS SOLÍS ANDREA, solicitante de Moldes). Las llama capturas.mjs.
import { capturar } from '../anotar.mjs';
import { PASSWORD, USUARIOS } from '../datos-demo-usuarios.mjs';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const enDias = (n) => ymd(new Date(Date.now() + n * 86400000));
const intentar = async (nombre, fn) => { try { await fn(); } catch (e) { console.log(`  ✗ ${nombre}: ${String(e.message).split('\n')[0]}`); } };
// Recortes (px de la ventana de 1366 × 820): se quita el menú lateral para que lo importante salga más grande
const LADO = { x: 288, y: 0, width: 1078, height: 820 };
const DIALOGO_ANCHO = { x: 280, y: 30, width: 806, height: 760 };
const DETALLE = { x: 225, y: 8, width: 916, height: 804 };
const SELECT_MOTIVO = (page) => page.locator('select').filter({ has: page.locator('option', { hasText: 'Elige el motivo' }) });

/** @param {{ abrir, entrar, ir, BASE }} h */
export async function solicitante({ abrir, ir, BASE, CELULAR }) {
  const R = 'solicitante';
  const { browser, page } = await abrir();

  await intentar('entrar', async () => {
    await page.goto(BASE + '/login'); await page.waitForTimeout(1200);
    await page.fill('#login-nomina', USUARIOS.solicitante[0]);
    await page.fill('#login-password', PASSWORD);
    await capturar(page, `${R}/01-entrar`, [
      { en: page.locator('#login-nomina'), n: 1 }, { en: page.locator('#login-password'), n: 2 },
      { en: page.locator('#btn-ingresar'), n: 3 }, { en: page.locator('#btn-olvide-password'), n: 4 },
    ], { recorte: { x: 400, y: 60, width: 566, height: 650 } });
    await page.click('#btn-olvide-password'); await page.waitForTimeout(600);
    await capturar(page, `${R}/02-olvide-contrasena`, [{ en: page.locator('#btn-entendido-password'), n: 1 }], { recorte: { x: 380, y: 230, width: 606, height: 360 } });
    await page.click('#btn-entendido-password');
  });

  await intentar('cambio de contraseña', async () => {
    const otro = await abrir();
    await otro.page.goto(BASE + '/login'); await otro.page.waitForTimeout(800);
    await otro.page.fill('#login-nomina', USUARIOS.nuevo[0]); await otro.page.fill('#login-password', PASSWORD);
    await otro.page.click('#btn-ingresar'); await otro.page.waitForTimeout(3000);
    // Al entrar con la contraseña temporal solo pide la nueva y su confirmación (la temporal se pide únicamente si la sesión ya no es reciente)
    const claves = otro.page.locator('input[type=password]');
    const n = await claves.count();
    for (let i = 0; i < n; i++) await claves.nth(i).fill(i === 0 && n === 3 ? PASSWORD : 'MiNuevaClave2026');
    await capturar(otro.page, `${R}/03-cambiar-contrasena`, [
      ...Array.from({ length: n }, (_, i) => ({ en: claves.nth(i), n: i + 1 })), { en: otro.page.locator('button[type=submit]'), n: n + 1 },
    ], { recorte: { x: 470, y: 150, width: 426, height: 520 } });
    await otro.browser.close();
  });

  await page.click('#btn-ingresar'); await page.waitForURL(u => !u.pathname.includes('/login')); await page.waitForTimeout(2500);
  await intentar('inicio', async () => {
    await capturar(page, `${R}/04-inicio`, [
      { en: page.getByRole('link', { name: 'Solicitar tiempo extra' }).last(), n: 1 },
      { en: page.getByText('Devueltas', { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), n: 2 },
      { en: page.getByText('Próximos tiempos extra autorizados'), n: 3 },
      { en: page.locator('#btn-cerrar-sesion'), n: 4, flecha: 'derecha' },
    ]);
  });

  await intentar('mi cuenta', async () => {
    await ir(page, '/mi-cuenta', 2500);
    await capturar(page, `${R}/05-mi-cuenta`, [
      { en: page.getByRole('button', { name: /Grande/ }).first(), n: 1 },
      { en: page.getByRole('button', { name: /^Claro/ }).first(), n: 2 },
      { en: page.locator('#btn-cerrar-sesion'), n: 3, flecha: 'derecha' },
    ]);
  });

  // Solicitar tiempo extra
  await ir(page, '/tiempo-extra/nueva', 2500);
  await intentar('formulario: datos', async () => {
    const area = page.locator('select').first();
    if ((await area.locator('option').count()) > 1) await area.selectOption({ label: 'Moldes' }).catch(() => {});
    await page.locator('input[type=date]').first().fill(enDias(6));
    await SELECT_MOTIVO(page).first().selectOption({ label: 'Inventario físico' });
    await page.locator('input[placeholder^="Ej."]').first().fill('apoyo a inventario de fin de mes');
    await capturar(page, `${R}/06-formulario-datos`, [
      { en: page.getByLabel('Área'), n: 1 }, { en: page.locator('input[type=date]').first(), n: 2 }, { en: SELECT_MOTIVO(page).first(), n: 3 }, { en: page.locator('input[placeholder^="Ej."]').first(), n: 4 },
    ], { recorte: LADO });
  });
  await intentar('varios motivos y P.O.', async () => {
    await page.getByRole('button', { name: /Agregar otro motivo/ }).click(); await page.waitForTimeout(500);
    await SELECT_MOTIVO(page).nth(1).selectOption({ label: 'Cargo a P.O.' }); await page.waitForTimeout(500);
    await capturar(page, `${R}/07-varios-motivos`, [
      { en: page.getByRole('button', { name: /Agregar otro motivo/ }), n: 1 }, { en: SELECT_MOTIVO(page).nth(1), n: 2 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Quitar/ }).last().click().catch(() => {});
  });
  await intentar('extensión de turno', async () => {
    await capturar(page, `${R}/08-tipo-extension`, [
      { en: page.getByText('Turno extra / día extra').first(), n: 1 }, { en: page.getByText('Extensión de turno').first(), n: 2 },
    ], { recorte: LADO });
  });
  await intentar('agregar empleados', async () => {
    await page.locator('textarea').first().fill('Inventario físico de fin de mes en el almacén de moldes');
    await page.getByRole('button', { name: /Agregar empleados/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/09-agregar-empleados`, [
      { en: page.getByPlaceholder('Nombre o nómina'), n: 1 }, { en: page.locator('[role=dialog] label').filter({ hasText: 'ÁLVAREZ CAMPOS JORGE' }).first(), n: 2 },
      { en: page.getByText(/Seleccionar los \d+ visibles/), n: 3 }, { en: page.locator('[role=dialog]').getByRole('button').last(), n: 4 },
    ], { recorte: DIALOGO_ANCHO });
    // tres de la Ruta Norte y uno de la Ruta Sur (así se ve el aviso de más de una ruta)
    for (const n of ['ÁLVAREZ CAMPOS JORGE', 'BENÍTEZ ROMERO ALMA', 'ESPARZA MONTES RAÚL', 'CARRILLO NIETO SAÚL']) await page.getByText(n).first().click();
    await page.locator('[role=dialog]').getByRole('button').last().click(); await page.waitForTimeout(1500);
  });
  await intentar('horario', async () => {
    const entrada = page.locator('select').filter({ has: page.locator('option', { hasText: 'Entrada…' }) }).first();
    const salida = page.locator('select').filter({ has: page.locator('option', { hasText: 'Salida…' }) }).first();
    await entrada.selectOption({ index: 1 }); await salida.selectOption({ index: 1 });
    await capturar(page, `${R}/10-horario-para-todos`, [
      { en: entrada, n: 1 }, { en: salida, n: 2 }, { en: page.getByRole('button', { name: 'Aplicar horario' }), n: 3 },
      { en: [page.getByRole('button', { name: 'Con alimentos' }), page.getByRole('button', { name: 'Sin alimentos' })], n: 4 },
      { en: page.getByRole('button', { name: 'Con transporte' }), n: 5 }, { en: page.getByRole('button', { name: 'Sin transporte' }) },
    ], { recorte: LADO });
    await page.getByRole('button', { name: 'Aplicar horario' }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Con alimentos' }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Confirmar las rutas del padrón/ }).click().catch(() => {}); await page.waitForTimeout(800);
  });
  await intentar('fila de un empleado', async () => {
    const fila = page.getByText('ÁLVAREZ CAMPOS JORGE').first().locator('xpath=ancestor::*[.//select][2]');
    await fila.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -60)); await page.waitForTimeout(400);
    await capturar(page, `${R}/11-fila-empleado`, [
      { en: page.getByText('ÁLVAREZ CAMPOS JORGE').first(), n: 1 },
      { en: page.locator('select').filter({ has: page.locator('option', { hasText: '7:00 a. m.' }) }).nth(2), n: 2 },
      { en: page.getByText('Ruta de transporte').first(), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('más de una ruta', async () => {
    const just = page.getByPlaceholder(/Explica por qué no basta una sola ruta/);
    await just.scrollIntoViewIfNeeded();
    await just.fill('Dos empleados viven en la Ruta Sur y no hay otra forma de traerlos');
    await page.evaluate(() => window.scrollBy(0, 200)); await page.waitForTimeout(300);
    await capturar(page, `${R}/12-mas-de-una-ruta`, [{ en: page.getByText(/Esta solicitud usa 2 rutas/), n: 1 }, { en: just, n: 2 }], { recorte: LADO });
  });
  await intentar('barra de envío', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(500);
    await capturar(page, `${R}/13-guardar-o-enviar`, [
      { en: page.getByText('Empleados', { exact: true }).last(), n: 1, sinCaja: true },
      { en: page.getByRole('button', { name: /Guardar borrador/ }), n: 2 }, { en: page.getByRole('button', { name: /Enviar a autorización/ }), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('confirmar envío', async () => {
    await page.getByRole('button', { name: /Enviar a autorización/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/14-confirmar-envio`, [{ en: page.locator('[role=dialog]').getByRole('button', { name: 'Enviar', exact: true }), n: 1 }], { recorte: { x: 440, y: 210, width: 486, height: 400 } });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Enviar', exact: true }).click(); await page.waitForTimeout(3000);
  });

  // Mis solicitudes y sus acciones
  await ir(page, '/tiempo-extra/mis-solicitudes', 2500);
  await intentar('mis solicitudes', async () => {
    await capturar(page, `${R}/15-mis-solicitudes`, [
      { en: page.getByRole('tab', { name: /En autorización/ }), n: 1 }, { en: page.getByRole('tab', { name: /Devueltas/ }), n: 2 },
      { en: page.locator('tbody tr').first().locator('td').nth(6), n: 3 }, { en: page.locator('tbody tr').first().locator('td').last(), n: 4 },
    ], { recorte: LADO });
  });
  await intentar('ver detalle', async () => {
    await page.getByRole('tab', { name: /En autorización/ }).click(); await page.waitForTimeout(600);
    await page.getByRole('button', { name: /^Ver/ }).first().click(); await page.waitForTimeout(1800);
    await capturar(page, `${R}/16-detalle`, [
      { en: page.locator('[role=dialog]').getByText('Estatus', { exact: true }).locator('xpath=..'), n: 1 }, { en: page.locator('[role=dialog]').getByText('Empleados por horario'), n: 2 },
    ], { recorte: DETALLE });
    await page.locator('[role=dialog]').evaluate(d => { const c = d.querySelector('.overflow-y-auto') ?? d; c.scrollTop = c.scrollHeight; }).catch(() => {}); await page.waitForTimeout(500);
    await capturar(page, `${R}/17-detalle-historial`, [{ en: page.locator('[role=dialog]').getByText('Historial', { exact: true }), n: 1 }], { recorte: DETALLE });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });
  await intentar('cancelar', async () => {
    await page.getByRole('tab', { name: /En autorización/ }).click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/18-cancelar`, [{ en: page.getByRole('button', { name: /^Cancelar$/ }).first(), n: 1 }], { recorte: LADO });
    await page.getByRole('button', { name: /^Cancelar$/ }).first().click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/19-cancelar-motivo`, [{ en: page.locator('[role=dialog] textarea, [role=dialog] input[type=text]').first(), n: 1 }, { en: page.locator('[role=dialog]').getByRole('button').last(), n: 2 }], { recorte: { x: 450, y: 180, width: 466, height: 460 } });
    await page.locator('[role=dialog]').getByRole('button', { name: 'Cancelar', exact: true }).click(); await page.waitForTimeout(600);
  });
  await intentar('corregir una devuelta', async () => {
    await page.getByRole('tab', { name: /Devueltas/ }).click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/20-devuelta`, [{ en: page.getByRole('button', { name: /Corregir y reenviar/ }).first(), n: 1 }], { recorte: LADO });
    await page.getByRole('button', { name: /Corregir y reenviar/ }).first().click(); await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capturar(page, `${R}/21-corregir-devuelta`, [
      { en: page.getByText('Devuelta por Autorización 1').locator('xpath=ancestor::*[contains(@class,"rounded")][1]'), n: 1 },
      { en: page.getByRole('button', { name: /Reenviar a autorización/ }), n: 2 }, { en: page.getByRole('button', { name: /Cancelar solicitud/ }), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('vencidas', async () => {
    await ir(page, '/tiempo-extra/mis-solicitudes', 2500);
    await page.getByRole('tab', { name: /Vencidas/ }).click(); await page.waitForTimeout(800);
    await capturar(page, `${R}/22-vencidas`, [{ en: page.getByRole('button', { name: /Duplicar con otra fecha/ }).first(), n: 1 }], { recorte: LADO });
    await page.getByRole('button', { name: /Duplicar con otra fecha/ }).first().click(); await page.waitForTimeout(1000);
    await page.locator('[role=dialog] input[type=date]').fill(enDias(5)); await page.waitForTimeout(600);
    await capturar(page, `${R}/23-duplicar`, [{ en: page.locator('[role=dialog] input[type=date]'), n: 1 }, { en: page.locator('[role=dialog]').getByRole('button', { name: /Crear borrador/ }), n: 2 }], { recorte: { x: 420, y: 230, width: 526, height: 360 } });
  });
  await browser.close();
}

/** En el celular (el solicitante captura desde su teléfono) */
export async function solicitanteCelular({ abrir, BASE, CELULAR }) {
  const R = 'solicitante';
  const cel = await abrir(CELULAR, true);
  await intentar('celular', async () => {
    const p = cel.page;
    await p.goto(BASE + '/login'); await p.waitForTimeout(1000);
    await p.fill('#login-nomina', USUARIOS.solicitante[0]); await p.fill('#login-password', PASSWORD);
    await p.click('#btn-ingresar'); await p.waitForURL(u => !u.pathname.includes('/login')); await p.waitForTimeout(2500);
    await capturar(p, `${R}/24-celular-inicio`, [{ en: p.locator('#btn-menu-movil'), n: 1 }, { en: p.locator('main').getByRole('link', { name: 'Solicitar tiempo extra' }).first(), n: 2 }]);
    await p.goto(BASE + '/tiempo-extra/nueva'); await p.waitForTimeout(2500);
    await capturar(p, `${R}/26-celular-solicitar`, [{ en: p.locator('input[type=date]').first(), n: 1 }, { en: p.getByRole('button', { name: /Enviar a autorización/ }), n: 2 }]);
  });
  await cel.browser.close();
}
