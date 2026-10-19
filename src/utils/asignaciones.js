import { comparar } from './orden.js';

/**
 * asignaciones.js — Roles operativos (aut2 / aut1 / solicitante) asignados a personas. Sin dependencias del navegador.
 *
 *   asignaciones/{nomina}_{rol}_{areaId|planta}
 *     nomina, nombre, puesto y puestoId (copia del padrón al asignar: así el organigrama los muestra a quien no lee ese padrón),
 *     rol, areaId (null en aut2), desde, hasta (null = permanente; fin del día),
 *     motivo, activo, asignadoPor {uid, nombre}, fechaAsignacion
 *
 * Los permisos viven en el ROL: el puesto solo sirve para sugerir candidatos. Revocar = activo:false (nunca se borra).
 * Vigente = activo, desde <= ahora y (sin hasta o ahora <= hasta). Es lo mismo que comprueba firestore.rules.
 */

export const ROL_OP = { AUT2: 'aut2', AUT1: 'aut1', SOLICITANTE: 'solicitante' };
export const ROLES_OP = [ROL_OP.AUT2, ROL_OP.AUT1, ROL_OP.SOLICITANTE];
/** Sufijo del id (y "área" de las reglas) para la Autorización 2, que no es de un área */
export const AREA_PLANTA = 'planta';

export const ROL_OP_LABELS = {
  [ROL_OP.AUT2]: 'Autorización 2',
  [ROL_OP.AUT1]: 'Autorización 1',
  [ROL_OP.SOLICITANTE]: 'Solicitante',
};
export const ROL_OP_CORTOS = {
  [ROL_OP.AUT2]: 'Aut. 2',
  [ROL_OP.AUT1]: 'Aut. 1',
  [ROL_OP.SOLICITANTE]: 'Solicitante',
};

export const ESTADO_ASIGNACION = {
  VIGENTE: 'vigente', PROGRAMADA: 'programada', VENCIDA: 'vencida', REVOCADA: 'revocada',
};
export const ESTADO_LABELS = {
  vigente: 'Vigente', programada: 'Programada', vencida: 'Vencida', revocada: 'Revocada',
};

export const areaDeRol = (rol, areaId) => (rol === ROL_OP.AUT2 ? AREA_PLANTA : String(areaId ?? ''));
export const idAsignacion = (nomina, rol, areaId) => `${String(nomina).trim()}_${rol}_${areaDeRol(rol, areaId)}`;

// ── Fechas ────────────────────────────────────────────────────────────────

/** Timestamp de Firestore, Date, ISO o milisegundos → Date (null si no hay) */
export function aFecha(v) {
  if (v == null || v === '') return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'AAAA-MM-DD' (de un input date) → Date local a las 00:00:00 */
export function inicioDelDia(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, m - 1, d, 0, 0, 0, 0);
}
/** 'AAAA-MM-DD' → Date local a las 23:59:59.999 (la vigencia incluye todo el día "hasta") */
export function finDelDia(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, m - 1, d, 23, 59, 59, 999);
}
/** Date → 'AAAA-MM-DD' local */
export function aIsoLocal(fecha) {
  const f = aFecha(fecha);
  if (!f) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;
}
export function formatoCorto(fecha) {
  const f = aFecha(fecha);
  if (!f) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(f.getDate())}/${p(f.getMonth() + 1)}`;
}
export function formatoFecha(fecha) {
  const f = aFecha(fecha);
  if (!f) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(f.getDate())}/${p(f.getMonth() + 1)}/${f.getFullYear()}`;
}

// ── Estado y vigencia ─────────────────────────────────────────────────────

