/**
 * constantes.js — Valores compartidos de la app (roles, estatus de solicitud y su aspecto).
 * Los valores son los que ya están guardados en Firestore: no cambiarlos sin migrar los datos.
 */

// ── Roles (usuarios/{uid}.rol) ────────────────────────────────────────────
export const ROLES = {
  SUPERINTENDENTE: 'superintendente',
  RH: 'rh',
  ADMIN: 'admin',
  /** Solo autoriza tiempo extra (directores y gerentes): no ve el módulo de rutas */
  AUTORIZADOR: 'autorizador',
};

/** Roles con acceso al panel de RH */
export const ROLES_RH = [ROLES.RH, ROLES.ADMIN];
/** Roles que pueden crear solicitudes */
export const ROLES_SOLICITANTES = [ROLES.SUPERINTENDENTE, ROLES.RH, ROLES.ADMIN];

export const ROL_LABELS = {
  [ROLES.ADMIN]: 'Administrador del sistema',
  [ROLES.RH]: 'Recursos Humanos',
  // El valor guardado sigue siendo 'superintendente'; en pantalla se muestra "Solicitante"
  [ROLES.SUPERINTENDENTE]: 'Solicitante',
  [ROLES.AUTORIZADOR]: 'Autorizador',
};

/** Versión corta, para la barra lateral y los selectores */
export const ROL_LABELS_CORTOS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.RH]: 'Recursos Humanos',
  [ROLES.SUPERINTENDENTE]: 'Solicitante',
  [ROLES.AUTORIZADOR]: 'Autorizador',
};

// ── Estatus de solicitud (solicitudes/{id}.estatus) ───────────────────────
export const ESTATUS_SOLICITUD = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
  CANCELADA: 'cancelada',
  ENVIADA_PROVEEDOR: 'enviada al proveedor',
};

/** Etiqueta y estilo de badge de cada estatus (cls: texto/fondo/borde; dot: punto de color) */
export const ESTATUS_MAP = {
  [ESTATUS_SOLICITUD.PENDIENTE]: {
    label: 'Pendiente',
    cls: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
    dot: 'bg-[var(--status-warning-text)]',
  },
  [ESTATUS_SOLICITUD.APROBADA]: {
    label: 'Aprobada',
    cls: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
    dot: 'bg-[var(--status-success-text)]',
  },
  [ESTATUS_SOLICITUD.RECHAZADA]: {
    label: 'Rechazada',
    cls: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
    dot: 'bg-[var(--status-error-text)]',
  },
  [ESTATUS_SOLICITUD.CANCELADA]: {
    label: 'Cancelada',
    cls: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]',
    dot: 'bg-[var(--border-color)]',
  },
  [ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR]: {
    label: 'Enviada al proveedor',
    cls: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-800',
  },
};

/** Normaliza el estatus leído de Firestore (minúsculas; 'pendiente' si falta) */
export const normalizarEstatus = (estatus) => estatus?.toLowerCase() || ESTATUS_SOLICITUD.PENDIENTE;

// ── Tiempo extra (tiempoExtra/{folio}.estatus) ────────────────────────────
export const ESTATUS_TE = {
  PENDIENTE_AUT1: 'pendiente_aut1',
  PENDIENTE_AUT2: 'pendiente_aut2',
  AUTORIZADA: 'autorizada',
  DEVUELTA: 'devuelta',
  CANCELADA: 'cancelada',
  PROCESADA: 'procesada',
};

const BADGE_WARNING = {
  cls: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  dot: 'bg-[var(--status-warning-text)]',
};
const BADGE_SUCCESS = {
  cls: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  dot: 'bg-[var(--status-success-text)]',
};

/** Etiqueta y estilo de badge de cada estatus de tiempo extra (mismo formato que ESTATUS_MAP) */
export const ESTATUS_TE_MAP = {
  [ESTATUS_TE.PENDIENTE_AUT1]: { label: 'Pendiente de Aut. 1', ...BADGE_WARNING },
  [ESTATUS_TE.PENDIENTE_AUT2]: { label: 'Pendiente de Aut. 2', ...BADGE_WARNING },
  [ESTATUS_TE.AUTORIZADA]: { label: 'Autorizada', ...BADGE_SUCCESS },
  [ESTATUS_TE.DEVUELTA]: {
    label: 'Devuelta',
    cls: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
    dot: 'bg-[var(--status-error-text)]',
  },
  [ESTATUS_TE.CANCELADA]: { ...ESTATUS_MAP[ESTATUS_SOLICITUD.CANCELADA], label: 'Cancelada' },
  [ESTATUS_TE.PROCESADA]: { ...ESTATUS_MAP[ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR], label: 'Procesada' },
};

