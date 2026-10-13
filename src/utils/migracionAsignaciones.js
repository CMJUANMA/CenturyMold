/**
 * migracionAsignaciones.js — Pasa del modelo anterior (matriz areasTE + config/tiempoExtra + roles superintendente/autorizador)
 * al modelo de asignaciones. Sin dependencias del navegador: planearMigracion solo calcula, no escribe (se prueba en Node).
 *
 * Qué migra:
 *   areasTE.autorizador1Nomina / suplente1Nomina   → aut1 permanente del área (mismo slug)
 *   areasTE.solicitantesNominas                    → solicitante permanente del área
 *   config/tiempoExtra autorizador2 / suplente2    → aut2 permanente
 *   accesosTE vigentes (si existen)                → asignaciones con sus mismas fechas
 *   usuarios superintendente                       → rol usuario + solicitante en el área de su padrón (areaId);
 *                                                    sin área, o en un área que no participa en TE → se listan para decidir
 *                                                    (su rol NO se cambia mientras tanto)
 *   usuarios autorizador                           → rol usuario
 *   empleados.areaTEManual                         → areaExcepcion (+ areaId y motivo)
 * Lo ya migrado (asignación activa con ese id) se omite: simular otra vez después de ejecutar da "nada pendiente".
 */
import { ROL_OP, aFecha, idAsignacion } from './asignaciones.js';

export const MOTIVO_MIGRACION = 'Migrado del modelo anterior';

const norm = (v) => String(v ?? '').trim();

/** Primer campo presente de un objeto */
const primero = (o, ...campos) => campos.map(c => o?.[c]).find(v => v != null && v !== '');

/** Rol de un accesosTE, tolerando nombres anteriores (autorizador1, aut1, solicitante…) */
function rolDeAcceso(a) {
  const t = norm(primero(a, 'rol', 'tipo', 'nivel')).toLowerCase();
  if (['aut2', 'autorizador2', 'autorizacion2', '2'].includes(t)) return ROL_OP.AUT2;
  if (['aut1', 'autorizador1', 'autorizacion1', 'suplente1', '1'].includes(t)) return ROL_OP.AUT1;
  if (['solicitante', 'solicitantes'].includes(t)) return ROL_OP.SOLICITANTE;
  return null;
}

/**
 * @param {object} p
 * @param {object[]} p.usuarios      [{ uid, nomina, nombre, rol, activo }]
 * @param {object[]} p.areasTE       [{ id, nombre, autorizador1Nomina, suplente1Nomina, solicitantesNominas, activa }]
 * @param {object|null} p.configTE   config/tiempoExtra { autorizador2Nomina, suplente2Nomina }
 * @param {object[]} p.accesosTE     accesosTE/* (puede ser [])
 * @param {object[]} p.empleados     [{ nomina, nombre, areaId, areaExcepcion, areaTEManual }]
 * @param {object[]} p.areas         catálogo areas/* [{ id, nombre, participaTE }]
 * @param {object[]} p.asignaciones  asignaciones que ya existen (para no repetir)
 * @param {Date} p.ahora
 */
