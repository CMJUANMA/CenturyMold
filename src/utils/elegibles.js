/**
 * elegibles.js — Personal ELEGIBLE para tiempo extra (empleados/{nómina}.elegibleTE, bool). Sin dependencias del navegador.
 *
 * Solo el personal elegible aparece en lo que sirve para capturar tiempo extra (buscadores y listas de captura, «Personal de mi área»,
 * contadores del Inicio, «Agregar empleado» y reemplazos de nómina). Supervisores, jefes y administrativos son NO elegibles pero siguen en
 * el padrón: se les crea usuario, se les asignan roles y salen en el organigrama y en la pantalla Personal de RH/admin.
 *
 * Un documento sin el campo (anterior a esta función, aún sin clasificar) se trata como elegible: solo `elegibleTE: false` oculta a alguien.
 * Así, desplegar la app antes de cargar el archivo de elegibles no vacía las listas.
 */
import { clavePuesto } from './puestos.js';
import { esActivo } from './activo.js';

export const esElegibleTE = (e) => !!e && e.elegibleTE !== false;

/** Activos y elegibles: lo que ven las listas de captura y los contadores */
export const esElegibleActivo = (e) => esActivo(e) && esElegibleTE(e);

export const FILTRO_ELEGIBLE = { ELEGIBLES: 'elegibles', NO_ELEGIBLES: 'no', TODOS: 'todos' };

/** Filtro de la pantalla Personal: «Elegibles / No elegibles / Todos» */
export function filtrarPorElegibilidad(lista, filtro = FILTRO_ELEGIBLE.TODOS) {
  if (filtro === FILTRO_ELEGIBLE.ELEGIBLES) return lista.filter(esElegibleTE);
  if (filtro === FILTRO_ELEGIBLE.NO_ELEGIBLES) return lista.filter(e => !esElegibleTE(e));
  return lista;
}

/**
 * Valor de la celda ELEGIBLE TE → true | false | null (vacía: no cambia el valor actual) | undefined (no se entiende)
 */
export function leerElegible(valor) {
  const t = clavePuesto(valor);
  if (t === '') return null;
  if (['si', 's', '1', 'true', 'x', 'verdadero', 'yes'].includes(t)) return true;
  if (['no', 'n', '0', 'false', 'falso'].includes(t)) return false;
  return undefined;
}

export const etiquetaElegible = (b) => (b ? 'SI' : 'NO');

// ── Carga del archivo de elegibles (con el área de tiempo extra) ───────────────────────────────

export const MOTIVO_AREA_TE = 'Área de tiempo extra según el padrón de elegibles';

/**
 * Plan de la carga del archivo «padrón de elegibles»: por cada nómina del archivo pone elegibleTE y, si es elegible, su área (AREA TE manda
 * sobre la del puesto/departamento; si difiere del área del puesto se guarda como excepción de área, para que el área no se revierta al
 * sincronizar). A un NO elegible no se le cambia el área. Los empleados del padrón que no vienen en el archivo quedan con elegibleTE false
 * (no se desactivan: pueden ser bajas, se reportan).
 *
 * @param {object} p
 * @param {{ filaExcel?: number, nomina: string, areaTE: string, elegible: boolean|null|undefined }[]} p.filas
 * @param {object[]} p.empleados  documentos del padrón [{ id, nomina, nombre, areaId, puestoId, ... }]
 * @param {{ id: string, nombre: string }[]} p.areas
 * @param {{ id: string, areaId: string }[]} p.puestos
 * @returns {{ cambios: { id, nomina, nombre, datos: object, areaAntes: string, areaDespues: string, elegible: boolean, cambia: boolean }[],
 *   porArea: Map<string, number>, conteo: { elegibles: number, noElegibles: number, sinArchivo: number, sinCambios: number },
 *   noEnArchivo: object[], noEnPadron: object[], problemas: { filaExcel?: number, nomina: string, mensaje: string }[] }}
 */
export function planElegiblesTE({ filas, empleados, areas, puestos }) {
  const porNomina = new Map(empleados.map(e => [String(e.nomina ?? e.id).trim(), e]));
  const puestoPorId = new Map(puestos.map(p => [p.id, p]));
  const areaPorClave = new Map(areas.map(a => [clavePuesto(a.nombre), a]));
  const problemas = [];
  const noEnPadron = [];
  const cambios = [];
  const porArea = new Map();
  const vistas = new Set();
  let elegibles = 0; let noElegibles = 0; let sinCambios = 0;

  for (const f of filas) {
    const nomina = String(f.nomina ?? '').trim();
    if (!/^\d+$/.test(nomina)) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: 'Nómina no válida' }); continue; }
    if (vistas.has(nomina)) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: 'Nómina repetida en el archivo' }); continue; }
    vistas.add(nomina);
    if (f.elegible !== true && f.elegible !== false) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: 'ELEGIBLE TE debe ser SI o NO' }); continue; }
    const e = porNomina.get(nomina);
    if (!e) { noEnPadron.push({ nomina, areaTE: f.areaTE ?? '', elegible: f.elegible, filaExcel: f.filaExcel }); continue; }

    const datos = {};
    const areaAntes = e.areaId ?? '';
    let areaDespues = areaAntes;
    if (e.elegibleTE !== f.elegible) datos.elegibleTE = f.elegible;
    if (f.elegible) {
      const area = areaPorClave.get(clavePuesto(f.areaTE));
      if (!area) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: `AREA TE «${f.areaTE ?? ''}» no existe en el catálogo de áreas` }); continue; }
      areaDespues = area.id;
      const areaPuesto = puestoPorId.get(e.puestoId)?.areaId ?? '';
      const excepcion = area.id !== areaPuesto ? area.id : null;
      const motivo = excepcion ? ((e.areaExcepcion === excepcion && e.areaExcepcionMotivo) ? e.areaExcepcionMotivo : MOTIVO_AREA_TE) : '';
      if (area.id !== areaAntes) datos.areaId = area.id;
      if ((e.areaExcepcion ?? null) !== excepcion) datos.areaExcepcion = excepcion;
      if ((e.areaExcepcionMotivo ?? '') !== motivo) datos.areaExcepcionMotivo = motivo;
      elegibles++;
      porArea.set(area.id, (porArea.get(area.id) ?? 0) + 1);
    } else noElegibles++;
    const cambia = Object.keys(datos).length > 0;
    if (!cambia) sinCambios++;
    cambios.push({ id: String(e.id ?? nomina), nomina, nombre: e.nombre ?? '', datos, areaAntes, areaDespues, elegible: f.elegible, cambia });
  }

  // El resto del padrón (activos e inactivos): elegibleTE false. Se lista para que RH revise posibles bajas; no se desactiva a nadie
  const noEnArchivo = [];
  for (const e of empleados) {
    const nomina = String(e.nomina ?? e.id).trim();
    if (vistas.has(nomina)) continue;
    noEnArchivo.push({ id: String(e.id ?? nomina), nomina, nombre: e.nombre ?? '', puesto: e.puesto ?? '', areaId: e.areaId ?? '', activo: esActivo(e) });
    if (e.elegibleTE !== false) cambios.push({ id: String(e.id ?? nomina), nomina, nombre: e.nombre ?? '', datos: { elegibleTE: false }, areaAntes: e.areaId ?? '', areaDespues: e.areaId ?? '', elegible: false, cambia: true });
    else sinCambios++;
  }
  noEnArchivo.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    cambios, porArea, noEnArchivo, noEnPadron, problemas,
    conteo: { elegibles, noElegibles, sinArchivo: noEnArchivo.length, sinCambios },
  };
}
