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
import { clavePuesto, normalizarPuesto, resolverPuesto } from './puestos.js';
import { idPuestoLibre } from './estructura.js';
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

/**
 * Área que se propone para alguien que no es elegible y no trae AREA TE, según su departamento de nómina. null si no se reconoce.
 * Mfg. Supervisors/Process → Producción · MIS/HR/Supervision/Admin → Administrativo · Maintenance → Mantenimiento · Mold Maintenance → Moldes ·
 * Quality → Calidad · Shipping/Material Handling/Customer Service → Almacén.
 * @param {string} depto  @param {{ id: string, nombre: string }[]} areas
 */
export function areaPorDepartamento(depto, areas) {
  const d = clavePuesto(depto);
  if (!d) return null;
  const nombre = /mold\s*maint/.test(d) ? 'moldes'
    : /maint/.test(d) ? 'mantenimiento'
      : /quality|calidad/.test(d) ? 'calidad'
        : /shipping|receiving|material|customer/.test(d) ? 'almacen'
          : /mfg|manufact|process|production|produccion/.test(d) ? 'produccion'
            : /\bmis\b|\bhr\b|supervis|admin|human/.test(d) ? 'administrativo' : '';
  return nombre ? areas.find(a => clavePuesto(a.nombre) === nombre) ?? null : null;
}

export const CREAR_PUESTO = '__crear__';

/** Elección inicial de un nuevo: el área propuesta y, del puesto, el que coincide (nivel a o b) o crearlo si no existe */
export function eleccionInicial(nuevo) {
  const r = nuevo.puestoRes;
  return {
    areaId: nuevo.areaSugerida ?? '',
    puestoSel: r?.puesto?.id ?? (nuevo.puestoTexto ? CREAR_PUESTO : ''),
  };
}

/**
 * Documentos de las altas con lo que RH eligió en la vista previa. Sin teléfono ni ruta (como cualquier alta). Si el área elegida no es la del
 * puesto, se guarda como excepción de área (así no se revierte al sincronizar). Los puestos que hay que crear se comparten entre quienes traen el
 * mismo texto y se crean en el área de la primera persona.
 * @param {{ nuevos: object[], elecciones: Record<string, { areaId: string, puestoSel: string }>, puestos: object[], areas: object[] }} p
 * @returns {{ altas: { id: string, datos: object }[], puestosNuevos: { id, nombre, areaId, activo, alias }[], errores: { nomina: string, mensaje: string }[] }}
 */
export function construirAltas({ nuevos, elecciones, puestos, areas }) {
  const porId = new Map(puestos.map(p => [p.id, p]));
  const ocupados = new Set(puestos.map(p => p.id));
  const areasPorId = new Map(areas.map(a => [a.id, a]));
  const creados = new Map(); // clave del texto → puesto nuevo
  const altas = []; const errores = [];
  for (const n of nuevos) {
    const el = elecciones[n.nomina] ?? eleccionInicial(n);
    if (!areasPorId.has(el.areaId)) { errores.push({ nomina: n.nomina, mensaje: 'Elige el área' }); continue; }
    let puesto;
    if (el.puestoSel === CREAR_PUESTO) {
      const nombre = normalizarPuesto(n.puestoTexto);
      if (!nombre) { errores.push({ nomina: n.nomina, mensaje: 'Elige el puesto' }); continue; }
      const clave = clavePuesto(nombre);
      if (!creados.has(clave)) {
        const id = idPuestoLibre(nombre, ocupados);
        ocupados.add(id);
        creados.set(clave, { id, nombre, areaId: el.areaId, activo: true, alias: [] });
      }
      puesto = creados.get(clave);
    } else {
      puesto = porId.get(el.puestoSel);
      if (!puesto) { errores.push({ nomina: n.nomina, mensaje: 'Elige el puesto' }); continue; }
    }
    const excepcion = el.areaId !== puesto.areaId ? el.areaId : null;
    altas.push({
      id: n.nomina,
      datos: {
        nomina: n.nomina, nombre: n.nombre, nombreLower: clavePuesto(n.nombre).toLowerCase(), puesto: puesto.nombre, puestoId: puesto.id,
        areaId: el.areaId, areaExcepcion: excepcion, areaExcepcionMotivo: excepcion ? MOTIVO_AREA_TE : '',
        activo: true, elegibleTE: n.elegible === true, rutaId: '', comunidadId: '', puntoReunionId: '',
        ...(n.depto ? { depto: n.depto } : {}),
      },
    });
  }
  return { altas, puestosNuevos: [...creados.values()], errores };
}

// ── Carga del archivo de elegibles (con el área de tiempo extra) ───────────────────────────────

export const MOTIVO_AREA_TE = 'Área de tiempo extra según el padrón de elegibles';

/**
 * Plan de la carga del archivo «padrón de elegibles»: por cada nómina del archivo pone elegibleTE y, si es elegible, su área (AREA TE manda
 * sobre la del puesto/departamento; si difiere del área del puesto se guarda como excepción de área, para que el área no se revierta al
 * sincronizar). A un NO elegible no se le cambia el área. Los empleados del padrón que no vienen en el archivo quedan con elegibleTE false
 * (no se desactivan: pueden ser bajas, se reportan).
 *
 * @param {object} p
 * Las nóminas del archivo que NO están en el padrón no se ignoran: salen en `noEnPadron` con sus datos (nombre, puesto, departamento, área
 * propuesta y resolución del puesto) para darlas de alta (ver construirAltas).
 * @param {{ filaExcel?: number, nomina: string, nombre?: string, puesto?: string, depto?: string, areaTE: string, elegible: boolean|null|undefined }[]} p.filas
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
    if (!e) {
      const nombre = String(f.nombre ?? '').trim().replace(/\s+/g, ' ');
      if (!nombre) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: 'No está en el padrón y la fila no trae NOMBRE: no se puede dar de alta' }); continue; }
      const areaArchivo = areaPorClave.get(clavePuesto(f.areaTE));
      if (f.elegible && !areaArchivo) { problemas.push({ filaExcel: f.filaExcel, nomina, mensaje: `AREA TE «${f.areaTE ?? ''}» no existe en el catálogo de áreas` }); continue; }
      const sugerida = areaArchivo ?? areaPorDepartamento(f.depto, areas);
      noEnPadron.push({
        nomina, nombre, puestoTexto: String(f.puesto ?? '').trim(), depto: String(f.depto ?? '').trim(), areaTE: f.areaTE ?? '', elegible: f.elegible, filaExcel: f.filaExcel,
        areaSugerida: sugerida?.id ?? '', areaFija: f.elegible,
        puestoRes: resolverPuesto(f.puesto, puestos.filter(p => p.nombre)),
      });
      if (f.elegible) { elegibles++; porArea.set(areaArchivo.id, (porArea.get(areaArchivo.id) ?? 0) + 1); } else noElegibles++;
      continue;
    }

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
