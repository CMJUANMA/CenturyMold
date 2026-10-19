/**
 * inactividad.js — Cierre de sesión por inactividad (equipos compartidos en planta). Sin dependencias del navegador.
 * La última actividad se guarda también entre pestañas, para que una pestaña olvidada no cierre la sesión de quien trabaja en otra.
 */

/** 15 minutos sin tocar el teclado, el mouse o la pantalla; 1 minuto antes se avisa y se puede seguir */
export const LIMITE_INACTIVIDAD_MS = 15 * 60 * 1000;
export const AVISO_INACTIVIDAD_MS = 60 * 1000;
export const CLAVE_ULTIMA_ACTIVIDAD = 'cm_ultima_actividad';

/**
 * @param {number} ahora  ms
 * @param {number} ultima ms de la última actividad
 * @returns {{ estado: 'activa'|'aviso'|'vencida', restanteMs: number }}
 */
export function estadoInactividad(ahora, ultima, { limite = LIMITE_INACTIVIDAD_MS, aviso = AVISO_INACTIVIDAD_MS } = {}) {
  const restanteMs = limite - (ahora - ultima);
  if (restanteMs <= 0) return { estado: 'vencida', restanteMs: 0 };
  return { estado: restanteMs <= aviso ? 'aviso' : 'activa', restanteMs };
}

/** La actividad más reciente entre la de esta pestaña y la guardada por otra (un valor no numérico se ignora) */
export const ultimaActividad = (propia, guardada) => Math.max(Number(propia) || 0, Number(guardada) || 0);
