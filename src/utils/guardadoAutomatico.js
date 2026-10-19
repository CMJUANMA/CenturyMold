/**
 * guardadoAutomatico.js — Guardar el borrador de tiempo extra antes de cerrar la sesión por inactividad.
 * El formulario (EditorTE) registra aquí una función que guarda su borrador si hay cambios sin guardar; el cierre por inactividad la
 * llama justo antes de salir. Sin dependencias del navegador. No guarda nada por sí mismo: solo coordina.
 */

let guardador = null;

/** El formulario registra su función de guardado (devuelve true si guardó algo). Devuelve la función para quitarla al desmontarse */
export function registrarGuardador(fn) {
  guardador = fn;
  return () => { if (guardador === fn) guardador = null; };
}

/** Guarda el borrador en curso, si lo hay y tiene cambios. Nunca lanza: si falla, el cierre sigue. @returns {Promise<boolean>} true si se guardó */
export async function guardarBorradorAntesDeCerrar() {
  if (!guardador) return false;
  try { return (await guardador()) === true; } catch (err) { console.error('Guardado automático:', err); return false; }
}

export const MSG_BORRADOR_GUARDADO = 'Guardamos tu borrador antes de cerrar la sesión';

/** Mensaje del login tras un cierre por inactividad (con la nota del borrador si se guardó uno) */
export const mensajeCierreInactividad = (base, borradorGuardado) => (borradorGuardado ? `${base} ${MSG_BORRADOR_GUARDADO}.` : base);
