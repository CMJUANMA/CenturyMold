// Números del Inicio por rol. Datos ficticios; con listas vacías todo es 0.
import { describe, expect, it } from 'vitest';
import {
  contarMisSolicitudes, contarPorEstatus, estadoTransporte, inicioDeSemana, proximosAutorizados, semanaPorArea, ultimasDelArea,
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
    expect(lista.map(x => x.transporte)).toEqual(['Sin transporte', 'Solicitado', 'Por solicitar']);
    expect(lista[0]).toMatchObject({ fecha: '2026-10-15', empleados: 1, horas: 2 });
  });
  it('estado del transporte', () => {
    expect(estadoTransporte(s('x', 'autorizada'))).toBe('Por solicitar');
    expect(estadoTransporte(s('x', 'autorizada', { solicitudRutaId: 'sol1' }))).toBe('Solicitado');
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
