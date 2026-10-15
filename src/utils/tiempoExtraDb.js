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
import {
  ESTATUS_TE_VISIBLES, LOTE_EMPLEADOS, MIN_MOTIVO_CANCELACION_RH, MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, NIVEL_RECEPCION,
  datosSolicitudTransporte, docAEmpleado, empleadoADoc, folioDe, pasajerosDeTE, resumenTE, trozos,
} from './tiempoExtra';
import { normalizarEstatus } from './constantes';

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
 * @param {object} p.extras      tipo, rutasDistintas, desgloseRutas y justificacionRutas (ver datosTE en tiempoExtra.js)
 * @param {(hechos:number,total:number)=>void} [p.onProgreso]
 */
export async function guardarBorrador({ id, existe, usuario, area, fechaTE, motivo, comentario, empleados, sucios, eliminados, extras = {}, onProgreso }) {
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
    primero.update(refTE(id), { fechaTE, motivo, comentario, resumen, ...extras, fechaActualizacion: serverTimestamp() });
  } else {
    primero.set(refTE(id), {
      areaId: area.id, areaNombre: area.nombre, creadoPor: usuario.uid, creadoPorNomina: String(usuario.nomina), creadoPorNombre: usuario.nombre ?? '',
      fechaTE, motivo, comentario, estatus: 'borrador', resumen, ...extras, fechaCreacion: serverTimestamp(), fechaActualizacion: serverTimestamp(),
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
export async function enviarSolicitud({ id, devuelta, usuario, estatus, fechaTE, motivo, comentario, empleados, extras = {} }) {
  const resumen = resumenTE(empleados);
  const contenido = { fechaTE, motivo, comentario, resumen, ...extras };
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
    if (c.exists()) tx.update(contador, { ultimo: numero, solicitudId: id }); else tx.set(contador, { ultimo: 1, solicitudId: id });
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

// ── Autorizar y devolver (bandejas) ───────────────────────────────────────

/** Error de concurrencia: alguien más ya respondió (o el solicitante canceló) mientras estaba abierta */
export class YaRespondida extends Error {
  constructor() { super(MSG_YA_RESPONDIDA); this.name = 'YaRespondida'; }
}

const ESTATUS_DEL_NIVEL = { 1: 'pendiente_aut1', 2: 'pendiente_aut2', [NIVEL_RECEPCION]: 'autorizada' };

/**
 * Autoriza en `nivel` (1: pendiente_aut1 → pendiente_aut2; 2: pendiente_aut2 → autorizada). En una transacción: relee el estatus y aborta con
 * YaRespondida si cambió; guarda la firma { nomina, nombre, fecha, comentario, comoRH } y la entrada del historial.
 * comoRH: firma el nivel 2 por su rol RH/admin sin ser Aut. 2 (para saber si firmó Salvador, Marco o alguien de RH).
 */
export async function autorizarSolicitud({ id, usuario, nivel, comoRH = false, comentario = '' }) {
  const ref = refTE(id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().estatus !== ESTATUS_DEL_NIVEL[nivel]) throw new YaRespondida();
    if (snap.data().creadoPor === usuario.uid) throw new Error('No puedes autorizar tu propia solicitud.');
    const texto = String(comentario).trim();
    const firma = { nomina: String(usuario.nomina), nombre: usuario.nombre ?? '', fecha: serverTimestamp(), comentario: texto, comoRH: nivel === 2 ? !!comoRH : false };
    tx.update(ref, nivel === 1
      ? { estatus: 'pendiente_aut2', aut1: firma, fechaActualizacion: serverTimestamp() }
      : { estatus: 'autorizada', aut2: firma, fechaActualizacion: serverTimestamp() });
    tx.set(doc(collection(db, 'tiempoExtra', id, 'historial')), { ...entradaHistorial(usuario, nivel === 1 ? 'autorizada_1' : 'autorizada_2', texto), nivel });
  });
}

/** Devuelve con motivo (mínimo 10 caracteres; nivel 3 = RH en la recepción, desde autorizada) → devuelta, con { nivel, nomina, nombre, motivo, fecha }. Misma transacción y mismo aborto */
export async function devolverSolicitud({ id, usuario, nivel, motivo }) {
  const texto = String(motivo).trim();
  if (texto.length < MIN_MOTIVO_DEVOLUCION) throw new Error(`El motivo de la devolución debe tener al menos ${MIN_MOTIVO_DEVOLUCION} caracteres.`);
  const ref = refTE(id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().estatus !== ESTATUS_DEL_NIVEL[nivel]) throw new YaRespondida();
    if (nivel !== NIVEL_RECEPCION && snap.data().creadoPor === usuario.uid) throw new Error('No puedes devolver tu propia solicitud.');
    tx.update(ref, {
      estatus: 'devuelta', fechaActualizacion: serverTimestamp(),
      devolucion: { nivel, nomina: String(usuario.nomina), nombre: usuario.nombre ?? '', motivo: texto, fecha: serverTimestamp() },
    });
    tx.set(doc(collection(db, 'tiempoExtra', id, 'historial')), { ...entradaHistorial(usuario, 'devuelta', texto), nivel });
  });
}

