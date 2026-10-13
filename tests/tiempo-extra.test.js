// Captura de tiempo extra: horas, validaciones, resumen y lotes. Datos ficticios.
import { describe, expect, it } from 'vitest';
import {
  HORAS_ENTRADA_TE, HORAS_SALIDA_TE, LOTE_EMPLEADOS, PESTANAS_TE, aplicarA, calcularHoras, docAEmpleado, empleadoADoc, empleadoDesdePadron,
  estatusAlEnviar, folioDe, nivelEnTexto, nuevoIdBorrador, problemasDeEnvio, resumenTE, transporteCompleto, trozos,
} from '../src/utils/tiempoExtra.js';

const emp = (nomina, extra = {}) => ({
  nomina, nombre: `Empleado ${nomina}`, puesto: 'X', turnoNomina: 'A', horaEntrada: '16:00', horaSalida: '0:00', alimentos: false, transporte: true,
  rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1', necesitaConfirmar: false, confirmada: false, ...extra,
});

describe('horas', () => {
  it('los bloques de las rutas', () => {
    expect(HORAS_ENTRADA_TE).toEqual(['7:00', '16:00', '19:00', '0:00']);
    expect(HORAS_SALIDA_TE).toEqual(['16:00', '19:00', '0:00', '7:00']);
  });
  it('calcula las horas, incluso cruzando la medianoche', () => {
    expect(calcularHoras('7:00', '16:00')).toBe(9);
    expect(calcularHoras('16:00', '0:00')).toBe(8);
    expect(calcularHoras('19:00', '7:00')).toBe(12);
    expect(calcularHoras('0:00', '7:00')).toBe(7);
    expect(calcularHoras('16:00', '7:00')).toBe(15);
  });
  it('0 si falta una hora o entrada = salida', () => {
    expect(calcularHoras('', '16:00')).toBe(0);
    expect(calcularHoras('7:00', '7:00')).toBe(0);
    expect(calcularHoras('raro', '7:00')).toBe(0);
  });
});

describe('ids, folios y lotes', () => {
  it('el id del borrador cumple el patrón de las reglas', () => {
    for (let i = 0; i < 200; i++) expect(nuevoIdBorrador()).toMatch(/^BR-[A-Za-z0-9]{10,}$/);
    expect(new Set(Array.from({ length: 500 }, () => nuevoIdBorrador())).size).toBe(500);
  });
  it('el folio tiene el formato TE-AAAA-NNNN', () => {
    expect(folioDe(2026, 1)).toBe('TE-2026-0001');
    expect(folioDe(2026, 12345)).toBe('TE-2026-12345');
  });
  it('lotes de 10 empleados', () => {
    expect(LOTE_EMPLEADOS).toBe(10);
    expect(trozos(Array.from({ length: 35 }, (_, i) => i)).map(t => t.length)).toEqual([10, 10, 10, 5]);
    expect(trozos([])).toEqual([]);
  });
});

