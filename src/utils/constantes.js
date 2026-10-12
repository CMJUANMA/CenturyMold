/**
 * constantes.js — Valores compartidos de la app (roles, estatus de solicitud y su aspecto).
 * Los valores son los que ya están guardados en Firestore: no cambiarlos sin migrar los datos.
 */

// ── Roles (usuarios/{uid}.rol) ────────────────────────────────────────────
export const ROLES = {
  SUPERINTENDENTE: 'superintendente',
  RH: 'rh',
  ADMIN: 'admin',
};

/** Roles con acceso al panel de RH */
export const ROLES_RH = [ROLES.RH, ROLES.ADMIN];
/** Roles que pueden crear solicitudes */
export const ROLES_SOLICITANTES = [ROLES.SUPERINTENDENTE, ROLES.RH, ROLES.ADMIN];

export const ROL_LABELS = {
  [ROLES.ADMIN]: 'Administrador del sistema',
  [ROLES.RH]: 'Recursos Humanos',
  [ROLES.SUPERINTENDENTE]: 'Superintendente de área',
};

/** Versión corta, para la barra lateral y los selectores */
export const ROL_LABELS_CORTOS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.RH]: 'Recursos Humanos',
  [ROLES.SUPERINTENDENTE]: 'Superintendente',
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
