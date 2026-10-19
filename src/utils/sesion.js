/**
 * sesion.js — Limpieza del estado que vive en el navegador cuando una sesión termina (cerrar sesión, inactividad, cambio de cuenta).
 * La marca de última actividad es de la sesión que terminó: si se quedara, la sesión siguiente la leería ya vencida y se cerraría sola.
 * No toca preferencias del equipo (tema), solo lo que pertenece a una sesión.
 */
import { CLAVE_ULTIMA_ACTIVIDAD } from './inactividad';

export function limpiarEstadoDeSesion() {
  try { localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD); } catch { /* sin almacenamiento */ }
}
