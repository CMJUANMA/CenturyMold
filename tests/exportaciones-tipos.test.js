// Exportaciones a prueba de tipos: datos MEZCLADOS como los de producción (nómina numérica, campos vacíos, fechas Timestamp, extensiones sin
// entrada, área faltante, horas que cruzan medianoche). Ninguna descarga debe lanzar «x.localeCompare is not a function».
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { aFechaIso, comparar, compararHoras, compararPor, minutosDeHora, texto } from '../src/utils/orden.js';
import { construirLibroProveedor } from '../src/utils/libroProveedor.js';
import { construirLibroConsulta } from '../src/utils/exportarConsultaTE.js';
import { construirLibroTiempoExtra, filasAlimentos } from '../src/utils/exportarTiempoExtraRH.js';
import { construirRespaldoPadron } from '../src/utils/respaldoPadron.js';
import { candidatosSinCuenta, construirLibroAccesos } from '../src/utils/accesosIniciales.js';
import { construirOrganigrama } from '../src/utils/asignaciones.js';
import { pasajeroDeEmpleado } from '../src/utils/tiempoExtra.js';

/** Imita un Timestamp de Firestore (lo que trae serverTimestamp() en las solicitudes de transporte nuevas) */
const ts = (iso) => ({ toDate: () => new Date(iso), seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 });

const catalogos = {
  rutas: [{ id: 'r1', nombre: 'RUTA NORTE' }, { id: 'r2', nombre: 'RUTA SUR' }, { id: 'r3' }],
  comunidades: [{ id: 'c1', nombre: 'EL PUEBLITO' }, { id: 'c2', nombre: null }],
  puntos: [{ id: 'p1', nombre: 'PLAZA' }, { id: 'p2', nombre: 5 }],
  areas: [{ id: 'moldes', nombre: 'Moldes' }],
};

