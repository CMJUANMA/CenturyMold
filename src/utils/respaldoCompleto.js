/**
 * respaldoCompleto.js — Respaldo completo de los datos en un archivo JSON (solo admin). Sin dependencias del navegador (se prueba en Node).
 * Es el respaldo manual mientras no haya respaldos programados (requieren el plan Blaze). No incluye contraseñas (no se guardan en Firestore).
 * El archivo contiene datos personales y la bitácora: se guarda con el mismo cuidado que el padrón.
 */

/** Colecciones que se respaldan, en el orden en que se leen. `sub`: subcolecciones de cada documento (solo tiempoExtra) */
export const COLECCIONES_RESPALDO = [
  'usuarios', 'asignaciones', 'areas', 'puestos', 'empleados', 'rutas', 'comunidades', 'puntosReunion', 'turnosNomina', 'contadores', 'bitacora',
  'tiempoExtra', 'solicitudes',
];
export const SUBCOLECCIONES_RESPALDO = { tiempoExtra: ['empleados', 'historial'], solicitudes: ['pasajeros'] };

/** Valor de Firestore → JSON: fechas (Timestamp, Date) a texto ISO, sin undefined; recursivo */
export function aJson(v) {
  if (v === undefined) return null;
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(aJson);
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, aJson(x)]));
}

/**
 * @param {{ colecciones: Record<string, { id: string, data: object, sub?: Record<string, {id, data}[]> }[]>, exportadoPor: string, fecha?: Date }} p
 * @returns {{ formato: string, exportadoPor: string, fecha: string, conteo: Record<string, number>, colecciones: object }}
 */
export function construirRespaldo({ colecciones, exportadoPor, fecha = new Date() }) {
  const salida = {};
  const conteo = {};
  for (const [nombre, docs] of Object.entries(colecciones)) {
    salida[nombre] = docs.map(d => ({ id: d.id, ...aJson(d.data), ...(d.sub ? { _sub: Object.fromEntries(Object.entries(d.sub).map(([s, lista]) => [s, lista.map(x => ({ id: x.id, ...aJson(x.data) }))])) } : {}) }));
    conteo[nombre] = docs.length;
  }
  return { formato: 'century-mold-respaldo-v1', exportadoPor, fecha: fecha.toISOString(), conteo, colecciones: salida };
}

export function nombreRespaldoCompleto(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Respaldo_Completo_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
}
