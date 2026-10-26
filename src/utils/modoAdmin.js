/**
 * modoAdmin.js — MODO ADMIN: el admin (apagado por defecto, solo en memoria: se apaga al recargar o cerrar sesión) puede hacer cualquier acción de cualquier
 * rol con SU PROPIA cuenta. Cada acción pide confirmación y queda marcada: la solicitud lleva accionAdmin: true, el historial y la bitácora llevan el nombre
 * REAL del admin más "(admin)" al mostrarse; nunca se firma a nombre de otra persona. Las reglas de Firestore lo exigen (accionAdmin / admin).
 *
 * Este módulo guarda el interruptor fuera de React para que las funciones de escritura (tiempoExtraDb, ajustesNominaDb) lo consulten sin recibirlo por parámetro.
 * Lo enciende y apaga AccesosContext; la confirmación la dibuja components/ModoAdminUI.jsx.
 */

let activo = false;
let pedirConfirmacion = null;

export const modoAdminActivo = () => activo;
export const fijarModoAdmin = (valor) => { activo = valor === true; };
export const registrarConfirmacionAdmin = (fn) => { pedirConfirmacion = fn; };

/** Texto que acompaña al nombre de quien actuó en modo admin */
export const ETIQUETA_ADMIN = '(admin)';
export const MSG_ACCION_CANCELADA = 'Acción cancelada.';

/** Campo que marca la solicitud o el ajuste como tocado por el admin en modo admin ({} si el modo está apagado) */
export const marcaAdmin = () => (activo ? { accionAdmin: true } : {});
/** Lo mismo para una entrada del historial de una solicitud ({ admin: true }) */
export const marcaAdminHistorial = () => (activo ? { admin: true } : {});

/** Nombre para mostrar: "Juan Pérez (admin)" cuando la entrada es de una acción en modo admin */
export const nombreConAdmin = (nombre, esAdmin) => (esAdmin ? `${nombre} ${ETIQUETA_ADMIN}` : nombre);

/** Error de una acción que el admin no confirmó */
export class AccionAdminCancelada extends Error {
  constructor() { super(MSG_ACCION_CANCELADA); this.name = 'AccionAdminCancelada'; this.code = 'admin-cancelada'; }
}

/**
 * Pide la confirmación del admin antes de escribir (si el modo está apagado, no hace nada). Lanza AccionAdminCancelada si no acepta.
 * @param {string} accion  lo que va a pasar, en una frase ("Autorizar como Aut. 2 la solicitud TE-2026-0007")
 */
export async function confirmarAccionAdmin(accion) {
  if (!activo || !pedirConfirmacion) return;
  const ok = await pedirConfirmacion(accion);
  if (!ok) throw new AccionAdminCancelada();
}

/**
 * Los accesos de un admin con el modo encendido: Aut. 2, Aut. 1 y solicitante de TODAS las áreas que participan en tiempo extra (lo demás, igual).
 * `reales` conserva los accesos de sus asignaciones, para saber con qué firma le tocaría de verdad (por ejemplo, si firma el nivel 2 como RH).
 * Sin el modo, o si quien llama no es admin, devuelve los accesos tal cual.
 */
export function accesosEnModoAdmin(accesos, areasQueParticipan, encendido) {
  if (!encendido || !accesos?.esAdmin) return { ...accesos, modoAdmin: false, reales: accesos };
  return {
    ...accesos, esAut2: true, areasAut1: areasQueParticipan, areasSolicitante: areasQueParticipan, tieneAcceso: true, modoAdmin: true, reales: accesos,
  };
}
