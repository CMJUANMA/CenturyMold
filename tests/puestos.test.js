// Resolución de puestos en 3 niveles y estructura inicial. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { resolverPuesto, slugPuesto } from '../src/utils/puestos.js';
import {
  AREAS_INICIALES, PUESTOS_INICIALES, areaEfectiva, impactoCambioArea, proponerEstructuraInicial,
} from '../src/utils/estructura.js';

const catalogo = PUESTOS_INICIALES;
const r = (t, cat = catalogo) => resolverPuesto(t, cat);
const nivel = (t, cat) => r(t, cat).nivel;

describe('catálogo inicial', () => {
  it('tiene 40 puestos con ids únicos en 6 áreas', () => {
    expect(PUESTOS_INICIALES).toHaveLength(40);
    expect(new Set(PUESTOS_INICIALES.map(p => p.id)).size).toBe(40);
    expect(AREAS_INICIALES.map(a => a.id)).toEqual(['produccion', 'almacen', 'calidad', 'mantenimiento', 'moldes', 'administrativo']);
    expect(AREAS_INICIALES.find(a => a.id === 'administrativo').participaTE).toBe(false);
  });
  it('slug del puesto', () => {
    expect(slugPuesto('MAINTENANCE ENGINEER /CONTROLS')).toBe('maintenance-engineer-controls');
    expect(slugPuesto('CORPORATE PLANNING & INVENTORY MANAGER')).toBe('corporate-planning-inventory-manager');
  });
});

describe('nivel a: limpieza automática', () => {
  it('espacios, mayúsculas, acentos y _x0002_ coinciden con el puesto', () => {
    for (const t of ['  production   operator ', 'PRODUCTION OPERATOR      _x0002_', 'Production Operator', 'PRODUCTION\u0001 OPERATOR']) {
      const res = r(t);
      expect(res.nivel).toBe('a');
      expect(res.puesto.id).toBe('production-operator');
    }
  });
  it('un alias confirmado se resuelve solo', () => {
    const cat = catalogo.map(p => (p.id === 'maintenance-technician' ? { ...p, alias: ['TECNICO'] } : p));
    expect(r('Técnico', cat)).toMatchObject({ nivel: 'a', puesto: { id: 'maintenance-technician' } });
  });
});

describe('nivel b: corrección propuesta', () => {
  it('una letra de diferencia propone el puesto', () => {
    expect(r('FORKLIF OPERATOR')).toMatchObject({ nivel: 'b', puesto: { id: 'forklift-operator' }, distancia: 1 });
    expect(r('QUALITY INSPECTR')).toMatchObject({ nivel: 'b', puesto: { id: 'quality-inspector' } });
  });
  it('dos letras de diferencia en un puesto largo también propone', () => {
    expect(r('QUALITY INSPEKTOR')).toMatchObject({ nivel: 'b', puesto: { id: 'quality-inspector' } });
  });
  it('no propone si pasa del 15 % del largo (puesto corto con 2 letras)', () => {
    expect(nivel('RESINAR')).toBe('b'); // 1 letra de 7 (15 % = 1)
    expect(nivel('RASINAR')).toBe('c'); // 2 letras de 7: pasa del 15 %
  });
  it('dos candidatos igual de cercanos: no propone y marca ambiguo', () => {
    const cat = [{ id: 'a1', nombre: 'PRUEBA A1' }, { id: 'a2', nombre: 'PRUEBA A2' }];
    expect(r('PRUEBA A3', cat)).toMatchObject({ nivel: 'c', ambiguo: true });
    expect(r('PRUEBA A1X', cat)).toMatchObject({ nivel: 'b', puesto: { id: 'a1' } }); // uno más cerca que el otro
  });
});

