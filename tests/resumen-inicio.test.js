// Números del Inicio por rol. Datos ficticios; con listas vacías todo es 0.
import { describe, expect, it } from 'vitest';
import {
  DIAS_RESPALDO_SEMANAL, contarMisSolicitudes, contarPorEstatus, estadoTransporte, indicadoresRH, inicioDeSemana, proximos7Dias, proximosAutorizados, respaldoVencido, semanaPorArea, textoUltimoRespaldo, ultimasDelArea,
} from '../src/utils/resumenInicio.js';

const AHORA = new Date(2026, 9, 14, 10); // miércoles 14/oct/2026
const s = (folio, estatus, extra = {}) => ({ id: folio, folio, estatus, areaId: 'mantenimiento', fechaTE: '2026-10-20', fechaCreacion: new Date(2026, 9, 12), fechaActualizacion: new Date(2026, 9, 13), resumen: { totalEmpleados: 3, totalHoras: 6, totalTransporte: 2 }, ...extra });

describe('sin solicitudes de tiempo extra', () => {
  it('todo es 0 y las listas están vacías, sin error', () => {
    expect(contarMisSolicitudes([], AHORA)).toEqual({ borrador: 0, enAutorizacion: 0, devueltas: 0, autorizadasMes: 0 });
    expect(proximosAutorizados([], AHORA)).toEqual([]);
    expect(ultimasDelArea([])).toEqual([]);
    expect(semanaPorArea([], [{ id: 'moldes', nombre: 'Moldes' }], AHORA)).toEqual([{ areaId: 'moldes', nombre: 'Moldes', total: 0 }]);
    expect(contarPorEstatus([], 'autorizada')).toBe(0);
  });
});

describe('mis solicitudes', () => {
  const propias = [
    s('TE-1', 'borrador'), s('TE-2', 'pendiente_aut1'), s('TE-3', 'pendiente_aut2'), s('TE-4', 'devuelta'), s('TE-5', 'devuelta'),
    s('TE-6', 'autorizada', { aut2: { fecha: new Date(2026, 9, 10) } }),
    s('TE-7', 'procesada', { aut2: { fecha: new Date(2026, 8, 25) } }), // del mes pasado
    s('TE-8', 'cancelada'),
  ];
  it('cuenta borradores, en autorización, devueltas y autorizadas del mes', () => {
    expect(contarMisSolicitudes(propias, AHORA)).toEqual({ borrador: 1, enAutorizacion: 2, devueltas: 2, autorizadasMes: 1 });
  });
  it('próximos autorizados: de hoy en adelante, la más próxima primero, con estado del transporte', () => {
    const lista = proximosAutorizados([
      s('TE-A', 'autorizada', { fechaTE: '2026-10-25' }), s('TE-B', 'autorizada', { fechaTE: '2026-10-15', resumen: { totalEmpleados: 1, totalHoras: 2, totalTransporte: 0 } }),
      s('TE-C', 'autorizada', { fechaTE: '2026-10-01' }), s('TE-D', 'pendiente_aut1', { fechaTE: '2026-10-16' }), s('TE-E', 'procesada', { fechaTE: '2026-10-20' }),
    ], AHORA);
    expect(lista.map(x => x.folio)).toEqual(['TE-B', 'TE-E', 'TE-A']);
    expect(lista.map(x => x.transporte)).toEqual(['Sin transporte', 'Confirmada por RH · transporte solicitado', 'Por enviar al proveedor']);
    expect(lista[0]).toMatchObject({ fecha: '2026-10-15', empleados: 1, horas: 2 });
  });
  it('estado del transporte', () => {
    expect(estadoTransporte(s('x', 'autorizada'))).toBe('Por enviar al proveedor');
    expect(estadoTransporte(s('x', 'procesada'))).toBe('Confirmada por RH · transporte solicitado');
    expect(estadoTransporte(s('x', 'procesada', { resumen: { totalTransporte: 0 } }))).toBe('Confirmada por RH · sin transporte');
    expect(estadoTransporte(s('x', 'autorizada', { resumen: { totalTransporte: 0 } }))).toBe('Sin transporte');
  });
});