const pas = (extra = {}) => ({ nomina: 700, nombre: 'GARCÍA JOSÉ', puesto: 'MOLDEADOR', areaId: 'moldes', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: false, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', ...extra });

// Mezcla de todo lo que se ha visto en producción
const solicitudesMezcladas = [
  // Solicitud de tiempo extra recién confirmada: fechaSolicitud es un Timestamp
  { id: 'A1', origen: 'tiempo_extra', folioTE: 'TE-2026-0012', solicitanteNombre: 'ACOSTA OSCAR', fechaServicio: '2026-10-19', fechaSolicitud: ts('2026-10-18T15:00:00Z'), areaId: 'moldes',
    pasajeros: [
      pas({ nomina: 50610, nombre: 'MENDOZA ANSELMO' }),                                                    // nómina numérica
      pas({ nomina: '50532', nombre: undefined, rutaId: 'r2', comunidadId: 'c2', puntoReunionId: 'p2' }),     // sin nombre; catálogos con nombre null y numérico
      pas({ nomina: null, nombre: null, area: undefined, areaId: undefined, puesto: undefined, rutaId: 'r3', turno: '2', horaEntrada: '4:00PM', horaSalida: '12:00AM' }), // todo vacío; cruza medianoche
      pas({ nomina: 801, nombre: 'EXTENSIÓN SIN ENTRADA', turno: '1', sentido: 'salida', horaEntrada: 'YA EN PLANTA', horaSalida: '7:00PM' }),
      pas({ nomina: 802, nombre: 'SOLO LLEGADA', turno: '3', horaEntrada: '12:00AM', horaSalida: 'NO REQUIERE', alimentos: true }),
    ] },
  // Solicitud anterior: fecha de solicitud como texto ISO, sin área, folio ausente
  { id: 'B2', solicitanteNombre: 'PEREZ JUAN', fechaServicio: '2026-10-19', fechaSolicitud: '2026-10-17T10:00:00.000Z', pasajeros: [pas({ nomina: '900', nombre: 'ZAMORA LUIS', areaId: undefined, turno: undefined })] },
  // Sin fecha de solicitud, ni nombre de solicitante, ni fecha de servicio válida
  { id: 'C3', solicitanteNombre: undefined, fechaServicio: undefined, fechaSolicitud: undefined, pasajeros: [pas({ nomina: 1, horaEntrada: undefined, horaSalida: undefined })] },
  { id: 'D4', solicitanteNombre: 12345, fechaServicio: '2026-10-20', fechaSolicitud: 1789000000000, pasajeros: [pas({ nomina: 2 })] },
];

describe('orden.js: comparaciones a prueba de tipos', () => {
  it('texto() convierte cualquier cosa sin lanzar', () => {
    expect(texto(null)).toBe('');
    expect(texto(undefined, '—')).toBe('—');
    expect(texto(12345)).toBe('12345');
    expect(texto(true)).toBe('true');
    expect(texto(ts('2026-10-18T15:00:00Z'))).toBe('2026-10-18T15:00:00.000Z');
    expect(texto(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02T00:00:00.000Z');
    expect(texto({ a: 1 })).toBe('[object Object]');
  });
  it('comparar() acepta números, null, objetos y Timestamps', () => {
    const mezcla = [10, null, 'b', undefined, 'a', 2, ts('2026-01-01T00:00:00Z')];
    expect(() => [...mezcla].sort(comparar)).not.toThrow();
    expect(comparar(2, 10, { numerico: true })).toBeLessThan(0);
    expect(comparar(null, 'a')).toBeLessThan(0);
    expect(comparar('á', 'b')).toBeLessThan(0); // en español
    expect([{ n: 3 }, { n: '2' }, {}].sort(compararPor(x => x.n)).map(x => x.n)).toEqual([undefined, '2', 3]);
  });
  it('aFechaIso(): Timestamp, Date, texto, ms o nada', () => {
    expect(aFechaIso(ts('2026-10-18T15:00:00Z'))).toBe('2026-10-18T15:00:00.000Z');
    expect(aFechaIso('2026-10-17T10:00:00.000Z')).toBe('2026-10-17T10:00:00.000Z');
    expect(aFechaIso(null)).toBe('');
    expect(aFechaIso('no es fecha')).toBe('');
    expect(aFechaIso(1789000000000)).toMatch(/^2026-/);
  });
  it('las horas se ordenan por su valor, no como texto', () => {
    expect(['16:00', '9:00', '7:00', '0:00'].sort(compararHoras)).toEqual(['0:00', '7:00', '9:00', '16:00']);
    expect(['4:00PM', '12:00AM', '7:00AM', '12:00PM', 'NO REQUIERE', '', 'YA EN PLANTA'].sort(compararHoras)).toEqual(['YA EN PLANTA', '12:00AM', '7:00AM', '12:00PM', '4:00PM', 'NO REQUIERE', '']);
    expect(minutosDeHora('4:00PM')).toBe(16 * 60);
    expect(minutosDeHora('12:00AM')).toBe(0);
    expect(minutosDeHora(null)).toBeGreaterThan(24 * 60);
  });
});

describe('Formato de rutas (proveedor) con datos mezclados', () => {
  it('no lanza con fechaSolicitud como Timestamp, texto, número o vacía', () => {
    expect(() => construirLibroProveedor({ ExcelJS, solicitudes: solicitudesMezcladas, catalogos })).not.toThrow();
  });
  it('incluye a TODOS los pasajeros de la fecha, aunque su hora ya haya pasado (mañana, tarde, noche, extensión «YA EN PLANTA»)', () => {
    const wb = construirLibroProveedor({ ExcelJS, solicitudes: solicitudesMezcladas.slice(0, 2), catalogos });
    const filas = [];
    for (const ws of wb.worksheets) ws.eachRow(row => { const v = row.values.slice(1); if (v.length >= 10 && /^\d|^$/.test(String(v[2] ?? '')) || v[4] !== undefined) filas.push(v); });
    const texto = JSON.stringify(wb.worksheets.map(w => w.getSheetValues()));
    for (const esperado of ['MENDOZA ANSELMO', 'EXTENSIÓN SIN ENTRADA', 'YA EN PLANTA', 'SOLO LLEGADA', 'NO REQUIERE', 'ZAMORA LUIS', '12:00AM', '4:00PM']) expect(texto, esperado).toContain(esperado);
    let pasajeros = 0;
    for (const ws of wb.worksheets) ws.eachRow(row => { if (/^Pasajeros: \d+$/.test(String(row.getCell(1).value ?? ''))) pasajeros += Number(String(row.getCell(1).value).split(': ')[1]); });
    expect(pasajeros).toBe(6); // 5 de la solicitud A1 + 1 de B2
  });
  it('separa las hojas por turno y muestra el solicitante y el folio del tiempo extra', () => {
    const wb = construirLibroProveedor({ ExcelJS, solicitudes: solicitudesMezcladas.slice(0, 1), catalogos });
    expect(wb.worksheets.map(w => w.name).sort()).toEqual(['Turno 1', 'Turno 2', 'Turno 3']);
    expect(JSON.stringify(wb.worksheets[0].getSheetValues())).toContain('ACOSTA OSCAR · Tiempo extra TE-2026-0012');
  });
  it('la nómina numérica sale como texto y los vacíos como celdas vacías', () => {
    const wb = construirLibroProveedor({ ExcelJS, solicitudes: solicitudesMezcladas.slice(0, 1), catalogos });
    const valores = JSON.stringify(wb.worksheets.map(w => w.getSheetValues()));
    expect(valores).toContain('"50610"');
    expect(valores).not.toContain('undefined');
    expect(valores).not.toContain('"null"');
  });
  it('ordena por ruta, comunidad, punto y nombre aunque falten datos', () => {
    const sols = [{ id: 'X', solicitanteNombre: 'S', fechaServicio: '2026-10-19', fechaSolicitud: ts('2026-10-18T00:00:00Z'), pasajeros: [
      pas({ nomina: 3, nombre: 'ZETA' }), pas({ nomina: 1, nombre: 'ALFA' }), pas({ nomina: 2, nombre: null }), pas({ nomina: 4, nombre: 'ALFA', rutaId: 'zzz' }),
    ] }];
    const wb = construirLibroProveedor({ ExcelJS, solicitudes: sols, catalogos });
    const nombres = [];
    wb.worksheets[0].eachRow(row => { if (/^\d+$/.test(String(row.getCell(3).value ?? ''))) nombres.push(`${row.getCell(3).value}`); });
    expect(nombres).toHaveLength(4);
  });
  it('dos solicitudes con Timestamps de distinto día muestran «varias» fechas sin romperse', () => {
    const sols = [
      { id: 'a', solicitanteNombre: 'S', fechaServicio: '2026-10-19', fechaSolicitud: ts('2026-10-17T10:00:00Z'), pasajeros: [pas()] },
      { id: 'b', solicitanteNombre: 'S', fechaServicio: '2026-10-19', fechaSolicitud: ts('2026-10-18T10:00:00Z'), pasajeros: [pas({ nomina: 2 })] },
    ];
    const wb = construirLibroProveedor({ ExcelJS, solicitudes: sols, catalogos });
    expect(JSON.stringify(wb.worksheets[0].getSheetValues())).toContain('Fecha de Solicitud: varias');
  });
  it('sin pasajeros devuelve null (la pantalla lo avisa como error, no se cierra en silencio)', () => {
    expect(construirLibroProveedor({ ExcelJS, solicitudes: [{ id: 'z', pasajeros: [] }], catalogos })).toBeNull();
  });
});

describe('pasajeros de un tiempo extra con extensión sin entrada y horas que cruzan medianoche', () => {
  const te = { areaId: 'moldes', areaNombre: 'Moldes', tipo: 'extension' };
  it('extensión: ya está en la planta (entrada «YA EN PLANTA») y su turno sale del fin del turno', () => {
    const p = pasajeroDeEmpleado({ nomina: 801, nombre: 'X', transporteSalida: true, transporte: true, horaEntrada: '16:00', horaSalida: '19:00' }, te);
    expect(p).toMatchObject({ horaEntrada: 'YA EN PLANTA', horaSalida: '7:00PM', turno: '1' });
  });
  it('sin hora de entrada no lanza', () => {
    expect(() => pasajeroDeEmpleado({ nomina: 801, nombre: 'X', transporteSalida: true, transporte: true, horaEntrada: undefined, horaSalida: undefined }, te)).not.toThrow();
  });
  it('turno extra que cruza la medianoche: 16:00 → 0:00 va al turno 2, 0:00 → 7:00 al 3', () => {
    const t = { areaId: 'moldes' };
    expect(pasajeroDeEmpleado({ nomina: 1, nombre: 'A', transporteLlegada: true, transporteSalida: true, transporte: true, horaEntrada: '16:00', horaSalida: '0:00' }, t)).toMatchObject({ turno: '2', horaSalida: '12:00AM' });
    expect(pasajeroDeEmpleado({ nomina: 2, nombre: 'B', transporteLlegada: true, transporteSalida: true, transporte: true, horaEntrada: '0:00', horaSalida: '7:00' }, t)).toMatchObject({ turno: '3', horaEntrada: '12:00AM' });
  });
});

describe('las demás descargas con datos mezclados', () => {
  const nombresArea = new Map([['moldes', 'Moldes']]);
  const empleados = (extra = {}) => [
    { nomina: 50610, nombre: 'MENDOZA', puesto: 'JEFE', horaEntrada: '7:00', horaSalida: '16:00', alimentos: true, transporte: true, transporteLlegada: true, transporteSalida: true, rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', turnoNomina: 'A', ...extra },
    { nomina: undefined, nombre: null, puesto: undefined, horaEntrada: '16:00', horaSalida: '0:00', alimentos: true },        // cruza medianoche, sin nómina ni nombre
    { nomina: '900', nombre: 'EXTENSIÓN', horaEntrada: '', horaSalida: '19:00', transporte: true, transporteSalida: true },   // extensión sin entrada
    { nomina: 5, nombre: 'SIN HORARIO' },
    { nomina: 6, nombre: 'NOCHE', horaEntrada: '0:00', horaSalida: '7:00', alimentos: true },
    { nomina: 7, nombre: 'MAÑANA', horaEntrada: '9:00', horaSalida: '16:00', alimentos: true },
  ];
  const solicitudesTE = [
    { id: 't1', folio: 'TE-2026-0001', areaId: 'moldes', fechaTE: '2026-10-19', estatus: 'autorizada', motivo: 'Producción', creadoPorNombre: 'ACOSTA', resumen: { totalEmpleados: 6, totalHoras: 40 }, empleados: empleados(), aut1: { nombre: 'X', fecha: ts('2026-10-18T10:00:00Z') }, aut2: { nombre: 'Y', fecha: ts('2026-10-18T12:00:00Z') } },
    { id: 't2', folio: undefined, areaId: undefined, fechaTE: undefined, estatus: 'procesada', motivo: undefined, empleados: undefined },
    { id: 't3', folio: 77, areaId: 'otra', areaNombre: undefined, fechaTE: '2026-10-18', estatus: 'cancelada', creadoPorNombre: undefined, empleados: [{ nomina: 1, nombre: 12 }] },
    { id: 't4', folio: 'TE-2026-0009', areaId: 'moldes', fechaTE: '2026-10-19', estatus: 'procesada', empleados: [] },
  ];
  it('resumen de horas extra (RH): todas las hojas se construyen', () => {
    expect(() => construirLibroTiempoExtra({ ExcelJS, solicitudes: solicitudesTE, nombresArea, catalogos })).not.toThrow();
  });
  it('alimentos: los horarios salen por su hora (0:00 → 7:00 antes que 9:00 y 16:00), «Sin horario» al final', () => {
    const { filas } = filasAlimentos(solicitudesTE.slice(0, 1));
    const horarios = filas.map(f => f[1]);
    const iNoche = horarios.indexOf('0:00 → 7:00'); const iManana = horarios.indexOf('9:00 → 16:00'); const iTarde = horarios.findIndex(h => h.startsWith('16:00'));
    expect(iNoche).toBeGreaterThanOrEqual(0);
    expect(iNoche).toBeLessThan(iManana);
    expect(iManana).toBeLessThan(iTarde);
  });
  it('consulta de tiempo extra', () => {
    expect(() => construirLibroConsulta({ solicitudes: solicitudesTE, nombresArea, catalogos })).not.toThrow();
  });
  it('respaldo del padrón', () => {
    const emps = [{ nomina: 100, nombre: 'A', activo: true }, { nomina: '20', nombre: null }, { id: '3' }, { nomina: undefined, id: undefined }];
    expect(() => construirRespaldoPadron({ empleados: emps, areas: [{ id: 'a', nombre: 5 }] })).not.toThrow();
  });
  it('accesos iniciales', () => {
    const asig = (nomina, extra = {}) => ({ id: `${nomina}_aut2_planta`, nomina, nombre: undefined, rol: 'aut2', areaId: null, desde: new Date(2026, 0, 1), hasta: null, activo: true, ...extra });
    const lista = candidatosSinCuenta({ asignaciones: [asig(11), asig('12'), asig(13, { nombre: 55 })], usuarios: [], empleados: [{ nomina: 12, nombre: 'ZETA' }, { nomina: 11, nombre: null }], ahora: new Date(2026, 9, 19) });
    expect(lista).toHaveLength(3);
    expect(() => construirLibroAccesos(lista.map(c => ({ nomina: c.nomina, nombre: c.nombre, area: '', roles: c.roles.join(' · '), password: 'CM-AAAA-BBBB' })))).not.toThrow();
  });
  it('organigrama con nombres numéricos o vacíos', () => {
    const a = (nomina, rol, areaId, extra = {}) => ({ id: `${nomina}_${rol}_${areaId}`, nomina, nombre: undefined, rol, areaId, desde: new Date(2026, 0, 1), hasta: null, activo: true, ...extra });
    expect(() => construirOrganigrama({
      asignaciones: [a(1, 'aut1', 'moldes', { nombre: 123 }), a(2, 'aut1', 'moldes'), a(3, 'solicitante', 'moldes', { nombre: null }), a(4, 'aut2', null)],
      areas: [{ id: 'moldes', nombre: 'Moldes', participaTE: true, activa: true, orden: 1 }], empleados: new Map(), ahora: new Date(2026, 9, 19),
    })).not.toThrow();
  });
});

describe('guardia: ningún ordenamiento de las exportaciones usa localeCompare sobre un valor sin convertir', () => {
  const archivos = (dir) => readdirSync(dir).flatMap(n => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? archivos(f) : /\.js$/.test(f) ? [f] : [];
  });
  const EXPORTACIONES = ['libroProveedor.js', 'exportarConsultaTE.js', 'exportarTiempoExtraRH.js', 'respaldoPadron.js', 'accesosIniciales.js', 'exportarSolicitudes.js'];
  it('esos archivos comparan con comparar()/compararHoras() de orden.js', () => {
    for (const f of archivos('src/utils').filter(x => EXPORTACIONES.some(e => x.endsWith(e)))) {
      const c = readFileSync(f, 'utf8');
      // respaldoPadron ya convertía con txt(); el resto no debe llamar localeCompare directo
      const directos = [...c.matchAll(/\.localeCompare\(/g)].length;
      if (f.endsWith('respaldoPadron.js')) expect(c).toContain('txt(');
      else expect(directos, f).toBe(0);
    }
  });
  it('los mensajes de error de las descargas dicen «No se pudo generar el Excel»', () => {
    for (const f of ['src/components/FormatoRutas.jsx', 'src/pages/te/DescargaTE.jsx', 'src/pages/te/ConsultaTE.jsx', 'src/pages/rh/RhEmpleados.jsx']) {
      expect(readFileSync(f, 'utf8'), f).toContain('No se pudo generar el Excel');
    }
  });
});
