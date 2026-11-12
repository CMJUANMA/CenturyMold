// Lista para capturar tiempo extra: sin quien captura ni quien tiene un rol operativo. Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { empleadosParaCapturar, nominasConRolOperativo } from '../src/utils/empleadosCaptura.js';

const padron = [
  { nomina: '1', areaId: 'produccion', nombre: 'DIANA (captura)' },
  { nomina: '2', areaId: 'produccion', nombre: 'OTRO SOLICITANTE' },
  { nomina: '3', areaId: 'produccion', nombre: 'AUT. 1 DE PRODUCCIÓN' },
  { nomina: '4', areaId: 'produccion', nombre: 'AUT. 2' },
  { nomina: '5', areaId: 'produccion', nombre: 'OPERADOR UNO' },
  { nomina: '6', areaId: 'produccion', nombre: 'OPERADOR NO ELEGIBLE', elegibleTE: false },
  { nomina: '7', areaId: 'produccion', nombre: 'OPERADOR DE BAJA', activo: false },
  { nomina: '8', areaId: 'produccion', nombre: 'OPERADOR DOS' },
  { nomina: '9', areaId: 'almacen', nombre: 'DE OTRA ÁREA' },
];
const asig = (nomina, rol, areaId, extra = {}) => ({ nomina, rol, areaId: rol === 'aut2' ? null : areaId, activo: true, ...extra });
const asignaciones = [asig('1', 'solicitante', 'produccion'), asig('2', 'solicitante', 'produccion'), asig('3', 'aut1', 'produccion'), asig('4', 'aut2'), asig('9', 'solicitante', 'almacen')];

describe('nominasConRolOperativo', () => {
  it('reúne al Aut. 2 y a los Aut. 1 y solicitantes del área (no los de otras áreas)', () => {
    expect([...nominasConRolOperativo(asignaciones, 'produccion')].sort()).toEqual(['1', '2', '3', '4']);
    expect([...nominasConRolOperativo(asignaciones, 'almacen')].sort()).toEqual(['4', '9']);
  });
  it('ignora lo que ya no está vigente (revocado o vencido)', () => {
    const esVigente = (a) => a.activo === true && !a.vencida;
    const lista = [...asignaciones, asig('5', 'solicitante', 'produccion', { activo: false }), asig('8', 'aut1', 'produccion', { vencida: true })];
    const r = nominasConRolOperativo(lista, 'produccion', esVigente);
    expect(r.has('5')).toBe(false);
    expect(r.has('8')).toBe(false);
  });
});

describe('empleadosParaCapturar', () => {
  it('ofrece solo a los operadores: sin quien captura, sin roles, sin no elegibles ni bajas ni otras áreas', () => {
    const conRol = nominasConRolOperativo(asignaciones, 'produccion');
    expect(empleadosParaCapturar(padron, 'produccion', { nominaPropia: '1', conRol }).map(e => e.nomina)).toEqual(['5', '8']);
  });
  it('sin poder leer los roles, al menos no ofrece a quien captura', () => {
    expect(empleadosParaCapturar(padron, 'produccion', { nominaPropia: '1' }).map(e => e.nomina)).toEqual(['2', '3', '4', '5', '8']);
  });
  it('compara las nóminas como texto', () => {
    expect(empleadosParaCapturar([{ nomina: 5, areaId: 'x' }], 'x', { nominaPropia: 5 })).toEqual([]);
  });
});
