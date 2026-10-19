/**
 * recordatoriosPantalla.js — Qué recordatorios siguen visibles al cambiar de pantalla. Un recordatorio nace sin pantalla (`ruta: null`, se ve donde
 * ocurrió la acción). Si la acción navega enseguida (enviar → Mis solicitudes) acompaña ese primer cambio; en cualquier otro cambio desaparece.
 */
/** Un aviso recién creado acompaña a la navegación que la acción provoca si ocurre dentro de este tiempo */
export const GRACIA_NAVEGACION_MS = 3000;

export function alNavegar(recordatorios, pathname, ahora = Date.now()) {
  const quedan = recordatorios
    .filter(r => r.ruta === pathname || (r.ruta === null && ahora - r.creado < GRACIA_NAVEGACION_MS))
    .map(r => (r.ruta === null ? { ...r, ruta: pathname } : r));
  return quedan.length === recordatorios.length && quedan.every((r, i) => r === recordatorios[i]) ? recordatorios : quedan;
}
