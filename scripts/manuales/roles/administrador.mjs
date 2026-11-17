// Capturas anotadas del manual del ADMINISTRADOR (persona de ejemplo: SISTEMAS DEMO). Las llama capturas.mjs.
// SOLO EMULADOR: «Preparar para producción» (fase 2) borra datos de verdad; aquí corre contra el emulador con datos inventados y este guion se niega a correr contra otra dirección.
import { capturar } from '../anotar.mjs';
import { LADO_A as LADO, VENTANA_ANCHA, alrededorDelCuadro, entrarComo, intentar } from './comun.mjs';

export async function administrador({ abrir, ir, BASE }) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE)) throw new Error('El manual del administrador solo se captura contra el emulador local (localhost). BASE = ' + BASE);
  const R = 'administrador';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  const cuadro = () => page.locator('[role=dialog]');
  const cerrarTodo = async () => { for (let i = 0; i < 3; i++) { if (!(await cuadro().count())) break; const b = cuadro().last().getByRole('button', { name: /^(Cancelar|Cerrar)$/ }).first(); if (await b.count()) await b.click().catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(500); } };
  const alto = async (h) => { await page.setViewportSize({ width: 1600, height: h }); await page.waitForTimeout(500); };
  await entrarComo(page, BASE, 'admin');

  // ── Primeros pasos ──
  await intentar('inicio', async () => {
    await alto(1100);
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByText('Descarga el respaldo semanal'), n: 1, sinCaja: true },
      { en: page.getByText('Ir a Herramientas').first(), n: 2 },
      { en: page.getByRole('link', { name: /Diagnóstico y limpieza/ }), n: 3, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 1600, height: 1100 } });
    await alto(900);
  });
  await intentar('menu', async () => {
    await capturar(page, `${R}/02-menu`, [
      { en: page.getByRole('link', { name: /Diagnóstico y limpieza/ }), n: 1, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Guía de estilo/ }), n: 2, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Usuarios y accesos/ }), n: 3, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Catálogos/ }), n: 4, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 345, height: 900 } });
  });

  // ── Herramientas ──
  await ir(page, '/herramientas', 3500);
  await intentar('herramientas', async () => {
    await alto(1100);
    await capturar(page, `${R}/03a-herramientas-arriba`, [{ en: page.getByRole('heading', { name: 'Diagnóstico y limpieza' }), n: 1, sinCaja: true }, { en: page.getByRole('heading', { name: 'Vista previa por rol' }), n: 2, sinCaja: true }], { recorte: { ...LADO, height: 1100 } });
    await page.getByRole('heading', { name: 'Respaldo completo (JSON)' }).evaluate(e => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(500);
    await capturar(page, `${R}/03-herramientas`, [
      { en: page.getByRole('heading', { name: 'Respaldo completo (JSON)' }), n: 1, sinCaja: true },
      { en: page.getByRole('heading', { name: 'Preparar para producción' }), n: 2, sinCaja: true },
      { en: page.getByRole('heading', { name: 'Diagnóstico de colecciones' }), n: 3, sinCaja: true },
      { en: page.getByRole('heading', { name: 'Limpiar estructura vieja' }), n: 4, sinCaja: true },
    ], { recorte: { ...LADO, height: 1100 } });
    await page.evaluate(() => window.scrollTo(0, 0)); await alto(900);
  });
  await intentar('vista previa por rol', async () => {
    await alto(1300);
    await page.getByLabel(/Aut\. 2/).first().check().catch(() => {});
    await page.getByLabel(/Solicitante \(de un área\)/).first().check().catch(() => {});
    await page.waitForTimeout(800);
    await capturar(page, `${R}/04-vista-previa`, [
      { en: page.getByText('Combinaciones frecuentes').first(), n: 1, sinCaja: true },
      { en: page.getByText('Rol del sistema', { exact: true }).first(), n: 2, sinCaja: true },
      { en: page.getByRole('button', { name: 'Restablecer vista' }), n: 3 },
      { en: page.getByText('Pantallas', { exact: true }).first(), n: 4, sinCaja: true },
    ], { recorte: { ...LADO, height: 1300 } });
    await page.getByRole('button', { name: 'Restablecer vista' }).click().catch(() => {});
    await alto(900);
  });
  await intentar('respaldo', async () => {
    await page.locator('#btn-respaldo-completo').scrollIntoViewIfNeeded();
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.locator('#btn-respaldo-completo').click()]);
    await d.saveAs('.tmp/archivos/respaldo-ejemplo.json'); await page.waitForTimeout(1500);
    await capturar(page, `${R}/05-respaldo`, [{ en: page.locator('#btn-respaldo-completo'), n: 1 }, { en: page.getByText(/datos personales de empleados/), n: 2, sinCaja: true }], { recorte: LADO });
  });
  await intentar('diagnóstico', async () => {
    await page.getByRole('button', { name: 'Contar documentos' }).click(); await page.waitForTimeout(2500);
    await alto(1300);
    await capturar(page, `${R}/06-diagnostico`, [{ en: page.getByRole('button', { name: 'Contar documentos' }), n: 1 }, { en: page.locator('dl').first(), n: 2 }], { recorte: { ...LADO, height: 1300 } });
    await alto(900);
  });
  await intentar('limpiar estructura vieja', async () => {
    await page.getByRole('button', { name: 'Revisar el padrón' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/07-limpiar-estructura`, [{ en: page.getByRole('button', { name: 'Revisar el padrón' }), n: 1 }, { en: page.getByText(/campos viejos|Ningún empleado/).first(), n: 2, sinCaja: true }], { recorte: LADO });
  });

  // ── Usuarios, roles y asignaciones (lo que solo hace el administrador) ──
  await ir(page, '/personal/accesos/usuarios', 3000);
  await intentar('rol administrador', async () => {
    await page.locator('tr', { hasText: '8031' }).locator('button').first().click(); await page.waitForTimeout(1500);
    await cuadro().locator('select').first().selectOption({ label: 'Administrador del sistema' }).catch(() => {});
    await capturar(page, `${R}/08-rol-administrador`, [{ en: cuadro().locator('select').first(), n: 1 }, { en: cuadro().getByRole('button', { name: /Guardar nombre y rol/ }), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('restablecer a cualquiera', async () => {
    await page.locator('tr', { hasText: '8001' }).locator('button').nth(1).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/09-restablecer-rh`, [{ en: cuadro().locator('h2').first(), n: 1, sinCaja: true }, { en: page.locator('#btn-restablecer-password'), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await ir(page, '/personal/accesos/asignaciones', 3000);
  await intentar('asignaciones del administrador', async () => {
    await capturar(page, `${R}/10-asignaciones`, [
      { en: page.getByRole('button', { name: /Asignar rol/ }), n: 1 },
      { en: page.getByRole('button', { name: /Actualizar nombres y puestos/ }), n: 2 },
      { en: page.getByRole('button', { name: /Cargar asignaciones iniciales/ }), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('asignar Autorización 2', async () => {
    await page.getByRole('button', { name: /Asignar rol/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/11-asignar-aut2`, [{ en: cuadro().locator('select').first(), n: 1 }, { en: cuadro().getByRole('button', { name: /^Asignar$/ }), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('cargar asignaciones iniciales', async () => {
    await page.getByRole('button', { name: /Cargar asignaciones iniciales/ }).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/12-carga-inicial`, [{ en: cuadro().locator('h2').first(), n: 1, sinCaja: true }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrarTodo();
  });
  await intentar('actualizar nombres y puestos', async () => {
    await page.getByRole('button', { name: /Actualizar nombres y puestos/ }).click(); await page.waitForTimeout(2000);
    await capturar(page, `${R}/13-actualizar-nombres`, [{ en: cuadro().locator('h2').first(), n: 1, sinCaja: true }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrarTodo();
  });
  await ir(page, '/personal/estructura', 3000);
  await intentar('estructura inicial', async () => {
    await capturar(page, `${R}/14-estructura-inicial-boton`, [{ en: page.getByRole('button', { name: /Crear estructura inicial/ }), n: 1 }], { recorte: LADO });
    await page.getByRole('button', { name: /Crear estructura inicial/ }).click(); await page.waitForTimeout(2000);
    await capturar(page, `${R}/15-estructura-inicial`, [{ en: cuadro().locator('h2').first(), n: 1, sinCaja: true }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrarTodo();
  });

  // ── Preparar para producción (ÚLTIMO: la fase 2 borra los datos de ejemplo del emulador) ──
  // Ventana muy alta para que toda la página quepa sin desplazarse; cada captura se recorta a lo que explica, para que la letra salga legible en el manual
  const entre = async (a, b, margen = 18) => {
    const A = await a.first().boundingBox(), B = await b.first().boundingBox();
    const y = Math.max(0, Math.floor(A.y - margen)), fin = Math.ceil(B.y + B.height + margen);
    return { x: LADO.x, y, width: LADO.width, height: fin - y };
  };
  await ir(page, '/herramientas', 3500);
  await alto(3800);
  await intentar('preparar para producción: paso 1', async () => {
    const titulo = page.getByRole('heading', { name: 'Preparar para producción' });
    await capturar(page, `${R}/16-preparar-inicio`, [{ en: titulo, n: 1, sinCaja: true }, { en: page.locator('#btn-preparar-produccion'), n: 2 }], { recorte: await entre(titulo, page.locator('#btn-preparar-produccion'), 30) });
    await Promise.all([page.waitForEvent('download', { timeout: 30000 }).catch(() => null), page.locator('#btn-preparar-produccion').click()]);
    await page.waitForTimeout(6000);
    const aviso = page.getByText(/Respaldo descargado/), conserva = page.getByText(/Empleados \(padrón\)/);
    await capturar(page, `${R}/17-fase1-inventario`, [
      { en: aviso, n: 1, sinCaja: true },
      { en: page.getByRole('heading', { name: 'Se borraría' }), n: 2, sinCaja: true },
      { en: page.getByRole('heading', { name: /Se conserva/ }), n: 3, sinCaja: true },
    ], { recorte: await entre(aviso, conserva) });
    const usuarios = page.getByRole('heading', { name: /Usuarios: marca los de prueba/ }), cuentas = page.getByText(/Ninguna: no marcaste usuarios|Se borrarán|@rutas\.app/).first();
    await capturar(page, `${R}/18-fase1-usuarios`, [
      { en: usuarios, n: 1, sinCaja: true },
      { en: page.getByRole('heading', { name: /Cuentas de Authentication/ }), n: 2, sinCaja: true },
    ], { recorte: await entre(usuarios, cuentas) });
  });
  await intentar('preparar para producción: paso 2', async () => {
    const paso2 = page.getByRole('heading', { name: 'Paso 2: borrar' });
    await capturar(page, `${R}/19-fase2-confirmar`, [
      { en: paso2, n: 1, sinCaja: true }, { en: page.getByPlaceholder('BORRAR'), n: 2 }, { en: page.locator('#btn-borrar-produccion'), n: 3 },
    ], { recorte: await entre(paso2, page.locator('#btn-borrar-produccion')) });
    await page.getByPlaceholder('BORRAR').fill('BORRAR'); await page.waitForTimeout(400);
    await page.locator('#btn-borrar-produccion').click(); await page.waitForTimeout(15000);
    const listo = page.getByText(/Limpieza terminada/), cerrar = page.getByRole('button', { name: 'Cerrar', exact: true }).first();
    await capturar(page, `${R}/20-fase2-listo`, [
      { en: listo, n: 1, sinCaja: true }, { en: page.getByRole('heading', { name: /Pendiente en la consola/ }), n: 2, sinCaja: true },
    ], { recorte: await entre(listo, cerrar) });
    await alto(900);
  });
  await browser.close();
}