describe('área y planta', () => {
  it('últimas del área: más nuevas primero y sin borradores', () => {
    const lista = ultimasDelArea([
      s('TE-1', 'autorizada', { fechaCreacion: new Date(2026, 9, 1) }), s('TE-2', 'borrador', { fechaCreacion: new Date(2026, 9, 13) }),
      s('TE-3', 'devuelta', { fechaCreacion: new Date(2026, 9, 12) }),
    ]);
    expect(lista.map(x => x.folio)).toEqual(['TE-3', 'TE-1']);
  });
  it('la semana empieza el lunes', () => {
    expect(inicioDeSemana(AHORA).getDate()).toBe(12);
  });
  it('solicitudes de la semana por área', () => {
    const areas = [{ id: 'mantenimiento', nombre: 'Mantenimiento' }, { id: 'moldes', nombre: 'Moldes' }];
    const r = semanaPorArea([
      s('TE-1', 'autorizada', { fechaCreacion: new Date(2026, 9, 13) }), s('TE-2', 'pendiente_aut1', { fechaCreacion: new Date(2026, 9, 12, 8) }),
      s('TE-3', 'autorizada', { fechaCreacion: new Date(2026, 9, 9) }), // semana pasada
      s('TE-4', 'autorizada', { areaId: 'moldes', fechaCreacion: new Date(2026, 9, 14) }),
    ], areas, AHORA);
    expect(r).toEqual([{ areaId: 'mantenimiento', nombre: 'Mantenimiento', total: 2 }, { areaId: 'moldes', nombre: 'Moldes', total: 1 }]);
  });
});

