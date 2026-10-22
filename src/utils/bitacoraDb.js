/**
 * bitacoraDb.js — Registros de la bitácora que escribe la pantalla: descargas de información (quién bajó qué Excel y cuándo) y cambios de usuarios
 * (alta, cambio de rol del sistema, activar/desactivar). Cada renglón lleva el uid y el nombre reales de quien lo hizo (las reglas de /bitacora lo exigen)
 * y nunca el contenido de un archivo ni una contraseña. Si el registro falla no se bloquea la acción: solo se avisa en consola.
 * Solo RH, admin y la Aut. 2 (descargas y cambios de usuarios) pueden escribir en la bitácora; Nóminas, solo sus descargas, su paso de enviar al proveedor y los ajustes y firmado de su formato (firestore.rules → accionDeNomina).
 */
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

/** Acciones de descarga que se registran */
export const ACCIONES_DESCARGA = {
  padron: 'descargar_padron',
  resumenTE: 'descargar_resumen_te',
  consultaTE: 'descargar_consulta_te',
  formatoRutas: 'descargar_formato_rutas',
  respaldoCompleto: 'descargar_respaldo_completo',
  formatoTENomina: 'descargar_formato_te_nomina',
};

/** Acciones sobre usuarios que se registran (quién creó, cambió de rol o activó/desactivó a quién) */
export const ACCIONES_USUARIO = {
  crear: 'crear_usuario', editar: 'editar_usuario', activar: 'activar_usuario', desactivar: 'desactivar_usuario',
  darRH: 'dar_rol_rh', quitarRH: 'quitar_rol_rh', darNomina: 'dar_rol_nomina', quitarNomina: 'quitar_rol_nomina',
};

async function escribir(accion, entidad, antes, despues) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const perfil = (await getDoc(doc(db, 'usuarios', uid))).data();
    await addDoc(collection(db, 'bitacora'), { accion, entidad, antes, despues, porUid: uid, porNombre: perfil?.nombre ?? '', fecha: serverTimestamp() });
  } catch (err) {
    console.warn('No se pudo registrar en la bitácora:', err.code ?? err.message);
  }
}

/** Registra un cambio de usuarios (alta, cambio de nombre o rol del sistema, activar/desactivar). Nunca lleva contraseñas. */
export const registrarUsuario = (accion, usuario, antes = null) => escribir(
  accion, `usuarios/${usuario.uid ?? ''}`.slice(0, 120),
  antes, { nomina: String(usuario.nomina ?? ''), nombre: usuario.nombre ?? '', rol: usuario.rol ?? '', activo: usuario.activo !== false },
);

/**
 * @param {string} accion  una de ACCIONES_DESCARGA
 * @param {object} detalle datos del archivo: { archivo?, filas?, desde?, hasta?… } (sin contenido personal)
 */
export const registrarDescarga = (accion, detalle = {}) => escribir(accion, 'descarga', null, detalle);

/**
 * Fecha del último "Respaldo completo (JSON)" registrado en la bitácora (la lee el admin en el Inicio para recordar el respaldo semanal).
 * Devuelve la fecha (Timestamp), o null si nunca se ha hecho. Si falla la lectura lanza el error. Necesita el índice bitacora(accion, fecha desc).
 */
export async function leerUltimoRespaldo() {
  const snap = await getDocs(query(collection(db, 'bitacora'), where('accion', '==', ACCIONES_DESCARGA.respaldoCompleto), orderBy('fecha', 'desc'), limit(1)));
  return snap.empty ? null : (snap.docs[0].data().fecha ?? null);
}
