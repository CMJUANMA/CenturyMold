// Tiempo extra que cruza la medianoche: horas, texto de término, validación (sin tope de duración), transporte (cada viaje en su día) y nómina (por inicio o dividido).
// Casos: a) martes 12:00 a. m.–7:00 a. m. · b) martes 10:00 p. m.–7:00 a. m. · c) martes 4:00 p. m.–12:00 a. m. · d) domingo 11:00 p. m.–7:00 a. m. · e) extensión que termina de madrugada.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  calcularHoras, conteoFechas, datosSolicitudTransporte, fechaDeFin, fechaSalidaTransporte, fechasDePasajero, mensajeConfirmada, pasajeroDeEmpleado,
  pasajerosDeTE, problemasDeEnvio, resumenTE, salidasPosteriores, terminaDiaSiguiente, textoTermina, tramosPorDia,
} from '../src/utils/tiempoExtra.js';
import { agruparHojas, construirLibroProveedor } from '../src/utils/libroProveedor.js';
import { aplicarCambios, autorizadasDelPeriodo, filasAutorizadas, semanaDe, totalesDeFilas } from '../src/utils/formatoNomina.js';
import { duracionMaximaHoras, horasNominaPor } from '../src/funciones.js';
import { MOTIVOS_INICIALES, motivoVacio } from '../src/utils/motivosTE.js';

const MARTES = '2026-10-20';
const DOMINGO = '2026-10-25';
const emp = (entrada, salida, extra = {}) => ({
  nomina: '1', nombre: 'ANA', puesto: 'OP', horaEntrada: entrada, horaSalida: salida, alimentos: false, transporte: true, transporteLlegada: true, transporteSalida: true,
  rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', ...extra,
});
const CASOS = {
  a: { fecha: MARTES, e: emp('0:00', '7:00') },
  b: { fecha: MARTES, e: emp('22:00', '7:00') },
  c: { fecha: MARTES, e: emp('16:00', '0:00') },
  d: { fecha: DOMINGO, e: emp('23:00', '7:00') },
  e: { fecha: MARTES, e: emp('19:00', '7:00', { transporteLlegada: false }), tipo: 'extension' },
};
const teDe = (c) => ({ fechaTE: c.fecha, areaId: 'moldes', areaNombre: 'Moldes', tipo: c.tipo ?? 'turno_extra', folio: 'TE-2026-0001', id: 'te1', creadoPorNombre: 'OSCAR' });
const horasPorDia = (c, modo, semana) => filasAutorizadas([{ ...teDe(c), empleados: [c.e], motivo: 'X' }], semana ?? semanaDe(c.fecha), modo)[0]?.horas ?? {};

describe('horas: siempre positivas y correctas', () => {
  it.each([['a', 7], ['b', 9], ['c', 8], ['d', 8], ['e', 12]])('caso %s: %s h', (id, h) => {
    expect(calcularHoras(CASOS[id].e.horaEntrada, CASOS[id].e.horaSalida)).toBe(h);
  });
  it('fin menor o igual al inicio = al día siguiente; igual son 24 h', () => {
    expect(terminaDiaSiguiente('22:00', '7:00')).toBe(true);
    expect(terminaDiaSiguiente('16:00', '0:00')).toBe(true);
    expect(terminaDiaSiguiente('0:00', '7:00')).toBe(false);
    expect(terminaDiaSiguiente('7:00', '7:00')).toBe(true);
    expect(calcularHoras('7:00', '7:00')).toBe(24);
    expect(calcularHoras('0:00', '0:00')).toBe(24);
  });
  it('nunca da horas negativas ni cero con dos horas válidas', () => {
    const horas = ['0:00', '1:30', '7:00', '12:00', '16:00', '19:00', '22:00', '23:59'];
    for (const a of horas) for (const b of horas) { const h = calcularHoras(a, b); expect(h, `${a}→${b}`).toBeGreaterThan(0); expect(h).toBeLessThanOrEqual(24); }
  });
  it('el resumen de la solicitud suma las horas reales', () => {
    expect(resumenTE([CASOS.b.e, CASOS.d.e, CASOS.c.e]).totalHoras).toBe(25);
  });
});

