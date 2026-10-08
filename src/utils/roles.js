/**
 * roles.js — Helpers de autorización centralizados.
 */

/** Devuelve true para roles con acceso completo al panel de RH */
export const esPersonalRH = (rol) => rol === 'rh' || rol === 'admin';

/** Array de roles RH (para RutaRol y listas) */
export const ROLES_RH = ['rh', 'admin'];