describe('nivel c y puestos que NUNCA se corrigen entre sí', () => {
  it('puestos inventados o en español no tienen corrección', () => {
    expect(nivel('OPERADOR DE PRODUCCION')).toBe('c');
    expect(nivel('ASISTENTE')).toBe('c');
  });
  it('MAINTENANCE SUPERVISOR / TECHNICIAN, PRODUCTION OPERATOR / SUPERVISOR no se corrigen entre sí', () => {
    const sin = (id) => catalogo.filter(p => p.id !== id);
    expect(nivel('MAINTENANCE SUPERVISOR', sin('maintenance-supervisor'))).toBe('c');
    expect(nivel('MAINTENANCE TECHNICIAN', sin('maintenance-technician'))).toBe('c');
    expect(nivel('PRODUCTION OPERATOR', sin('production-operator'))).toBe('c');
    expect(nivel('PRODUCTION SUPERVISOR', sin('production-supervisor'))).toBe('c');
    expect(nivel('MOLDS SUPERVISOR', sin('molds-supervisor'))).toBe('c');
    expect(nivel('QUALITY AUDITOR', sin('quality-auditor'))).toBe('c');
  });
  it('FORKLIFT OPERATOR y FORK LIFT DRIVER son puestos separados y no se corrigen entre sí', () => {
    expect(r('FORKLIFT OPERATOR')).toMatchObject({ nivel: 'a', puesto: { id: 'forklift-operator' } });
    expect(r('FORK LIFT DRIVER')).toMatchObject({ nivel: 'a', puesto: { id: 'fork-lift-driver' } });
    const sinOperador = catalogo.filter(p => p.id !== 'forklift-operator');
    expect(nivel('FORKLIFT OPERATOR', sinOperador)).toBe('c');
    const sinChofer = catalogo.filter(p => p.id !== 'fork-lift-driver');
    expect(nivel('FORK LIFT DRIVER', sinChofer)).toBe('c');
  });
  it('un typo de uno no se confunde con el otro', () => {
    expect(r('FORK LIFT OPERATOR')).toMatchObject({ nivel: 'b', puesto: { id: 'forklift-operator' } });
    expect(r('FORK LIFT DRIVR')).toMatchObject({ nivel: 'b', puesto: { id: 'fork-lift-driver' } });
  });
});

describe('estructura', () => {
  const porId = new Map(PUESTOS_INICIALES.map(p => [p.id, p]));
  it('el área efectiva es la excepción o la del puesto', () => {
    expect(areaEfectiva({ puestoId: 'forklift-operator' }, porId)).toBe('almacen');
    expect(areaEfectiva({ puestoId: 'forklift-operator', areaExcepcion: 'moldes' }, porId)).toBe('moldes');
    expect(areaEfectiva({ puestoId: 'no-existe' }, porId)).toBe('');
  });
  it('cambiar el área de un puesto mueve a todos menos a los que tienen excepción', () => {
    const emps = [
      { nomina: '1', puestoId: 'resiner', areaId: 'produccion' },
      { nomina: '2', puestoId: 'resiner', areaId: 'moldes', areaExcepcion: 'moldes' },
      { nomina: '3', puestoId: 'resiner', areaId: 'produccion', activo: false },
      { nomina: '4', puestoId: 'process-engineer', areaId: 'produccion' },
    ];
    const imp = impactoCambioArea(emps, 'resiner', 'almacen');
    expect(imp.mover.map(e => e.nomina)).toEqual(['1']);
    expect(imp.conExcepcion.map(e => e.nomina)).toEqual(['2']);
  });
  it('la propuesta de estructura inicial describe sin tocar y equipara áreas viejas por nombre', () => {
    const areas = [{ id: 'produccion', nombre: 'Producción' }, { id: 'abc123', nombre: 'Calidad' }, { id: 'xyz', nombre: 'Logística' }];
    const usuarios = [
      { uid: 'u1', nombre: 'Ana', areaIds: ['abc123', 'produccion'] },
      { uid: 'u2', nombre: 'Luis', areaIds: ['xyz'] },
    ];
    const p = proponerEstructuraInicial({ areas, puestos: [{ id: 'resiner' }] }, usuarios);
    expect(p.areasNuevas.find(a => a.id === 'produccion').accion).toBe('completar');
    expect(p.areasNuevas.find(a => a.id === 'moldes').accion).toBe('crear');
    expect(p.puestosNuevos.filter(x => x.accion === 'crear')).toHaveLength(39);
    expect(p.heredadas).toEqual([
      { id: 'abc123', nombre: 'Calidad', equivale: 'calidad', equivaleNombre: 'Calidad' },
      { id: 'xyz', nombre: 'Logística', equivale: null, equivaleNombre: null },
    ]);
    expect(p.usuariosAfectados).toEqual([{ uid: 'u1', nombre: 'Ana', antes: ['abc123', 'produccion'], despues: ['calidad', 'produccion'] }]);
    expect(p.sinEquivalencia).toEqual(['xyz']);
  });
});
