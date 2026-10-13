/**
 * areasImportacion.js — Cálculo del paso "Confirmar áreas" de la importación del padrón y resumen final.
 * Sin dependencias del navegador. Trabaja sobre el plan de compararEmpleados (comparacionImportacion.js).
 */
import { esActivo } from './activo.js';
import { fechaCorta } from './comparacionImportacion.js';

export const GRUPO_SIN_AREA = 'sin-area';

/** Motivo por defecto de una excepción creada en la importación */
export const motivoExcepcionPorDefecto = (d = new Date()) => `Ajustado en importación ${fechaCorta(d)}`;

/**
 * Empleados del plan agrupados por área efectiva. Orden: áreas por `orden`, áreas desconocidas y "Sin área" al final.
 * `firma` cambia cuando cambia quién está en el grupo (o su puesto/área): una confirmación solo vale para esa firma.
 * @returns {{ id, nombre, items, firma }[]} solo grupos con empleados
 */
export function agruparPorArea(items, areas = []) {
  const nombreDe = new Map(areas.map(a => [a.id, a.nombre ?? a.id]));
  const orden = new Map([...areas].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99)).map((a, i) => [a.id, i]));
  const porId = new Map();
  for (const it of items) {
    const id = it.areaId || GRUPO_SIN_AREA;
    if (!porId.has(id)) porId.set(id, []);
    porId.get(id).push(it);
  }
  const rango = (id) => (id === GRUPO_SIN_AREA ? Infinity : orden.get(id) ?? 1e6);
  return [...porId.entries()]
    .sort((a, b) => rango(a[0]) - rango(b[0]) || String(a[0]).localeCompare(String(b[0]), 'es'))
    .map(([id, lista]) => {
      const ordenados = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return {
        id,
        nombre: id === GRUPO_SIN_AREA ? 'Sin área' : nombreDe.get(id) ?? id,
        items: ordenados,
        firma: ordenados.map(i => `${i.clave}|${i.puestoId}|${i.areaId}`).sort().join(';'),
      };
    });
}

/** ¿Todos los grupos están confirmados con su firma vigente? (sin empleados = nada que confirmar) */
export const todoConfirmado = (grupos, confirmadas) => grupos.every(g => confirmadas.get(g.id) === g.firma);

/** Línea de resumen de la lista: "N empleados en X áreas, Y cambian de área, Z sin área" */
export function resumenLista(items, grupos) {
  return {
    total: items.length,
    areas: grupos.filter(g => g.id !== GRUPO_SIN_AREA).length,
    cambian: items.filter(i => i.areaEstado === 'cambia').length,
    sinArea: items.filter(i => !i.areaId).length,
  };
}

/** Filtros de la lista de áreas */
export const FILTROS_AREA = {
  todos: () => true,
  nuevos: (i) => i.areaEstado === 'nuevo',
  cambian: (i) => i.areaEstado === 'cambia',
  sinArea: (i) => !i.areaId,
};

/**
 * Qué pasa si se cambia el área de TODO el puesto del empleado `item` a `areaNueva`:
 * se mueven los del archivo sin excepción y los activos del padrón que no vienen en el archivo (también sin excepción).
 * Los que tienen excepción no se mueven.
 */
export function impactoPuesto(plan, item, areaNueva, empleadosBase = []) {
  const delPuesto = plan.items.filter(i => i.puestoClave === item.puestoClave);
  const enArchivo = delPuesto.filter(i => !i.excepcion && i.areaId !== areaNueva);
  const nominaDe = (e) => String(e.nomina ?? e.id).trim();
  const fuera = item.puestoNuevo || !item.puestoId ? [] : empleadosBase.filter(e =>
    esActivo(e) && e.puestoId === item.puestoId && !plan.presentes.has(nominaDe(e)));
  return {
    enArchivo: enArchivo.length,
    fueraArchivo: fuera.filter(e => !e.areaExcepcion && (e.areaId ?? '') !== areaNueva).length,
    conExcepcion: delPuesto.filter(i => i.excepcion).length + fuera.filter(e => !!e.areaExcepcion).length,
  };
}

/**
 * Conteos del resumen final (antes y después de guardar). `idsBaja`: Set de las bajas que sí se aplicarán.
 * "Cambian de área" = tenían un área distinta; "Área asignada" = no tenían área y ahora sí (se cuenta aparte).
 * Un empleado puede estar a la vez en "actualizados" y en "cambian de área".
 */
export function resumenImportacion(plan, idsBaja = new Set()) {
  const items = plan.items;
  const n = (f) => items.filter(f).length;
  const bajas = plan.bajas.filter(b => idsBaja.has(b.key)).length;
  return {
    creados: n(i => i.accion === 'crear'),
    actualizados: n(i => i.accion === 'actualizar'),
    sinCambios: n(i => i.accion === 'sinCambios'),
    reactivados: n(i => i.accion === 'reactivar'),
    cambianArea: n(i => i.areaEstado === 'cambia' && !!i.areaAnteriorId),
    areaAsignada: n(i => i.areaEstado === 'cambia' && !i.areaAnteriorId),
    excepcionesNuevas: n(i => i.excepcionNueva),
    puestosNuevos: plan.resolucion?.puestosNuevos.length ?? 0,
    puestosCambioArea: plan.cambiosPuesto?.length ?? 0,
    aliasNuevos: plan.resolucion?.aliasNuevos.length ?? 0,
    bajas,
    mantenidos: plan.bajas.length - bajas,
    omitidos: plan.conteos.errores,
    omitidosPuesto: plan.resolucion?.omitidas ?? 0,
  };
}
