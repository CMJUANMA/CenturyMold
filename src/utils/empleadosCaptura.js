/**
 * empleadosCaptura.js — A quién se le puede pedir tiempo extra desde la pantalla de captura. Sin dependencias del navegador; se prueba en Node.
 *
 * La lista de «Agregar empleados» nunca ofrece: a quien está capturando, ni a nadie con un rol operativo vigente (Aut. 2 de la planta; Aut. 1 y solicitante del
 * área), además del personal no elegible o dado de baja (esElegibleActivo). Quien pide tiempo extra para su gente no se lo pide a quien autoriza ni a sí mismo.
 */
import { esElegibleActivo } from './elegibles.js';

/**
 * Nóminas con un rol operativo VIGENTE que no deben salir: Aut. 2 (de toda la planta) y Aut. 1 y solicitante del área de la solicitud.
 * @param {{ nomina, rol, areaId, activo, desde, hasta }[]} asignaciones
 * @param {string} areaId  el área de la solicitud
 * @param {(a: object) => boolean} esVigente  p. ej. `esVigente` de asignaciones.js
 * @returns {Set<string>}
 */
export function nominasConRolOperativo(asignaciones = [], areaId, esVigente = (a) => a?.activo === true) {
  const nominas = new Set();
  for (const a of asignaciones) {
    if (!a?.nomina || !esVigente(a)) continue;
    if (a.rol === 'aut2' || (['aut1', 'solicitante'].includes(a.rol) && a.areaId === areaId)) nominas.add(String(a.nomina));
  }
  return nominas;
}

/**
 * Los empleados que se ofrecen al capturar tiempo extra en un área: activos, elegibles, de esa área, y nunca quien captura ni quien tiene un rol operativo.
 * @param {object[]} padron  @param {string} areaId  @param {{ nominaPropia?: string, conRol?: Set<string> }} opciones
 */
export function empleadosParaCapturar(padron, areaId, { nominaPropia = '', conRol = new Set() } = {}) {
  const propia = String(nominaPropia ?? '');
  return padron.filter(e => esElegibleActivo(e) && e.areaId === areaId && String(e.nomina) !== propia && !conRol.has(String(e.nomina)));
}