describe('indicadores del Inicio de RH y admin', () => {
  // AHORA = miércoles 14/oct/2026 10:00 → semana del 12 al 18 de octubre; mes de octubre
  const hace = (dias) => new Date(AHORA.getTime() - dias * 86400000);
  const t = (folio, estatus, fechaTE, extra = {}) => s(folio, estatus, { fechaTE, ...extra });

  it('sin solicitudes todo es 0 y no hay "más antigua"', () => {
    expect(indicadoresRH([], AHORA)).toEqual({
      atencion: { porEnviar: 0, vencidas: 0, nivel1: 0, nivel2: 0, masAntiguaNivel1: null, masAntiguaNivel2: null, devueltas: 0 },
      semana: { horasSemana: 0, horasMes: 0, empleadosSemana: 0, transporte7: 0 },
    });
    expect(proximos7Dias([], AHORA)).toEqual([]);
  });

  it('requieren atención: por enviar, vencidas sin confirmar, nivel 1 y 2 con la más antigua, devueltas', () => {
    const planta = [
      t('A', 'autorizada', '2026-10-20'), t('B', 'autorizada', '2026-10-13'), t('C', 'autorizada', '2026-10-01'), // 2 vencidas
      t('D', 'procesada', '2026-10-01'),                                    // confirmada: no cuenta como pendiente
      t('E', 'pendiente_aut1', '2026-10-21', { fechaActualizacion: hace(1) }),
      t('F', 'pendiente_aut2', '2026-10-21', { fechaActualizacion: hace(5) }),
      t('G', 'pendiente_aut2', '2026-10-22', { fechaActualizacion: hace(2) }),
      t('H', 'devuelta', '2026-10-22'), t('I', 'cancelada', '2026-10-22'),
    ];
    expect(indicadoresRH(planta, AHORA).atencion).toEqual({
      porEnviar: 3, vencidas: 2, nivel1: 1, nivel2: 2, masAntiguaNivel1: 1, masAntiguaNivel2: 5, devueltas: 1,
    });
  });

  it('una fecha de hoy no está vencida', () => {
    expect(indicadoresRH([t('A', 'autorizada', '2026-10-14')], AHORA).atencion.vencidas).toBe(0);
  });

  it('esta semana: horas de la semana y del mes, empleados de la semana y transporte de los próximos 7 días', () => {
    const planta = [
      t('A', 'autorizada', '2026-10-12', { resumen: { totalEmpleados: 4, totalHoras: 10, totalTransporte: 1 } }),  // lunes
      t('B', 'procesada', '2026-10-18', { resumen: { totalEmpleados: 2, totalHoras: 5.5, totalTransporte: 2 } }),  // domingo
      t('C', 'autorizada', '2026-10-19', { resumen: { totalEmpleados: 9, totalHoras: 20, totalTransporte: 3 } }),  // semana siguiente, mismo mes
      t('D', 'autorizada', '2026-09-30', { resumen: { totalEmpleados: 9, totalHoras: 99, totalTransporte: 9 } }),  // mes pasado
      t('E', 'pendiente_aut2', '2026-10-15', { resumen: { totalEmpleados: 9, totalHoras: 99, totalTransporte: 9 } }), // no autorizada
      t('F', 'autorizada', '2026-10-21', { resumen: { totalEmpleados: 1, totalHoras: 8, totalTransporte: 1 } }),  // dentro de 7 días
      t('G', 'autorizada', '2026-10-22', { resumen: { totalEmpleados: 1, totalHoras: 8, totalTransporte: 7 } }),  // 8 días: fuera
    ];
    expect(indicadoresRH(planta, AHORA).semana).toEqual({
      horasSemana: 15.5,          // A + B
      horasMes: 51.5,             // A + B + C + F + G
      empleadosSemana: 6,         // A + B
      transporte7: 2 + 3 + 1,     // hoy (14) a 21/oct: A (12) queda fuera; B (18), C (19) y F (21) entran
    });
  });

  it('próximos 7 días: autorizadas y confirmadas, la más próxima primero, con su transporte', () => {
    const planta = [
      t('Z', 'autorizada', '2026-10-21'), t('Y', 'procesada', '2026-10-14'), t('X', 'autorizada', '2026-10-13'),
      t('W', 'pendiente_aut2', '2026-10-15'), t('V', 'autorizada', '2026-10-25'),
    ];
    expect(proximos7Dias(planta, AHORA).map(p => p.folio)).toEqual(['Y', 'Z']);
    expect(proximos7Dias(planta, AHORA)[0]).toMatchObject({ empleados: 3, horas: 6, transporte: 2, estatus: 'procesada' });
  });
});

describe('recordatorio del respaldo semanal (solo admin, en Requieren atención)', () => {
  const dias = (n) => new Date(AHORA.getTime() - n * 86400000);
  it('con más de 7 días pide el respaldo; con 7 o menos, no', () => {
    expect(DIAS_RESPALDO_SEMANAL).toBe(7);
    expect(respaldoVencido(dias(8), AHORA)).toBe(true);
    expect(respaldoVencido(dias(7), AHORA)).toBe(false);
    expect(respaldoVencido(dias(1), AHORA)).toBe(false);
    expect(respaldoVencido(AHORA, AHORA)).toBe(false);
  });
  it('si nunca se ha hecho, también lo pide; si no se pudo leer, no molesta', () => {
    expect(respaldoVencido(null, AHORA)).toBe(true);
    expect(respaldoVencido(undefined, AHORA)).toBe(false);
  });
  it('acepta fechas de Firestore (Timestamp) y milisegundos', () => {
    expect(respaldoVencido({ toDate: () => dias(9) }, AHORA)).toBe(true);
    expect(respaldoVencido(dias(2).getTime(), AHORA)).toBe(false);
  });
  it('dice hace cuánto fue el último', () => {
    expect(textoUltimoRespaldo(dias(9), AHORA)).toBe('El último respaldo completo fue hace 9 días.');
    expect(textoUltimoRespaldo(dias(1), AHORA)).toBe('El último respaldo completo fue hace 1 día.');
    expect(textoUltimoRespaldo(null, AHORA)).toBe('Aún no hay un respaldo completo registrado.');
  });
});
