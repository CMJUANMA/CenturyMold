/**
 * asignacionesDb.js — Escrituras de asignaciones en Firestore (cada cambio lleva su renglón en la bitácora, en el mismo lote).
 * La lógica pura (vigencia, permisos, organigrama) está en asignaciones.js.
 */
import { Timestamp, addDoc, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ROL_OP, idAsignacion, inicioDelDia, finDelDia, resumenParaBitacora } from './asignaciones';

const quien = (actor) => ({ uid: actor.uid, nombre: actor.nombre ?? '' });

function renglonBitacora(batch, actor, accion, antes, despues) {
  batch.set(doc(collection(db, 'bitacora')), {
    accion, entidad: 'asignacion',
    antes: resumenParaBitacora(antes), despues: resumenParaBitacora(despues),
    porUid: actor.uid, porNombre: actor.nombre ?? '', fecha: serverTimestamp(),
  });
}

/**
 * Da un rol operativo (o lo vuelve a dar si estaba revocado/vencido: mismo id, el historial queda en la bitácora).
 * @param {object} actor    { uid, nombre }
 * @param {object} datos    { nomina, nombre, puesto, puestoId?, rol, areaId, desde:'AAAA-MM-DD', hasta:''|'AAAA-MM-DD', motivo }
 *                          nombre y puesto se copian del padrón: quien ve el organigrama sin leer ese padrón los muestra desde aquí
 * @param {object|null} previa  asignación que ya existía con ese id (para la bitácora)
 */
export async function asignarRol(actor, datos, previa = null) {
  const areaId = datos.rol === ROL_OP.AUT2 ? null : datos.areaId;
  const id = idAsignacion(datos.nomina, datos.rol, areaId);
  const hasta = datos.hasta ? Timestamp.fromDate(finDelDia(datos.hasta)) : null;
  const motivo = String(datos.motivo ?? '').trim();
  const nueva = {
    nomina: String(datos.nomina).trim(), nombre: String(datos.nombre ?? '').trim(), puesto: String(datos.puesto ?? '').trim(),
    ...(datos.puestoId ? { puestoId: String(datos.puestoId) } : {}), rol: datos.rol, areaId,
    desde: Timestamp.fromDate(inicioDelDia(datos.desde)), hasta, motivo, activo: true,
    asignadoPor: quien(actor), fechaAsignacion: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'asignaciones', id), nueva);
  renglonBitacora(batch, actor, previa ? 'reasignar' : 'asignar', previa, { ...nueva, id, desde: nueva.desde, hasta });
  await batch.commit();
  return id;
}

/** Revocar = activo:false. La asignación se conserva; el motivo de la revocación queda en la bitácora */
export async function revocarAsignacion(actor, asignacion, motivo = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'asignaciones', asignacion.id), { activo: false });
  renglonBitacora(batch, actor, 'revocar', asignacion, { ...asignacion, activo: false, motivoRevocacion: String(motivo).trim() });
  await batch.commit();
}

/** Cambia la fecha final ('' = permanente) y el motivo */
export async function extenderAsignacion(actor, asignacion, { hasta, motivo }) {
  const nuevaHasta = hasta ? Timestamp.fromDate(finDelDia(hasta)) : null;
  const nuevoMotivo = String(motivo ?? '').trim();
  const batch = writeBatch(db);
  batch.update(doc(db, 'asignaciones', asignacion.id), { hasta: nuevaHasta, motivo: nuevoMotivo, activo: true });
  renglonBitacora(batch, actor, 'extender', asignacion, { ...asignacion, hasta: nuevaHasta, motivo: nuevoMotivo, activo: true });
  await batch.commit();
}

/**
 * Copia nombre, puesto y puestoId del padrón a las asignaciones que lo pidan (admin; ver planActualizarDatos). Lotes de 400 y UN renglón de bitácora.
 * @param {{ id: string, nombre: string, puesto: string, puestoId?: string }[]} cambios
 */
export async function actualizarDatosAsignaciones(actor, cambios) {
  for (let i = 0; i < cambios.length; i += 400) {
    const batch = writeBatch(db);
    for (const c of cambios.slice(i, i + 400)) batch.update(doc(db, 'asignaciones', c.id), { nombre: c.nombre, puesto: c.puesto, ...(c.puestoId ? { puestoId: c.puestoId } : {}) });
    await batch.commit();
  }
  await addDoc(collection(db, 'bitacora'), {
    accion: 'actualizar_datos_asignaciones', entidad: 'asignacion', antes: null,
    despues: { total: cambios.length, ids: cambios.slice(0, 500).map(c => c.id) },
    porUid: actor.uid, porNombre: actor.nombre ?? '', fecha: serverTimestamp(),
  });
}

/** Historial de una asignación: renglones de la bitácora, del más nuevo al más viejo */
export async function leerHistorialAsignacion(id) {
  const snap = await getDocs(query(collection(db, 'bitacora'), where('entidad', '==', 'asignacion'), where('despues.id', '==', id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
}