describe('cómo se muestra dónde termina', () => {
  it('b: «Termina: miércoles 21 oct, 7:00 a. m. (día siguiente)»', () => {
    expect(textoTermina(MARTES, '22:00', '7:00')).toBe('Termina: miércoles 21 oct, 7:00 a. m. (día siguiente)');
  });
  it('d: el domingo termina el lunes de la semana siguiente', () => {
    expect(textoTermina(DOMINGO, '23:00', '7:00')).toBe('Termina: lunes 26 oct, 7:00 a. m. (día siguiente)');
    expect(fechaDeFin(DOMINGO, '23:00', '7:00')).toBe('2026-10-26');
  });
  it('c: termina justo a medianoche = las 12:00 a. m. del día siguiente', () => {
    expect(textoTermina(MARTES, '16:00', '0:00')).toBe('Termina: miércoles 21 oct, 12:00 a. m. (día siguiente)');
  });
  it('a: empieza de madrugada y termina el mismo día; sin cruce, `soloSiCruza` no dice nada', () => {
    expect(textoTermina(MARTES, '0:00', '7:00')).toBe('Termina: martes 20 oct, 7:00 a. m.');
    expect(textoTermina(MARTES, '0:00', '7:00', { soloSiCruza: true })).toBe('');
    expect(textoTermina(MARTES, '0:00', '7:00', { prefijo: false })).toBe('martes 20 oct, 7:00 a. m.');
  });
  it('sin fecha o sin horas, nada', () => {
    expect(textoTermina('', '22:00', '7:00')).toBe('');
    expect(textoTermina(MARTES, '', '7:00')).toBe('');
  });
});

describe('validación: sin tope de duración, salvo la misma hora', () => {
  const base = { areaId: 'moldes', fechaTE: MARTES, motivos: [motivoVacio('inventario-fisico')], catalogoMotivos: MOTIVOS_INICIALES, comentario: 'Pedido urgente del cliente', hoy: '2026-10-01' };
  const errores = (c, extra = {}) => problemasDeEnvio({ ...base, empleados: [c.e], tipo: c.tipo, ...extra }).filter(x => x.nivel === 'error').map(x => x.mensaje);
  it('no hay máximo: duracionMaximaHoras es null', () => {
    expect(duracionMaximaHoras).toBeNull();
  });
  it('los cinco casos son válidos', () => {
    for (const id of Object.keys(CASOS)) expect(errores(CASOS[id], { fechaTE: CASOS[id].fecha }), id).toEqual([]);
  });
  it('lo largo ya no se rechaza (0:00→19:00 son 19 h; 19:00→16:00, 21 h)', () => {
    expect(errores({ e: emp('0:00', '19:00') })).toEqual([]);
    expect(errores({ e: emp('16:00', '7:00') })).toEqual([]);
    expect(errores({ e: emp('19:00', '16:00') })).toEqual([]);
  });
  it('entrada igual a salida no se permite', () => {
    expect(errores({ e: emp('7:00', '7:00') })).toEqual(['ANA: La entrada y la salida no pueden ser la misma hora.']);
    expect(errores({ e: emp('0:00', '0:00') })).toEqual(['ANA: La entrada y la salida no pueden ser la misma hora.']);
  });
  it('la extensión que empieza a las 7:00 vuelve a ofrecer 12:00 a. m. como salida', () => {
    expect(salidasPosteriores('7:00')).toEqual(['16:00', '19:00', '0:00']);
    expect(salidasPosteriores('19:00')).toEqual(['0:00', '7:00']);
    expect(errores({ e: emp('7:00', '0:00', { transporteLlegada: false }), tipo: 'extension' })).toEqual([]);
  });
  it('si más adelante se pone un máximo en funciones.js, se aplica (se prueba pasándolo)', () => {
    expect(errores({ e: emp('0:00', '19:00') }, { duracionMaxima: 16 })).toEqual(['ANA: el tiempo extra duraría 19 h; el máximo es 16 h.']);
    expect(errores({ e: emp('16:00', '7:00') }, { duracionMaxima: 16 })).toEqual([]);
    expect(salidasPosteriores('7:00', 16)).toEqual(['16:00', '19:00']);
  });
});

