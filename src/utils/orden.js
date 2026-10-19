/**
 * orden.js — Ordenar y comparar a prueba de tipos (para las exportaciones y los listados). Sin dependencias del navegador.
 * Los datos reales vienen mezclados: la nómina a veces es número, un campo puede faltar (null/undefined), una fecha puede ser un Timestamp de
 * Firestore o un texto ISO. `.localeCompare` solo existe en los textos: aquí todo se convierte a texto con un valor por defecto ANTES de comparar.
 */
import { toDate } from './fechas.js';

/** Cualquier valor → texto ('' o `defecto` si es null/undefined; las fechas de Firestore, en ISO) */
export function texto(v, defecto = '') {
  if (v === null || v === undefined) return defecto;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v.toDate === 'function' || v instanceof Date) return toDate(v)?.toISOString() ?? defecto;
  return String(v);
}

/** Comparación de textos en español. `numerico`: "2" antes que "10". Acepta cualquier valor */
export const comparar = (a, b, { numerico = false } = {}) => texto(a).localeCompare(texto(b), 'es', { numeric: numerico });

/** Comparador por varias claves: compararPor(x => x.area, x => x.nombre) (cada clave puede ser texto, número, null…) */
export const compararPor = (...claves) => (a, b) => {
  for (const clave of claves) {
    const c = comparar(clave(a), clave(b));
    if (c !== 0) return c;
  }
  return 0;
};

/** Fecha de Firestore, Date, texto o milisegundos → texto ISO ('' si no hay fecha válida): se puede comparar y ordenar como texto */
export const aFechaIso = (v) => toDate(v)?.toISOString() ?? '';

/**
 * Valor de ordenamiento de una hora: minutos desde las 00:00. Acepta "7:00", "16:00", "4:00PM", "12:00AM" (12 a. m. = 0:00).
 * "YA EN PLANTA" va primero (ya está en la planta); "NO REQUIERE" y lo vacío o desconocido, al final.
 */
export function minutosDeHora(h) {
  const t = texto(h).trim().toUpperCase();
  if (t === 'YA EN PLANTA') return -1;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/.exec(t);
  if (!m) return t === 'NO REQUIERE' ? 100000 : 200000;
  let hora = Number(m[1]);
  if (m[3] === 'AM' && hora === 12) hora = 0;
  else if (m[3] === 'PM' && hora < 12) hora += 12;
  return hora * 60 + Number(m[2]);
}

/** Compara dos horas por su valor (no como texto: "9:00" va antes que "16:00") */
export const compararHoras = (a, b) => minutosDeHora(a) - minutosDeHora(b);
