/**
 * ajustesNominaDb.js — Lectura y escritura de ajustesNomina/{semana}_{areaId} (Reportes de nómina). Cada guardado va en un solo lote con su renglón de
 * bitácora (quién, qué y por qué); nunca se tocan las solicitudes de tiempo extra. Solo Nóminas, RH y admin (firestore.rules); nadie borra.
 * Firmada = bloqueada: las reglas solo dejan a RH reabrirla.
 */
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { idAjuste, renglonParaGuardar, semanaDe } from './formatoNomina.js';

export const ACCIONES_AJUSTE_NOMINA = { ajustar: 'ajustar_nomina', deshacer: 'deshacer_ajustes_nomina', firmar: 'firmar_nomina', reabrir: 'reabrir_nomina' };

/** Escucha los ajustes de un periodo (todas las áreas) en vivo: onDatos(Map areaId → documento) */
export function escucharAjustes(periodo, onDatos, onError) {
  return onSnapshot(
    query(collection(db, 'ajustesNomina'), where('semana', '==', periodo.clave)),
    (snap) => onDatos(new Map(snap.docs.map(d => [d.data().areaId, { id: d.id, ...d.data() }]))),
    onError,
  );
}

/**
 * ¿La nómina de esa área y de la semana de `fechaTE` ya está firmada? Lee un solo documento por su id (la Aut. 2 puede leerlo así, no listar: firestore.rules).
 * @returns {Promise<{ firmada: boolean, semana: number, clave: string }>}
 */
export async function nominaFirmadaDe(fechaTE, areaId) {
  const sem = semanaDe(fechaTE);
  const snap = await getDoc(doc(db, 'ajustesNomina', idAjuste(sem, areaId)));
  return { firmada: snap.exists() && snap.data().firmada === true, semana: sem.semana, clave: sem.clave };
}

const quien = (usuario) => ({ uid: usuario.uid, nombre: usuario.nombre ?? '' });
const firma = (usuario) => ({ ...quien(usuario), nomina: String(usuario.nomina ?? ''), fecha: new Date().toISOString() });

function renglonBitacora(usuario, accion, id, antes, despues) {
  return { accion, entidad: `ajustesNomina/${id}`.slice(0, 120), antes, despues, porUid: usuario.uid, porNombre: usuario.nombre ?? '', fecha: serverTimestamp() };
}

/**
 * Guarda el documento del área (cambios + copia de los renglones ya ajustados) y su renglón de bitácora.
 * @param {{ periodo, areaId, cambios: object[], filas: object[], firmada?: boolean, reabiertaPor?: object|null, usuario, accion: string, antes?: object|null, despues?: object|null }} p
 */
export async function guardarAjuste({ periodo, areaId, cambios, filas, firmada = false, reabiertaPor = null, usuario, accion, antes = null, despues = null }) {
  const id = idAjuste(periodo, areaId);
  const lote = writeBatch(db);
  lote.set(doc(db, 'ajustesNomina', id), {
    semana: periodo.clave, areaId, desde: periodo.desde, hasta: periodo.hasta,
    cambios, renglones: filas.map(renglonParaGuardar), firmada,
    ...(firmada ? { firmadaPor: firma(usuario) } : { firmadaPor: null }),
    ...(reabiertaPor ? { reabiertaPor } : {}),
    actualizadoPor: quien(usuario), fechaActualizacion: serverTimestamp(),
  });
  lote.set(doc(collection(db, 'bitacora')), renglonBitacora(usuario, accion, id, antes, despues));
  await lote.commit();
}

/** RH reabre un área firmada: solo baja la firma (las reglas no dejan tocar nada más) */
export async function reabrirAjuste({ periodo, areaId, usuario }) {
  const id = idAjuste(periodo, areaId);
  const lote = writeBatch(db);
  lote.update(doc(db, 'ajustesNomina', id), {
    firmada: false, firmadaPor: null, reabiertaPor: firma(usuario), actualizadoPor: quien(usuario), fechaActualizacion: serverTimestamp(),
  });
  lote.set(doc(collection(db, 'bitacora')), renglonBitacora(usuario, ACCIONES_AJUSTE_NOMINA.reabrir, id, { firmada: true }, { firmada: false }));
  await lote.commit();
}
