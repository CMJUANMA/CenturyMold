// Capturas anotadas del manual del AUTORIZADOR 2 (persona de ejemplo: IBARRA SALAZAR ROBERTO, gerente de operaciones). Las llama capturas.mjs. Solo datos ficticios del emulador.
import { capturar } from '../anotar.mjs';
import { DETALLE_A as DETALLE, DIALOGO_A as DIALOGO, LADO_A as LADO, VENTANA_ANCHA, alFinalDelCuadro, entrarComo, intentar } from './comun.mjs';

const DIALOGO_GRANDE = { x: 380, y: 40, width: 840, height: 820 };
const LOTE = { x: 130, y: 20, width: 1340, height: 860 };

export async function autorizador2({ abrir, ir, BASE }) {
  const R = 'autorizador-2';
  const { browser, page } = await abrir(VENTANA_ANCHA);
  const cuadro = () => page.locator('[role=dialog]');
  const cerrar = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(500); };
  await entrarComo(page, BASE, 'aut2');

  // ── Primeros pasos ──
  await intentar('inicio', async () => {
    await capturar(page, `${R}/01-inicio`, [
      { en: page.getByRole('link', { name: /Por autorizar/ }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByText('Ir a la bandeja'), n: 2, flecha: 'abajo' },
      { en: page.getByText('Personal de planta').first(), n: 3 },
      { en: page.getByText('Solicitudes de la semana por área'), n: 4 },
    ]);
  });
  await intentar('menu', async () => {
    await capturar(page, `${R}/02-menu`, [
      { en: page.getByRole('link', { name: 'Solicitar tiempo extra' }).first(), n: 1, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Todas las solicitudes' }), n: 2, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Organigrama' }).first(), n: 3, flecha: 'derecha' },
      { en: page.getByRole('link', { name: 'Asignar roles' }), n: 4, flecha: 'derecha' },
      { en: page.getByRole('link', { name: /Ayuda y manuales/ }), n: 5, flecha: 'derecha' },
    ], { recorte: { x: 0, y: 0, width: 345, height: 900 } });
  });
  await ir(page, '/mi-cuenta', 2500);
  await intentar('mi cuenta', async () => {
    await page.setViewportSize({ width: 1600, height: 1250 }); await page.waitForTimeout(600);
    await capturar(page, `${R}/03-mi-cuenta`, [
      { en: page.getByText('Mostrar ayudas', { exact: true }), n: 1 }, { en: page.getByText('Tamaño de letra', { exact: true }), n: 2 },
      { en: page.getByText('Tema', { exact: true }), n: 3 }, { en: page.getByRole('button', { name: /Cambiar mi contraseña/ }), n: 4 },
    ], { recorte: { ...LADO, height: 1250 } });
    await page.setViewportSize({ width: 1600, height: 900 });
  });

  // ── Por autorizar ──
  await ir(page, '/tiempo-extra/autorizar', 3000);
  await intentar('bandeja', async () => {
    await capturar(page, `${R}/04-bandeja`, [
      { en: page.getByRole('tab', { name: /Por autorizar/ }), n: 1 },
      { en: page.getByRole('tab', { name: /Vencidas/ }), n: 2 },
      { en: page.getByRole('button', { name: /Revisar/ }).first(), n: 3 },
      { en: page.locator('label').filter({ hasText: /^Todas$/ }).first(), n: 4 },
      { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first(), n: 5 },
    ], { recorte: LADO });
  });
  await intentar('filtros', async () => {
    await capturar(page, `${R}/05-filtros`, [
      { en: page.locator('select').first(), n: 1 },
      { en: page.locator('input[type=date]').first(), n: 2 }, { en: page.locator('input[type=date]').nth(1), n: 3 },
    ], { recorte: LADO });
  });

  await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
  await intentar('detalle arriba', async () => {
    await capturar(page, `${R}/06-detalle-arriba`, [
      { en: cuadro().locator('h2').first(), n: 1 },
      { en: cuadro().getByText(/Empleados por horario/), n: 2 },
    ], { recorte: DETALLE });
  });
  await intentar('detalle empleados', async () => {
    await cuadro().getByText(/^Empleados \(/).scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await capturar(page, `${R}/07-detalle-empleados`, [
      { en: cuadro().getByText(/^Empleados \(/), n: 1 },
      { en: cuadro().locator('th').filter({ hasText: /^Horario$/ }), n: 2 },
      { en: cuadro().locator('th').filter({ hasText: /Ruta/ }), n: 3 },
    ], { recorte: DETALLE });
  });
  await intentar('detalle abajo', async () => {
    await alFinalDelCuadro(page); await page.waitForTimeout(400);
    await capturar(page, `${R}/08-detalle-abajo`, [
      { en: cuadro().getByText(/^Historial$/), n: 1 },
      { en: page.locator('#comentario-firma'), n: 2 }, { en: page.locator('#btn-devolver'), n: 3 }, { en: page.locator('#btn-autorizar'), n: 4 },
    ], { recorte: DETALLE });
  });
  await intentar('autorizar', async () => {
    await page.locator('#btn-autorizar').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/09-autorizada`, [{ en: page.getByText(/Autorizaste TE-|Recursos Humanos ya/).first(), n: 1 }], { recorte: LADO });
  });

  await intentar('devolver', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('button', { name: /Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await alFinalDelCuadro(page); await page.waitForTimeout(300);
    await capturar(page, `${R}/10-devolver-sin-motivo`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.locator('#comentario-firma').fill('El horario no coincide con el pedido. Revisa y reenvía.'); await page.waitForTimeout(300);
    await capturar(page, `${R}/11-devolver`, [{ en: page.locator('#comentario-firma'), n: 1 }, { en: page.locator('#btn-devolver'), n: 2 }], { recorte: DETALLE });
    await page.locator('#btn-devolver').click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/12-devuelta`, [{ en: page.getByText(/Devolviste|devuelta|Devuelta/).first(), n: 1 }], { recorte: LADO });
  });

  await intentar('autorizar varias', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    const casillas = page.locator('input[type=checkbox]');
    const n = await casillas.count();
    for (let i = 0; i < Math.min(n, 2); i++) await casillas.nth(i).check();
    await capturar(page, `${R}/13-varias`, [
      { en: casillas.first(), n: 1 }, { en: page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first(), n: 2 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Autorizar .*seleccionada/ }).first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/14-varias-confirmar`, [{ en: cuadro().getByRole('button').last(), n: 1 }], { recorte: DIALOGO });
    await cerrar();
  });

  // ── Capturar (sección corta) ──
  await ir(page, '/tiempo-extra/nueva', 2500);
  await intentar('solicitar', async () => {
    await capturar(page, `${R}/15-solicitar`, [
      { en: page.getByText(/Como eres Autorización 2/).first(), n: 1 },
      { en: page.getByText('Datos generales').first(), n: 2 },
    ], { recorte: LADO });
  });
  await ir(page, '/tiempo-extra/mis-solicitudes', 2500);
  await intentar('mis solicitudes', async () => {
    await capturar(page, `${R}/16-mis-solicitudes`, [
      { en: page.getByRole('tab', { name: /Autorizadas/ }), n: 1 },
      { en: page.getByRole('button', { name: /Continuar/ }).first(), n: 2 },
    ], { recorte: LADO });
  });

  // ── Vencidas y fuera de tiempo ──
  await intentar('vencidas y fuera de tiempo', async () => {
    await ir(page, '/tiempo-extra/autorizar', 2500);
    await page.getByRole('tab', { name: /Vencidas/ }).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/17-vencidas`, [{ en: page.getByRole('tab', { name: /Vencidas/ }), n: 1 }, { en: page.getByRole('button', { name: /Ver|Revisar/ }).first(), n: 2 }], { recorte: LADO });
    await page.getByRole('button', { name: /Ver|Revisar/ }).first().click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/18-fuera-de-tiempo`, [{ en: cuadro().getByRole('button', { name: /Autorizar fuera de tiempo/ }), n: 1 }], { recorte: DETALLE });
    await cuadro().getByRole('button', { name: /Autorizar fuera de tiempo/ }).click(); await page.waitForTimeout(1200);
    await cuadro().locator('textarea').last().fill('Sí se trabajó; la autorización no se alcanzó a firmar a tiempo.');
    await capturar(page, `${R}/19-fuera-de-tiempo-motivo`, [
      { en: cuadro().locator('textarea').last(), n: 1 }, { en: cuadro().getByRole('button').last(), n: 2 },
    ], { recorte: DIALOGO });
    await cuadro().getByRole('button').last().click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/20-fuera-de-tiempo-listo`, [{ en: page.getByText(/fuera de tiempo/i).first(), n: 1 }], { recorte: LADO });
  });

  // ── Consulta ──
  await ir(page, '/tiempo-extra/consulta', 3000);
  await intentar('consulta', async () => {
    await capturar(page, `${R}/21-consulta`, [
      { en: page.getByRole('button', { name: /Exportar consulta/ }), n: 1 },
      { en: page.getByText('Autorizado del mes, por área').first(), n: 2 },
      { en: page.locator('select').first(), n: 3 },
    ], { recorte: LADO });
  });
  await intentar('consulta filtros', async () => {
    await page.locator('select').nth(1).selectOption({ index: 1 }).catch(() => {});
    await capturar(page, `${R}/22-consulta-filtros`, [
      { en: page.locator('label').filter({ hasText: /^Estatus$/ }), n: 1 }, { en: page.locator('label').filter({ hasText: /^Fuera de tiempo$/ }), n: 2 },
      { en: page.locator('label').filter({ hasText: /^Fecha del tiempo extra, desde$/ }), n: 3 },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Ver/ }).first().click(); await page.waitForTimeout(2500);
    await capturar(page, `${R}/23-consulta-detalle`, [{ en: cuadro().locator('h2').first(), n: 1 }], { recorte: DETALLE });
    await cerrar();
  });
  await intentar('exportar consulta', async () => {
    await page.getByRole('button', { name: /Exportar consulta/ }).click(); await page.waitForTimeout(1500);
    await capturar(page, `${R}/24-consulta-exportada`, [{ en: page.getByText(/Descargaste|descargó|Listo/i).first(), n: 1 }], { recorte: LADO });
  });

  // ── Usuarios y accesos ──
  await ir(page, '/personal/accesos/usuarios', 3000);
  await intentar('usuarios', async () => {
    await capturar(page, `${R}/25-usuarios`, [
      { en: page.getByRole('button', { name: /Nuevo usuario/ }), n: 1 }, { en: page.getByRole('button', { name: /Crear usuarios en lote/ }), n: 2 },
      { en: page.getByPlaceholder(/Buscar por nómina/), n: 3 },
      { en: page.locator('tr', { hasText: '8031' }).locator('button').nth(0), n: 4 },
      { en: page.locator('tr', { hasText: '8031' }).locator('button').nth(1), n: 5 },
      { en: page.locator('tr', { hasText: '8031' }).locator('button').nth(2), n: 6 },
    ], { recorte: LADO });
  });
  await intentar('nuevo usuario', async () => {
    await page.getByRole('button', { name: /Nuevo usuario/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/26-nuevo-usuario`, [
      { en: cuadro().getByText(/Persona del padrón/), n: 1 }, { en: cuadro().getByText(/Rol del sistema/).first(), n: 2 },
      { en: cuadro().getByRole('button', { name: /Crear usuario/ }), n: 3 },
    ], { recorte: DIALOGO_GRANDE });
    await cuadro().getByRole('button', { name: /Capturar a mano/ }).click().catch(() => {}); await page.waitForTimeout(500);
    await capturar(page, `${R}/27-capturar-a-mano`, [{ en: cuadro().locator('input').first(), n: 1 }], { recorte: DIALOGO_GRANDE });
    await cerrar();
  });
  await intentar('crear usuario y contraseña temporal', async () => {
    await page.getByRole('button', { name: /Nuevo usuario/ }).click(); await page.waitForTimeout(800);
    const buscar = cuadro().locator('input').first(); await buscar.fill('Palacios'); await page.waitForTimeout(800);
    await cuadro().getByText(/PALACIOS/i).first().click(); await page.waitForTimeout(500);
    await cuadro().getByRole('button', { name: /Crear usuario/ }).click(); await page.waitForTimeout(3000);
    await capturar(page, `${R}/28-contrasena-temporal`, [
      { en: cuadro().locator('[class*=mono]').first(), n: 1 }, { en: cuadro().getByRole('button', { name: /Copiar contraseña/ }), n: 2 },
      { en: cuadro().getByRole('button', { name: /Ya la copié/ }), n: 3 },
    ], { recorte: DIALOGO_GRANDE });
    await cuadro().getByRole('button', { name: /Ya la copié/ }).click(); await page.waitForTimeout(800);
  });
  await intentar('lote', async () => {
    await page.getByRole('button', { name: /Crear usuarios en lote/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/29-lote`, [
      { en: cuadro().getByRole('button', { name: /Agregar otros empleados/ }), n: 1 }, { en: cuadro().getByRole('button', { name: /Crear d+ cuenta/ }), n: 2 },
    ], { recorte: LOTE });
    await cuadro().getByRole('button', { name: /Agregar otros empleados/ }).click(); await page.waitForTimeout(800);
    await capturar(page, `${R}/30-lote-buscar`, [{ en: cuadro().getByPlaceholder(/Buscar en el padrón/), n: 1 }, { en: cuadro().getByRole('button', { name: 'Listo' }), n: 2 }], { recorte: LOTE });
    await cerrar();
  });
  await intentar('lapiz', async () => {
    await page.locator('tr', { hasText: '8031' }).locator('button').nth(0).click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/31-editar-usuario`, [
      { en: cuadro().getByText(/Nombre completo/).first(), n: 1 }, { en: cuadro().locator('select').first(), n: 2 },
      { en: cuadro().getByRole('button', { name: /Agregar asignación/ }), n: 3 }, { en: cuadro().getByRole('button', { name: /Guardar nombre y rol/ }), n: 4 },
    ], { recorte: DIALOGO_GRANDE });
    await cuadro().getByRole('button', { name: /Agregar asignación/ }).click(); await page.waitForTimeout(600);
    await capturar(page, `${R}/32-agregar-asignacion`, [
      { en: cuadro().getByText(/^Tipo$/), n: 1 }, { en: cuadro().getByText(/^Área$/), n: 2 }, { en: cuadro().getByText(/Desde/), n: 3 }, { en: cuadro().getByRole('button', { name: /^Agregar$/ }), n: 4 },
    ], { recorte: DIALOGO_GRANDE });
    await cuadro().locator('select').first().selectOption({ label: 'Recursos Humanos' }).catch(() => {}); await page.waitForTimeout(300);
    await cuadro().getByRole('button', { name: /Guardar nombre y rol/ }).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/33-dar-rol-rh`, [{ en: page.getByText(/Dar acceso de Recursos Humanos/).first(), n: 1 }, { en: page.getByRole('button', { name: /^Dar acceso$/ }), n: 2 }], { recorte: DIALOGO });
    await page.getByRole('button', { name: /Cancelar/ }).last().click(); await page.waitForTimeout(400);
    await cerrar();
  });
  await intentar('restablecer', async () => {
    await ir(page, '/personal/accesos/usuarios', 2500);
    await page.locator('tr', { hasText: '8031' }).locator('button').nth(1).click(); await page.waitForTimeout(1000);
    await capturar(page, `${R}/34-restablecer`, [{ en: cuadro().getByText(/Restablecer contraseña ·/), n: 1 }, { en: cuadro().getByRole('button', { name: /^Restablecer contraseña$/ }), n: 2 }], { recorte: DIALOGO });
    await cuadro().getByRole('button', { name: /^Restablecer contraseña$/ }).click(); await page.waitForTimeout(3000);
    await capturar(page, `${R}/35-restablecida`, [{ en: cuadro().locator('[class*=mono]').first(), n: 1 }, { en: cuadro().getByRole('button', { name: /Ya la copié/ }), n: 2 }], { recorte: DIALOGO_GRANDE });
    await cuadro().getByRole('button', { name: /Ya la copié/ }).click(); await page.waitForTimeout(600);
  });
  await intentar('desactivar', async () => {
    await page.locator('tr', { hasText: '8031' }).locator('button').nth(2).click(); await page.waitForTimeout(800);
    await capturar(page, `${R}/36-desactivar`, [{ en: cuadro().getByRole('button', { name: /^Desactivar$/ }), n: 1 }], { recorte: DIALOGO });
    await cuadro().getByRole('button', { name: /Cancelar/ }).click(); await page.waitForTimeout(400);
  });

  // ── Asignaciones, organigrama, lista de personal ──
  await ir(page, '/personal/accesos/asignaciones', 3000);
  await intentar('asignaciones', async () => {
    await capturar(page, `${R}/37-asignaciones`, [
      { en: page.getByRole('button', { name: /Asignar rol/ }), n: 1 }, { en: page.locator('select').first(), n: 2 },
      { en: page.getByRole('table').first(), n: 3, sinCaja: false },
    ], { recorte: LADO });
    await page.getByRole('button', { name: /Asignar rol/ }).click(); await page.waitForTimeout(800);
    await capturar(page, `${R}/38-asignar-rol`, [
      { en: cuadro().getByText(/^Rol$/), n: 1 }, { en: cuadro().getByText(/^Área$/), n: 2 }, { en: cuadro().getByText(/^Empleado$/), n: 3 },
      { en: cuadro().getByText(/^Desde$/), n: 4 }, { en: cuadro().getByRole('button', { name: /^Asignar$/ }), n: 5 },
    ], { recorte: DIALOGO_GRANDE });
    await cerrar();
  });
  await ir(page, '/personal/accesos/organigrama', 3000);
  await intentar('organigrama', async () => {
    await capturar(page, `${R}/39-organigrama`, [
      { en: page.getByText(/Resaltar sin usuario/), n: 1 }, { en: page.getByText('Nivel 2 · Planta'), n: 2 },
      { en: page.getByText(/Sin Autorización 1/).first(), n: 3 },
    ], { recorte: LADO });
    await page.getByText('Cortés Bravo Héctor').first().click(); await page.waitForTimeout(1200);
    await capturar(page, `${R}/40-organigrama-persona`, [
      { en: page.getByRole('button', { name: /Extender/ }), n: 1 }, { en: page.getByRole('button', { name: /Revocar/ }), n: 2 }, { en: page.getByText(/^Historial$/).last(), n: 3 },
    ], { recorte: LADO });
  });
  await ir(page, '/personal/lista', 2500);
  await intentar('lista de personal', async () => {
    await capturar(page, `${R}/41-lista-personal`, [
      { en: page.getByText('Todas las áreas').first(), n: 1 }, { en: page.locator('th').first(), n: 2 },
    ], { recorte: LADO });
  });
  await browser.close();
}
