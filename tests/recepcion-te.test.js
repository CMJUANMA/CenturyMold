// Recepción de RH: turno por hora de entrada, pasajeros de transporte, Excel del proveedor (AREA, turno, bloque de tiempo extra)
// y Excel de tiempo extra para RH. Datos ficticios.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  agruparPorFecha, datosSolicitudTransporte, horaFormatoRutas, pasajerosDeTE, quienDevolvio, solicitanteDeTransporte,
  NOMBRE_POR_ENVIAR, mensajeConfirmada, textoConfirmar, textoRecibida, turnoPorEntrada,
} from '../src/utils/tiempoExtra.js';
import { ENCABEZADOS_PROVEEDOR, agruparHojas, construirLibroProveedor } from '../src/utils/libroProveedor.js';
import {
  ENCABEZADOS_ALIMENTOS, ENCABEZADOS_DETALLE_RH, ENCABEZADOS_HORAS, ENCABEZADOS_RESUMEN_RH, construirLibroTiempoExtra, filasAlimentos,
  filasHorasPorEmpleado, filasResumen, filtrarParaDescarga, nombreArchivoTiempoExtra,
} from '../src/utils/exportarTiempoExtraRH.js';

const emp = (nomina, entrada, salida, extra = {}) => ({
  nomina, nombre: `EMPLEADO ${nomina}`, puesto: 'OPERADOR', turnoNomina: 'A', horaEntrada: entrada, horaSalida: salida, alimentos: false, transporte: true,
  rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', ...extra,
});
const te = { id: 'te1', folio: 'TE-2026-0001', areaId: 'moldes', areaNombre: 'Moldes', fechaTE: '2026-10-20', creadoPorNombre: 'OSCAR PEREZ', creadoPorNomina: '50532' };
const catalogos = {
  rutas: [{ id: 'r1', nombre: 'Norte' }, { id: 'r2', nombre: 'Sur' }], comunidades: [{ id: 'c1', nombre: 'Pueblito' }, { id: 'c2', nombre: 'Corregidora' }],
  puntos: [{ id: 'p1', nombre: 'Plaza' }, { id: 'p2', nombre: 'Gasolinera' }], areas: [{ id: 'moldes', nombre: 'Moldes' }, { id: 'calidad', nombre: 'Calidad' }],
};
const valores = (fila) => fila.values.slice(1);
// Las celdas combinadas repiten su valor en cada columna: se dejan una sola vez
const textoDe = (ws) => { const t = []; ws.eachRow(r => t.push(valores(r).filter(v => v !== undefined && v !== null && v !== '').map(String).filter((v, i, a) => i === 0 || v !== a[i - 1]))); return t; };

describe('turno por hora de entrada', () => {
  it('el turno que contiene la hora: 7:00 → 1, 16:00 → 2, 0:00 → 3', () => {
    expect(turnoPorEntrada('7:00')).toBe('1');
    expect(turnoPorEntrada('16:00')).toBe('2');
    expect(turnoPorEntrada('0:00')).toBe('3');
  });
  it('19:00 no inicia turno: cae en el 2 (el turno en que entra)', () => {
    expect(turnoPorEntrada('19:00')).toBe('2');
  });
  it('los bordes de cada turno', () => {
    expect(turnoPorEntrada('6:59')).toBe('3');
    expect(turnoPorEntrada('15:59')).toBe('1');
    expect(turnoPorEntrada('23:59')).toBe('2');
    expect(turnoPorEntrada('3:30')).toBe('3');
  });
  it('hora inválida o vacía: sin turno', () => {
    expect(turnoPorEntrada('')).toBe('');
    expect(turnoPorEntrada('raro')).toBe('');
    expect(turnoPorEntrada(undefined)).toBe('');
  });
  it('las horas pasan al formato del formulario de rutas', () => {
    expect(['7:00', '16:00', '19:00', '0:00'].map(horaFormatoRutas)).toEqual(['7:00AM', '4:00PM', '7:00PM', '12:00AM']);
    expect(horaFormatoRutas('12:30')).toBe('12:30PM');
    expect(horaFormatoRutas('raro')).toBe('raro');
  });
});