/**
 * Autoriza varias, cada una en su propia transacción. Devuelve { ok: [ids], fallidas: [{ id, motivo }] }.
 * `tareas`: [{ id, nivel }]
 */
export async function autorizarVarias({ tareas, usuario, comoRH, comentario = '' }) {
  const ok = [];
  const fallidas = [];
  for (const { id, nivel } of tareas) {
    try {
      await autorizarSolicitud({ id, usuario, nivel, comoRH, comentario });
      ok.push(id);
    } catch (err) {
      fallidas.push({ id, motivo: err instanceof YaRespondida ? MSG_YA_RESPONDIDA : (err.code === 'permission-denied' ? 'Sin permiso (ya no es tu nivel o tu rol venció)' : err.message) });
    }
  }
  return { ok, fallidas };
}

// ── Recepción de RH, transporte y cancelación posterior ───────────────────

const refSolicitud = (id) => doc(db, 'solicitudes', id);

/** Renglón de la bitácora general (solo se crea): cada recepción y cada cancelación posterior dejan el suyo en la misma transacción */
function renglonBitacora(usuario, accion, antes, despues) {
  return { accion, entidad: 'tiempoExtra', antes, despues, porUid: usuario.uid, porNombre: usuario.nombre ?? '', fecha: serverTimestamp() };
}

const firmaRH = (usuario, extra = {}) => ({ nomina: String(usuario.nomina), nombre: usuario.nombre ?? '', fecha: serverTimestamp(), ...extra });

/** Entrada para el arreglo `historial` de una solicitud de transporte (el formato que ya usan las solicitudes de rutas) */
const entradaTransporte = (usuario, accion, comentario) => ({ fecha: new Date().toISOString(), usuario: usuario.nombre ?? '', accion, comentario });

/**
 * RH recibe una solicitud autorizada y, si hay empleados con transporte, genera UNA solicitud de transporte con ellos.
 *
 * Todo en una sola transacción de Firestore (todo o nada): relee el estatus (aborta con "Alguien más ya respondió esta solicitud" si ya no
 * está autorizada) y escribe juntos la solicitud de transporte (nace aprobada), un pasajero por empleado con transporte, el TE como
 * procesada (recibidaPor, fechaRecepcion, solicitudTransporteId), su historial y la bitácora. Los empleados del TE se leen antes porque
 * una transacción no admite consultas; ya no pueden cambiar (solo el creador edita empleados, y solo en borrador o devuelta).
 * Las reglas exigen además, con getAfter, que la solicitud de transporte y el paso a procesada lleguen en la misma operación.
 * @returns {Promise<{ solicitudTransporteId: string|null, pasajeros: number }>}
 */
export async function recibirSolicitud({ id, usuario }) {
  const ref = refTE(id);
  const emps = await getDocs(collection(db, 'tiempoExtra', id, 'empleados'));
  const empleados = emps.docs.map(d => docAEmpleado(d.id, d.data()));
  const solRef = empleados.some(e => e.transporte) ? doc(collection(db, 'solicitudes')) : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().estatus !== 'autorizada') throw new YaRespondida();
    const te = { id, ...snap.data() };
    const pasajeros = pasajerosDeTE(empleados, te);
    if ((te.resumen?.totalTransporte ?? 0) !== pasajeros.length) throw new Error(`${te.folio}: el resumen no coincide con sus empleados con transporte; avisa a sistemas.`);

    if (solRef) {
      tx.set(solRef, {
        ...datosSolicitudTransporte(te, pasajeros, usuario),
        fechaSolicitud: serverTimestamp(),
        revisadoPor: usuario.uid, revisadoPorNombre: usuario.nombre ?? '', fechaRevision: serverTimestamp(),
        historial: [entradaTransporte(usuario, 'creada', `Generada al confirmar el tiempo extra ${te.folio}.`)],
      });
      for (const p of pasajeros) tx.set(doc(db, 'solicitudes', solRef.id, 'pasajeros', p.nomina), { ...p, creadoPor: usuario.uid });
    }
    tx.update(ref, {
      estatus: 'procesada', recibidaPor: firmaRH(usuario), fechaRecepcion: serverTimestamp(),
      ...(solRef ? { solicitudTransporteId: solRef.id } : {}), fechaActualizacion: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'tiempoExtra', id, 'historial')), {
      ...entradaHistorial(usuario, 'recibida_rh', solRef ? `Transporte solicitado para ${pasajeros.length} empleados.` : 'Sin empleados con transporte.'), nivel: 0,
    });
    tx.set(doc(collection(db, 'bitacora')), renglonBitacora(usuario, 'recibir', { estatus: 'autorizada', folio: te.folio ?? '' },
      { estatus: 'procesada', folio: te.folio ?? '', solicitudTransporteId: solRef?.id ?? null, pasajeros: pasajeros.length }));
    return { solicitudTransporteId: solRef?.id ?? null, pasajeros: pasajeros.length };
  });
}