/** Acciones del historial (tiempoExtra/{id}/historial) */
export const ACCIONES_TE = {
  CREADA: 'creada',
  AUTORIZADA_1: 'autorizada_1',
  AUTORIZADA_2: 'autorizada_2',
  DEVUELTA: 'devuelta',
  REENVIADA: 'reenviada',
  CANCELADA: 'cancelada',
  RECIBIDA_RH: 'recibida_rh',
};

export const ACCIONES_TE_LABELS = {
  [ACCIONES_TE.CREADA]: 'Solicitud creada',
  [ACCIONES_TE.AUTORIZADA_1]: 'Autorizada (nivel 1)',
  [ACCIONES_TE.AUTORIZADA_2]: 'Autorizada (nivel 2)',
  [ACCIONES_TE.DEVUELTA]: 'Devuelta',
  [ACCIONES_TE.REENVIADA]: 'Reenviada',
  [ACCIONES_TE.CANCELADA]: 'Cancelada',
  [ACCIONES_TE.RECIBIDA_RH]: 'Recibida por RH',
};

/**
 * Quién puede ejecutar una transición (lo mismo que verifican firestore.rules):
 *   creador → quien capturó la solicitud · aut1 → Aut. 1 o suplente del área
 *   aut2 → Aut. 2, su suplente o RH · rh → RH/admin
 * Nadie autoriza ni devuelve una solicitud que creó él mismo.
 * Reenviar desde "devuelta" va a pendiente_aut2 (y no a pendiente_aut1) si quien reenvía es el Aut. 1 del área.
 */
export const TRANSICIONES_TE = [
  { de: ESTATUS_TE.PENDIENTE_AUT1, a: ESTATUS_TE.PENDIENTE_AUT2, quien: 'aut1', accion: ACCIONES_TE.AUTORIZADA_1 },
  { de: ESTATUS_TE.PENDIENTE_AUT1, a: ESTATUS_TE.DEVUELTA, quien: 'aut1', accion: ACCIONES_TE.DEVUELTA, requiereMotivo: true },
  { de: ESTATUS_TE.PENDIENTE_AUT2, a: ESTATUS_TE.AUTORIZADA, quien: 'aut2', accion: ACCIONES_TE.AUTORIZADA_2 },
  { de: ESTATUS_TE.PENDIENTE_AUT2, a: ESTATUS_TE.DEVUELTA, quien: 'aut2', accion: ACCIONES_TE.DEVUELTA, requiereMotivo: true },
  { de: ESTATUS_TE.DEVUELTA, a: ESTATUS_TE.PENDIENTE_AUT1, quien: 'creador', accion: ACCIONES_TE.REENVIADA },
  { de: ESTATUS_TE.DEVUELTA, a: ESTATUS_TE.PENDIENTE_AUT2, quien: 'creador', accion: ACCIONES_TE.REENVIADA, soloSiEsAut1: true },
  { de: ESTATUS_TE.AUTORIZADA, a: ESTATUS_TE.PROCESADA, quien: 'rh', accion: ACCIONES_TE.RECIBIDA_RH },
  ...[ESTATUS_TE.PENDIENTE_AUT1, ESTATUS_TE.PENDIENTE_AUT2, ESTATUS_TE.DEVUELTA].map(de => (
    { de, a: ESTATUS_TE.CANCELADA, quien: 'creador', accion: ACCIONES_TE.CANCELADA }
  )),
];

/** Transiciones que `quien` puede hacer desde `estatus` */
export const transicionesTE = (estatus, quien) => TRANSICIONES_TE.filter(t => t.de === estatus && t.quien === quien);

/** Estatus con el que entra una solicitud nueva (o reenviada): el Aut. 1 de la propia área se salta su nivel */
export const estatusInicialTE = (esAut1DeLaArea) =>
  esAut1DeLaArea ? ESTATUS_TE.PENDIENTE_AUT2 : ESTATUS_TE.PENDIENTE_AUT1;
