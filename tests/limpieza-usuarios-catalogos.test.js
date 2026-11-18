// «Preparar para producción»: borrar todos los usuarios excepto los administradores (perfil + accesos, nunca asignaciones) y los catálogos de
// transporte de prueba (con la ruta de cada empleado en blanco). Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_TRANSPORTE_EMPLEADO, COLECCIONES_TRANSPORTE, armarInventario, cuentasAuthABorrar, cuentasAuthDeAdmins, empleadosConTransporte, rutasABorrar, usuariosNoAdmin,
} from '../src/utils/limpiezaProduccion.js';

const d = (id, data = {}, sub = null) => ({ id, data, sub });
const base = () => ({
  usuarios: [
    d('u-admin', { nomina: '1', nombre: 'ADMIN REAL', rol: 'admin' }), d('u-admin2', { nomina: '2', nombre: 'OTRO ADMIN', rol: 'admin' }),
    d('u-real', { nomina: '100', nombre: 'ANA REAL', rol: 'usuario' }), d('u-prueba', { nomina: '90001', nombre: 'PRUEBA UNO', rol: 'usuario' }),
  ],
  accesos: [d('90001', { version: 3, uid: 'x' }), d('2', { version: 3, uid: 'y' })],
  empleados: [
    d('100', { nomina: '100', rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1' }), d('1', { nomina: '1', rutaId: '', comunidadId: '', puntoReunionId: '' }), d('3', { nomina: '3' }),
  ],
  asignaciones: [d('100_aut1_moldes', { nomina: '100' })],
  rutas: [d('r1')], comunidades: [d('c1'), d('c2')], puntosReunion: [d('p1'), d('p2'), d('p3')],
});

describe('todos los usuarios excepto los administradores', () => {
  const inv = armarInventario(base(), { uid: 'u-admin', nomina: '1' });
  it('marca a todos menos a los administradores y a quien limpia', () => {
    expect(usuariosNoAdmin(inv.usuarios).map(u => u.nomina).sort()).toEqual(['100', '90001']);
  });
  it('borra el perfil y el accesos/{nómina} de cada uno, pero nunca asignaciones ni administradores', () => {
    const marcados = usuariosNoAdmin(inv.usuarios);
    const rutas = rutasABorrar(base(), marcados.map(u => u.uid), { nominasAccesos: marcados.map(u => u.nomina) });
    expect(rutas.filter(r => r[0] === 'accesos').map(r => r[1]).sort()).toEqual(['100', '90001']);
    expect(rutas.filter(r => r[0] === 'usuarios').map(r => r[1]).sort()).toEqual(['u-prueba', 'u-real']);
    expect(rutas.some(r => r[0] === 'asignaciones')).toBe(false);
    expect(rutas.some(r => ['u-admin', 'u-admin2'].includes(r[1]) || (r[0] === 'accesos' && ['1', '2'].includes(r[1])))).toBe(false);
  });
  it('lista las cuentas de Authentication de los marcados (todas las versiones) y separa las de los administradores', () => {
    const accesos = new Map([['90001', { version: 3 }], ['2', { version: 3 }]]);
    const correos = cuentasAuthABorrar(usuariosNoAdmin(inv.usuarios), accesos).flatMap(c => c.correos);
    expect(correos.sort()).toEqual(['100@rutas.app', '90001.v2@rutas.app', '90001.v3@rutas.app', '90001@rutas.app']);
    const admins = cuentasAuthDeAdmins(inv.usuarios.filter(u => u.rol === 'admin'), accesos);
    expect(admins.vigentes.map(v => v.correo).sort()).toEqual(['1@rutas.app', '2.v3@rutas.app']);
    expect(admins.viejas.map(v => v.correo)).toEqual(['2@rutas.app', '2.v2@rutas.app']);
  });
});

describe('catálogos de transporte', () => {
  it('sin la casilla no se borra ningún catálogo', () => {
    expect(rutasABorrar(base(), []).some(r => COLECCIONES_TRANSPORTE.includes(r[0]))).toBe(false);
  });
  it('con la casilla se borran rutas, comunidades y puntos y se cuentan los empleados con ruta; el padrón no se borra', () => {
    const rutas = rutasABorrar(base(), [], { catalogosTransporte: true });
    const pos = (c) => rutas.findIndex(r => r[0] === c);
    expect(rutas.filter(r => r[0] === 'puntosReunion')).toHaveLength(3);
    expect(pos('puntosReunion')).toBeLessThan(pos('comunidades'));
    expect(pos('comunidades')).toBeLessThan(pos('rutas'));
    expect(rutas.some(r => r[0] === 'empleados')).toBe(false);
    expect(armarInventario(base(), { uid: 'u-admin', nomina: '1' }).transporte).toEqual({ rutas: 1, comunidades: 2, puntosReunion: 3, empleadosConRuta: 1 });
    expect(empleadosConTransporte(base()).map(e => e.id)).toEqual(['100']);
    expect(CAMPOS_TRANSPORTE_EMPLEADO).toEqual(['rutaId', 'comunidadId', 'puntoReunionId']);
  });
});
