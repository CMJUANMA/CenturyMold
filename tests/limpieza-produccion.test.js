// «Preparar para producción»: inventario, usuarios de prueba, cuentas de Authentication y rutas que se borran (y las que nunca). Datos ficticios.
// Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { COLECCIONES_A_BORRAR, COLECCIONES_PROTEGIDAS, armarInventario, cuentasAuthABorrar, puedeMarcarse, rutasABorrar } from '../src/utils/limpiezaProduccion.js';
import { COLECCIONES_RESPALDO } from '../src/utils/respaldoCompleto.js';

const d = (id, data = {}, sub = null) => ({ id, data, sub });
const colecciones = () => ({
  usuarios: [d('u-admin', { nomina: '1', nombre: 'ADMIN REAL', rol: 'admin' }), d('u-real', { nomina: '100', nombre: 'ANA REAL', rol: 'usuario' }), d('u-prueba', { nomina: '90001', nombre: 'PRUEBA UNO', rol: 'usuario' })],
  accesos: [d('90001', { version: 3, uid: 'x' })],
  empleados: [d('100', { nomina: '100' }), d('1', { nomina: '1' })],
  asignaciones: [d('100_aut1_moldes', { nomina: '100' }), d('90001_solicitante_moldes', { nomina: '90001' })],
  areas: [d('moldes')], puestos: [d('p')], turnosNomina: [d('A')], motivosTE: [d('m')], rutas: [], comunidades: [], puntosReunion: [],
  tiempoExtra: [
    d('te1', { folio: 'TE-2026-0001', estatus: 'autorizada', areaNombre: 'Moldes' }, { empleados: [{ id: '100', data: {} }, { id: '101', data: {} }], historial: [{ id: 'h1', data: {} }] }),
    d('BR-1', { estatus: 'borrador' }, { empleados: [{ id: '100', data: {} }], historial: [] }),
  ],
  solicitudes: [d('s1', { folio: 'SOL-1', origen: 'tiempo_extra' }, { pasajeros: [{ id: 'p1', data: {} }] })],
  ajustesNomina: [d('2026-01_moldes')], bitacora: [d('b1'), d('b2'), d('b3')], contadores: [d('te-2026', { ultimo: 5 })],
});

describe('inventario de lo que se borraría', () => {
  const inv = armarInventario(colecciones(), { uid: 'u-admin', nomina: '1' });
  it('cuenta documentos, subcolecciones y borradores, y lista los folios', () => {
    expect(inv.conteo).toEqual({
      tiempoExtra: 2, tiempoExtraEmpleados: 3, tiempoExtraHistorial: 1, borradores: 1, solicitudes: 1, pasajeros: 1, ajustesNomina: 1, bitacora: 3, contadores: 1,
    });
    expect(inv.folios.tiempoExtra.map(f => f.folio)).toEqual(['(borrador)', 'TE-2026-0001']);
    expect(inv.folios.solicitudes.map(f => f.folio)).toEqual(['SOL-1']);
  });
  it('cuenta lo que se conserva', () => {
    expect(inv.protegidos).toMatchObject({ empleados: 2, asignaciones: 2, areas: 1, turnosNomina: 1, motivosTE: 1, accesos: 1 });
  });
  it('los usuarios que parecen de prueba son los que no están en el padrón, van primero y quien limpia nunca se ofrece', () => {
    expect(inv.usuarios.map(u => [u.nomina, u.parecePrueba, u.esYo])).toEqual([['90001', true, false], ['1', false, true], ['100', false, false]]);
    expect(inv.usuarios.find(u => u.nomina === '90001').asignaciones).toBe(1);
    expect(puedeMarcarse(inv.usuarios.find(u => u.esYo))).toBe(false);
    expect(puedeMarcarse(inv.usuarios.find(u => u.nomina === '90001'))).toBe(true);
    // el admin no está en el padrón, pero no «parece de prueba» porque es quien limpia
    const sinPadron = armarInventario({ ...colecciones(), empleados: [] }, { uid: 'u-admin', nomina: '1' });
    expect(sinPadron.usuarios.find(u => u.esYo).parecePrueba).toBe(false);
  });
});

describe('cuentas de Authentication por borrar', () => {
  it('una por cada versión de acceso del usuario marcado', () => {
    const accesos = new Map([['90001', { version: 3, uid: 'x' }]]);
    const r = cuentasAuthABorrar([{ nomina: '90001', nombre: 'PRUEBA UNO' }, { nomina: '90002', nombre: 'PRUEBA DOS' }], accesos);
    expect(r).toEqual([
      { nomina: '90001', nombre: 'PRUEBA UNO', correos: ['90001@rutas.app', '90001.v2@rutas.app', '90001.v3@rutas.app'] },
      { nomina: '90002', nombre: 'PRUEBA DOS', correos: ['90002@rutas.app'] },
    ]);
  });
});

describe('rutas que se borran', () => {
  const rutas = rutasABorrar(colecciones(), ['u-prueba']);
  it('primero las subcolecciones, luego las solicitudes y el resto, al final los usuarios marcados', () => {
    const i = (r) => rutas.findIndex(x => x.join('/') === r.join('/'));
    expect(i(['tiempoExtra', 'te1', 'empleados', '100'])).toBeLessThan(i(['tiempoExtra', 'te1']));
    expect(i(['solicitudes', 's1', 'pasajeros', 'p1'])).toBeLessThan(i(['solicitudes', 's1']));
    expect(i(['usuarios', 'u-prueba'])).toBe(rutas.length - 1);
    expect(rutas).toHaveLength(14); // 5 de subcolecciones + 3 solicitudes + 1 ajuste + 3 de bitácora + 1 contador + 1 usuario
  });
  it('nunca incluye padrón, áreas, puestos, turnos, motivos, catálogos, asignaciones, accesos ni usuarios no marcados', () => {
    const colecs = new Set(rutas.map(r => r[0]));
    for (const p of COLECCIONES_PROTEGIDAS) expect(colecs.has(p), p).toBe(false);
    expect([...colecs].sort()).toEqual([...COLECCIONES_A_BORRAR, 'usuarios'].sort());
    expect(rutas.filter(r => r[0] === 'usuarios')).toEqual([['usuarios', 'u-prueba']]);
  });
  it('el respaldo cubre todo lo que se borra y todo lo que se conserva', () => {
    for (const c of [...COLECCIONES_A_BORRAR, ...COLECCIONES_PROTEGIDAS, 'usuarios']) expect(COLECCIONES_RESPALDO, c).toContain(c);
  });
});
