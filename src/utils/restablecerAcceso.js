/**
 * restablecerAcceso.js — "Restablecer contraseña" de un usuario (RH, Aut. 2 vigente y admin), 100 % dentro de la app, mientras no haya funciones
 * de servidor (con Blaze se reemplaza por una función que cambia la contraseña de la misma cuenta: docs/blaze.md).
 *
 * Cambiar la contraseña de otra persona exige el Admin SDK, así que el restablecimiento crea una cuenta de la SIGUIENTE versión (accesos.js):
 *   1. Con la app secundaria se crea {nomina}.v{N+1}@rutas.app con una contraseña temporal CM-XXXX-XXXX.
 *   2. En un solo lote: el perfil pasa al uid nuevo conservando rol, preferencias y datos (debeCambiarPassword: true), se borra el perfil viejo,
 *      se actualiza accesos/{nomina} y se registra en la bitácora quién restableció a quién (sin la contraseña).
 *   3. Si algo falla, se borra la cuenta nueva y el perfil viejo queda intacto.
 * Las asignaciones no se tocan: van por nómina, no por uid. La cuenta vieja queda sin perfil: las reglas no le dejan leer ni escribir nada.
 *
 * La contraseña NUNCA se guarda ni se registra. Este archivo es la parte pura (se prueba en Node); la que habla con Firebase está en
 * restablecerAccesoDb.js.
 */
import { registroBitacora } from './estructura.js';
import { correoDeAcceso } from './accesos.js';

/** Id del renglón de bitácora de un restablecimiento. firestore.rules lo exige para dejar borrar el perfil viejo (ver `restablece`) */
export const idBitacoraRestablecer = (uidViejo) => `restablecer-${uidViejo}`;

export const ACCION_RESTABLECER = 'restablecer_acceso';

/** El perfil que pasa al uid nuevo: todo lo del anterior (rol, preferencias, activo…) y debeCambiarPassword: true. Sin el uid, que es el id del documento */
export function perfilRestablecido(viejo) {
  const { uid: _uid, ...resto } = viejo ?? {};
  return { ...resto, debeCambiarPassword: true };
}

/** Renglón de bitácora: quién restableció a quién (uid viejo y nuevo, nómina, nombre y versión). Nunca lleva la contraseña */
export function registroRestablecimiento({ uidViejo, uidNuevo, perfil, version }, actor) {
  return registroBitacora({
    accion: ACCION_RESTABLECER,
    entidad: `usuarios/${uidNuevo}`,
    antes: { uid: uidViejo },
    despues: { uid: uidNuevo, nomina: String(perfil.nomina ?? ''), nombre: perfil.nombre ?? '', ...(version ? { version } : {}) },
  }, actor);
}

/** Texto para mostrar de un error al restablecer */
export function mensajeErrorRestablecer(err, nomina, version) {
  if (err?.code === 'auth/email-already-in-use') {
    return `Ya existe la cuenta ${correoDeAcceso(nomina, version)} (un intento anterior quedó a medias). Avisa al área de Sistemas para limpiarla en Firebase Console > Authentication.`;
  }
  if (err?.cuentaHuerfana) {
    return `No se pudo mover el perfil (${err.message}) y tampoco se pudo borrar la cuenta nueva (${correoDeAcceso(nomina, version)}). Avisa al área de Sistemas: hay que borrarla en Firebase Console > Authentication.`;
  }
  if (err?.code === 'app/sin-perfil') return 'Este usuario ya no existe: actualiza la pantalla.';
  if (err?.code === 'permission-denied') return 'No tienes permiso para restablecer esta contraseña. Solo un administrador puede hacerlo con usuarios de RH o administradores.';
  if (err?.code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu red e inténtalo de nuevo (no se cambió nada).';
  return `No se pudo restablecer la contraseña: ${err?.message ?? err}`;
}