describe('transporte: cada viaje en su día', () => {
  const pas = (id) => pasajeroDeEmpleado(CASOS[id].e, teDe(CASOS[id]));
  it('la llegada usa el día de inicio y la salida, el día real en que termina', () => {
    expect(pas('a')).toMatchObject({ fechaLlegada: MARTES, fechaSalida: MARTES, turno: '3' });
    expect(pas('b')).toMatchObject({ fechaLlegada: MARTES, fechaSalida: '2026-10-21', turno: '2', turnoSalida: '3', horaEntrada: '10:00PM', horaSalida: '7:00AM' });
    expect(pas('d')).toMatchObject({ fechaLlegada: DOMINGO, fechaSalida: '2026-10-26' });
    expect(pas('e')).toMatchObject({ sentido: 'salida', horaEntrada: 'YA EN PLANTA', fechaSalida: '2026-10-21' });
  });
  it('c: la salida a las 12:00 a. m. sigue en el servicio del día que empezó (el turno 2 de siempre)', () => {
    expect(pas('c').fechaSalida).toBe(MARTES);
    expect(fechaSalidaTransporte(MARTES, '16:00', '0:00')).toBe(MARTES);
    expect(fechasDePasajero(pas('c'), MARTES)).toEqual([{ fecha: MARTES, viaje: 'ambos', turno: '2' }]);
  });
  it('a: un solo día; b y d: la llegada un día y la salida al siguiente; e: solo la salida, al día siguiente', () => {
    expect(fechasDePasajero(pas('a'), MARTES)).toEqual([{ fecha: MARTES, viaje: 'ambos', turno: '3' }]);
    expect(fechasDePasajero(pas('b'), MARTES)).toEqual([{ fecha: MARTES, viaje: 'llegada', turno: '2' }, { fecha: '2026-10-21', viaje: 'salida', turno: '3' }]);
    expect(fechasDePasajero(pas('d'), DOMINGO)).toEqual([{ fecha: DOMINGO, viaje: 'llegada', turno: '2' }, { fecha: '2026-10-26', viaje: 'salida', turno: '3' }]);
    expect(fechasDePasajero(pas('e'), MARTES)).toEqual([{ fecha: '2026-10-21', viaje: 'salida', turno: '3' }]);
  });
  it('solo llegada que cruza: todo el viaje es el día de inicio; un pasajero anterior (sin fechas) no cambia', () => {
    const soloLlegada = pasajeroDeEmpleado(emp('22:00', '7:00', { transporteSalida: false }), teDe(CASOS.b));
    expect(fechasDePasajero(soloLlegada, MARTES)).toEqual([{ fecha: MARTES, viaje: 'llegada', turno: '2' }]);
    const viejo = { nomina: '9', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM' };
    expect(fechasDePasajero(viejo, MARTES)).toEqual([{ fecha: MARTES, viaje: 'ambos', turno: '1' }]);
  });
  it('la solicitud de transporte guarda cuántos viajes hay cada día', () => {
    const ps = pasajerosDeTE([CASOS.b.e, { ...CASOS.a.e, nomina: '2' }, { ...CASOS.c.e, nomina: '3' }], teDe(CASOS.b));
    expect(conteoFechas(ps, MARTES)).toEqual({ [MARTES]: 3, '2026-10-21': 1 });
    expect(datosSolicitudTransporte(teDe(CASOS.b), ps, { uid: 'rh', nombre: 'RH' })).toMatchObject({ fechaServicio: MARTES, totalPasajeros: 3, conteoFechas: { [MARTES]: 3, '2026-10-21': 1 } });
  });
  it('el aviso al confirmar dice que las salidas de otro día van en su formato', () => {
    expect(mensajeConfirmada({ fecha: MARTES, pasajeros: 2, fechas: [MARTES] })).not.toMatch(/salidas del/);
    expect(mensajeConfirmada({ fecha: MARTES, pasajeros: 2, fechas: [MARTES, '2026-10-21'] })).toMatch(/Las salidas del miércoles 21 de octubre van en el formato de ese día/);
  });

  describe('Formato de rutas del proveedor', () => {
    const solicitud = (id) => {
      const te = teDe(CASOS[id]);
      const pasajeros = pasajerosDeTE([CASOS[id].e], te);
      return { ...datosSolicitudTransporte(te, pasajeros, { uid: 'rh', nombre: 'RH' }), id: `s-${id}`, fechaSolicitud: '2026-10-14T10:00:00.000Z', pasajeros };
    };
    const catalogos = { rutas: [{ id: 'r1', nombre: 'Norte' }], comunidades: [{ id: 'c1', nombre: 'Pueblito' }], puntos: [{ id: 'p1', nombre: 'Plaza' }], areas: [{ id: 'moldes', nombre: 'Moldes' }] };
    const filas = (wb, hoja) => { const f = []; wb.getWorksheet(hoja).eachRow(r => { if (r.getCell(3).value === '1') f.push([String(r.getCell(5).value), String(r.getCell(6).value)]); }); return f; };

    it('b: la llegada de las 10:00 p. m. sale el martes y la salida de las 7:00 a. m., en el formato del miércoles', () => {
      const wb = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('b')], catalogos });
      expect(wb.worksheets.map(w => w.name).sort()).toEqual(['20-10 Turno 2', '21-10 Turno 3']);
      expect(filas(wb, '20-10 Turno 2')).toEqual([['22:00', 'NO REQUIERE']]);
      expect(filas(wb, '21-10 Turno 3')).toEqual([['YA EN PLANTA', '07:00']]);
    });
    it('a y c: una sola hoja, la del día de inicio', () => {
      expect(construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('a')], catalogos }).worksheets.map(w => w.name)).toEqual(['Turno 3']);
      const c = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('c')], catalogos });
      expect(c.worksheets.map(w => w.name)).toEqual(['Turno 2']);
      expect(filas(c, 'Turno 2')).toEqual([['16:00', '00:00']]);
    });
    it('d: la salida del lunes de la semana siguiente va en el formato del lunes; e: la extensión solo sale al día siguiente', () => {
      const d = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('d')], catalogos });
      expect(d.worksheets.map(w => w.name).sort()).toEqual(['25-10 Turno 2', '26-10 Turno 3']);
      const e = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('e')], catalogos });
      expect(e.worksheets.map(w => w.name)).toEqual(['Turno 3']);
      expect(filas(e, 'Turno 3')).toEqual([['YA EN PLANTA', '07:00']]);
    });
    it('Hoy / una fecha: con `rango` solo salen las hojas de ese día (el miércoles trae solo la salida)', () => {
      const miercoles = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('b')], catalogos, rango: { desde: '2026-10-21', hasta: '2026-10-21' } });
      expect(miercoles.worksheets.map(w => w.name)).toEqual(['Turno 3']);
      expect(filas(miercoles, 'Turno 3')).toEqual([['YA EN PLANTA', '07:00']]);
      const martes = construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('b')], catalogos, rango: { desde: MARTES, hasta: MARTES } });
      expect(filas(martes, 'Turno 2')).toEqual([['22:00', 'NO REQUIERE']]);
      expect(construirLibroProveedor({ ExcelJS, solicitudes: [solicitud('b')], catalogos, rango: { desde: '2026-10-22', hasta: '2026-10-22' } })).toBeNull();
    });
    it('cada viaje cuenta como pasajero de su hoja (b son dos viajes)', () => {
      const hojas = agruparHojas([solicitud('b')]);
      expect(Object.values(hojas).map(h => [h.fechaServicio, h.turnoName, h.pasajeros.length])).toEqual([[MARTES, 'Turno 2', 1], ['2026-10-21', 'Turno 3', 1]]);
    });
  });
});

