/**
 * puestos.js — Normalización y comparación de puestos.
 * La lista de puestos se deriva siempre de la colección empleados (no hay catálogo propio).
 */

/** trim + espacios dobles a uno + mayúsculas */
export const normalizarPuesto = (s) =>
  String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Clave de comparación: normalizado, sin acentos ni mayúsculas */
export const clavePuesto = (s) =>
  normalizarPuesto(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Distancia de edición; corta en cuanto supera `max` */
function distancia(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Máxima diferencia (en letras) para considerar dos puestos "parecidos" */
const MAX_DIFERENCIA = 1;

/**
 * Compara `texto` contra `lista`.
 * - exacto: puesto de la lista igual sin acentos/mayúsculas (o null)
 * - similares: puestos que difieren en una letra, el más cercano primero
 */
export function buscarCoincidencias(texto, lista) {
  const clave = clavePuesto(texto);
  if (!clave) return { exacto: null, similares: [] };
  let exacto = null;
  const similares = [];
  for (const p of lista) {
    const c = clavePuesto(p);
    if (c === clave) { exacto = p; continue; }
    const d = distancia(c, clave, MAX_DIFERENCIA);
    if (d <= MAX_DIFERENCIA) similares.push({ p, d });
  }
  similares.sort((x, y) => x.d - y.d || x.p.localeCompare(y.p, 'es'));
  return { exacto, similares: exacto ? [] : similares.map(s => s.p) };
}

/** Devuelve el puesto existente equivalente o, si no hay, el texto normalizado */
export function canonizarPuesto(texto, lista) {
  return buscarCoincidencias(texto, lista).exacto ?? normalizarPuesto(texto);
}

/** true si `texto` ya está en la lista (sin acentos ni mayúsculas) */
export function existePuesto(texto, lista) {
  const clave = clavePuesto(texto);
  return !!clave && lista.some(p => clavePuesto(p) === clave);
}

/**
 * Puestos únicos del padrón, ordenados alfabéticamente.
 * Variantes de acentos/mayúsculas se agrupan; se conserva la escritura más usada.
 */
export function derivarPuestos(empleados) {
  const grupos = new Map(); // clave -> Map(escritura -> conteo)
  for (const e of empleados) {
    const escrito = normalizarPuesto(e?.puesto);
    if (!escrito) continue;
    const clave = clavePuesto(escrito);
    if (!grupos.has(clave)) grupos.set(clave, new Map());
    const g = grupos.get(clave);
    g.set(escrito, (g.get(escrito) ?? 0) + 1);
  }
  return [...grupos.values()]
    .map(g => [...g.entries()].sort((a, b) => b[1] - a[1])[0][0])
    .sort((a, b) => a.localeCompare(b, 'es'));
}