describe('transporte de un tiempo extra', () => {
  const empleados = [emp('1', '7:00', '16:00', { alimentos: true }), emp('2', '16:00', '0:00', { transporte: false, rutaId: '' }), emp('3', '19:00', '7:00')];
  it('solo los empleados con transporte, cada uno con su turno, horario, ruta y área', () => {
    const p = pasajerosDeTE(empleados, te);
    expect(p.map(x => x.nomina)).toEqual(['1', '3']);
    expect(p[0]).toMatchObject({ areaId: 'moldes', areaNombre: 'Moldes', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' });
    expect(p[1]).toMatchObject({ turno: '2', horaEntrada: '7:00PM', horaSalida: '7:00AM', alimentos: false });
  });
  it('sin empleados con transporte no hay pasajeros', () => {
    expect(pasajerosDeTE([emp('2', '7:00', '16:00', { transporte: false })], te)).toEqual([]);
  });
  it('la solicitud nace aprobada, de origen tiempo extra, con el solicitante original y creada por RH', () => {
    const pasajeros = pasajerosDeTE(empleados, te);
    const d = datosSolicitudTransporte(te, pasajeros, { uid: 'rh1', nombre: 'MARCO' });
    expect(d).toMatchObject({
      estatus: 'aprobada', origen: 'tiempo_extra', tiempoExtraId: 'te1', folioTE: 'TE-2026-0001', areaId: 'moldes', fechaServicio: '2026-10-20',
      solicitanteNombre: 'OSCAR PEREZ', solicitanteNomina: '50532', creadoPor: 'rh1', totalPasajeros: 2, totalAlimentos: 1,
    });
    expect(d.conteoTurnos).toEqual({ 1: 1, 2: 1 });
  });
  it('el bloque del proveedor muestra al solicitante original y el folio; una solicitud normal, solo su solicitante', () => {
    expect(solicitanteDeTransporte({ origen: 'tiempo_extra', solicitanteNombre: 'OSCAR PEREZ', folioTE: 'TE-2026-0001' })).toBe('OSCAR PEREZ · Tiempo extra TE-2026-0001');
    expect(solicitanteDeTransporte({ solicitanteNombre: 'ANA' })).toBe('ANA');
  });
  it('agrupa por fecha, la más próxima primero, y por folio dentro de la fecha', () => {
    const g = agruparPorFecha([{ folio: 'B', fechaTE: '2026-10-22' }, { folio: 'C', fechaTE: '2026-10-20' }, { folio: 'A', fechaTE: '2026-10-20' }]);
    expect(g.map(x => [x.fecha, x.items.map(i => i.folio)])).toEqual([['2026-10-20', ['A', 'C']], ['2026-10-22', ['B']]]);
  });
  it('textos para el solicitante y para la devolución', () => {
    expect(textoRecibida({ resumen: { totalTransporte: 3 } })).toBe('Confirmada por RH · transporte solicitado');
    expect(textoRecibida({ resumen: { totalTransporte: 0 } })).toBe('Confirmada por RH · sin transporte');
    expect(quienDevolvio(2)).toBe('Autorización 2');
    expect(quienDevolvio(3)).toBe('Recursos Humanos (recepción)');
  });
});

describe('Excel del proveedor', () => {
  // Un tiempo extra con tres empleados en horarios distintos, y una solicitud normal del mismo día
  const empleadosTE = [emp('1', '7:00', '16:00', { alimentos: true }), emp('2', '16:00', '0:00'), emp('3', '19:00', '7:00'), emp('4', '0:00', '7:00')];
  const pasajerosTE = pasajerosDeTE(empleadosTE, te).map(p => ({ ...p, rutaId: p.nomina === '2' ? 'r2' : 'r1' }));
  const solTE = { ...datosSolicitudTransporte(te, pasajerosTE, { uid: 'rh1', nombre: 'MARCO RH' }), id: 's-te', fechaSolicitud: '2026-10-14T10:00:00.000Z', pasajeros: pasajerosTE };
  const solNormal = {
    id: 's-norm', fechaServicio: '2026-10-20', fechaSolicitud: '2026-10-13T09:00:00.000Z', solicitanteNombre: 'ANA LOPEZ', estatus: 'aprobada', areaId: 'calidad',
    pasajeros: [
      { nomina: '77', nombre: 'LUIS', puesto: 'INSPECTOR', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' },
      { nomina: '78', nombre: 'MARIA', puesto: 'INSPECTOR', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: false, rutaId: 'r2', comunidadId: 'c2', puntoReunionId: 'p2' },
    ],
  };
  const armar = (solicitudes) => construirLibroProveedor({ ExcelJS, solicitudes, catalogos });

  it('el encabezado lleva AREA al inicio y el resto del formato aprobado', () => {
    expect(ENCABEZADOS_PROVEEDOR).toEqual(['AREA', 'PUESTO', 'NÓMINA', 'NOMBRE', 'ENTRADA', 'SALIDA', 'ALIMENTOS', 'RUTA', 'COMUNIDAD O COLONIA', 'PUNTO DE REUNION']);
  });

  it('cada pasajero de tiempo extra cae en la hoja del turno de su hora de entrada', () => {
    const wb = armar([solTE]);
    expect(wb.worksheets.map(w => w.name).sort()).toEqual(['Turno 1', 'Turno 2', 'Turno 3']);
    const nominas = (hoja) => { const n = []; wb.getWorksheet(hoja).eachRow(r => { if (/^[0-9]+$/.test(String(r.getCell(3).value))) n.push(String(r.getCell(3).value)); }); return n; };
    expect(nominas('Turno 1')).toEqual(['1']);
    expect(nominas('Turno 2').sort()).toEqual(['2', '3']); // 16:00 y 19:00
    expect(nominas('Turno 3')).toEqual(['4']);
  });

  it('el bloque dice "Solicitante: [original] · Tiempo extra TE-…", no el nombre de RH, y la columna AREA va llena', () => {
    const ws = armar([solTE]).getWorksheet('Turno 1');
    const filas = textoDe(ws);
    expect(filas).toContainEqual(['Solicitante:', 'OSCAR PEREZ · Tiempo extra TE-2026-0001']);
    expect(JSON.stringify(filas)).not.toContain('MARCO RH');
    expect(filas).toContainEqual(['TURNO:', '1']);
    expect(valores(ws.getRow(8))[0]).toBeDefined();
    const encabezado = [...Array(ws.rowCount).keys()].map(i => ws.getRow(i + 1)).find(r => r.getCell(1).value === 'AREA');
    expect(valores(encabezado)).toEqual(ENCABEZADOS_PROVEEDOR);
    const pasajero = ws.getRow(Number(encabezado.number) + 1);
    expect(valores(pasajero)).toEqual(['Moldes', 'OPERADOR', '1', 'EMPLEADO 1', '7:00AM', '4:00PM', 'SI', 'Norte', 'Pueblito', 'Plaza']);
  });

  it('dos tiempos extra del mismo solicitante salen en bloques separados, cada uno con su folio', () => {
    const otra = { ...solTE, id: 's2', folioTE: 'TE-2026-0002', tiempoExtraId: 'te2' };
    const filas = textoDe(armar([solTE, otra]).getWorksheet('Turno 1'));
    expect(filas).toContainEqual(['Solicitante:', 'OSCAR PEREZ · Tiempo extra TE-2026-0001']);
    expect(filas).toContainEqual(['Solicitante:', 'OSCAR PEREZ · Tiempo extra TE-2026-0002']);
  });

  it('una solicitud normal sale igual que antes (más la columna AREA, con el área de la solicitud)', () => {
    const ws = armar([solNormal]).getWorksheet('Turno 1');
    const filas = textoDe(ws);
    expect(filas).toContainEqual(['Solicitante:', 'ANA LOPEZ']);
    expect(filas).toContainEqual(['TURNO:', '1']);
    expect(filas).toContainEqual(['Fecha:', '20/10/2026']);
    expect(filas).toContainEqual(['Pasajeros: 2', 'Con alimentos: 1', 'Sin alimentos: 1']);
    expect(filas).toContainEqual(['TOTAL DEL TURNO']);
    expect(filas).toContainEqual(['Solicitantes: 1', 'Pasajeros: 2', 'Con alimentos: 1', 'Sin alimentos: 1']);
    const luis = [...Array(ws.rowCount).keys()].map(i => valores(ws.getRow(i + 1))).find(v => v[2] === '77');
    expect(luis).toEqual(['Calidad', 'INSPECTOR', '77', 'LUIS', '7:00AM', '4:00PM', 'SI', 'Norte', 'Pueblito', 'Plaza']);
  });

  it('una solicitud normal sin área deja AREA vacía; una de tiempo extra y una normal conviven en la misma hoja', () => {
    const vieja = { ...solNormal, areaId: undefined };
    const ws = armar([vieja, solTE]).getWorksheet('Turno 1');
    const filas = [...Array(ws.rowCount).keys()].map(i => valores(ws.getRow(i + 1)));
    expect(filas.find(v => v[2] === '77')[0]).toBe('');
    expect(filas.find(v => v[2] === '1')[0]).toBe('Moldes');
    expect(textoDe(ws).filter(f => f[0] === 'Solicitante:')).toHaveLength(2);
    expect(textoDe(ws)).toContainEqual(['Solicitantes: 2', 'Pasajeros: 3', 'Con alimentos: 2', 'Sin alimentos: 1']);
  });

  it('sin pasajeros no hay libro; los pasajeros sin turno van a su propia hoja como antes', () => {
    expect(armar([{ ...solNormal, pasajeros: [] }])).toBeNull();
    const hojas = agruparHojas([{ ...solNormal, pasajeros: [{ ...solNormal.pasajeros[0], turno: 'TE' }] }]);
    expect(Object.values(hojas).map(h => h.turnoName)).toEqual(['Tiempo extra']);
  });

  it('varias fechas: la hoja lleva día-mes y el turno', () => {
    const otraFecha = { ...solNormal, id: 's3', fechaServicio: '2026-10-21' };
    expect(armar([solNormal, otraFecha]).worksheets.map(w => w.name).sort()).toEqual(['20-10 Turno 1', '21-10 Turno 1']);
  });
});

describe('Por enviar al proveedor (antes Recepción)', () => {
  it('el botón dice si nadie lleva transporte', () => {
    expect(textoConfirmar({ resumen: { totalTransporte: 2 } })).toBe('Confirmar y generar transporte');
    expect(textoConfirmar({ resumen: { totalTransporte: 0 } })).toBe('Confirmar (sin transporte)');
    expect(textoConfirmar({})).toBe('Confirmar (sin transporte)');
  });
  it('el mensaje de "Listo" dice dónde quedó el transporte', () => {
    expect(NOMBRE_POR_ENVIAR).toBe('Por enviar al proveedor');
    expect(mensajeConfirmada({ fecha: '2026-10-15', pasajeros: 3 }))
      .toBe('Listo. El transporte de jueves 15 de octubre ya aparece en Solicitudes de transporte y se incluirá en el Formato de rutas.');
    expect(mensajeConfirmada({ fecha: '2026-10-15', pasajeros: 0 })).toContain('sin transporte');
  });
});

describe('Excel de tiempo extra para RH', () => {
  const nombresArea = new Map([['moldes', 'Moldes'], ['calidad', 'Calidad']]);
  const firma = (nombre, comoRH = false) => ({ nombre, comoRH, fecha: new Date(2026, 9, 15, 14, 30) });
  const sols = [
    { ...te, id: 'a', folio: 'TE-2026-0001', estatus: 'autorizada', resumen: { totalEmpleados: 2, totalHoras: 17, totalTransporte: 2 }, aut1: firma('ANSELMO'), aut2: firma('ADMIN', true),
      empleados: [emp('1', '7:00', '16:00', { alimentos: true }), emp('2', '7:00', '16:00', { alimentos: true, nombre: 'ZETA' })].map(e => ({ ...e, horaSalida: e.nomina === '2' ? '15:00' : '16:00' })) },
    { ...te, id: 'b', folio: 'TE-2026-0002', estatus: 'procesada', fechaTE: '2026-10-21', resumen: { totalEmpleados: 1, totalHoras: 8, totalTransporte: 0 },
      empleados: [emp('1', '16:00', '0:00', { alimentos: true, transporte: false })] },
    { ...te, id: 'c', folio: 'TE-2026-0003', estatus: 'pendiente_aut2', resumen: { totalEmpleados: 1, totalHoras: 9 }, empleados: [emp('9', '7:00', '16:00')] },
    { ...te, id: 'd', folio: 'TE-2026-0004', areaId: 'calidad', areaNombre: 'Calidad', fechaTE: '2026-11-30', estatus: 'autorizada', resumen: { totalEmpleados: 1, totalHoras: 9 }, empleados: [emp('5', '7:00', '16:00')] },
  ];

  it('solo autorizadas y recibidas, dentro del rango y del área', () => {
    expect(filtrarParaDescarga(sols, {}).map(t => t.folio)).toEqual(['TE-2026-0001', 'TE-2026-0002', 'TE-2026-0004']);
    expect(filtrarParaDescarga(sols, { desde: '2026-10-01', hasta: '2026-10-31' }).map(t => t.folio)).toEqual(['TE-2026-0001', 'TE-2026-0002']);
    expect(filtrarParaDescarga(sols, { areaId: 'calidad' }).map(t => t.folio)).toEqual(['TE-2026-0004']);
  });

  it('las cuatro hojas, con el estilo del proveedor', () => {
    const wb = construirLibroTiempoExtra({ ExcelJS, solicitudes: sols, nombresArea, catalogos, filtros: { desde: '2026-10-01', hasta: '2026-10-31' } });
    expect(wb.worksheets.map(w => w.name)).toEqual(['Detalle', 'Horas por empleado', 'Alimentos', 'Resumen']);
    const d = wb.getWorksheet('Detalle');
    expect(d.getCell('A1').fill.fgColor.argb).toBe('FF1F2328'); // banda de título
    expect(d.getCell('A4').fill.fgColor.argb).toBe('FFC8102E'); // encabezado rojo
    expect(d.getCell('A4').font.color.argb).toBe('FFFFFFFF');
    expect(d.getCell('A5').border.top.style).toBe('thin');
    expect(valores(d.getRow(4))).toEqual(ENCABEZADOS_DETALLE_RH);
    expect(wb.getWorksheet('Horas por empleado').getRow(4).getCell(1).value).toBe(ENCABEZADOS_HORAS[0]);
    expect(valores(wb.getWorksheet('Alimentos').getRow(4))).toEqual(ENCABEZADOS_ALIMENTOS);
    expect(valores(wb.getWorksheet('Resumen').getRow(4))).toEqual(ENCABEZADOS_RESUMEN_RH);
  });

  it('Detalle: una fila por empleado con horas, ruta, solicitante, quién firmó y la fecha de autorización', () => {
    const wb = construirLibroTiempoExtra({ ExcelJS, solicitudes: sols, nombresArea, catalogos, filtros: { areaId: 'moldes' } });
    const d = wb.getWorksheet('Detalle');
    expect(valores(d.getRow(5))).toEqual(['TE-2026-0001', '20/10/2026', 'Moldes', 'Turno extra', '', '1', 'EMPLEADO 1', 'OPERADOR', 'A', '7:00', '16:00', 9, 'Sí', 'Sí', 'llegada y salida', 'Norte · Pueblito · Plaza', 'OSCAR PEREZ', 'ANSELMO', 'ADMIN (RH)', '15/10/2026 14:30']);
    expect(valores(d.getRow(7))).toEqual(['TE-2026-0002', '21/10/2026', 'Moldes', 'Turno extra', '', '1', 'EMPLEADO 1', 'OPERADOR', 'A', '16:00', '0:00', 8, 'Sí', 'No', '', '', 'OSCAR PEREZ', '', '', '']);
    expect(d.rowCount).toBe(7); // título, subtítulo, vacía, encabezado y 3 empleados
  });

  it('Horas por empleado: días con tiempo extra y horas totales en el rango', () => {
    const f = filasHorasPorEmpleado(filtrarParaDescarga(sols, { areaId: 'moldes' }), { nombresArea });
    expect(f).toEqual([['1', 'EMPLEADO 1', 'Moldes', 'OPERADOR', 2, 17], ['2', 'ZETA', 'Moldes', 'OPERADOR', 1, 8]]);
  });

  it('Alimentos: conteo por fecha y horario, con total', () => {
    const r = filasAlimentos(filtrarParaDescarga(sols, {}));
    expect(r.filas).toEqual([['20/10/2026', '7:00 → 15:00', 1], ['20/10/2026', '7:00 → 16:00', 1], ['21/10/2026', '16:00 → 0:00', 1]]);
    expect(r.total).toBe(3);
  });

  it('Resumen: solicitudes, empleados y horas por fecha y área, con total', () => {
    const r = filasResumen(filtrarParaDescarga(sols, {}), { nombresArea });
    expect(r.filas).toEqual([['20/10/2026', 'Moldes', 1, 2, 17], ['21/10/2026', 'Moldes', 1, 1, 8], ['30/11/2026', 'Calidad', 1, 1, 9]]);
    expect(r.total).toEqual(['TOTAL', '', 3, 4, 34]);
  });

  it('solo confirmadas por RH: deja fuera lo que aún no se confirma', () => {
    expect(filtrarParaDescarga(sols, { estatus: ['procesada'] }).map(t => t.folio)).toEqual(['TE-2026-0002']);
    const wb = construirLibroTiempoExtra({ ExcelJS, solicitudes: sols, nombresArea, catalogos, filtros: { estatus: ['procesada'] } });
    expect(wb.getWorksheet('Detalle').getCell('A2').value).toContain('Solo confirmadas por RH');
    const todas = construirLibroTiempoExtra({ ExcelJS, solicitudes: sols, nombresArea, catalogos, filtros: {} });
    expect(todas.getWorksheet('Detalle').getCell('A2').value).toContain('Todas las autorizadas');
  });

  it('nombre del archivo con el rango', () => {
    expect(nombreArchivoTiempoExtra('2026-10-01', '2026-10-31')).toBe('TiempoExtra_2026-10-01_a_2026-10-31.xlsx');
    expect(nombreArchivoTiempoExtra('2026-10-20', '2026-10-20')).toBe('TiempoExtra_2026-10-20.xlsx');
  });
});
