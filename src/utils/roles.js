/**
 * roles.js — Helpers de autorización centralizados.
 */
import { ROLES_RH } from './constantes';

export { ROLES_RH };

/** Devuelve true para roles con acceso completo al panel de RH */
export const esPersonalRH = (rol) => ROLES_RH.includes(rol);
