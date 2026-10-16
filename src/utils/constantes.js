/**
 * constantes.js — Valores compartidos de la app (roles, estatus de solicitud y su aspecto).
 * Los valores son los que ya están guardados en Firestore: no cambiarlos sin migrar los datos.
 */

// ── Roles del sistema (usuarios/{uid}.rol) ───────────────────────────────
// Solo admin, rh o usuario. Los permisos operativos (Aut. 2, Aut. 1, solicitante) NO van aquí:
// son asignaciones por área, con vigencia (utils/asignaciones.js).
export const ROLES = {
  RH: 'rh',
  ADMIN: 'admin',
  USUARIO: 'usuario',
};

/** Roles con acceso al panel de RH */
export const ROLES_RH = [ROLES.RH, ROLES.ADMIN];

export const ROL_LABELS = {
  [ROLES.ADMIN]: 'Administrador del sistema',
  [ROLES.RH]: 'Recursos Humanos',
  [ROLES.USUARIO]: 'Usuario',
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
  /** Se arma antes de enviarla: solo la ve y edita su creador (los empleados se agregan en lotes de hasta 10) */
  BORRADOR: 'borrador',
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
  // Borrador en azul (no en gris como Cancelada): el orden importa, el estilo va primero y la etiqueta después
  [ESTATUS_TE.BORRADOR]: {
    cls: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
    dot: 'bg-[var(--status-info-text)]',
    label: 'Borrador',
  },
  [ESTATUS_TE.PENDIENTE_AUT1]: { ...BADGE_WARNING, label: 'En autorización (nivel 1)' },
  [ESTATUS_TE.PENDIENTE_AUT2]: { ...BADGE_WARNING, label: 'En autorización (nivel 2)' },
  [ESTATUS_TE.AUTORIZADA]: { ...BADGE_SUCCESS, label: 'Autorizada' },
  [ESTATUS_TE.DEVUELTA]: {
    label: 'Devuelta',
    cls: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]',
    dot: 'bg-[var(--status-error-text)]',
  },
  [ESTATUS_TE.CANCELADA]: { ...ESTATUS_MAP[ESTATUS_SOLICITUD.CANCELADA], label: 'Cancelada' },
  [ESTATUS_TE.PROCESADA]: { ...ESTATUS_MAP[ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR], label: 'Confirmada por RH' },
};

/** Etiqueta de un estatus de tiempo extra (la misma en todas las pantallas y en los Excel) */
export const etiquetaEstatusTE = (estatus) => ESTATUS_TE_MAP[estatus]?.label ?? String(estatus ?? '');

/** Acciones del historial (tiempoExtra/{id}/historial) */
export const ACCIONES_TE = {
  CREADA: 'creada',
  AUTORIZADA_1: 'autorizada_1',
  AUTORIZADA_2: 'autorizada_2',
  DEVUELTA: 'devuelta',
  REENVIADA: 'reenviada',
  CANCELADA: 'cancelada',
  RECIBIDA_RH: 'recibida_rh',
  ENVIADA: 'enviada',
};

export const ACCIONES_TE_LABELS = {
  [ACCIONES_TE.CREADA]: 'Solicitud creada',
  [ACCIONES_TE.AUTORIZADA_1]: 'Autorizada (nivel 1)',
  [ACCIONES_TE.AUTORIZADA_2]: 'Autorizada (nivel 2)',
  [ACCIONES_TE.DEVUELTA]: 'Devuelta',
  [ACCIONES_TE.REENVIADA]: 'Reenviada',
  [ACCIONES_TE.CANCELADA]: 'Cancelada',
  [ACCIONES_TE.RECIBIDA_RH]: 'Confirmada por RH',
  [ACCIONES_TE.ENVIADA]: 'Enviada a autorización',
};
