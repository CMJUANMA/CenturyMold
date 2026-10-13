/**
 * tiempoExtraDb.js — Escrituras y lecturas de la captura de tiempo extra (esquema de BORRADOR de docs/tiempo-extra.md).
 *
 *   guardarBorrador   crea/actualiza el borrador; los empleados van en lotes de 10 (las reglas validan cada uno contra el padrón)
 *   enviarSolicitud   borrador → pendiente (asigna el FOLIO con el contador, en una transacción) o devuelta → pendiente (conserva su folio)
 *   cancelarSolicitud pendiente/devuelta → cancelada, con motivo
 *   eliminarBorrador  borra sus empleados en lotes y luego la solicitud
 */
import {
  collection, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ESTATUS_TE_VISIBLES, LOTE_EMPLEADOS, docAEmpleado, empleadoADoc, folioDe, resumenTE, trozos } from './tiempoExtra';

const refTE = (id) => doc(db, 'tiempoExtra', id);

function entradaHistorial(usuario, accion, comentario = '') {
  return { accion, nivel: 0, porUid: usuario.uid, porNomina: String(usuario.nomina), porNombre: usuario.nombre ?? '', comentario, fecha: serverTimestamp() };
}

/** Solicitud con sus empleados (para abrirla en el editor o en el detalle) */
export async function leerSolicitudTE(id) {
  const snap = await getDoc(refTE(id));
  if (!snap.exists()) return null;
  const emps = await getDocs(collection(db, 'tiempoExtra', id, 'empleados'));
  const empleados = emps.docs.map(d => docAEmpleado(d.id, d.data())).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return { id: snap.id, ...snap.data(), empleados };
}

export async function leerHistorialTE(id) {
  const snap = await getDocs(collection(db, 'tiempoExtra', id, 'historial'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0));
}

/**
 * Guarda el borrador (o los cambios de una devuelta). Solo escribe los empleados nuevos o modificados (`sucios`) y borra los quitados.
 * @param {object} p
 * @param {string} p.id          id de la solicitud (BR-… si es nueva)
 * @param {boolean} p.existe     ya está en Firestore
 * @param {object} p.usuario     { uid, nomina, nombre }
 * @param {{ id, nombre }} p.area
 * @param {object[]} p.empleados todos los del editor
 * @param {Set<string>} p.sucios nóminas por escribir; p.eliminados: nóminas por borrar
 * @param {(hechos:number,total:number)=>void} [p.onProgreso]
 */
export async function guardarBorrador({ id, existe, usuario, area, fechaTE, motivo, comentario, empleados, sucios, eliminados, onProgreso }) {
  const porNomina = new Map(empleados.map(e => [e.nomina, e]));
  const porEscribir = [...sucios].filter(n => porNomina.has(n));
  const lotesEmp = trozos(porEscribir, LOTE_EMPLEADOS);
  const lotesDel = trozos([...eliminados], LOTE_EMPLEADOS);
  const total = Math.max(lotesEmp.length, 1) + lotesDel.length;
  let hechos = 0;
  const avance = () => onProgreso?.(++hechos, total);
  const resumen = resumenTE(empleados);
  const escribirEmpleados = (b, nominas) => nominas.forEach(n => b.set(doc(db, 'tiempoExtra', id, 'empleados', n), empleadoADoc(porNomina.get(n))));

  // El primer lote lleva la solicitud (se crea o se actualiza) junto con los primeros empleados
  const primero = writeBatch(db);
  if (existe) {
    primero.update(refTE(id), { fechaTE, motivo, comentario, resumen, fechaActualizacion: serverTimestamp() });
  } else {
    primero.set(refTE(id), {
      areaId: area.id, areaNombre: area.nombre, creadoPor: usuario.uid, creadoPorNomina: String(usuario.nomina), creadoPorNombre: usuario.nombre ?? '',
      fechaTE, motivo, comentario, estatus: 'borrador', resumen, fechaCreacion: serverTimestamp(), fechaActualizacion: serverTimestamp(),
    });
  }
  escribirEmpleados(primero, lotesEmp[0] ?? []);
  await primero.commit();
  avance();

  for (const nominas of lotesEmp.slice(1)) {
    const b = writeBatch(db);
    escribirEmpleados(b, nominas);
    await b.commit();
    avance();
  }
  for (const nominas of lotesDel) {
    const b = writeBatch(db);
    nominas.forEach(n => b.delete(doc(db, 'tiempoExtra', id, 'empleados', n)));
    await b.commit();
    avance();
  }
}

