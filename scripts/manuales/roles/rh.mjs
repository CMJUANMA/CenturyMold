// Capturas anotadas del manual de RECURSOS HUMANOS (persona de ejemplo: NAVARRO PEÑA LUCÍA, analista de RH). Las llama capturas.mjs. Solo datos ficticios del emulador.
import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { capturar } from '../anotar.mjs';
import { DETALLE_A as DETALLE, LADO_A as LADO, VENTANA_ANCHA, alFinalDelCuadro, claveSemana, entrarComo, intentar } from './comun.mjs';

/** Recorte ajustado al cuadro de diálogo abierto (con un margen), para que cada cuadro salga del tamaño que tiene */
async function alrededorDelCuadro(page, margen = 28) {
  const b = await page.locator('[role=dialog]').last().boundingBox();
  const x = Math.max(0, Math.floor(b.x - margen)), y = Math.max(0, Math.floor(b.y - margen));
  const v = page.viewportSize();
  return { x, y, width: Math.min(v.width - x, Math.ceil(b.width + margen * 2)), height: Math.min(v.height - y, Math.ceil(b.height + margen * 2)) };
}

/** Archivo de ejemplo (inventado) para «Cargar elegibles TE»: NOMINA, NOMBRE, PUESTO, DEPTO NOMINA, AREA TE, ELEGIBLE TE */
async function archivoElegibles() {
  mkdirSync('.tmp/archivos', { recursive: true });
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Elegibles');
  ws.addRow(['NOMINA', 'NOMBRE', 'PUESTO', 'DEPTO NOMINA', 'AREA TE', 'ELEGIBLE TE']);
  ws.addRow(['8040', 'ÁLVAREZ CAMPOS JORGE', 'MOLDEADOR', 'MOLDES', 'Moldes', 'SI']);
  ws.addRow(['8041', 'BENÍTEZ ROMERO ALMA', 'MOLDEADOR', 'MOLDES', 'Moldes', 'SI']);
  ws.addRow(['8050', 'IBÁÑEZ CORONA ELÍAS', 'OPERADOR', 'PRODUCCION', 'Producción', 'NO']);
  ws.addRow(['8200', 'TORRES VEGA ALEJANDRO', 'MOLDEADOR', 'MOLDES', 'Moldes', 'SI']);
  const ruta = '.tmp/archivos/elegibles-ejemplo.xlsx'; await wb.xlsx.writeFile(ruta); return ruta;
}

