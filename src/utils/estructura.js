/**
 * estructura.js — Modelo ÁREAS → PUESTOS → EMPLEADOS (sin dependencias del navegador; se prueba en Node).
 *
 *  areas/{areaId}     { nombre, participaTE, activa, orden }
 *  puestos/{puestoId} { nombre (mayúsculas), areaId, activo, alias[], fechaCreacion, creadoPor }
 *  empleados          + puestoId, areaId (efectiva), areaExcepcion (areaId|null), areaExcepcionMotivo
 *
 * Área efectiva = areaExcepcion si existe; si no, el área del puesto. El departamento (depto) es solo informativo.
 */
import { clavePuesto, normalizarPuesto, slugPuesto } from './puestos.js';

export const AREA_ADMIN = 'administrativo';

/** Áreas iniciales (id = slug del nombre) */
export const AREAS_INICIALES = [
  { id: 'produccion', nombre: 'Producción', participaTE: true, orden: 1 },
  { id: 'almacen', nombre: 'Almacén', participaTE: true, orden: 2 },
  { id: 'calidad', nombre: 'Calidad', participaTE: true, orden: 3 },
  { id: 'mantenimiento', nombre: 'Mantenimiento', participaTE: true, orden: 4 },
  { id: 'moldes', nombre: 'Moldes', participaTE: true, orden: 5 },
  { id: AREA_ADMIN, nombre: 'Administrativo', participaTE: false, orden: 6 },
];

/** Catálogo inicial de puestos por área, como vienen en el reporte de nómina */
export const PUESTOS_INICIALES_POR_AREA = {
  produccion: [
    'PRODUCTION OPERATOR', 'PRODUCTION SUPERVISOR', 'PRODUCTION SUPERINTENDENT', 'MANUFACTURING / PROCESS MANAGER',
    'MANUFACTURING AND CONTINUOS IMPROVEMENT ENGINEER', 'PROCESS ENGINEER', 'TOOL CHANGES', 'RESINER', 'SCRAP MILLER',
  ],
  calidad: [
    'QUALITY INSPECTOR', 'QUALITY AUDITOR', 'QUALITY ENGINEER', 'QUALITY MANAGER', 'METROLOGIST', 'METROLOGY COORDINATOR',
  ],
  almacen: [
    'FORKLIFT OPERATOR', 'FORK LIFT DRIVER', 'WAREHOUSE SUPERVISOR', 'MATERIALS ASSISTANT', 'MATERIALS MANAGER',
    'CUSTOMER SERVICE', 'PRODUCTION PLANNER',
  ],
  mantenimiento: ['MAINTENANCE TECHNICIAN', 'MAINTENANCE SUPERVISOR', 'MAINTENANCE ENGINEER /CONTROLS'],
  moldes: ['MOLDS TECHNICIAN', 'MOLDS SUPERVISOR', 'MOLDS COORDINATOR', 'MOLD MAKING TECHNICIAN'],
  administrativo: [
    'PROGRAM MANAGEMENT / LAUNCH', 'OPERATIONS DIRECTOR', 'ADMINISTRATIVE MANAGER', 'TRAINING SUPERVISOR',
    'CLERK / PERSONNEL ANALYST', 'EHS LEADER', 'SAFE MANAGEMENT', 'ACCOUNT MANAGER', 'IT ANALYST',
    'CORPORATE PLANNING & INVENTORY MANAGER', 'MRO COMMODITY BUYER',
  ],
};

/** [{ id, nombre, areaId, activo, alias }] del catálogo inicial */
export const PUESTOS_INICIALES = Object.entries(PUESTOS_INICIALES_POR_AREA)
  .flatMap(([areaId, nombres]) => nombres.map(n => ({ id: slugPuesto(n), nombre: normalizarPuesto(n), areaId, activo: true, alias: [] })));

const esActivoDoc = (d) => d?.activo !== false && d?.activa !== false;

/** Área efectiva de un empleado: excepción o la de su puesto ('' si el puesto no tiene área) */
export function areaEfectiva(emp, puestosPorId) {
  if (emp?.areaExcepcion) return emp.areaExcepcion;
  return puestosPorId.get(emp?.puestoId)?.areaId ?? '';
}

