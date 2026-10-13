// Asignaciones (vigencia, permisos, organigrama) y migración al modelo de asignaciones. Datos ficticios en memoria.
// Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import {
  calcularAccesos, construirOrganigrama, estadoAsignacion, etiquetaAsignacion, finDelDia, formatoCorto, idAsignacion, inicioDelDia,
  motivoNoPuedeAsignar, rolesAsignables,
} from '../src/utils/asignaciones.js';
import { planearMigracion } from '../src/utils/migracionAsignaciones.js';

const HOY = new Date(2026, 9, 13, 12, 0, 0); // 13/oct/2026 12:00
const dia = (d) => new Date(2026, 9, d, 12, 0, 0);
const asig = (nomina, rol, areaId, extra = {}) => ({
  id: idAsignacion(nomina, rol, areaId), nomina, nombre: `P${nomina}`, rol, areaId: rol === 'aut2' ? null : areaId,
  desde: dia(1), hasta: null, activo: true, ...extra,
});

describe('id y vigencia', () => {
  it('el id es nomina_rol_area, con "planta" para la Aut. 2', () => {
    expect(idAsignacion('50610', 'aut1', 'produccion')).toBe('50610_aut1_produccion');
    expect(idAsignacion('11', 'aut2', null)).toBe('11_aut2_planta');
  });

  it('vigente, programada, vencida y revocada', () => {
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes'), HOY)).toBe('vigente');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { desde: dia(20) }), HOY)).toBe('programada');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { hasta: dia(10) }), HOY)).toBe('vencida');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { activo: false }), HOY)).toBe('revocada');
  });

  it('"hasta" incluye todo el día final; "desde" empieza a las 00:00', () => {
    const hasta = finDelDia('2026-10-13');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { hasta }), new Date(2026, 9, 13, 23, 59, 0))).toBe('vigente');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { hasta }), new Date(2026, 9, 14, 0, 0, 1))).toBe('vencida');
    const desde = inicioDelDia('2026-10-13');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { desde }), new Date(2026, 9, 13, 0, 0, 1))).toBe('vigente');
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { desde }), new Date(2026, 9, 12, 23, 59, 59))).toBe('programada');
  });

  it('un Aut. 1 temporal de 2 días vence solo', () => {
    const a = asig('1', 'aut1', 'moldes', { desde: inicioDelDia('2026-10-13'), hasta: finDelDia('2026-10-14') });
    expect(estadoAsignacion(a, dia(13))).toBe('vigente');
    expect(estadoAsignacion(a, dia(14))).toBe('vigente');
    expect(estadoAsignacion(a, dia(15))).toBe('vencida');
  });

  it('acepta Timestamps de Firestore (toDate)', () => {
    const ts = (d) => ({ toDate: () => d });
    expect(estadoAsignacion(asig('1', 'aut1', 'moldes', { desde: ts(dia(1)), hasta: ts(dia(30)) }), HOY)).toBe('vigente');
  });
});

describe('accesos del usuario (useAccesos)', () => {
  const lista = [
    asig('7', 'solicitante', 'mantenimiento'),
    asig('7', 'aut1', 'moldes', { hasta: dia(20) }),
    asig('7', 'aut1', 'calidad', { hasta: dia(10) }), // vencida
    asig('7', 'solicitante', 'almacen', { activo: false }), // revocada
    asig('7', 'aut2', null, { desde: dia(20) }), // programada
  ];
  it('solo cuentan las vigentes', () => {
    const a = calcularAccesos(lista, { rol: 'usuario' }, HOY);
    expect(a).toMatchObject({ esAdmin: false, esRH: false, esAut2: false, areasAut1: ['moldes'], areasSolicitante: ['mantenimiento'] });
  });
  it('cuando llega la fecha, la programada empieza sola', () => {
    expect(calcularAccesos(lista, { rol: 'usuario' }, dia(25)).esAut2).toBe(true);
  });
  it('admin y rh salen del rol del sistema', () => {
    expect(calcularAccesos([], { rol: 'rh' }, HOY)).toMatchObject({ esRH: true, esAdmin: false, esAut2: false });
    expect(calcularAccesos([], { rol: 'admin' }, HOY)).toMatchObject({ esRH: true, esAdmin: true });
  });
});

