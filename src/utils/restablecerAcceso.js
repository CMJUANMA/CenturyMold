/**
 * restablecerAcceso.js — "Restablecer acceso" de un usuario (RH y admin), mientras no haya funciones de servidor.
 *
 * Cambiar la contraseña de otra persona exige el Admin SDK, así que el restablecimiento es una cuenta nueva:
 *   1. Alguien borra la cuenta en Firebase Console > Authentication (la app no puede).
 *   2. Aquí se crea una cuenta nueva con la contraseña temporal (CM-XXXX-XXXX, debeCambiarPassword: true), el perfil se mueve al uid nuevo
 *      conservando rol, preferencias y demás datos, y se borra el perfil viejo, todo en un solo lote junto con su renglón de bitácora.
 *      Las asignaciones no se tocan: van por nómina, no por uid.
 *
 * La contraseña NUNCA se guarda ni se registra. Este archivo es la parte pura (se prueba en Node); la que habla con Firebase está en
 * restablecerAccesoDb.js.
 */
import { registroBitacora } from './estructura.js';

/** Id del renglón de bitácora de un restablecimiento. firestore.rules lo exige para dejar borrar el perfil viejo (ver `restablece`) */
export const idBitacoraRestablecer = (uidViejo) => `restablecer-${uidViejo}`;

export const ACCION_RESTABLECER = 'restablecer_acceso';

/** Enlace directo a Authentication en la consola del proyecto */
export const urlConsolaAuth = (projectId) => `https://console.firebase.google.com/project/${encodeURIComponent(projectId ?? '')}/authentication/users`;

/** Correo interno de la cuenta de una persona (ficticio: no recibe correo) */
export const correoDeNomina = (nomina) => `${String(nomina).trim()}@rutas.app`;

/** El perfil que pasa al uid nuevo: todo lo del anterior (rol, preferencias, activo…) y debeCambiarPassword: true. Sin el uid, que es el id del documento */
export function perfilRestablecido(viejo) {
  const { uid: _uid, ...resto } = viejo ?? {};
  return { ...resto, debeCambiarPassword: true };
}

/** Renglón de bitácora: quién restableció a quién (uid viejo y nuevo, nómina y nombre). Nunca lleva la contraseña */
export function registroRestablecimiento({ uidViejo, uidNuevo, perfil }, actor) {
  return registroBitacora({
    accion: ACCION_RESTABLECER,
    entidad: `usuarios/${uidNuevo}`,
    antes: { uid: uidViejo },
    despues: { uid: uidNuevo, nomina: String(perfil.nomina ?? ''), nombre: perfil.nombre ?? '' },
  }, actor);
}

/** Texto para mostrar de un error al restablecer */
export function mensajeErrorRestablecer(err, nomina) {
  if (err?.code === 'auth/email-already-in-use') {
    return `La cuenta ${correoDeNomina(nomina)} todavía existe en Firebase Console. Bórrala en Authentication y vuelve a intentar.`;
  }
  if (err?.cuentaHuerfana) {
    return `No se pudo mover el perfil (${err.message}) y tampoco se pudo borrar la cuenta nueva. Bórrala en Firebase Console > Authentication (${correoDeNomina(nomina)}) y vuelve a intentar.`;
  }
  if (err?.code === 'app/sin-perfil') return 'Este usuario ya no existe: actualiza la pantalla.';
  if (err?.code === 'permission-denied') return 'No tienes permiso para restablecer este acceso. Solo un administrador puede hacerlo con usuarios de RH o administradores.';
  if (err?.code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu red e inténtalo de nuevo (no se cambió nada).';
  return `No se pudo restablecer el acceso: ${err?.message ?? err}`;
}