export function estadoAsignacion(a, ahora = new Date()) {
  const t = aFecha(ahora)?.getTime() ?? Date.now();
  if (a?.activo !== true) return ESTADO_ASIGNACION.REVOCADA;
  const desde = aFecha(a.desde);
  if (desde && desde.getTime() > t) return ESTADO_ASIGNACION.PROGRAMADA;
  const hasta = aFecha(a.hasta);
  if (hasta && t > hasta.getTime()) return ESTADO_ASIGNACION.VENCIDA;
  return ESTADO_ASIGNACION.VIGENTE;
}
export const esVigente = (a, ahora) => estadoAsignacion(a, ahora) === ESTADO_ASIGNACION.VIGENTE;

/**
 * Qué puede hacer una persona según sus asignaciones y su rol del sistema.
 *   esAut2:           tiene Aut. 2 vigente (RH la firma por su rol, pero eso no la hace Aut. 2)
 *   areasAut1:        ids de las áreas donde es Aut. 1 vigente
 *   areasSolicitante: ids de las áreas donde es solicitante vigente
 */
export function calcularAccesos(asignaciones, usuario, ahora = new Date()) {
  const vigentes = (asignaciones ?? []).filter(a => esVigente(a, ahora));
  const areas = (rol) => [...new Set(vigentes.filter(a => a.rol === rol && a.areaId).map(a => a.areaId))];
  const rol = usuario?.rol;
  return {
    esAdmin: rol === 'admin',
    esRH: rol === 'rh' || rol === 'admin',
    esAut2: vigentes.some(a => a.rol === ROL_OP.AUT2),
    areasAut1: areas(ROL_OP.AUT1),
    areasSolicitante: areas(ROL_OP.SOLICITANTE),
    vigentes,
  };
}

// ── Quién puede asignar qué ───────────────────────────────────────────────

/** Roles operativos que esta persona puede dar o quitar: admin todos; RH y Aut. 2, solo aut1 y solicitante */
export function rolesAsignables({ esAdmin, esRH, esAut2 }) {
  if (esAdmin) return [ROL_OP.AUT2, ROL_OP.AUT1, ROL_OP.SOLICITANTE];
  if (esRH || esAut2) return [ROL_OP.AUT1, ROL_OP.SOLICITANTE];
  return [];
}
export const puedeAsignarAlgo = (accesos) => rolesAsignables(accesos).length > 0;

/**
 * ¿Puede `actor` dar/cambiar el rol `rol` en `areaId` a la persona `nominaObjetivo`?
 * `areas` = [{ id, participaTE }]. Nadie, salvo admin, toca sus propias asignaciones.
 * @returns {string|null} el motivo por el que no puede, o null si puede
 */
export function motivoNoPuedeAsignar(actor, { rol, areaId, nominaObjetivo }, areas = []) {
  if (!rolesAsignables(actor).includes(rol)) return 'No tienes permiso para asignar ese rol.';
  if (!actor.esAdmin && String(nominaObjetivo) === String(actor.nomina ?? '')) return 'Nadie puede asignarse un rol a sí mismo.';
  if (rol !== ROL_OP.AUT2) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return 'Elige el área.';
    if (area.participaTE !== true) return `${area.nombre ?? areaId} no participa en tiempo extra.`;
  }
  return null;
}

// ── Etiquetas ─────────────────────────────────────────────────────────────

/** "Solicitante · Producción" / "Aut. 1 · Moldes hasta 20/10" / "Aut. 2" */
export function etiquetaAsignacion(a, nombresArea = new Map()) {
  const base = ROL_OP_CORTOS[a.rol] ?? a.rol;
  const donde = a.rol === ROL_OP.AUT2 ? '' : ` · ${nombresArea.get(a.areaId) ?? a.areaId}`;
  const hasta = aFecha(a.hasta);
  return `${base}${donde}${hasta ? ` hasta ${formatoCorto(hasta)}` : ''}`;
}

// ── Organigrama ───────────────────────────────────────────────────────────

/** Nivel jerárquico del puesto (entero >= 1, 1 = el más alto) o null si no tiene */
export const nivelJerarquicoValido = (n) => (Number.isInteger(n) && n >= 1 ? n : null);

