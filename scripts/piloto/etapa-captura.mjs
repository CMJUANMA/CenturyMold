// Etapa 2 — La solicitante de Almacén captura dos tiempos extra con transporte:
//   A) turno extra de 6 empleados, con DOS motivos (el sexto no tiene ruta: la app lo pide y se elige del catálogo);
//   B) extensión de turno que CRUZA LA MEDIANOCHE (16:00 → 7:00 del día siguiente).
import { enDias, PERSONAS, PASSWORD_NUEVA } from './datos.mjs';
import { esperar, igual, leerColeccion, leerDoc, paso, verificar } from './infra.mjs';
import { cuadro, entrar, ir } from './ui.mjs';

// Fechas fijas respecto a hoy pero siempre en la misma semana de nómina: A = el próximo martes (a 2 días o más); B = el miércoles siguiente (termina el jueves 7:00)
const diasHastaMartes = () => { const dia = new Date(Date.now() + 2 * 86400000).getDay(); return 2 + ((2 - dia + 7) % 7); };
export const FECHA_A = enDias(diasHastaMartes());
export const FECHA_B = enDias(diasHastaMartes() + 1);
export const EMPLEADOS_A = ['6001', '6002', '6003', '6004', '6005', '6006'];
export const EMPLEADOS_B = ['6001', '6002'];
const MOTIVO_1 = 'Inventario físico';
const MOTIVO_2 = 'Cargo a P.O.';
const NUMERO_PO = '4551099797';

const agregarEmpleados = async (page, nominas) => {
  await page.locator('#btn-agregar-empleados').click();
  const d = cuadro(page);
  await d.getByPlaceholder('Nombre o nómina').waitFor();
  for (const n of nominas) await d.locator('label', { hasText: n }).first().click();
  await d.getByRole('button', { name: /^Agregar \d/ }).click();
  await d.waitFor({ state: 'hidden' });
  await esperar(500);
};

async function enviarYLeerFolio(page) {
  await page.locator('#btn-enviar-autorizacion').click();
  await cuadro(page).getByRole('button', { name: /^(Enviar|Reenviar)$/ }).click();
  await page.waitForURL(u => u.pathname.includes('/mis-solicitudes'), { timeout: 30000 });
  await esperar(1500);
}