describe('nómina: horas por día y semana', () => {
  const sem = (fecha) => semanaDe(fecha);
  it('por defecto cuentan en el día en que EMPIEZA (la constante horasNominaPor)', () => {
    expect(horasNominaPor).toBe('inicio');
    expect(horasPorDia(CASOS.a)).toEqual({ [MARTES]: 7 });
    expect(horasPorDia(CASOS.b)).toEqual({ [MARTES]: 9 });
    expect(horasPorDia(CASOS.c)).toEqual({ [MARTES]: 8 });
    expect(horasPorDia(CASOS.e)).toEqual({ [MARTES]: 12 });
  });
  it('d: completo al domingo de su semana, y la semana siguiente no trae nada', () => {
    expect(horasPorDia(CASOS.d, 'inicio')).toEqual({ [DOMINGO]: 8 });
    expect(horasPorDia(CASOS.d, 'inicio', sem('2026-10-26'))).toEqual({});
    const planta = [{ ...teDe(CASOS.d), estatus: 'autorizada' }];
    expect(autorizadasDelPeriodo(planta, sem(DOMINGO), 'inicio')).toHaveLength(1);
    expect(autorizadasDelPeriodo(planta, sem('2026-10-26'), 'inicio')).toHaveLength(0);
  });
  it('«dividir» reparte por día calendario', () => {
    expect(horasPorDia(CASOS.a, 'dividir')).toEqual({ [MARTES]: 7 });
    expect(horasPorDia(CASOS.b, 'dividir')).toEqual({ [MARTES]: 2, '2026-10-21': 7 });
    expect(horasPorDia(CASOS.c, 'dividir')).toEqual({ [MARTES]: 8 }); // termina justo a medianoche: nada en el día siguiente
    expect(horasPorDia(CASOS.e, 'dividir')).toEqual({ [MARTES]: 5, '2026-10-21': 7 });
  });
  it('«dividir», caso d: 1 h el domingo en su semana y 7 h el lunes en la siguiente', () => {
    expect(horasPorDia(CASOS.d, 'dividir')).toEqual({ [DOMINGO]: 1 });
    expect(horasPorDia(CASOS.d, 'dividir', sem('2026-10-26'))).toEqual({ '2026-10-26': 7 });
    const planta = [{ ...teDe(CASOS.d), estatus: 'procesada' }, { ...teDe(CASOS.a), estatus: 'autorizada' }];
    expect(autorizadasDelPeriodo(planta, sem('2026-10-26'), 'dividir').map(t => t.fechaTE)).toEqual([DOMINGO]);
    expect(autorizadasDelPeriodo(planta, sem(DOMINGO), 'dividir')).toHaveLength(2);
  });
  it('los totales del formato suman lo mismo en cualquiera de los dos modos (entre las dos semanas)', () => {
    const total = (modo) => [sem(DOMINGO), sem('2026-10-26')].reduce((n, s) => n + totalesDeFilas(aplicarCambios(filasAutorizadas([{ ...teDe(CASOS.d), empleados: [CASOS.d.e] }], s, modo), [], s), s).horas, 0);
    expect(total('inicio')).toBe(8);
    expect(total('dividir')).toBe(8);
  });
  it('un rango libre también reparte: el lunes queda fuera si el rango termina el domingo', () => {
    expect(tramosPorDia(DOMINGO, '23:00', '7:00')).toEqual([{ fecha: DOMINGO, horas: 1 }, { fecha: '2026-10-26', horas: 7 }]);
    expect(tramosPorDia(MARTES, '16:00', '0:00')).toEqual([{ fecha: MARTES, horas: 8 }]);
    expect(tramosPorDia(MARTES, '0:00', '7:00')).toEqual([{ fecha: MARTES, horas: 7 }]);
  });
});