/**
 * Organigrama de autorización, SOLO de las asignaciones vigentes (forma de la hoja "Niveles de autorización"):
 * arriba Aut. 2; debajo una columna por área con participaTE (en orden): su Aut. 1 y sus solicitantes.
 *
 * @param {object} p
 * @param {object[]} p.asignaciones   todas (se filtran las vigentes)
 * @param {object[]} p.areas          [{ id, nombre, participaTE, activa, orden }]
 * @param {Map|object} p.empleados    nómina → { nombre, puesto, puestoId }
 * @param {object[]} [p.puestos]      catálogo de puestos [{ id, nivelJerarquico }]: ordena cada lista (menor = más alto; sin nivel, al final)
 * @param {Set<string>|null} p.nominasConUsuario  null = no se sabe (quien ve no puede leer usuarios)
 */
export function construirOrganigrama({ asignaciones, areas, empleados, puestos = [], nominasConUsuario = null, ahora = new Date() }) {
  const nivelPorPuesto = new Map((puestos ?? []).map(p => [p.id, nivelJerarquicoValido(p.nivelJerarquico)]));
  const emp = empleados instanceof Map ? empleados : new Map(Object.entries(empleados ?? {}));
  const vigentes = (asignaciones ?? []).filter(a => esVigente(a, ahora));

  const tarjeta = (a) => {
    const e = emp.get(String(a.nomina));
    const hasta = aFecha(a.hasta);
    return {
      id: a.id ?? idAsignacion(a.nomina, a.rol, a.areaId),
      nomina: String(a.nomina),
      nombre: e?.nombre ?? a.nombre ?? String(a.nomina),
      // El puesto guardado en la asignación manda: quien ve el árbol (un Aut. 1) no puede leer el padrón de otras áreas
      puesto: a.puesto || e?.puesto || '',
      rol: a.rol,
      areaId: a.areaId ?? null,
      puestoId: a.puestoId || e?.puestoId || '',
      nivelJerarquico: nivelPorPuesto.get(a.puestoId || e?.puestoId) ?? null,
      temporalHasta: hasta,
      sinUsuario: nominasConUsuario ? !nominasConUsuario.has(String(a.nomina)) : false,
    };
  };
  // Por nivel jerárquico del puesto (el número más bajo primero; sin nivel, al final) y, si empatan, por nombre
  const porJerarquia = (x, y) => (x.nivelJerarquico ?? Infinity) - (y.nivelJerarquico ?? Infinity) || comparar(x.nombre, y.nombre);

  const columnas = [...(areas ?? [])]
    .filter(a => a.participaTE === true && a.activa !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.nombre).localeCompare(String(b.nombre), 'es'))
    .map(area => {
      const de = (rol) => vigentes.filter(a => a.rol === rol && a.areaId === area.id).map(tarjeta).sort(porJerarquia);
      const aut1 = de(ROL_OP.AUT1);
      return { area, aut1, solicitantes: de(ROL_OP.SOLICITANTE), sinAut1: aut1.length === 0 };
    });

  const aut2 = vigentes.filter(a => a.rol === ROL_OP.AUT2).map(tarjeta).sort(porJerarquia);
  return { aut2, columnas };
}

// ── Bitácora ──────────────────────────────────────────────────────────────

/** Copia plana de una asignación para la bitácora (fechas ISO, sin Timestamps) */
export function resumenParaBitacora(a) {
  if (!a) return null;
  const iso = (v) => aFecha(v)?.toISOString() ?? null;
  return {
    id: a.id ?? idAsignacion(a.nomina, a.rol, a.areaId),
    nomina: String(a.nomina), nombre: a.nombre ?? '', rol: a.rol, areaId: a.areaId ?? null,
    desde: iso(a.desde), hasta: iso(a.hasta), motivo: a.motivo ?? '', activo: a.activo === true,
    ...(a.motivoRevocacion ? { motivoRevocacion: a.motivoRevocacion } : {}),
  };
}