describe('quién puede asignar qué', () => {
  const areas = [{ id: 'produccion', nombre: 'Producción', participaTE: true }, { id: 'administrativo', nombre: 'Administrativo', participaTE: false }];
  it('admin todo; RH y Aut. 2, aut1 y solicitante; el resto nada', () => {
    expect(rolesAsignables({ esAdmin: true })).toEqual(['aut2', 'aut1', 'solicitante']);
    expect(rolesAsignables({ esRH: true })).toEqual(['aut1', 'solicitante']);
    expect(rolesAsignables({ esAut2: true })).toEqual(['aut1', 'solicitante']);
    expect(rolesAsignables({})).toEqual([]);
  });
  it('RH no asigna aut2; nadie (salvo admin) se asigna a sí mismo; sin participaTE no', () => {
    const rh = { esRH: true, nomina: '9' };
    expect(motivoNoPuedeAsignar(rh, { rol: 'aut2', nominaObjetivo: '5' }, areas)).toMatch(/permiso/);
    expect(motivoNoPuedeAsignar(rh, { rol: 'aut1', areaId: 'produccion', nominaObjetivo: '9' }, areas)).toMatch(/sí mismo/);
    expect(motivoNoPuedeAsignar(rh, { rol: 'aut1', areaId: 'administrativo', nominaObjetivo: '5' }, areas)).toMatch(/no participa/);
    expect(motivoNoPuedeAsignar(rh, { rol: 'aut1', areaId: 'produccion', nominaObjetivo: '5' }, areas)).toBeNull();
    expect(motivoNoPuedeAsignar({ esAdmin: true, nomina: '1' }, { rol: 'aut2', nominaObjetivo: '1' }, areas)).toBeNull();
  });
});

describe('organigrama', () => {
  const areas = [
    { id: 'moldes', nombre: 'Moldes', participaTE: true, orden: 2 },
    { id: 'produccion', nombre: 'Producción', participaTE: true, orden: 1 },
    { id: 'administrativo', nombre: 'Administrativo', participaTE: false, orden: 3 },
  ];
  const empleados = new Map([
    ['11', { nombre: 'MALDONADO SALVADOR', puesto: 'DIRECTOR' }],
    ['50610', { nombre: 'JEFE PRODUCCION', puesto: 'PRODUCTION SUPERINTENDENT' }],
    ['50532', { nombre: 'ANA SOLICITANTE', puesto: 'PRODUCTION SUPERVISOR' }],
    ['50874', { nombre: 'TEMPORAL MOLDES', puesto: 'MOLDS SUPERVISOR' }],
  ]);
  const lista = [
    asig('11', 'aut2', null), asig('50610', 'aut1', 'produccion'), asig('50532', 'solicitante', 'produccion'),
    asig('50874', 'aut1', 'moldes', { hasta: finDelDia('2026-10-20') }),
    asig('50999', 'solicitante', 'moldes', { activo: false }), // revocada: no sale
    asig('50998', 'aut1', 'administrativo'), // área sin participaTE: no tiene columna
  ];
  const org = construirOrganigrama({ asignaciones: lista, areas, empleados, nominasConUsuario: new Set(['11', '50610']), ahora: HOY });

  it('Aut. 2 arriba y una columna por área con participaTE, en orden', () => {
    expect(org.aut2.map(t => t.nomina)).toEqual(['11']);
    expect(org.columnas.map(c => c.area.id)).toEqual(['produccion', 'moldes']);
  });
  it('cada tarjeta trae nombre, puesto y nómina del padrón', () => {
    const jefe = org.columnas[0].aut1[0];
    expect(jefe).toMatchObject({ nombre: 'JEFE PRODUCCION', puesto: 'PRODUCTION SUPERINTENDENT', nomina: '50610', rol: 'aut1', sinUsuario: false });
    expect(org.columnas[0].solicitantes.map(t => t.nombre)).toEqual(['ANA SOLICITANTE']);
  });
  it('marca "Temporal hasta" y "Sin usuario"; ignora revocadas', () => {
    const temporal = org.columnas[1].aut1[0];
    expect(formatoCorto(temporal.temporalHasta)).toBe('20/10');
    expect(temporal.sinUsuario).toBe(true);
    expect(org.columnas[1].solicitantes).toEqual([]);
    expect(org.columnas[0].solicitantes[0].sinUsuario).toBe(true);
  });
  it('si no se conocen los usuarios, no marca "Sin usuario"', () => {
    const sin = construirOrganigrama({ asignaciones: lista, areas, empleados, nominasConUsuario: null, ahora: HOY });
    expect(sin.columnas.flatMap(c => [...c.aut1, ...c.solicitantes]).some(t => t.sinUsuario)).toBe(false);
  });
  it('un área sin Aut. 1 vigente lo señala (sus solicitudes no podrían avanzar)', () => {
    expect(org.columnas.map(c => c.sinAut1)).toEqual([false, false]);
    const vencido = construirOrganigrama({ asignaciones: lista, areas, empleados, ahora: dia(25) });
    expect(vencido.columnas.find(c => c.area.id === 'moldes').sinAut1).toBe(true);
    expect(vencido.columnas.find(c => c.area.id === 'produccion').sinAut1).toBe(false);
  });
  it('etiquetas de la tabla de usuarios', () => {
    const nombres = new Map([['produccion', 'Producción'], ['moldes', 'Moldes']]);
    expect(etiquetaAsignacion(lista[2], nombres)).toBe('Solicitante · Producción');
    expect(etiquetaAsignacion(lista[3], nombres)).toBe('Aut. 1 · Moldes hasta 20/10');
    expect(etiquetaAsignacion(lista[0], nombres)).toBe('Aut. 2');
  });
});