describe('empleado ↔ documento', () => {
  it('el documento solo trae campos permitidos y las horas calculadas', () => {
    const d = empleadoADoc(emp('1', { alimentos: true }));
    expect(Object.keys(d).sort()).toEqual(['comunidadId', 'horaEntrada', 'horaSalida', 'horas', 'nombre', 'puesto', 'puntoReunionId', 'requiereAlimentos', 'requiereTransporte', 'rutaId', 'turnoNomina'].sort());
    expect(d).toMatchObject({ horas: 8, requiereAlimentos: true, requiereTransporte: true, rutaId: 'r1' });
  });
  it('sin transporte no guarda ruta', () => {
    expect(empleadoADoc(emp('1', { transporte: false }))).toMatchObject({ requiereTransporte: false, rutaId: '', comunidadId: '', puntoReunionId: '' });
  });
  it('del padrón: transporte marcado por defecto; ruta completa pide confirmar', () => {
    const e = empleadoDesdePadron({ nomina: 5, nombre: 'ANA', puesto: 'OP', turnoNomina: 'B' }, { rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' });
    expect(e).toMatchObject({ nomina: '5', transporte: true, necesitaConfirmar: true, confirmada: false, turnoNomina: 'B' });
    expect(empleadoDesdePadron({ nomina: 6, nombre: 'LUIS' }, {}).necesitaConfirmar).toBe(false);
  });
  it('al reabrir un borrador, lo guardado ya está confirmado', () => {
    expect(docAEmpleado('1', empleadoADoc(emp('1')))).toMatchObject({ nomina: '1', horaEntrada: '16:00', confirmada: true, transporte: true });
  });
});

describe('validaciones de envío', () => {
  const base = { areaId: 'mantenimiento', fechaTE: '2026-10-20', motivo: 'Producción', comentario: 'Pedido urgente del cliente', hoy: '2026-10-14' };
  const errores = (p) => problemasDeEnvio({ ...base, ...p }).filter(x => x.nivel === 'error').map(x => x.mensaje);

  it('una solicitud completa no tiene errores', () => {
    expect(errores({ empleados: [emp('1'), emp('2', { transporte: false })] })).toEqual([]);
  });
  it('fecha de hoy o futura; motivo de la lista; comentario de 10 caracteres', () => {
    expect(errores({ empleados: [emp('1')], fechaTE: '2026-10-13' })).toContain('La fecha debe ser hoy o futura.');
    expect(errores({ empleados: [emp('1')], fechaTE: '2026-10-14' })).toEqual([]);
    expect(errores({ empleados: [emp('1')], motivo: 'Fiesta' })).toContain('Elige el motivo.');
    expect(errores({ empleados: [emp('1')], comentario: 'corto' }).join()).toMatch(/comentario es obligatorio/);
    expect(errores({ empleados: [emp('1')], comentario: '   123456789   ' }).join()).toMatch(/comentario es obligatorio/);
  });
  it('al menos un empleado y máximo MAX_PASAJEROS', () => {
    expect(errores({ empleados: [] })).toContain('Agrega al menos un empleado.');
    expect(errores({ empleados: Array.from({ length: 151 }, (_, i) => emp(String(i))) }).join()).toMatch(/Máximo 150/);
  });
  it('sin repetidos, con horario y entrada distinta de salida', () => {
    expect(errores({ empleados: [emp('1'), emp('1')] }).join()).toMatch(/repetido/);
    expect(errores({ empleados: [emp('1', { horaEntrada: '' })] }).join()).toMatch(/falta el horario/);
    expect(errores({ empleados: [emp('1', { horaEntrada: '7:00', horaSalida: '7:00' })] }).join()).toMatch(/no pueden ser iguales/);
  });
  it('transporte completo en cada empleado que lo pida; la precargada se confirma', () => {
    expect(errores({ empleados: [emp('1', { puntoReunionId: '' })] }).join()).toMatch(/completa ruta, comunidad y punto/);
    expect(errores({ empleados: [emp('1', { necesitaConfirmar: true, confirmada: false })] }).join()).toMatch(/confirma la ruta/);
    expect(errores({ empleados: [emp('1', { necesitaConfirmar: true, confirmada: true })] })).toEqual([]);
    expect(errores({ empleados: [emp('1', { transporte: false, rutaId: '' })] })).toEqual([]);
    expect(transporteCompleto(emp('1', { transporte: false, rutaId: '' }))).toBe(true);
  });
  it('un empleado con otro tiempo extra el mismo día solo da AVISO (no bloquea)', () => {
    const p = problemasDeEnvio({ ...base, empleados: [emp('1')], ocupados: new Map([['1', { folio: 'TE-2026-0004', estatus: 'autorizada' }]]) });
    expect(p.filter(x => x.nivel === 'error')).toEqual([]);
    expect(p.find(x => x.nivel === 'aviso').mensaje).toMatch(/TE-2026-0004/);
  });
});

describe('resumen y aplicar a varios', () => {
  it('totales y empleados por bloque de horario', () => {
    const r = resumenTE([emp('1'), emp('2', { alimentos: true }), emp('3', { horaEntrada: '7:00', horaSalida: '16:00', transporte: false })]);
    expect(r).toMatchObject({ totalEmpleados: 3, totalHoras: 25, totalTransporte: 2, totalAlimentos: 1 });
    expect(r.porBloque).toEqual({ '16:00 → 0:00': 2, '7:00 → 16:00': 1 });
  });
  it('aplica horario, alimentos y transporte a los seleccionados (o a todos)', () => {
    const lista = [emp('1'), emp('2'), emp('3')];
    const solo = aplicarA(lista, new Set(['2']), { horaEntrada: '19:00', horaSalida: '7:00', alimentos: true });
    expect(solo.map(e => e.horaEntrada)).toEqual(['16:00', '19:00', '16:00']);
    expect(solo[1].alimentos).toBe(true);
    const todos = aplicarA(lista, null, { transporte: false });
    expect(todos.every(e => !e.transporte)).toBe(true);
  });
});

describe('estatus y pestañas', () => {
  it('el Aut. 1 de esa área, o un área sin participaTE, va directo a nivel 2', () => {
    expect(estatusAlEnviar({ esAut1DeLaArea: false, areaParticipa: true })).toBe('pendiente_aut1');
    expect(estatusAlEnviar({ esAut1DeLaArea: true, areaParticipa: true })).toBe('pendiente_aut2');
    expect(estatusAlEnviar({ esAut1DeLaArea: false, areaParticipa: false })).toBe('pendiente_aut2');
  });
  it('nivel en texto y pestañas de Mis solicitudes', () => {
    expect(nivelEnTexto('pendiente_aut1')).toBe('Autorización 1');
    expect(PESTANAS_TE.map(p => p.label)).toEqual(['Borradores', 'En autorización', 'Devueltas', 'Autorizadas', 'Canceladas']);
  });
});