// ── Privacidad del organigrama ────────────────────────────────────────────

/** Nivel de autorización de cada rol: quien ve el árbol compara su nivel con el de la persona */
export const NIVEL_DE_ROL = { [ROL_OP.SOLICITANTE]: 0, [ROL_OP.AUT1]: 1, [ROL_OP.AUT2]: 2 };

export const VISTA_PERSONA = { COMPLETA: 'completa', BASICA: 'basica', BLOQUEADA: 'bloqueada' };

/** Nivel de quien mira: RH y admin ven todo (3); Aut. 2 → 2; Aut. 1 → 1; el resto, 0 */
export function nivelDeActor({ esRH, esAut2, esAut1 }) {
  return esRH ? 3 : esAut2 ? 2 : esAut1 ? 1 : 0;
}

/** Nivel más alto que tiene una persona entre sus asignaciones vigentes (-1 si no tiene ninguna) */
export function nivelDePersona(nomina, asignaciones, ahora = new Date()) {
  return (asignaciones ?? [])
    .filter(a => String(a.nomina) === String(nomina) && esVigente(a, ahora))
    .reduce((max, a) => Math.max(max, NIVEL_DE_ROL[a.rol] ?? -1), -1);
}

/**
 * Qué puede ver `actor` de una persona de nivel `nivelPersona`:
 *   RH y admin: completa. Niveles superiores al suyo: bloqueada (sin clic ni panel).
 *   Aut. 2: completa de los niveles inferiores y básica de otros Aut. 2. Aut. 1 y demás: básica de su nivel y de los inferiores.
 */
export function vistaDePersona(actor, nivelPersona) {
  if (actor.esRH) return VISTA_PERSONA.COMPLETA;
  if (nivelPersona > nivelDeActor(actor)) return VISTA_PERSONA.BLOQUEADA;
  if (actor.esAut2 && nivelPersona < NIVEL_DE_ROL[ROL_OP.AUT2]) return VISTA_PERSONA.COMPLETA;
  return VISTA_PERSONA.BASICA;
}

// ── Nombre, puesto y puestoId guardados en la asignación ────────────────────────────

/**
 * Asignaciones cuyo nombre o puesto guardado difiere del padrón ("Actualizar nombres y puestos de las asignaciones").
 * Quien no está en el padrón no se toca, y un dato vacío del padrón nunca borra el que ya hay.
 * @returns {{ cambios: { id, asignacion, nombre, puesto, cambia }[], sinPadron: object[], alDia: number }}
 */
export function planActualizarDatos(asignaciones, empleados) {
  const porNomina = empleados instanceof Map ? empleados : new Map((empleados ?? []).map(e => [String(e.nomina), e]));
  const cambios = [];
  const sinPadron = [];
  let alDia = 0;
  for (const a of asignaciones ?? []) {
    const e = porNomina.get(String(a.nomina));
    if (!e) { sinPadron.push(a); continue; }
    const nombre = String(e.nombre ?? '').trim() || a.nombre || '';
    const puesto = String(e.puesto ?? '').trim() || a.puesto || '';
    const puestoId = String(e.puestoId ?? '').trim() || a.puestoId || '';
    const cambia = {};
    if (nombre !== (a.nombre ?? '')) cambia.nombre = { antes: a.nombre ?? '', despues: nombre };
    if (puesto !== (a.puesto ?? '')) cambia.puesto = { antes: a.puesto ?? '', despues: puesto };
    if (puestoId !== (a.puestoId ?? '')) cambia.puestoId = { antes: a.puestoId ?? '', despues: puestoId };
    if (Object.keys(cambia).length === 0) { alDia++; continue; }
    cambios.push({ id: a.id ?? idAsignacion(a.nomina, a.rol, a.areaId), asignacion: a, nombre, puesto, puestoId, cambia });
  }
  return { cambios, sinPadron, alDia };
}