describe('migración al modelo de asignaciones', () => {
  const areas = [
    { id: 'produccion', nombre: 'Producción', participaTE: true },
    { id: 'almacen', nombre: 'Almacén', participaTE: true },
    { id: 'moldes', nombre: 'Moldes', participaTE: true },
    { id: 'administrativo', nombre: 'Administrativo', participaTE: false },
  ];
  const base = () => ({
    areas, ahora: HOY,
    areasTE: [
      { id: 'produccion', nombre: 'Producción', autorizador1Nomina: '50610', suplente1Nomina: '50611', solicitantesNominas: ['50532', '50009'] },
      { id: 'almacen', nombre: 'Almacén', autorizador1Nomina: '50988', solicitantesNominas: ['50901'] },
      { id: 'fantasma', nombre: 'Vieja', autorizador1Nomina: '1', solicitantesNominas: [] },
    ],
    configTE: { autorizador2Nomina: '11', suplente2Nomina: '50296' },
    empleados: [
      { nomina: '50610', nombre: 'JEFE', areaId: 'produccion' }, { nomina: '50532', nombre: 'ANA', areaId: 'produccion' },
      { nomina: '60001', nombre: 'SUP PRODUCCION', areaId: 'produccion' }, { nomina: '60002', nombre: 'SUP ADMIN', areaId: 'administrativo' },
      { nomina: '60003', nombre: 'SUP SIN AREA', areaId: '' }, { nomina: '60004', nombre: 'MANUAL', areaId: 'produccion', areaTEManual: 'almacen' },
      { nomina: '50901', nombre: 'LUIS', areaId: 'almacen' },
    ],
    usuarios: [
      { uid: 'u1', nomina: '60001', nombre: 'SUP PRODUCCION', rol: 'superintendente' },
      { uid: 'u2', nomina: '60002', nombre: 'SUP ADMIN', rol: 'superintendente' },
      { uid: 'u3', nomina: '60003', nombre: 'SUP SIN AREA', rol: 'superintendente' },
      { uid: 'u4', nomina: '11', nombre: 'MALDONADO', rol: 'autorizador' },
      { uid: 'u5', nomina: '50296', nombre: 'MARCO', rol: 'rh' },
      { uid: 'u6', nomina: '50532', nombre: 'ANA', rol: 'superintendente' },
    ],
  });

  it('areasTE → aut1 y solicitantes; config → aut2; todo permanente y con el mismo slug', () => {
    const plan = planearMigracion(base());
    const ids = plan.asignaciones.map(a => a.id).sort();
    expect(ids).toEqual(expect.arrayContaining([
      '50610_aut1_produccion', '50611_aut1_produccion', '50532_solicitante_produccion', '50009_solicitante_produccion',
      '50988_aut1_almacen', '50901_solicitante_almacen', '11_aut2_planta', '50296_aut2_planta',
    ]));
    expect(plan.asignaciones.every(a => a.hasta === null)).toBe(true);
    expect(plan.asignaciones.find(a => a.id === '50610_aut1_produccion').nombre).toBe('JEFE');
  });

  it('un área que ya no existe en el catálogo da advertencia y no migra', () => {
    const plan = planearMigracion(base());
    expect(plan.advertencias.join(' ')).toMatch(/fantasma/);
    expect(plan.asignaciones.some(a => a.areaId === 'fantasma')).toBe(false);
  });

  it('superintendentes: solicitante en su área; sin área o en Administrativo se listan y su rol no cambia', () => {
    const plan = planearMigracion(base());
    expect(plan.asignaciones.map(a => a.id)).toContain('60001_solicitante_produccion');
    expect(plan.usuariosCambios.find(u => u.uid === 'u1')).toMatchObject({ rolAntes: 'superintendente', rolDespues: 'usuario' });
    expect(plan.porDecidir.map(p => p.uid).sort()).toEqual(['u2', 'u3']);
    expect(plan.porDecidir.find(p => p.uid === 'u2').motivo).toMatch(/no participa/);
    expect(plan.usuariosCambios.some(u => ['u2', 'u3'].includes(u.uid))).toBe(false);
  });

  it('autorizador pasa a usuario; un superintendente ya solicitante en la matriz no duplica la asignación', () => {
    const plan = planearMigracion(base());
    expect(plan.usuariosCambios.find(u => u.uid === 'u4')).toMatchObject({ rolDespues: 'usuario' });
    expect(plan.asignaciones.filter(a => a.id === '50532_solicitante_produccion')).toHaveLength(1);
    expect(plan.usuariosCambios.find(u => u.uid === 'u5')).toBeUndefined(); // rh no cambia
  });

  it('areaTEManual → areaExcepcion', () => {
    const plan = planearMigracion(base());
    expect(plan.excepciones).toEqual([{ nomina: '60004', nombre: 'MANUAL', areaAntes: 'produccion', areaExcepcion: 'almacen' }]);
  });

  it('accesosTE: solo los vigentes, con sus mismas fechas', () => {
    const plan = planearMigracion({
      ...base(),
      accesosTE: [
        { id: 'a1', nomina: '50874', rol: 'aut1', areaId: 'moldes', desde: dia(10), hasta: dia(20), motivo: 'Vacaciones' },
        { id: 'a2', nomina: '50875', rol: 'aut1', areaId: 'moldes', hasta: dia(5) }, // vencido
        { id: 'a3', nomina: '50876', rol: 'raro', areaId: 'moldes' }, // no se entiende
      ],
    });
    const a = plan.asignaciones.find(x => x.id === '50874_aut1_moldes');
    expect(a).toMatchObject({ hasta: dia(20), motivo: 'Vacaciones' });
    expect(plan.asignaciones.some(x => x.nomina === '50875')).toBe(false);
    expect(plan.advertencias.join(' ')).toMatch(/accesosTE\/a3/);
  });

  it('lo ya migrado no se repite: después de ejecutar no queda nada pendiente', () => {
    const inicial = planearMigracion(base());
    const hecho = inicial.asignaciones.map(a => ({ ...a, activo: true }));
    const datos = base();
    datos.usuarios = datos.usuarios.map(u => (['superintendente', 'autorizador'].includes(u.rol) && !['u2', 'u3'].includes(u.uid) ? { ...u, rol: 'usuario' } : u));
    datos.empleados = datos.empleados.map(e => (e.areaTEManual ? { ...e, areaExcepcion: e.areaTEManual } : e));
    const otra = planearMigracion({ ...datos, asignaciones: hecho });
    expect(otra.asignaciones).toEqual([]);
    expect(otra.excepciones).toEqual([]);
    expect(otra.pendiente).toBe(false);
    expect(otra.yaMigradas).toBeGreaterThan(0); // las de la matriz; los superintendentes ya son "usuario"
  });

  it('lista a quien tendrá un rol pero aún no tiene usuario', () => {
    const plan = planearMigracion(base());
    expect(plan.sinUsuario.map(s => s.nomina)).toContain('50610'); // JEFE no está en usuarios
    expect(plan.sinUsuario.map(s => s.nomina)).not.toContain('50532');
  });
});
