/**
 * inactividad.js — Cierre de sesión por inactividad (equipos compartidos en planta). Sin dependencias del navegador.
 * La última actividad se guarda también entre pestañas, para que una pestaña olvidada no cierre la sesión de quien trabaja en otra.
 */

/** 30 minutos sin tocar el teclado, el mouse o la pantalla; 1 minuto antes se avisa y se puede seguir */
export const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000;
export const AVISO_INACTIVIDAD_MS = 60 * 1000;
export const CLAVE_ULTIMA_ACTIVIDAD = 'cm_ultima_actividad';

/**
 * La marca se guarda como `uid|ms`: así una marca de OTRA cuenta (o de una sesión anterior) nunca cuenta para la sesión actual.
 * (Causa del error «no puedo volver a entrar»: la marca de la sesión cerrada, ya vencida, seguía en localStorage y el temporizador de la
 * sesión NUEVA la leía al montarse y cerraba la sesión de inmediato.)
 */
export const crearMarca = (uid, ms) => `${uid}|${ms}`;
/** Hora (ms) de una marca guardada, o 0 si no existe, está mal formada o es de otra cuenta */
export function leerMarca(raw, uid) {
  if (!uid || typeof raw !== 'string') return 0;
  const i = raw.lastIndexOf('|');
  if (i < 0 || raw.slice(0, i) !== uid) return 0;
  return Number(raw.slice(i + 1)) || 0;
}

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