/** Recibe varias, cada una en su propia transacción. Devuelve { ok: [{ id, pasajeros }], fallidas: [{ id, motivo }] } */
export async function recibirVarias({ ids, usuario }) {
  const ok = [];
  const fallidas = [];
  for (const id of ids) {
    try {
      const r = await recibirSolicitud({ id, usuario });
      ok.push({ id, ...r });
    } catch (err) {
      fallidas.push({ id, motivo: err instanceof YaRespondida ? MSG_YA_RESPONDIDA : (err.code === 'permission-denied' ? 'Sin permiso (solo RH y admin reciben)' : err.message) });
    }
  }
  return { ok, fallidas };
}

/**
 * RH cancela un tiempo extra ya autorizado o recibido, con motivo (mínimo 10 caracteres). Una sola transacción:
 *  - el TE pasa a cancelada (motivoCancelacion y canceladaPor), con su historial y su renglón en la bitácora;
 *  - si ya estaba recibida y su transporte NO se ha enviado al proveedor, esa solicitud de transporte se cancela también;
 *  - si ya se envió al proveedor no se toca su estatus: se marca para revisión y se avisa que hay que llamarle al proveedor.
 * @returns {Promise<{ transporte: 'sin'|'cancelado'|'enviado', fechaServicio?: string }>}
 */
export async function cancelarAutorizada({ id, usuario, motivo }) {
  const texto = String(motivo).trim();
  if (texto.length < MIN_MOTIVO_CANCELACION_RH) throw new Error(`El motivo de la cancelación debe tener al menos ${MIN_MOTIVO_CANCELACION_RH} caracteres.`);
  const ref = refTE(id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const antes = snap.exists() ? snap.data().estatus : null;
    if (!['autorizada', 'procesada'].includes(antes)) throw new YaRespondida();
    const te = snap.data();
    const transporteId = antes === 'procesada' ? te.solicitudTransporteId : null;
    const solSnap = transporteId ? await tx.get(refSolicitud(transporteId)) : null;
    const sol = solSnap?.exists() ? solSnap.data() : null;

    let transporte = 'sin';
    if (sol) {
      const enviada = normalizarEstatus(sol.estatus) === 'enviada al proveedor';
      const historial = [...(sol.historial ?? []), entradaTransporte(usuario, enviada ? 'aviso' : 'cancelada', `Tiempo extra ${te.folio} cancelado por RH: ${texto}`)];
      if (enviada) {
        tx.update(refSolicitud(transporteId), { requiereRevision: true, motivoRevision: `Tiempo extra ${te.folio} cancelado: ${texto}`, historial });
        transporte = 'enviado';
      } else if (normalizarEstatus(sol.estatus) !== 'cancelada') {
        tx.update(refSolicitud(transporteId), { estatus: 'cancelada', historial });
        transporte = 'cancelado';
      }
    }
    tx.update(ref, { estatus: 'cancelada', motivoCancelacion: texto, canceladaPor: firmaRH(usuario, { comoRH: true }), fechaActualizacion: serverTimestamp() });
    tx.set(doc(collection(db, 'tiempoExtra', id, 'historial')), { ...entradaHistorial(usuario, 'cancelada', texto), nivel: 0 });
    tx.set(doc(collection(db, 'bitacora')), renglonBitacora(usuario, 'cancelar_autorizada', { estatus: antes, folio: te.folio ?? '' },
      { estatus: 'cancelada', folio: te.folio ?? '', motivo: texto, transporte, solicitudTransporteId: transporteId ?? null }));
    return { transporte, fechaServicio: te.fechaTE };
  });
}

/** Solicitud de transporte de un tiempo extra recibido (para mostrar su estatus). null si no existe o no se puede leer */
export async function leerTransporteDeTE(solicitudId) {
  if (!solicitudId) return null;
  try {
    const snap = await getDoc(refSolicitud(solicitudId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('Transporte del TE:', err);
    return null;
  }
}
