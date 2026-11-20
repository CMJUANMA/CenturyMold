// Etapa 4 — RH confirma y descarga el Formato de rutas (se revisa el Excel); Nóminas abre la semana, ajusta y descarga el formato (se revisa el Excel).
import { ALMACEN, PERSONAS, PASSWORD_NUEVA } from './datos.mjs';
import { esperar, igual, leerColeccion, leerDoc, paso, verificar } from './infra.mjs';
import { FECHA_A, FECHA_B } from './etapa-captura.mjs';
import { cuadro, claveSemanaDe, sumarDiasYmd, descargar, entrar, ir, leerExcel, textoDeExcel } from './ui.mjs';

const RUTA_DE = { 6001: 'RUTA NORTE', 6002: 'RUTA NORTE', 6003: 'RUTA SUR', 6004: 'RUTA SUR', 6005: 'RUTA ORIENTE', 6006: 'RUTA ORIENTE' };
const nombreDe = (n) => ALMACEN.find(a => a.nomina === n).nombre;

export async function etapaNomina({ nueva, contexto }) {
  console.log('\nEtapa 4 · RH (confirmar y Formato de rutas) y Nóminas');
  const A = contexto.solicitudes.A;
  const B = contexto.solicitudes.B;
  const rh = await nueva();
  const p = { page: rh };

  await paso('RH entra y ve las dos autorizadas por confirmar, con sus dos firmas', async () => {
    igual(await entrar(rh, PERSONAS.rh.nomina, PASSWORD_NUEVA), 'inicio', 'adónde lo manda el login');
    await ir(rh, '/tiempo-extra/recepcion', 3000);
    for (const s of [A, B]) verificar(await rh.locator('tr', { hasText: s.folio }).count(), `RH no ve el folio ${s.folio} en «Por enviar al proveedor».`);
    const fila = rh.locator('tr', { hasText: A.folio }).first();
    verificar(/Aut\. 1: .*\S/.test(await fila.innerText()) && !/Aut\. 2: —/.test(await fila.innerText()), 'La fila de A no muestra las dos firmas.');
    await fila.getByRole('button', { name: 'Revisar', exact: true }).click();
    await cuadro(rh).waitFor();
    let detalle = '';
    for (let i = 0; i < 20 && !/Fuentes/i.test(detalle); i++) { await esperar(500); detalle = await cuadro(rh).innerText(); } // los empleados se leen después de abrir
    for (const n of ['Aguilar', 'Fuentes']) verificar(new RegExp(n, 'i').test(detalle), `El detalle de A no lista a ${n}.`);
    verificar(/Fue devuelta antes/.test(detalle) && /Faltan detalles/.test(detalle), 'El detalle no recuerda la devolución anterior de A.');
    for (const r of ['RUTA NORTE', 'RUTA SUR', 'RUTA ORIENTE']) verificar(detalle.includes(r), `El detalle de A no menciona la ${r}.`);
    await rh.keyboard.press('Escape');
    await cuadro(rh).waitFor({ state: 'hidden' }).catch(() => {});
  }, p);

  await paso('RH confirma todas las fechas: se generan las solicitudes de transporte', async () => {
    await rh.locator('#btn-confirmar-todas-las-fechas').click();
    await cuadro(rh).getByRole('button').last().click();
    await cuadro(rh).getByText(/Ver en Solicitudes de transporte/).waitFor({ timeout: 40000 });
    await cuadro(rh).getByRole('button', { name: 'Cerrar', exact: true }).last().click();
    const sols = await leerColeccion('solicitudes');
    igual(sols.length, 2, 'solicitudes de transporte generadas');
    const pasajeros = {};
    for (const s of sols) pasajeros[s.id] = (await leerColeccion(`solicitudes/${s.id}/pasajeros`)).length;
    igual(Object.values(pasajeros).sort(), [2, 6], 'pasajeros por solicitud de transporte');
    for (const s of [A, B]) igual((await leerDoc(`tiempoExtra/${s.id}`)).estatus.startsWith('confirmada') || (await leerDoc(`tiempoExtra/${s.id}`)).estatus.startsWith('procesada'), true, `estatus de ${s.folio} tras confirmar`);
    return '2 solicitudes de transporte: 6 y 2 pasajeros';
  }, p);

  await paso('RH descarga el Formato de rutas del rango completo', async () => {
    await ir(rh, '/transporte/formato-rutas', 2500);
    await rh.locator('#btn-formato-rutas-pagina').click();
    const d = cuadro(rh);
    await d.getByText('Elegir fecha', { exact: true }).click();
    await d.getByText('Rango de fechas', { exact: true }).click();
    await d.locator('input[type=date]').nth(0).fill(FECHA_A);
    await d.locator('input[type=date]').nth(1).fill(sumarDiasYmd(FECHA_B, 1));
    await d.getByText(/\b2 solicitudes\b|8 pasajeros|8 viajes/).first().waitFor({ timeout: 15000 }).catch(() => {});
    const ruta = await descargar(rh, () => d.getByRole('button', { name: /Descargar Excel/ }).click(), 'formato-rutas.xlsx');
    contexto.archivos.rutas = ruta;
  }, p);

  await paso('Excel del Formato de rutas: pasajeros, ruta, punto y teléfono correctos; la extensión cae en la hoja del día siguiente', async () => {
    const hojas = await leerExcel(contexto.archivos.rutas);
    const dm = (ymd) => `${ymd.slice(8, 10)}-${ymd.slice(5, 7)}`;
    const fechaB1 = sumarDiasYmd(FECHA_B, 1);
    igual(Object.keys(hojas).sort(), [`${dm(FECHA_A)} Turno 1`, `${dm(fechaB1)} Turno 3`].sort(), 'hojas del Excel (una por fecha de servicio y turno)');
    const PUNTO_DE = { 6001: 'PARQUE CENTRAL', 6002: 'FARMACIA DEL AHORRO', 6003: 'PLAZA COMERCIAL', 6004: 'PLAZA COMERCIAL', 6005: 'CAPILLA', 6006: 'CAPILLA' };
    const COMUNIDAD_DE = { 6001: 'COLONIA SAN PEDRO', 6002: 'COLONIA SAN PEDRO', 6003: 'COLONIA VISTA HERMOSA', 6004: 'COLONIA VISTA HERMOSA', 6005: 'LOMAS DEL SOL', 6006: 'LOMAS DEL SOL' };
    const pasajeros = (filas) => filas.filter(f => /^\d{4}$/.test(f[2]));
    const comprobar = (f, n, entrada, salida, alimentos, donde) => {
      const a = ALMACEN.find(x => x.nomina === n);
      const tel = `${a.telefono.slice(0, 3)} ${a.telefono.slice(3, 6)} ${a.telefono.slice(6)}`;
      igual(f.slice(0, 11), ['Almacén', 'ALMACENISTA', n, a.nombre, entrada, salida, alimentos, RUTA_DE[n], COMUNIDAD_DE[n], PUNTO_DE[n], tel], `${donde}: fila de ${a.nombre}`);
    };
    const hojaA = pasajeros(hojas[`${dm(FECHA_A)} Turno 1`]);
    igual(hojaA.map(f => f[2]).sort(), ['6001', '6002', '6003', '6004', '6005', '6006'], 'pasajeros de la hoja de A');
    for (const f of hojaA) comprobar(f, f[2], '07:00', '16:00', 'SI', 'Hoja de A');
    const hojaB = pasajeros(hojas[`${dm(fechaB1)} Turno 3`]);
    igual(hojaB.map(f => f[2]).sort(), ['6001', '6002'], 'pasajeros de la hoja de B');
    for (const f of hojaB) comprobar(f, f[2], 'YA EN PLANTA', '07:00', 'NO', 'Hoja de B');
    verificar(textoDeExcel(hojas).includes('TE-2026-0001') && textoDeExcel(hojas).includes('TE-2026-0002'), 'El Excel no cita los folios de las dos solicitudes.');
    return `A: 6 pasajeros (hoja ${dm(FECHA_A)} Turno 1) · B: 2 pasajeros (hoja ${dm(fechaB1)} Turno 3, salida 7:00 del día siguiente)`;
  }, p);
  await rh.context().close();

  // ── Nóminas ───────────────────────────────────────────────────────────────────────────────
  const nom = await nueva();
  const pn = { page: nom };
  const semana = claveSemanaDe(FECHA_A);
  const horasDe = (nomina) => `Horas de ${nombreDe(nomina)} el`;

  await paso('Nóminas entra y abre la semana del tiempo extra de Almacén', async () => {
    igual(await entrar(nom, PERSONAS.nomina.nomina, PASSWORD_NUEVA), 'inicio', 'adónde lo manda el login');
    await ir(nom, `/nomina/reportes?periodo=${semana}`, 3500);
    verificar(/Almac/.test(await nom.locator('main').innerText()), 'La semana no muestra el área Almacén.');
    await ir(nom, `/nomina/semana/${semana}/almacen`, 3500);
    for (const a of ALMACEN) verificar(await nom.locator('[data-hoja] tbody tr', { hasText: a.nombre }).count(), `El formato no trae a ${a.nombre}.`);
  }, pn);

  await paso('Nóminas ajusta: corrige las horas de uno (9 → 8) y quita a otro con motivo, y guarda', async () => {
    // la celda del día con 9 horas de 6003
    const celdas = nom.locator(`[data-hoja] input[aria-label^="${horasDe('6003')}"]`);
    const n = await celdas.count();
    let objetivo = -1;
    for (let i = 0; i < n; i++) if ((await celdas.nth(i).inputValue()) === '9') objetivo = i;
    verificar(objetivo >= 0, `6003 no trae una celda con 9 horas (celdas: ${n}).`);
    await celdas.nth(objetivo).fill('8');
    await celdas.nth(objetivo).press('Tab');
    const fila5 = nom.locator('[data-hoja] tbody tr', { hasText: nombreDe('6005') }).first();
    await fila5.getByRole('button', { name: /Acciones de/ }).click();
    await nom.getByRole('menuitem', { name: /Quitar/ }).click();
    await cuadro(nom).locator('input[type=text], textarea').first().fill('No asistió ese día');
    await cuadro(nom).getByRole('button', { name: 'Quitar', exact: true }).click();
    await nom.locator('#btn-guardar-cambios').click();
    await cuadro(nom).locator('input[type=text], textarea').first().fill('Corrección de asistencia de la semana');
    await cuadro(nom).getByRole('button', { name: 'Guardar cambios' }).click();
    await nom.locator('#btn-deshacer-ajustes').waitFor({ timeout: 20000 });
    const ajuste = (await leerColeccion('ajustesNomina'))[0];
    verificar(ajuste && (ajuste.cambios ?? []).length >= 2, `Los ajustes no quedaron guardados: ${JSON.stringify(ajuste)?.slice(0, 200)}`);
  }, pn);

  await paso('Nóminas marca el área como firmada y descarga el formato', async () => {
    await nom.getByRole('button', { name: /Marcar como firmada/ }).click();
    await cuadro(nom).getByRole('button', { name: 'Marcar como firmada' }).click();
    await nom.getByText(/Esta área ya está firmada/).waitFor({ timeout: 20000 });
    contexto.archivos.nomina = await descargar(nom, () => nom.locator('#btn-descargar-area').click(), 'formato-nomina-almacen.xlsx');
  }, pn);

  await paso('Excel del formato de nómina: horas por día, subtotales, motivos, P.O. y el ajuste de Nóminas', async () => {
    const hojas = await leerExcel(contexto.archivos.nomina);
    igual(Object.keys(hojas), ['Almacén'], 'hojas del Excel de nómina');
    const filas = hojas['Almacén'];
    verificar(filas.some(f => f[0] === 'No. Semana:' && f[2] === claveSemanaDe(FECHA_A).split('-')[1].replace(/^0/, '')), 'El Excel no trae el número de semana correcto.');
    verificar(filas.some(f => f.some(c => /Materiales\/Logística/.test(c) && c.startsWith('☒'))), 'La casilla del área (Materiales/Logística) no está marcada.');
    const dia = (ymd) => { const d = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return 3 + ((d + 6) % 7); }; // Lunes = columna 3
    const [cA, cB] = [dia(FECHA_A), dia(FECHA_B)];
    const quitar = (f) => f.map(c => (c === '' ? 0 : Number(c)));
    // [nómina, nombre, horas del día A, horas del día B, subtotal, P.O., motivo]
    const esperado = [
      ['6001', 'Ana Aguilar Ríos', 9, 15, 24, '', 'Inventario físico'],
      ['6002', 'Carlos Bravo Leal', 9, 15, 24, '', 'Inventario físico'],
      ['6003', 'Diana Castro Mora', 8, 0, 8, '', 'Inventario físico'], // corregido de 9 a 8 por Nóminas
      ['6004', 'Domínguez Soto Eric', 9, 0, 9, '4551099797', 'Cargo a P.O.'],
      ['6006', 'Fuentes Vega Gabriel', 9, 0, 9, '', 'Inventario físico'],
    ];
    for (const [n, nombre, hA, hB, sub, po, motivo] of esperado) {
      const f = filas.find(x => x[1] === n);
      verificar(f, `El Excel no trae al empleado ${n} (${nombre}).`);
      igual([f[2], Number(f[cA] || 0), Number(f[cB] || 0), Number(f[10]), f[11], f[12]], [nombre, hA, hB, sub, po, motivo], `fila de ${n}`);
    }
    verificar(!filas.some(f => f[1] === '6005'), '6005 se quitó con motivo y sigue en el formato.');
    const total = filas.find(f => f[0] === 'Total Hrs.');
    igual([Number(total[cA]), Number(total[cB]), Number(total[10])], [44, 30, 74], 'totales del formato (44 h el día A, 30 el día B, 74 en la semana)');
    return 'semana ' + claveSemanaDe(FECHA_A) + ': 5 empleados, 74 h; 6003 corregido a 8 h; 6005 quitado';
  }, pn);
  await nom.context().close();
}