/** Id libre para un puesto nuevo (agrega -2, -3... si el slug ya existe con otro nombre) */
export function idPuestoLibre(nombre, idsOcupados) {
  const base = slugPuesto(nombre) || 'puesto';
  let id = base;
  for (let n = 2; idsOcupados.has(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Empleados que se moverían si el puesto cambia de área (se excluyen los que tienen excepción).
 * @returns {{ mover: object[], conExcepcion: object[] }}
 */
export function impactoCambioArea(empleados, puestoId, areaIdNueva) {
  const delPuesto = empleados.filter(e => e.puestoId === puestoId && esActivoDoc(e));
  return {
    mover: delPuesto.filter(e => !e.areaExcepcion && e.areaId !== areaIdNueva),
    conExcepcion: delPuesto.filter(e => !!e.areaExcepcion),
  };
}

/** Una baja de área solo es posible si no le quedan puestos activos */
export const puestosActivosDeArea = (puestos, areaId) => puestos.filter(p => p.areaId === areaId && p.activo !== false);

/**
 * Propuesta para "Crear estructura inicial": qué áreas/puestos se crean o se completan,
 * y cómo se equiparan las áreas viejas con las nuevas (por nombre) para los areaIds de los usuarios.
 * Nunca decide nada: solo describe.
 * @param existentes { areas: [{id,...}], puestos: [{id,...}] }
 * @param usuarios   [{ uid, nombre, areaIds? }]
 */
export function proponerEstructuraInicial({ areas, puestos }, usuarios = []) {
  const areasPorId = new Map(areas.map(a => [a.id, a]));
  const puestosPorId = new Map(puestos.map(p => [p.id, p]));
  const areasNuevas = AREAS_INICIALES.map(a => {
    const ex = areasPorId.get(a.id);
    if (!ex) return { ...a, accion: 'crear' };
    const faltan = ['participaTE', 'activa', 'orden'].filter(k => ex[k] === undefined);
    return { ...a, accion: faltan.length ? 'completar' : 'existe', faltan, actual: ex };
  });
  const puestosNuevos = PUESTOS_INICIALES.map(p => ({ ...p, accion: puestosPorId.has(p.id) ? 'existe' : 'crear' }));

  // Áreas viejas (cualquier doc de areas que no sea una de las 6) → área nueva con el mismo nombre
  const idsNuevas = new Set(AREAS_INICIALES.map(a => a.id));
  const porNombre = new Map(AREAS_INICIALES.map(a => [clavePuesto(a.nombre), a]));
  const heredadas = areas.filter(a => !idsNuevas.has(a.id)).map(a => {
    const equiv = porNombre.get(clavePuesto(a.nombre ?? '')) ?? null;
    return { id: a.id, nombre: a.nombre ?? '(sin nombre)', equivale: equiv?.id ?? null, equivaleNombre: equiv?.nombre ?? null };
  });
  const mapa = new Map(heredadas.filter(h => h.equivale).map(h => [h.id, h.equivale]));
  const usuariosAfectados = usuarios
    .filter(u => (u.areaIds ?? []).some(id => mapa.has(id)))
    .map(u => {
      const antes = u.areaIds ?? [];
      const despues = [...new Set(antes.map(id => mapa.get(id) ?? id))];
      return { uid: u.uid, nombre: u.nombre ?? u.uid, antes, despues };
    });
  const sinEquivalencia = [...new Set(usuarios.flatMap(u => u.areaIds ?? []))]
    .filter(id => !idsNuevas.has(id) && !mapa.has(id));
  return { areasNuevas, puestosNuevos, heredadas, usuariosAfectados, sinEquivalencia };
}

/** Documento de bitácora (sin `fecha`: la pone el servidor al guardar) */
export const registroBitacora = ({ accion, entidad, antes = null, despues = null }, usuario) => ({
  accion, entidad, antes, despues,
  porUid: usuario?.uid ?? '',
  porNombre: usuario?.nombre ?? '',
});

/** Alias nuevo para un puesto: texto normalizado, sin duplicar el nombre ni alias existentes */
export function aliasNuevo(puesto, texto) {
  const alias = normalizarPuesto(texto);
  const ya = [puesto.nombre, ...(puesto.alias ?? [])].some(x => clavePuesto(x) === clavePuesto(alias));
  return ya || !alias ? null : alias;
}