/**
 * Envía a autorización.
 *  - Borrador: en UNA transacción, toma el siguiente folio del año (contador), pone el estatus, el resumen y la entrada 'enviada'.
 *  - Devuelta: conserva su folio, quita las firmas anteriores y vuelve a empezar; entrada 'reenviada'.
 * @returns {Promise<string>} el folio
 */
export async function enviarSolicitud({ id, devuelta, usuario, estatus, fechaTE, motivo, comentario, empleados }) {
  const resumen = resumenTE(empleados);
  const contenido = { fechaTE, motivo, comentario, resumen };
  if (devuelta) {
    const b = writeBatch(db);
    b.update(refTE(id), { ...contenido, estatus, aut1: deleteField(), aut2: deleteField(), fechaActualizacion: serverTimestamp() });
    b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entradaHistorial(usuario, 'reenviada'));
    await b.commit();
    return (await getDoc(refTE(id))).data()?.folio ?? '';
  }
  const anio = new Date().getFullYear();
  const contador = doc(db, 'contadores', `te-${anio}`);
  return runTransaction(db, async (tx) => {
    const c = await tx.get(contador);
    const numero = (c.exists() ? c.data().ultimo : 0) + 1;
    const folio = folioDe(anio, numero);
    if (c.exists()) tx.update(contador, { ultimo: numero }); else tx.set(contador, { ultimo: 1 });
    tx.update(refTE(id), { ...contenido, estatus, folio, fechaActualizacion: serverTimestamp() });
    tx.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entradaHistorial(usuario, 'enviada'));
    return folio;
  });
}

/** Cancela una solicitud pendiente o devuelta; el motivo queda en la solicitud y en el historial */
export async function cancelarSolicitud({ id, usuario, motivo }) {
  const texto = String(motivo).trim();
  const b = writeBatch(db);
  b.update(refTE(id), { estatus: 'cancelada', motivoCancelacion: texto, fechaActualizacion: serverTimestamp() });
  b.set(doc(collection(db, 'tiempoExtra', id, 'historial')), entradaHistorial(usuario, 'cancelada', texto));
  await b.commit();
}

/** Elimina un borrador propio: primero sus empleados (en lotes de 10, mientras la solicitud existe) y al final la solicitud */
export async function eliminarBorrador(id) {
  const emps = await getDocs(collection(db, 'tiempoExtra', id, 'empleados'));
  for (const lote of trozos(emps.docs, LOTE_EMPLEADOS)) {
    const b = writeBatch(db);
    lote.forEach(d => b.delete(d.ref));
    await b.commit();
  }
  const b = writeBatch(db);
  b.delete(refTE(id));
  await b.commit();
}

/** Ruta, comunidad y punto confirmados → padrón (solo empleados de su área; lo exigen las reglas) */
export async function guardarRutasEnPadron(cambios) {
  for (const lote of trozos(Object.entries(cambios), 50)) {
    const b = writeBatch(db);
    lote.forEach(([nomina, c]) => b.update(doc(db, 'empleados', nomina), c));
    await b.commit();
  }
}

/**
 * Empleados que ya tienen otro tiempo extra NO cancelado en esa fecha (para avisar, sin bloquear).
 * Ve lo que el usuario puede leer: lo suyo y, si es Aut. 1 del área, lo del área. Si algo falla, no avisa (devuelve vacío).
 * @returns {Promise<Map<string, {folio: string|null, estatus: string}>>} nómina → solicitud
 */
export async function leerOcupados({ uid, areaId, fechaTE, esAut1DeLaArea, excluirId }) {
  const ocupados = new Map();
  if (!fechaTE) return ocupados;
  try {
    const col = collection(db, 'tiempoExtra');
    const consultas = [getDocs(query(col, where('creadoPor', '==', uid), where('fechaTE', '==', fechaTE)))];
    if (esAut1DeLaArea) consultas.push(getDocs(query(col, where('areaId', '==', areaId), where('fechaTE', '==', fechaTE), where('estatus', 'in', ESTATUS_TE_VISIBLES))));
    const docs = new Map();
    for (const s of await Promise.all(consultas)) s.docs.forEach(d => docs.set(d.id, d));
    for (const d of docs.values()) {
      const t = d.data();
      if (d.id === excluirId || t.estatus === 'cancelada') continue;
      const emps = await getDocs(collection(db, 'tiempoExtra', d.id, 'empleados'));
      emps.docs.forEach(e => { if (!ocupados.has(e.id)) ocupados.set(e.id, { folio: t.folio ?? null, estatus: t.estatus }); });
    }
  } catch (err) {
    console.error('Ocupados:', err);
  }
  return ocupados;
}
