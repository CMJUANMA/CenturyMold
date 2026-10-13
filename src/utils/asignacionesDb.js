/**
 * asignacionesDb.js — Escrituras de asignaciones en Firestore (cada cambio lleva su renglón en la bitácora, en el mismo lote).
 * La lógica pura (vigencia, permisos, organigrama) está en asignaciones.js.
 */
import { Timestamp, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
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
 * @param {object} datos    { nomina, nombre, rol, areaId, desde:'AAAA-MM-DD', hasta:''|'AAAA-MM-DD', motivo }
 * @param {object|null} previa  asignación que ya existía con ese id (para la bitácora)
 */
export async function asignarRol(actor, datos, previa = null) {
  const areaId = datos.rol === ROL_OP.AUT2 ? null : datos.areaId;
  const id = idAsignacion(datos.nomina, datos.rol, areaId);
  const hasta = datos.hasta ? Timestamp.fromDate(finDelDia(datos.hasta)) : null;
  const motivo = String(datos.motivo ?? '').trim();
  const nueva = {
    nomina: String(datos.nomina).trim(), nombre: String(datos.nombre ?? '').trim(), rol: datos.rol, areaId,
    desde: Timestamp.fromDate(inicioDelDia(datos.desde)), hasta, motivo, activo: true,
    asignadoPor: quien(actor), fechaAsignacion: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'asignaciones', id), nueva);
  renglonBitacora(batch, actor, previa ? 'reasignar' : 'asignar', previa, { ...nueva, id, desde: nueva.desde, hasta });
  await batch.commit();
  return id;
}

/** Revocar = activo:false. La asignación se conserva */
export async function revocarAsignacion(actor, asignacion) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'asignaciones', asignacion.id), { activo: false });
  renglonBitacora(batch, actor, 'revocar', asignacion, { ...asignacion, activo: false });
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

/** Todas las asignaciones (cualquier usuario activo las lee) */
export async function leerAsignaciones() {
  const snap = await getDocs(collection(db, 'asignaciones'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Historial de una asignación: renglones de la bitácora, del más nuevo al más viejo */
export async function leerHistorialAsignacion(id) {
  const snap = await getDocs(query(collection(db, 'bitacora'), where('entidad', '==', 'asignacion'), where('despues.id', '==', id)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
}