export async function rh({ abrir, ir, BASE }) {
  const R = 'rh';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  const cuadro = () => page.locator('[role=dialog]');
  /** Cierra todos los cuadros abiertos (hasta 3 niveles): con su botón Cerrar/Cancelar, y con Escape si no hay */
  const cerrarTodo = async () => { for (let i = 0; i < 3; i++) { if (!(await cuadro().count())) break; const b = cuadro().last().getByRole('button', { name: /^(Cancelar|Cerrar)$/ }).first(); if (await b.count()) await b.click().catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(500); } };
  const alto = async (h) => { await page.setViewportSize({ width: 1600, height: h }); await page.waitForTimeout(500); };
  const cerrar = async () => { const b = cuadro().getByRole('button', { name: /^(Cancelar|Cerrar)$/ }).last(); if (await b.count()) await b.click(); else await page.keyboard.press('Escape'); await page.waitForTimeout(600); };
  const semana = claveSemana(new Date());
  await entrarComo(page, BASE, 'rh');

  // ── Primeros pasos ──
  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Por enviar al proveedor/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByText('Requieren atención', { exact: true }), n: 2, sinCaja: true },
      { en: page.getByText('Próximos tiempos extra (7 días)', { exact: false }).first(), n: 3, sinCaja: true },
      { en: page.getByText('Accesos rápidos', { exact: true }), n: 4, sinCaja: true },
    ]);
  });
  await intentar('menu', async () => {
    await capturar(page, `${R}/02-menu`, [
      { en: page.getByText('Tiempo extra', { exact: true }).first(), n: 1, sinCaja: true },
      { en: page.getByRole('link', { name: 'Solicitudes de transporte' }), n: 2, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Formato de tiempo extra' }), n: 3, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Padrón de empleados' }), n: 4, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Usuarios y accesos' }), n: 5, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 345, height: 900 } });
  });

  // ── Por enviar al proveedor ──
  await ir(page, '/tiempo-extra/recepcion', 3000);
  await intentar('por enviar al proveedor', async () => {
    await capturar(page, `${R}/03-recepcion`, [
      { en: page.locator('#btn-formato-rutas-recepcion'), n: 1 },
      { en: page.getByRole('button', { name: /Descargar resumen de horas extra/ }), n: 2 },
      { en: page.getByText('Fecha pasada – transporte no enviado'), n: 3, sinCaja: true },
      { en: page.getByRole('button', { name: /Confirmar todas las fechas/ }), n: 4 },
      { en: page.getByRole('button', { name: /Confirmar todas las de esta fecha/ }).first(), n: 5 },
    ], { recorte: LADO });
  });
  await intentar('fecha pasada', async () => {
    await capturar(page, `${R}/04-fecha-pasada`, [
      { en: page.getByRole('button', { name: /Cerrar todas sin transporte/ }), n: 1 },
      { en: page.getByRole('button', { name: /^Ver( |$)/ }).first(), n: 2 },
      { en: page.getByRole('button', { name: 'Cerrar sin transporte', exact: true }).first(), n: 3 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: 'Cerrar sin transporte', exact: true }).first().click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/05-cerrar-sin-transporte`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrar();
  });
  await intentar('revisar una solicitud', async () => {
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click(); await page.waitForTimeout(2200);
    await alFinalDelCuadro(page); await page.waitForTimeout(400);
    await capturar(page, `${R}/06-revisar`, [
      { en: cuadro().getByRole('button', { name: /Cancelar tiempo extra autorizado/ }), n: 1 },
      { en: cuadro().getByRole('button', { name: 'Devolver', exact: true }), n: 2 },
      { en: cuadro().getByRole('button', { name: /Confirmar y generar transporte/ }), n: 3 },
    ], { recorte: DETALLE });
    await cuadro().getByRole('button', { name: 'Devolver', exact: true }).click(); await page.waitForTimeout(1000);
    await cuadro().locator('textarea').last().fill('Falta indicar el punto de reunión de dos empleados.'); await page.waitForTimeout(300);
    await capturar(page, `${R}/07-devolver`, [{ en: cuadro().locator('textarea').last(), n: 1 }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('cancelar autorizado', async () => {
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click(); await page.waitForTimeout(2000);
    await alFinalDelCuadro(page);
    await cuadro().getByRole('button', { name: /Cancelar tiempo extra autorizado/ }).click(); await page.waitForTimeout(1000);
    await cuadro().locator('textarea').last().fill('La solicitud ya no se necesita: se cubrió con personal propio.'); await page.waitForTimeout(300);
    await capturar(page, `${R}/08-cancelar`, [{ en: cuadro().locator('textarea').last(), n: 1 }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('confirmar una fecha (sin confirmar)', async () => {
    await page.getByRole('button', { name: /Confirmar todas las de esta fecha/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/09-confirmar-fecha`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('confirmar todas las fechas', async () => {
    await page.locator('#btn-confirmar-todas-las-fechas').click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/11-confirmar-todas`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button').last().click(); await page.waitForTimeout(4000);
    await capturar(page, `${R}/10-confirmada`, [{ en: cuadro().getByText(/Ver en Solicitudes de transporte/), n: 1 }, { en: cuadro().getByRole('button', { name: 'Cerrar', exact: true }).last(), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  // ── Formato de rutas ──
  await ir(page, '/tiempo-extra/recepcion', 2500);
  await cerrarTodo();
  await ir(page, '/transporte/formato-rutas', 2500);
  const botonFormato = () => page.locator('#btn-formato-rutas-pagina');
  await intentar('formato de rutas (página)', async () => {
    await capturar(page, `${R}/11a-formato-pagina`, [{ en: botonFormato(), n: 1 }], { recorte: LADO });
  });
  await intentar('formato de rutas (cuadro)', async () => {
    await cerrarTodo(); await botonFormato().click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/12-formato-rutas`, [
      { en: cuadro().locator('h2').first(), n: 1, sinCaja: true },
      { en: cuadro().getByText('Hoy', { exact: true }), n: 2 },
      { en: cuadro().getByText('Mañana', { exact: true }), n: 3 },
      { en: cuadro().getByText('Elegir fecha', { exact: true }), n: 4 },
      { en: cuadro().getByRole('button', { name: /Descargar Excel/ }), n: 5 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByText('Elegir fecha', { exact: true }).click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/13-formato-rutas-fecha`, [
      { en: cuadro().getByText('Rango de fechas', { exact: true }), n: 1 }, { en: cuadro().locator('input[type=date]').first(), n: 2 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().locator('input[type=date]').first().fill('2026-01-05'); await page.waitForTimeout(400);
    await page.waitForTimeout(1200);
    await capturar(page, `${R}/14-formato-rutas-vacio`, [{ en: cuadro().locator('input[type=date]').first(), n: 1 }, { en: cuadro().getByText(/No hay|encontrada|Sin solicitudes/i).first(), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await intentar('formato de rutas con datos', async () => {
    await botonFormato().click(); await page.waitForTimeout(1200);
    await cuadro().getByText('Mañana', { exact: true }).click(); await page.waitForTimeout(400);
    await cuadro().getByRole('button', { name: /Descargar Excel/ }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/15-formato-rutas-descargado`, [{ en: cuadro().getByText(/archivo|Se descargó|solicitud/i).first(), n: 1, sinCaja: true }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });

  // ── Solicitudes de transporte ──
  await ir(page, '/transporte/solicitudes', 3000);
  await intentar('solicitudes de transporte', async () => {
    await capturar(page, `${R}/16-solicitudes-transporte`, [
      { en: page.getByRole('button', { name: 'Esta semana' }), n: 1 },
      { en: page.locator('select').first(), n: 2 },
      { en: page.getByPlaceholder(/Solicitante o folio/), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('detalle de una solicitud de transporte', async () => {
    await page.getByRole('button', { name: 'Esta semana' }).click(); await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Ver detalle de/ }).first().click(); await page.waitForTimeout(1800);
    await capturar(page, `${R}/17-transporte-detalle`, [{ en: cuadro().locator('h2').first(), n: 1 }], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrarTodo();
  });

  // ── Por autorizar (RH firma el nivel 2 «como RH») y capturar ──
  await ir(page, '/tiempo-extra/autorizar', 3000);
  await intentar('por autorizar como RH', async () => {
    await capturar(page, `${R}/18-por-autorizar`, [
      { en: page.getByText(/Nivel 2 · Autorización 2/), n: 1, sinCaja: true },
      { en: page.getByRole('button', { name: /Revisar/ }).first(), n: 2 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2200);
    await alFinalDelCuadro(page); await page.waitForTimeout(300);
    await capturar(page, `${R}/19-firmar-como-rh`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }, { en: page.locator('#btn-autorizar'), n: 3 }], { recorte: DETALLE });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });
  await ir(page, '/tiempo-extra/nueva', 2500);
  await intentar('solicitar como RH', async () => {
    await capturar(page, `${R}/20-solicitar`, [{ en: page.getByText(/Área:/).first(), n: 1, sinCaja: true }, { en: page.getByText('Datos generales').first(), n: 2, sinCaja: true }], { recorte: LADO });
  });

  // ── Consulta ──
  await ir(page, '/tiempo-extra/consulta', 3000);
  await intentar('consulta', async () => {
    await alto(1150);
    await capturar(page, `${R}/21-consulta`, [
      { en: page.getByRole('button', { name: /Exportar consulta/ }), n: 1 },
      { en: page.locator('select').first(), n: 2 },
      { en: page.getByRole('button', { name: /^Ver( |$)/ }).first(), n: 3 },
    ], { recorte: { ...LADO, height: 1150 } });
    await alto(900);
  });
  await intentar('cancelar desde la consulta', async () => {
    await page.getByRole('button', { name: /^Ver( |$)/ }).first().click(); await page.waitForTimeout(2000);
    await alFinalDelCuadro(page);
    await capturar(page, `${R}/22-consulta-detalle`, [{ en: cuadro().getByRole('button', { name: /Cancelar/ }).first(), n: 1 }], { recorte: DETALLE });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  });

  // ── Usuarios y accesos ──
  await ir(page, '/personal/accesos', 3500);
  await intentar('usuarios', async () => {
    await alto(1150);
    await capturar(page, `${R}/24-usuarios`, [
      { en: page.getByRole('button', { name: /Nuevo usuario/ }), n: 1 },
      { en: page.getByRole('button', { name: /Crear usuarios en lote/ }), n: 2 },
      { en: page.locator('select').first(), n: 3 },
      { en: page.locator('tr', { hasText: '8031' }).locator('button').nth(0), n: 4 },
      { en: page.locator('tr', { hasText: '8031' }).locator('button').nth(1), n: 5 },
    ], { recorte: { ...LADO, height: 1150 } });
    await alto(900);
  });
  await intentar('nuevo usuario y contraseña', async () => {
    await page.getByRole('button', { name: /Nuevo usuario/ }).click(); await page.waitForTimeout(1200);
    await cuadro().getByPlaceholder(/nómina|nombre|Buscar/i).first().fill('Quintero'); await page.waitForTimeout(900);
    await cuadro().getByText(/QUINTERO/i).first().click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/25-nuevo-usuario`, [
      { en: cuadro().getByText(/QUINTERO/i).first(), n: 1 }, { en: cuadro().getByRole('button', { name: /Crear usuario/ }), n: 2 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().getByRole('button', { name: /Crear usuario/ }).click(); await page.waitForTimeout(3000);
    await capturar(page, `${R}/26-contrasena-temporal`, [
      { en: page.locator('[role=dialog] .font-mono').first(), n: 1 }, { en: page.locator('#btn-copiar-password'), n: 2 }, { en: page.locator('#btn-cerrar-usuario-creado'), n: 3 },
    ], { recorte: await alrededorDelCuadro(page) });
    await page.locator('#btn-cerrar-usuario-creado').click(); await page.waitForTimeout(800);
  });
  await intentar('lote', async () => {
    await page.getByRole('button', { name: /Crear usuarios en lote/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/27-lote`, [
      { en: cuadro().getByRole('button', { name: /Agregar otros empleados/ }), n: 1 }, { en: cuadro().getByRole('button', { name: /Crear [0-9]+ cuenta/ }), n: 2 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrar();
  });
  await intentar('editar usuario', async () => {
    const fila = page.locator('tr', { hasText: '8031' }).first();
    await fila.locator('button').nth(0).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/28-editar-usuario`, [
      { en: cuadro().locator('select').first(), n: 1 }, { en: cuadro().getByRole('button', { name: /Agregar asignación/ }), n: 2 },
      { en: cuadro().getByRole('button', { name: /Guardar nombre y rol/ }), n: 3 },
    ], { recorte: await alrededorDelCuadro(page) });
    await cuadro().locator('select').first().selectOption({ label: 'Nóminas' }).catch(() => {});
    await cuadro().getByRole('button', { name: /Guardar nombre y rol/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/29-dar-rol-nominas`, [{ en: page.getByRole('button', { name: /^Dar acceso$/ }), n: 1 }], { recorte: await alrededorDelCuadro(page) }).catch(() => {});
    await page.getByRole('button', { name: /Cancelar/ }).last().click(); await page.waitForTimeout(500); await cerrar();
  });
  await intentar('restablecer', async () => {
    await page.locator('tr', { hasText: '8031' }).locator('button').nth(1).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/30-restablecer`, [{ en: page.locator('#btn-restablecer-password'), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrar();
  });
  await intentar('sin asignación', async () => {
    await page.locator('select').nth(0).selectOption({ index: 1 }).catch(() => {});
    await capturar(page, `${R}/31-sin-asignacion`, [{ en: page.getByText('Sin asignación').first(), n: 1 }], { recorte: LADO });
  });
  await ir(page, '/personal/accesos/asignaciones', 3000);
  await intentar('asignaciones', async () => {
    await capturar(page, `${R}/32-asignaciones`, [{ en: page.getByRole('button', { name: /Asignar rol/ }), n: 1 }, { en: page.locator('select').first(), n: 2 }], { recorte: LADO });
  });
  await ir(page, '/personal/accesos/organigrama', 3000);
  await intentar('organigrama', async () => {
    await capturar(page, `${R}/33-organigrama`, [{ en: page.getByText(/Resaltar sin usuario/), n: 1 }, { en: page.getByText('Nivel 2 · Planta'), n: 2 }], { recorte: LADO });
  });

  // ── Personal (padrón) ──
  await ir(page, '/personal/padron', 3000);
  await intentar('padrón', async () => {
    await capturar(page, `${R}/34-padron`, [
      { en: page.getByRole('button', { name: /Nuevo empleado/ }), n: 1 },
      { en: page.getByRole('button', { name: /Importar empleados/ }), n: 2 },
      { en: page.getByRole('button', { name: /Cargar elegibles TE/ }), n: 3 },
      { en: page.getByRole('button', { name: /Exportar padrón/ }), n: 4 },
      { en: page.getByRole('button', { name: /Editar SISTEMAS DEMO/ }), n: 5 },
    ], { recorte: LADO });
  });
  await intentar('nuevo empleado', async () => {
    await alto(1250); await page.getByRole('button', { name: /Nuevo empleado/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/35-nuevo-empleado`, [
      { en: cuadro().getByText(/Nómina \*/), n: 1, sinCaja: true }, { en: cuadro().getByText(/Teléfono/), n: 2, sinCaja: true },
      { en: cuadro().getByText(/Elegible para tiempo extra/), n: 3 }, { en: cuadro().getByRole('button', { name: 'Guardar' }), n: 4 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrar(); await alto(900);
  });
  await intentar('editar empleado', async () => {
    await alto(1250); await page.getByRole('button', { name: /Editar IBÁÑEZ/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/36-editar-empleado`, [
      { en: cuadro().getByText(/Teléfono/), n: 1, sinCaja: true }, { en: cuadro().getByText(/Excepción de área/), n: 2, sinCaja: true },
      { en: cuadro().getByText(/Elegible para tiempo extra/), n: 3 }, { en: cuadro().getByText(/Empleado activo/), n: 4 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrar(); await alto(900);
  });
  await intentar('baja de un empleado', async () => {
    await page.getByRole('button', { name: /Eliminar IBÁÑEZ/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/37-baja-empleado`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrar();
  });
  await intentar('importar empleados', async () => {
    await page.getByRole('button', { name: /Importar empleados/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/38-importar`, [
      { en: cuadro().getByText(/Agregar y actualizar/).first(), n: 1, sinCaja: true },
      { en: cuadro().getByRole('button', { name: /Descargar formato en blanco/ }), n: 2 },
      { en: cuadro().getByRole('button', { name: /Seleccionar archivo/ }), n: 3 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrar();
  });
  await intentar('cargar elegibles', async () => {
    await page.getByRole('button', { name: /Cargar elegibles TE/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/39-elegibles`, [{ en: cuadro().getByText(/Elegir archivo/).first(), n: 1 }], { recorte: await alrededorDelCuadro(page, 20) });
    const ruta = await archivoElegibles();
    await cuadro().locator('input[type=file]').setInputFiles(ruta); await page.waitForTimeout(2500);
    await capturar(page, `${R}/40-elegibles-vista-previa`, [
      { en: cuadro().getByText(/Quedarían/), n: 1, sinCaja: true },
      { en: cuadro().getByText(/Nuevos en el padrón/), n: 2, sinCaja: true },
      { en: cuadro().getByRole('button', { name: 'Aplicar' }), n: 3 },
    ], { recorte: await alrededorDelCuadro(page, 20) });
    await cerrar();
  });

  // ── Estructura ──
  await ir(page, '/personal/estructura', 3000);
  await intentar('estructura: áreas', async () => {
    await capturar(page, `${R}/41-estructura-areas`, [
      { en: page.getByRole('button', { name: /Nueva área/ }), n: 1 }, { en: page.getByText('Participa en TE').first(), n: 2, sinCaja: true },
      { en: page.getByRole('button', { name: /Editar/ }).first(), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('estructura: puestos', async () => {
    await page.getByRole('tab', { name: 'Puestos' }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/42-estructura-puestos`, [
      { en: page.getByRole('button', { name: /Nuevo puesto/ }), n: 1 }, { en: page.getByRole('button', { name: /Asignar puestos y áreas/ }), n: 2 },
      { en: page.getByText('Nivel', { exact: true }).first(), n: 3, sinCaja: true },
    ], { recorte: LADO });
  });
  await intentar('estructura: excepciones y turnos', async () => {
    await page.getByRole('tab', { name: 'Excepciones y pendientes' }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/43-estructura-pendientes`, [{ en: page.getByText(/Excepciones de área/).first(), n: 1, sinCaja: true }], { recorte: LADO });
    await page.getByRole('tab', { name: 'Turnos' }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/44-estructura-turnos`, [{ en: page.getByRole('button', { name: /Guardar turnos/ }), n: 1 }], { recorte: LADO });
  });

  // ── Catálogos ──
  await ir(page, '/transporte/catalogos', 3000);
  await intentar('catálogos: rutas', async () => {
    await capturar(page, `${R}/45-catalogo-rutas`, [
      { en: page.getByRole('button', { name: /Nueva ruta/ }), n: 1 }, { en: page.getByRole('button', { name: /Editar Ruta Norte/ }), n: 2 },
      { en: page.getByRole('button', { name: /Desactivar Ruta Norte/ }), n: 3 }, { en: page.getByRole('button', { name: /Importar directorio/ }), n: 4 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Nueva ruta/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/46-nueva-ruta`, [{ en: cuadro().locator('input').first(), n: 1 }, { en: cuadro().getByRole('button').last(), n: 2 }], { recorte: await alrededorDelCuadro(page) });
    await cerrar();
  });
  await intentar('catálogos: comunidades y puntos', async () => {
    await page.getByRole('tab', { name: 'Comunidades' }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/47-catalogo-comunidades`, [{ en: page.getByRole('button', { name: /Nueva comunidad/ }), n: 1 }], { recorte: LADO });
    await page.getByRole('tab', { name: 'Puntos de reunión' }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/48-catalogo-puntos`, [{ en: page.getByRole('button', { name: /Nuevo punto/ }), n: 1 }], { recorte: LADO });
  });
  await intentar('catálogos: motivos', async () => {
    await page.getByRole('tab', { name: 'Motivos' }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/49-catalogo-motivos`, [
      { en: page.getByRole('button', { name: /Nuevo motivo/ }), n: 1 }, { en: page.getByRole('button', { name: /^Subir/ }).first(), n: 2 },
      { en: page.getByRole('button', { name: /^Editar/ }).first(), n: 3 }, { en: page.getByRole('button', { name: /^Desactivar/ }).first(), n: 4 },
    ], { recorte: LADO });
  });

  // ── Reportes de nómina: reabrir ──
  await intentar('reabrir un área firmada', async () => {
    await ir(page, `/nomina/semana/${semana}/moldes`, 3500);
    await page.getByRole('button', { name: /Marcar como firmada/ }).click(); await page.waitForTimeout(1000);
    await cuadro().getByRole('button', { name: 'Marcar como firmada' }).click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/50-reabrir`, [{ en: page.locator('#btn-reabrir-area'), n: 1 }, { en: page.getByText(/Esta área ya está firmada/), n: 2, sinCaja: true }], { recorte: { x: 288, y: 0, width: 1312, height: 900 } });
    await page.locator('#btn-reabrir-area').click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/51-reabrir-confirmar`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: await alrededorDelCuadro(page) });
    await cerrarTodo();
  });
  await browser.close();
}
