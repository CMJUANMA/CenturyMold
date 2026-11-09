/**
 * listaPersonal.js — Lógica de la lista de personal elegible a la que lleva la tarjeta del Inicio. Sin dependencias del navegador.
 */

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Áreas que puede ver esta persona en la lista: RH, admin, Nóminas y Aut. 2, todas las que participan en tiempo extra; Aut. 1 y
 * solicitante, solo las suyas.
 * @param {{ esRH, esNomina, esAut2, areasAut1: string[], areasSolicitante: string[] }} accesos
 * @param {{ id: string, nombre: string, participaTE?: boolean, activa?: boolean }[]} areas
 */
export function areasDeLaLista(accesos, areas = []) {
  const vigentes = areas.filter(a => a.activa !== false);
  if (accesos.esRH || accesos.esAut2 || accesos.esNomina) return vigentes.filter(a => a.participaTE === true);
  const mias = new Set([...(accesos.areasAut1 ?? []), ...(accesos.areasSolicitante ?? [])]);
  return vigentes.filter(a => mias.has(a.id));
}

/** Personal de una (o varias) áreas, ordenado por nombre. `areasPermitidas` null = sin límite; `areaId` '' = todas las permitidas */
export function filtrarLista(empleados, { areaId = '', areasPermitidas = null, busqueda = '' } = {}) {
  const q = sinAcentos(busqueda).trim();
  const permitidas = areasPermitidas ? new Set(areasPermitidas) : null;
  return empleados
    .filter(e => (!permitidas || permitidas.has(e.areaId)) && (!areaId || e.areaId === areaId)
      && (!q || String(e.nomina).startsWith(q) || sinAcentos(e.nombre).includes(q)))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

/**
 * Teléfono: lo ven RH, admin, Nóminas y el solicitante del área de cada persona (no Aut. 1 ni Aut. 2: ver firestore.rules).
 * @returns {{ muestra: boolean, puede: (empleado) => boolean }} `muestra` = si hay columna; `puede` = si se ve el de esa persona
 */
export function quienVeTelefono(accesos) {
  const todos = !!(accesos.esRH || accesos.esNomina);
  const suyas = new Set(accesos.areasSolicitante ?? []);
  return { muestra: todos || suyas.size > 0, puede: (e) => todos || suyas.has(e?.areaId) };
}