export async function etapaCaptura({ nueva, contexto }) {
  console.log('\nEtapa 2 · Captura (solicitante de Almacén)');
  const page = await nueva();
  const p = { page };
  const sol = PERSONAS.solicitante;

  await paso('La solicitante de Almacén entra', async () => { igual(await entrar(page, sol.nomina, PASSWORD_NUEVA), 'inicio', 'adónde la manda el login'); }, p);

  await paso('Solicitud A (turno extra, 6 empleados, dos motivos): datos, motivos y empleados', async () => {
    await ir(page, '/tiempo-extra/nueva', 2500);
    verificar((await page.locator('#te-area').inputValue()).includes('Almac'), 'El área de la solicitante no es Almacén.');
    await page.locator('#te-fecha').fill(FECHA_A);
    await page.locator('#te-motivo-0').selectOption({ label: MOTIVO_1 });
    await page.locator('#btn-agregar-motivo').click();
    await page.locator('#te-motivo-1').selectOption({ label: MOTIVO_2 });
    await page.locator('#te-motivo-numero-1').fill(NUMERO_PO);
    await page.locator('#te-comentario').fill('Inventario de cierre y carga de un pedido con P.O.');
    await agregarEmpleados(page, EMPLEADOS_A);
    igual(await page.locator('[id^="fila-"]').count(), 6, 'empleados agregados');
    return '6 empleados, 2 motivos';
  }, p);

  await paso('Solicitud A: horario 7:00 a 16:00, con alimentos y con transporte; el segundo motivo a dos empleados', async () => {
    await page.getByLabel('Entrada para aplicar').selectOption('7:00');
    await page.getByLabel('Salida para aplicar').selectOption('16:00');
    await page.getByRole('button', { name: 'Con alimentos', exact: true }).click();
    await page.getByRole('button', { name: 'Con transporte', exact: true }).click();
    await esperar(600);
    for (const n of ['6004', '6005']) await page.locator(`#mot-${n}`).selectOption({ index: 1 });
    // las rutas que traen del padrón piden confirmación: se confirman todas
    for (let i = 0; i < 10; i++) {
      const b = page.getByRole('button', { name: 'Confirmar', exact: true });
      if (!(await b.count())) break;
      await b.first().click(); await esperar(200);
    }
  }, p);

  await paso('Solicitud A: el empleado sin ruta (6006) se pide con claridad y se elige la ruta del catálogo', async () => {
    const fila = page.locator('#fila-6006');
    const texto = await fila.innerText();
    verificar(/no tiene ruta guardada: elige ruta, comunidad y punto del catálogo/i.test(texto), `La fila de 6006 no pide la ruta con claridad: ${texto.replace(/\s+/g, ' ').slice(0, 250)}`);
    // intentar enviar así: la app dice qué falta
    await page.locator('#btn-enviar-autorizacion').click();
    await page.locator('#faltan-te').waitFor({ timeout: 8000 });
    verificar(/FUENTES VEGA GABRIEL: completa ruta, comunidad y punto de reuni/.test(await page.locator('#faltan-te').innerText()), 'El aviso de lo que falta no señala al empleado sin ruta (6006).');
    await fila.getByLabel(/^Ruta de /).selectOption({ label: 'RUTA ORIENTE' });
    await fila.getByLabel(/^Comunidad de /).selectOption({ label: 'LOMAS DEL SOL' });
    await fila.getByLabel(/^Punto de reunión de /).selectOption({ label: 'CAPILLA' });
    await esperar(400);
    return 'faltante señalado y resuelto con RUTA ORIENTE › LOMAS DEL SOL › CAPILLA';
  }, p);

  await paso('Solicitud A: las rutas recién importadas aparecen en cada empleado y los teléfonos vienen del padrón', async () => {
    const esperado = { 6001: 'RUTA NORTE', 6002: 'RUTA NORTE', 6003: 'RUTA SUR', 6004: 'RUTA SUR', 6005: 'RUTA ORIENTE', 6006: 'RUTA ORIENTE' };
    for (const [n, ruta] of Object.entries(esperado)) {
      const sel = page.locator(`#fila-${n}`).getByLabel(/^Ruta de /);
      igual((await sel.locator('option:checked').innerText()).trim(), ruta, `ruta de ${n} en la captura`);
    }
    for (const n of EMPLEADOS_A.slice(0, 5)) igual(await page.locator(`#tel-${n}`).inputValue(), `442111000${n.slice(-1)}`, `teléfono de ${n}`);
    // Se confirma una ruta antes de enviar: más de una ruta pide justificación
    const just = page.locator('#te-justificacion-rutas');
    if (await just.count()) await just.fill('Los empleados viven en comunidades distintas, una ruta por cada comunidad.');
  }, p);

  await paso('Solicitud A: se envía a autorización', async () => {
    await enviarYLeerFolio(page);
    const tes = (await leerColeccion('tiempoExtra')).filter(t => t.fechaTE === FECHA_A);
    igual(tes.length, 1, 'solicitudes de la fecha A');
    igual(tes[0].estatus, 'pendiente_aut1', 'estatus de la solicitud A');
    igual(tes[0].resumen.totalEmpleados, 6, 'empleados de A');
    contexto.solicitudes.A = { id: tes[0].id, folio: tes[0].folio };
    return `folio ${tes[0].folio}`;
  }, p);

  await paso('Solicitud B (extensión que cruza la medianoche): 16:00 → 7:00 del día siguiente, solo transporte de salida', async () => {
    await ir(page, '/tiempo-extra/nueva', 2500);
    await page.locator('#te-fecha').fill(FECHA_B);
    await page.locator('#te-motivo-0').selectOption({ label: MOTIVO_1 });
    await page.locator('#te-comentario').fill('Se quedan a terminar el inventario de la noche.');
    await page.getByText('Extensión de turno', { exact: true }).first().click();
    await agregarEmpleados(page, EMPLEADOS_B);
    await page.getByLabel('Fin de turno para aplicar').selectOption('16:00');
    await page.getByLabel('Hora hasta la que se quedan, para aplicar').selectOption('7:00');
    await page.getByRole('button', { name: 'Con transporte', exact: true }).click();
    await esperar(600);
    for (let i = 0; i < 5; i++) {
      const b = page.getByRole('button', { name: 'Confirmar', exact: true });
      if (!(await b.count())) break;
      await b.first().click(); await esperar(200);
    }
    const aviso = await page.locator('#fila-6001').innerText();
    verificar(/Termina: .*7:00 a\. ?m\. \(día siguiente\)/.test(aviso.replace(/\s+/g, ' ')), `La fila no avisa que termina al día siguiente: ${aviso.replace(/\s+/g, ' ').slice(0, 200)}`);
    verificar(await page.locator('#fila-6001').getByLabel(/Transporte de llegada/).isDisabled(), 'En una extensión la llegada debería estar deshabilitada.');
    await enviarYLeerFolio(page);
    const tes = (await leerColeccion('tiempoExtra')).filter(t => t.fechaTE === FECHA_B);
    igual(tes.length, 1, 'solicitudes de la fecha B');
    igual([tes[0].tipo, tes[0].resumen.totalHoras], ['extension', 30], 'tipo y horas de B (2 empleados × 15 h)');
    contexto.solicitudes.B = { id: tes[0].id, folio: tes[0].folio };
    return `folio ${tes[0].folio}, 2 empleados × 15 h`;
  }, p);

  await paso('Lo guardado coincide con lo capturado: empleados, horarios, motivos, rutas y teléfono', async () => {
    const A = contexto.solicitudes.A.id;
    const t = await leerDoc(`tiempoExtra/${A}`);
    igual((t.motivos ?? []).map(m => m.nombre), [MOTIVO_1, MOTIVO_2], 'motivos de A');
    igual(t.motivos[1].numero, NUMERO_PO, 'número de P.O.');
    const empleados = await leerColeccion(`tiempoExtra/${A}/empleados`);
    igual(empleados.length, 6, 'empleados guardados de A');
    for (const e of empleados) igual([e.horaEntrada, e.horaSalida, e.requiereTransporte], ['7:00', '16:00', true], `horario de ${e.id}`);
    const e6 = empleados.find(e => e.id === '6006');
    verificar(e6.rutaId && e6.puntoReunionId === 'OR01', 'A 6006 no se le guardó el punto de reunión elegido.');
    // la ruta elegida a mano se recordó en el padrón
    igual((await leerDoc('empleados/6006')).puntoReunionId, 'OR01', 'punto de reunión recordado en el padrón de 6006');
    const motivosAsignados = empleados.map(e => `${e.id}:${e.motivoIndex ?? 0}`).sort();
    igual(motivosAsignados, ['6001:0', '6002:0', '6003:0', '6004:1', '6005:1', '6006:0'], 'motivo de cada empleado');
    const B = contexto.solicitudes.B.id;
    const eb = await leerColeccion(`tiempoExtra/${B}/empleados`);
    for (const e of eb) igual([e.horaEntrada, e.horaSalida, !!e.transporteLlegada, !!e.transporteSalida], ['16:00', '7:00', false, true], `extensión de ${e.id}`);
  }, p);

  await page.context().close();
}
