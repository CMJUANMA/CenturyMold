// Prueba de humo de la lógica pura (sin Firebase): carga los módulos con el servidor de Vite en modo SSR.
// Uso: node scripts/prueba-humo.mjs
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const cargar = (p) => server.ssrLoadModule(p);
let ok = 0;
const prueba = async (nombre, fn) => { await fn(); ok++; console.log('  ✓', nombre); };

try {
  const F = await cargar('/src/utils/fechas.js');
  const S = await cargar('/src/utils/solicitudes.js');
  const C = await cargar('/src/utils/constantes.js');
  const I = await cargar('/src/utils/formatosImportacion.js');

  await prueba('toDate acepta Timestamp, ISO, Date y basura', () => {
    const d = new Date('2026-10-12T10:00:00Z');
    assert.equal(F.toDate({ toDate: () => d }).getTime(), d.getTime());
    assert.equal(F.toDate('2026-10-12T10:00:00Z').getTime(), d.getTime());
    assert.equal(F.toDate(d).getTime(), d.getTime());
    assert.equal(F.toDate({ seconds: d.getTime() / 1000 }).getTime(), d.getTime());
    assert.equal(F.toDate(null), null);
    assert.equal(F.toDate('no es fecha'), null);
  });
  await prueba('mismoMes distingue año', () => {
    assert.equal(F.mismoMes('2026-10-05T12:00:00', new Date(2026, 9, 20)), true);
    assert.equal(F.mismoMes('2025-10-05T12:00:00', new Date(2026, 9, 20)), false);
  });
  await prueba('fechaLocal / sumarDias / rangoSemana (sin desfase)', () => {
    assert.equal(F.ymd(F.fechaLocal('2026-10-12')), '2026-10-12');
    assert.equal(F.sumarDias('2026-10-31', 1), '2026-11-01');
    assert.deepEqual(F.rangoSemana('2026-10-14', 0), { desde: '2026-10-12', hasta: '2026-10-18' }); // miércoles → lunes..domingo
    assert.deepEqual(F.rangoSemana('2026-10-14', 1), { desde: '2026-10-19', hasta: '2026-10-25' });
    assert.deepEqual(F.rangoSemana('2026-10-18', 0), { desde: '2026-10-12', hasta: '2026-10-18' }); // domingo
  });
  await prueba('resumenPasajeros + textoConteo', () => {
    const r = S.resumenPasajeros([
      { turno: '1', puesto: 'Operador', alimentos: true },
      { turno: '1', puesto: 'Operador', alimentos: false },
      { turno: 'TE', puesto: 'Soldador', alimentos: true },
      { turno: '', puesto: '', alimentos: false },
    ]);
    assert.deepEqual(r, { totalPasajeros: 4, totalAlimentos: 2, conteoTurnos: { 1: 2, TE: 1 }, conteoPuestos: { Operador: 2, Soldador: 1 } });
    assert.equal(S.textoConteo(r.conteoTurnos), '1, TE');
    assert.equal(S.textoConteo(undefined), '—');
  });
  await prueba('validarSolicitud', () => {
    const completo = { empleadoSeleccionado: { nomina: '1' }, puesto: 'X', turno: '1', horaEntrada: 'a', horaSalida: 'b', rutaId: 'r', comunidadId: 'c', puntoReunionId: 'p', needsConfirmation: false, isConfirmed: false };
    assert.equal(S.validarSolicitud({ fechaServicio: '', pasajeros: [completo] }), 'Selecciona la fecha del servicio.');
    assert.match(S.validarSolicitud({ fechaServicio: '2026-10-20', pasajeros: [completo], comentarioObligatorio: true }), /comentario/);
    assert.match(S.validarSolicitud({ fechaServicio: '2026-10-20', pasajeros: [{ ...completo, turno: '' }] }), /Completa/);
    assert.match(S.validarSolicitud({ fechaServicio: '2026-10-20', pasajeros: [{ ...completo, needsConfirmation: true }] }), /Completa/);
    assert.equal(S.validarSolicitud({ fechaServicio: '2026-10-20', pasajeros: [completo] }), null);
    const muchos = Array.from({ length: S.MAX_PASAJEROS + 1 }, () => completo);
    assert.equal(S.validarSolicitud({ fechaServicio: '2026-10-20', pasajeros: muchos }), S.MSG_MAX_PASAJEROS);
  });
  await prueba('cambiosPadron solo marca empleados con ruta distinta', () => {
    const p = (id, ruta, nueva) => ({ empleadoSeleccionado: { id, rutaId: ruta, comunidadId: 'c', puntoReunionId: 'p' }, rutaId: nueva, comunidadId: 'c', puntoReunionId: 'p' });
    assert.deepEqual(S.cambiosPadron([p('a', 'r1', 'r1'), p('b', 'r1', 'r2')]), { b: { rutaId: 'r2', comunidadId: 'c', puntoReunionId: 'p' } });
  });
  await prueba('constantes: valores guardados en Firestore intactos', () => {
    assert.deepEqual(C.ESTATUS_SOLICITUD, { PENDIENTE: 'pendiente', APROBADA: 'aprobada', RECHAZADA: 'rechazada', CANCELADA: 'cancelada', ENVIADA_PROVEEDOR: 'enviada al proveedor' });
    assert.deepEqual(C.ROLES, { SUPERINTENDENTE: 'superintendente', RH: 'rh', ADMIN: 'admin', AUTORIZADOR: 'autorizador' });
    for (const e of Object.values(C.ESTATUS_TE)) assert.ok(C.ESTATUS_TE_MAP[e]?.label, 'falta ESTATUS_TE_MAP de ' + e);
    for (const e of Object.values(C.ESTATUS_SOLICITUD)) assert.ok(C.ESTATUS_MAP[e]?.label, 'falta ESTATUS_MAP de ' + e);
  });
  await prueba('importación con exceljs: formato en blanco → llenar → leer', async () => {
    const wb = I.construirFormatoDirectorio();
    const ws = wb.getWorksheet(I.HOJA_DIR);
    ws.getRow(2).values = ['Ruta Norte', 'Colonia Centro', 'Oxxo Central', 'N-001'];
    ws.getRow(3).values = ['Ruta Norte', 'Colonia Centro', 'Parque', 'N-001']; // clave duplicada
    ws.getRow(5).values = ['Ruta Sur', '', 'Plaza', 'S-001'];                  // comunidad vacía
    const buf = await wb.xlsx.writeBuffer();
    const filas = await I.leerDirectorio(buf);
    assert.equal(filas.length, 3);
    assert.equal(filas[0].estado, 'valido', JSON.stringify(filas[0]));
    assert.equal(filas[0].datos.RUTA, 'RUTA NORTE');
    assert.equal(filas[1].estado, 'error');
    assert.match(filas[1].mensaje, /duplicada/);
    assert.equal(filas[2].filaExcel, 5); // los números de fila de Excel se conservan aunque haya filas vacías
    assert.match(filas[2].mensaje, /COMUNIDAD/);
  });
  await prueba('importación de empleados: nómina numérica y archivo inválido', async () => {
    const wb = I.construirFormatoEmpleados([]);
    const ws = wb.getWorksheet(I.HOJA_EMP);
    ws.getRow(2).values = [12345, 'Ana Pérez', 'Operador', ''];   // nómina como número
    ws.getRow(3).values = ['ABC', 'Luis', 'Operador', ''];        // nómina no numérica
    const filas = await I.leerEmpleados(await wb.xlsx.writeBuffer(), new Map(), []);
    assert.equal(filas[0].datos.NOMINA, '12345');
    assert.equal(filas[0].estado === 'error', false);
    assert.equal(filas[1].estado, 'error');
    await assert.rejects(() => I.leerEmpleados(new TextEncoder().encode('no soy un xlsx').buffer, new Map(), []), /xlsx/);
    const otro = new ExcelJS.Workbook(); otro.addWorksheet('Otra');
    await assert.rejects(async () => I.leerDirectorio(await otro.xlsx.writeBuffer()), /hoja/);
  });
} finally {
  await server.close();
}
console.log(`\n${ok} pruebas OK`);
