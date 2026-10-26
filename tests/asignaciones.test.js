// Asignaciones (vigencia, permisos, organigrama) y carga inicial. Datos ficticios en memoria.
// Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import {
  calcularAccesos, construirOrganigrama, estadoAsignacion, etiquetaAsignacion, finDelDia, formatoCorto, idAsignacion, inicioDelDia,
  motivoNoPuedeAsignar, nivelDePersona, planActualizarDatos, rolesAsignables, vistaDePersona,
} from '../src/utils/asignaciones.js';
import { PROPUESTAS_INICIALES, evaluarPropuestas, nombreCoincide } from '../src/utils/cargaInicial.js';

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
  it('varios Aut. 2 vigentes salen todos, ordenados por nivel del puesto y luego por nombre', () => {
    const emps = new Map([
      ['11', { nombre: 'MALDONADO SALVADOR', puesto: 'GERENTE', puestoId: 'gerente' }],
      ['12', { nombre: 'ESPINOSA MARCO', puesto: 'DIRECTOR', puestoId: 'director' }],
      ['13', { nombre: 'ARIAS BEATRIZ', puesto: 'GERENTE', puestoId: 'gerente' }],
      ['14', { nombre: 'ZAMORA PEDRO', puesto: 'ANALISTA', puestoId: 'analista' }],
    ]);
    const puestos = [{ id: 'director', nivelJerarquico: 1 }, { id: 'gerente', nivelJerarquico: 2 }, { id: 'analista' }];
    const varios = construirOrganigrama({
      asignaciones: [asig('11', 'aut2', null), asig('12', 'aut2', null), asig('13', 'aut2', null), asig('14', 'aut2', null), asig('15', 'aut2', null, { activo: false })],
      areas, empleados: emps, puestos, ahora: HOY,
    });
    expect(varios.aut2.map(t => t.nombre)).toEqual(['ESPINOSA MARCO', 'ARIAS BEATRIZ', 'MALDONADO SALVADOR', 'ZAMORA PEDRO']);
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

describe('carga inicial de asignaciones', () => {
  const padron = (nomina, nombre, areaId, puesto = 'P') => ({ nomina, nombre, areaId, puesto });
  const todos = PROPUESTAS_INICIALES.map(p => padron(p.nomina, `${p.nombre.split(' ').slice(-1)[0].toUpperCase()} ${p.nombre.split(' ')[0].toUpperCase()}`, p.areaId ?? 'administrativo'));

  it('propone las 16 asignaciones de la hoja, todas con casilla marcada si todo coincide', () => {
    expect(PROPUESTAS_INICIALES).toHaveLength(16);
    const filas = evaluarPropuestas({ empleados: todos, usuarios: PROPUESTAS_INICIALES.map(p => ({ nomina: p.nomina })), asignaciones: [], ahora: HOY });
    expect(filas.every(f => f.estado === 'listo' && f.marcada && f.seleccionable)).toBe(true);
    expect(filas.every(f => f.avisos.length === 0)).toBe(true);
  });
  it('el nombre sale del padrón; apellidos primero y nombres compuestos coinciden', () => {
    expect(nombreCoincide('Luis Rodolfo Pérez', 'PEREZ GARCIA LUIS RODOLFO')).toBe(true);
    expect(nombreCoincide('José Juan González', 'GONZALEZ JOSE JUAN')).toBe(true);
    expect(nombreCoincide('Ismael Gómez', 'LOPEZ MARTINEZ PEDRO')).toBe(false);
    const filas = evaluarPropuestas({ empleados: [padron('50610', 'GOMEZ ROBLES ISMAEL', 'produccion')], usuarios: null, asignaciones: [], ahora: HOY });
    expect(filas.find(f => f.nomina === '50610').nombre).toBe('GOMEZ ROBLES ISMAEL');
  });
  it('estados: ya existe, no está en el padrón, área distinta, sin usuario y revisar nombre', () => {
    const empleados = [
      padron('50610', 'GOMEZ ISMAEL', 'produccion'),        // ya existe
      padron('50988', 'MEDRANO LEZLI', 'calidad'),          // área distinta
      padron('50712', 'PEREZ JUAN', 'calidad'),             // nombre distinto
      padron('50440', 'MENDOZA ANSELMO', 'mantenimiento'),  // sin usuario
    ];
    const filas = evaluarPropuestas({
      empleados, usuarios: [{ nomina: '50610' }, { nomina: '50988' }, { nomina: '50712' }],
      asignaciones: [asig('50610', 'aut1', 'produccion')], ahora: HOY,
    });
    const de = (n, rol = 'aut1') => filas.find(f => f.nomina === n && f.rol === rol);
    expect(de('50610')).toMatchObject({ estado: 'ya-existe', seleccionable: false, marcada: false });
    expect(de('50999') ?? null).toBeNull();
    expect(de('50874')).toMatchObject({ estado: 'no-padron', seleccionable: false });
    expect(de('50988')).toMatchObject({ estado: 'listo', marcada: true, avisos: ['area-distinta'] });
    expect(de('50712')).toMatchObject({ marcada: false, avisos: ['revisar-nombre'] });
    expect(de('50440')).toMatchObject({ marcada: true, avisos: ['sin-usuario'] });
  });
  it('es idempotente: lo ya creado sale como "Ya existe"; lo revocado se puede volver a crear', () => {
    const creadas = PROPUESTAS_INICIALES.map(p => asig(p.nomina, p.rol, p.areaId));
    const otra = evaluarPropuestas({ empleados: todos, usuarios: null, asignaciones: creadas, ahora: HOY });
    expect(otra.every(f => f.estado === 'ya-existe')).toBe(true);
    const revocada = creadas.map((a, i) => (i === 0 ? { ...a, activo: false } : a));
    const de = evaluarPropuestas({ empleados: todos, usuarios: null, asignaciones: revocada, ahora: HOY });
    expect(de[0]).toMatchObject({ estado: 'listo', seleccionable: true });
  });
});

describe('orden por nivel jerárquico del puesto', () => {
  const puestos = [
    { id: 'op-dir', nivelJerarquico: 1 }, { id: 'adm-mgr', nivelJerarquico: 2 }, { id: 'sup', nivelJerarquico: 3 }, { id: 'sin-nivel' },
  ];
  it('con OPERATIONS DIRECTOR = 1 y ADMINISTRATIVE MANAGER = 2, Salvador va antes que Marco sin importar nombre ni orden de creación', () => {
    const asignaciones = [
      asig('1', 'aut2', null, { nombre: 'ACOSTA MARCO', puesto: 'ADMINISTRATIVE MANAGER', puestoId: 'adm-mgr' }),
      asig('2', 'aut2', null, { nombre: 'ZAMORA SALVADOR', puesto: 'OPERATIONS DIRECTOR', puestoId: 'op-dir' }),
    ];
    for (const lista of [asignaciones, [...asignaciones].reverse()]) {
      const org = construirOrganigrama({ asignaciones: lista, areas: [], empleados: new Map(), puestos, ahora: HOY });
      expect(org.aut2.map(t => t.nombre)).toEqual(['ZAMORA SALVADOR', 'ACOSTA MARCO']);
    }
  });
  it('si empatan, por nombre; sin nivel o sin puesto, al final', () => {
    const org = construirOrganigrama({
      asignaciones: [
        asig('1', 'aut2', null, { nombre: 'SIN PUESTO' }),
        asig('2', 'aut2', null, { nombre: 'SIN NIVEL', puestoId: 'sin-nivel' }),
        asig('3', 'aut2', null, { nombre: 'ZETA', puestoId: 'sup' }),
        asig('4', 'aut2', null, { nombre: 'ALFA', puestoId: 'sup' }),
        asig('5', 'aut2', null, { nombre: 'OMEGA', puestoId: 'op-dir' }),
      ],
      areas: [], empleados: new Map(), puestos, ahora: HOY,
    });
    expect(org.aut2.map(t => t.nombre)).toEqual(['OMEGA', 'ALFA', 'ZETA', 'SIN NIVEL', 'SIN PUESTO']);
  });
  it('ordena igual el Aut. 1 y los solicitantes de cada área; el puestoId de la asignación manda sobre el del padrón', () => {
    const org = construirOrganigrama({
      asignaciones: [
        asig('1', 'aut1', 'moldes', { nombre: 'B BAJO', puestoId: 'sup' }),
        asig('2', 'aut1', 'moldes', { nombre: 'C ALTO', puestoId: 'op-dir' }),
        asig('3', 'solicitante', 'moldes', { nombre: 'A SUP', puestoId: 'sup' }),
        asig('4', 'solicitante', 'moldes', { nombre: 'Z DIR', puestoId: 'op-dir' }),
        asig('5', 'solicitante', 'moldes', { nombre: 'M PADRON' }),
      ],
      areas: [{ id: 'moldes', nombre: 'Moldes', participaTE: true, activa: true }],
      empleados: new Map([['5', { nombre: 'M PADRON', puestoId: 'adm-mgr' }]]), puestos, ahora: HOY,
    });
    expect(org.columnas[0].aut1.map(t => t.nomina)).toEqual(['2', '1']);
    expect(org.columnas[0].solicitantes.map(t => t.nomina)).toEqual(['4', '5', '3']);
  });
  it('un nivel que no es entero >= 1 se ignora', () => {
    const org = construirOrganigrama({
      asignaciones: [asig('1', 'aut2', null, { nombre: 'A', puestoId: 'x' }), asig('2', 'aut2', null, { nombre: 'B', puestoId: 'y' })],
      areas: [], empleados: new Map(), puestos: [{ id: 'x', nivelJerarquico: 0 }, { id: 'y', nivelJerarquico: 2.5 }], ahora: HOY,
    });
    expect(org.aut2.map(t => t.nivelJerarquico)).toEqual([null, null]);
  });
});

describe('puesto guardado en la asignación', () => {
  it('el organigrama muestra el puesto de la asignación aunque quien mira no lea el padrón', () => {
    const org = construirOrganigrama({
      asignaciones: [asig('11', 'aut2', null, { puesto: 'DIRECTOR DE PLANTA' })], areas: [], empleados: new Map(), ahora: HOY,
    });
    expect(org.aut2[0].puesto).toBe('DIRECTOR DE PLANTA');
  });
  it('sin puesto guardado usa el del padrón (si se puede leer) y si no, queda vacío', () => {
    const con = construirOrganigrama({ asignaciones: [asig('11', 'aut2', null)], areas: [], empleados: new Map([['11', { nombre: 'X', puesto: 'GERENTE' }]]), ahora: HOY });
    expect(con.aut2[0].puesto).toBe('GERENTE');
    const sin = construirOrganigrama({ asignaciones: [asig('11', 'aut2', null)], areas: [], empleados: new Map(), ahora: HOY });
    expect(sin.aut2[0].puesto).toBe('');
  });
});

describe('privacidad del organigrama', () => {
  const rh = { esRH: true, esAdmin: false, esAut2: false, esAut1: false };
  const aut2 = { esRH: false, esAdmin: false, esAut2: true, esAut1: false };
  const aut1 = { esRH: false, esAdmin: false, esAut2: false, esAut1: true };
  it('RH y admin ven todo completo', () => {
    for (const nivel of [0, 1, 2]) expect(vistaDePersona(rh, nivel)).toBe('completa');
  });
  it('el Aut. 1 no puede abrir a la Aut. 2; ve básico a su nivel y a los solicitantes', () => {
    expect(vistaDePersona(aut1, 2)).toBe('bloqueada');
    expect(vistaDePersona(aut1, 1)).toBe('basica');
    expect(vistaDePersona(aut1, 0)).toBe('basica');
  });
  it('la Aut. 2 ve completo hacia abajo, pero solo básico a otros Aut. 2', () => {
    expect(vistaDePersona(aut2, 1)).toBe('completa');
    expect(vistaDePersona(aut2, 0)).toBe('completa');
    expect(vistaDePersona(aut2, 2)).toBe('basica');
  });
  it('una persona se trata por su nivel más alto vigente', () => {
    const lista = [asig('9', 'solicitante', 'moldes'), asig('9', 'aut2', null), asig('8', 'aut1', 'moldes', { activo: false })];
    expect(nivelDePersona('9', lista, HOY)).toBe(2);
    expect(nivelDePersona('8', lista, HOY)).toBe(-1); // revocada
    expect(vistaDePersona(aut1, nivelDePersona('9', lista, HOY))).toBe('bloqueada');
  });
});

describe('actualizar nombres y puestos de las asignaciones', () => {
  const padron = [
    { nomina: '1', nombre: 'ACOSTA MARCOS', puesto: 'SUPERVISOR', puestoId: 'supervisor' },
    { nomina: '2', nombre: 'BARRIOS LUIS', puesto: '' },
    { nomina: '3', nombre: 'CARRERA JOEL', puesto: 'OPERADOR' },
  ];
  it('copia lo que falta, no toca lo que ya coincide ni a quien no está en el padrón, y un puesto vacío no borra el existente', () => {
    const plan = planActualizarDatos([
      asig('1', 'solicitante', 'moldes', { nombre: 'ACOSTA MARCOS' }),                    // falta el puesto
      asig('2', 'aut1', 'moldes', { nombre: 'BARRIOS', puesto: 'JEFE DE AREA' }),         // el padrón no trae puesto: se conserva
      asig('3', 'solicitante', 'moldes', { nombre: 'CARRERA JOEL', puesto: 'OPERADOR' }), // ya al día
      asig('99', 'solicitante', 'moldes', { nombre: 'FUERA' }),                           // no está en el padrón
    ], padron);
    expect(plan.cambios.map(c => [c.asignacion.nomina, c.nombre, c.puesto])).toEqual([
      ['1', 'ACOSTA MARCOS', 'SUPERVISOR'],
      ['2', 'BARRIOS LUIS', 'JEFE DE AREA'],
    ]);
    expect(plan.cambios[0].cambia).toEqual({ puesto: { antes: '', despues: 'SUPERVISOR' }, puestoId: { antes: '', despues: 'supervisor' } });
    expect(plan.cambios[0].puestoId).toBe('supervisor');
    expect(plan.cambios[1].cambia).toEqual({ nombre: { antes: 'BARRIOS', despues: 'BARRIOS LUIS' } });
    expect(plan.alDia).toBe(1);
    expect(plan.sinPadron.map(a => a.nomina)).toEqual(['99']);
  });
});

describe('accesosDeAdmin: el admin tiene todos los permisos de todos los roles, siempre', () => {
  it('es Aut. 2, Aut. 1 y solicitante de todas las áreas que participan, además de RH', async () => {
    const { accesosDeAdmin, calcularAccesos } = await import('../src/utils/asignaciones.js');
    const a = accesosDeAdmin(calcularAccesos([], { rol: 'admin' }), ['moldes', 'produccion']);
    expect(a).toMatchObject({ esAdmin: true, esRH: true, esAut2: true, areasAut1: ['moldes', 'produccion'], areasSolicitante: ['moldes', 'produccion'] });
  });
  it('los demás roles no ganan nada', async () => {
    const { accesosDeAdmin, calcularAccesos } = await import('../src/utils/asignaciones.js');
    for (const rol of ['rh', 'nomina', 'usuario']) {
      expect(accesosDeAdmin(calcularAccesos([], { rol }), ['moldes'])).toMatchObject({ esAut2: false, areasAut1: [], areasSolicitante: [] });
    }
  });
});
