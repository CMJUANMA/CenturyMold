/**
 * activo.js — Estado activo/inactivo (baja lógica) de empleados y del directorio.
 * El campo vigente es `activo`; `activa` se acepta como dato heredado de versiones anteriores.
 */

/** true salvo que el documento esté marcado como inactivo */
export const esActivo = (d) => !!d && d.activo !== false && d.activa !== false;

/** Elementos activos, más el seleccionado aunque esté inactivo (para no perder el valor al editar) */
export const opcionesVigentes = (lista, seleccionadoId) =>
  lista.filter(x => esActivo(x) || (seleccionadoId && x.id === seleccionadoId));

/**
 * Ruta/comunidad/punto de un empleado, descartando lo que esté inactivo o ya no exista.
 * Si la ruta no es válida se descarta todo; si la comunidad no lo es, también el punto.
 */
export function rutaVigente(emp, { rutas, comunidades, puntos }) {
  const vigente = (lista, id) => !!id && lista.some(x => x.id === id && esActivo(x));
  const rutaId = vigente(rutas, emp?.rutaId) ? emp.rutaId : '';
  const comunidadId = rutaId && vigente(comunidades, emp.comunidadId) ? emp.comunidadId : '';
  const puntoReunionId = comunidadId && vigente(puntos, emp.puntoReunionId) ? emp.puntoReunionId : '';
  return { rutaId, comunidadId, puntoReunionId };
}