export function planearMigracion({
  usuarios = [], areasTE = [], configTE = null, accesosTE = [], empleados = [], areas = [], asignaciones = [], ahora = new Date(),
}) {
  const areaPorId = new Map(areas.map(a => [a.id, a]));
  const empleadoPorNomina = new Map(empleados.map(e => [norm(e.nomina), e]));
  const usuarioPorNomina = new Map(usuarios.map(u => [norm(u.nomina), u]));
  const yaActivas = new Set(asignaciones.filter(a => a.activo === true).map(a => a.id));
  const advertencias = [];

  const nombreDe = (nomina) => empleadoPorNomina.get(nomina)?.nombre || usuarioPorNomina.get(nomina)?.nombre || nomina;
  const participa = (areaId) => areaPorId.get(areaId)?.participaTE === true;

  const plan = new Map(); // id → asignación a crear
  const yaMigradas = new Set();
  const agregar = ({ nomina, rol, areaId = null, desde = null, hasta = null, motivo = MOTIVO_MIGRACION, origen }) => {
    nomina = norm(nomina);
    if (!nomina) return;
    if (rol !== ROL_OP.AUT2) {
      if (!areaPorId.has(areaId)) { advertencias.push(`${origen}: el área "${areaId}" no existe en el catálogo; no se migró a ${nomina}.`); return; }
      if (!participa(areaId)) { advertencias.push(`${origen}: ${areaPorId.get(areaId).nombre} no participa en tiempo extra; no se migró a ${nomina}.`); return; }
    }
    const id = idAsignacion(nomina, rol, areaId);
    if (yaActivas.has(id)) { yaMigradas.add(id); return; }
    const nueva = { id, nomina, nombre: nombreDe(nomina), rol, areaId: rol === ROL_OP.AUT2 ? null : areaId, desde, hasta, motivo, origen };
    const previa = plan.get(id);
    // Si ya hay una permanente, la temporal sobra; si la nueva es permanente, reemplaza a la temporal
    if (previa && (previa.hasta === null || nueva.hasta !== null)) return;
    plan.set(id, nueva);
  };

  // 1. Matriz de áreas
  for (const area of areasTE) {
    const origen = `areasTE/${area.id}`;
    for (const n of [area.autorizador1Nomina, area.suplente1Nomina]) agregar({ nomina: n, rol: ROL_OP.AUT1, areaId: area.id, origen });
    for (const n of area.solicitantesNominas ?? []) agregar({ nomina: n, rol: ROL_OP.SOLICITANTE, areaId: area.id, origen });
  }
  // 2. Aut. 2
  for (const n of [configTE?.autorizador2Nomina, configTE?.suplente2Nomina]) agregar({ nomina: n, rol: ROL_OP.AUT2, origen: 'config/tiempoExtra' });

  // 3. Accesos temporales vigentes
  for (const a of accesosTE) {
    const origen = `accesosTE/${a.id}`;
    const rol = rolDeAcceso(a);
    const nomina = primero(a, 'nomina', 'nominaNueva');
    const hasta = aFecha(a.hasta ?? a.fin);
    const desde = aFecha(a.desde ?? a.inicio);
    if (a.activo === false) continue;
    if (hasta && hasta.getTime() < ahora.getTime()) continue; // vencido: no se migra
    if (!rol || !nomina) { advertencias.push(`${origen}: no se entendió (rol o nómina faltan); no se migró.`); continue; }
    agregar({ nomina, rol, areaId: primero(a, 'areaId', 'area') ?? null, desde, hasta, motivo: norm(a.motivo) || MOTIVO_MIGRACION, origen });
  }

  // 4. Usuarios con roles anteriores
  const usuariosCambios = [];
  const porDecidir = [];
  for (const u of usuarios) {
    const nomina = norm(u.nomina);
    if (u.rol === 'autorizador') {
      usuariosCambios.push({ uid: u.uid, nomina, nombre: u.nombre, rolAntes: u.rol, rolDespues: 'usuario' });
    } else if (u.rol === 'superintendente') {
      const emp = empleadoPorNomina.get(nomina);
      const areaId = emp?.areaId || '';
      if (!areaId) {
        porDecidir.push({ uid: u.uid, nomina, nombre: u.nombre, motivo: emp ? 'Su registro del padrón no tiene área.' : 'No está en el padrón.' });
      } else if (!participa(areaId)) {
        porDecidir.push({ uid: u.uid, nomina, nombre: u.nombre, motivo: `Está en ${areaPorId.get(areaId)?.nombre ?? areaId}, que no participa en tiempo extra: no se le puede asignar solicitante ahí.` });
      } else {
        usuariosCambios.push({ uid: u.uid, nomina, nombre: u.nombre, rolAntes: u.rol, rolDespues: 'usuario' });
        agregar({ nomina, rol: ROL_OP.SOLICITANTE, areaId, origen: `usuario ${nomina} (superintendente)` });
      }
    }
  }

  // 5. Áreas manuales del padrón → excepciones
  const excepciones = [];
  for (const e of empleados) {
    const manual = norm(e.areaTEManual);
    if (!manual) continue;
    const nomina = norm(e.nomina);
    if (!areaPorId.has(manual)) { advertencias.push(`Empleado ${nomina}: areaTEManual "${manual}" no existe en el catálogo de áreas; se deja para revisión manual.`); continue; }
    if (norm(e.areaExcepcion) === manual) continue; // ya es excepción
    if (norm(e.areaExcepcion)) { advertencias.push(`Empleado ${nomina}: ya tiene excepción "${e.areaExcepcion}"; areaTEManual "${manual}" no la pisa.`); continue; }
    excepciones.push({ nomina, nombre: e.nombre ?? '', areaAntes: e.areaId ?? '', areaExcepcion: manual });
  }

  const lista = [...plan.values()];
  const cuenta = (rol) => lista.filter(a => a.rol === rol).length;
  const sinUsuario = lista.filter(a => !usuarioPorNomina.has(a.nomina)).map(a => ({ nomina: a.nomina, nombre: a.nombre, rol: a.rol, areaId: a.areaId }));
  return {
    asignaciones: lista,
    usuariosCambios,
    porDecidir,
    excepciones,
    advertencias,
    sinUsuario,
    yaMigradas: yaMigradas.size,
    resumen: {
      aut2: cuenta(ROL_OP.AUT2), aut1: cuenta(ROL_OP.AUT1), solicitantes: cuenta(ROL_OP.SOLICITANTE),
      usuariosAUsuario: usuariosCambios.length, porDecidir: porDecidir.length, excepciones: excepciones.length,
      advertencias: advertencias.length, yaMigradas: yaMigradas.size,
    },
    pendiente: lista.length + usuariosCambios.length + excepciones.length > 0,
  };
}
