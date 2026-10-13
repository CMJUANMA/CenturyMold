/**
 * puestos.js — Normalización y comparación de puestos.
 * El catálogo oficial vive en la colección puestos; derivarPuestos solo sirve a formularios que no lo cargan.
 */

/**
 * Quita caracteres de control y secuencias de escape de Excel como "_x0002_"
 * (así salen de los reportes de nómina), y deja los espacios simples y sin bordes.
 */
export const limpiarTexto = (s) =>
  String(s ?? '')
    .replace(/_x[0-9a-fA-F]{4}_/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Limpieza + mayúsculas */
export const normalizarPuesto = (s) => limpiarTexto(s).toUpperCase();

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

/** Id de documento de un puesto: slug del nombre normalizado */
export const slugPuesto = (s) =>
  clavePuesto(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Porcentaje máximo del largo que puede diferir un puesto para proponer una corrección */
const PORCENTAJE_MAX = 0.15;
/** Letras de diferencia máximas para proponer una corrección */
const LETRAS_MAX = 2;

/**
 * Resuelve el texto de un puesto contra el catálogo, en tres niveles (única lógica de comparación de puestos):
 *  a. Coincide (sin acentos/mayúsculas/espacios sobrantes/"_x0002_") con un puesto o uno de sus alias → { nivel: 'a', puesto }
 *  b. No coincide pero UN solo puesto está a 1 o 2 letras (y no más del 15 % del largo) → { nivel: 'b', puesto, distancia }
 *  c. Cualquier otra cosa (sin parecido, o dos o más candidatos igual de cercanos) → { nivel: 'c', ambiguo }
 * @param texto    puesto tal como viene en el archivo
 * @param catalogo [{ id, nombre, alias?: string[] }]
 */
export function resolverPuesto(texto, catalogo) {
  const clave = clavePuesto(texto);
  if (!clave) return { nivel: 'vacio' };
  const claves = catalogo.map(p => ({ p, cs: [p.nombre, ...(p.alias ?? [])].map(clavePuesto).filter(Boolean) }));

  const exacto = claves.find(x => x.cs.includes(clave));
  if (exacto) return { nivel: 'a', puesto: exacto.p };

  const limite = Math.min(LETRAS_MAX, Math.floor(clave.length * PORCENTAJE_MAX));
  if (limite < 1) return { nivel: 'c', ambiguo: false };
  const candidatos = [];
  for (const { p, cs } of claves) {
    const d = Math.min(...cs.map(c => distancia(c, clave, limite)));
    if (d <= limite) candidatos.push({ p, d });
  }
  if (candidatos.length === 0) return { nivel: 'c', ambiguo: false };
  const minimo = Math.min(...candidatos.map(c => c.d));
  const mejores = candidatos.filter(c => c.d === minimo);
  if (mejores.length === 1) return { nivel: 'b', puesto: mejores[0].p, distancia: minimo };
  return { nivel: 'c', ambiguo: true, candidatos: mejores.map(c => c.p) };
}

/** Escritura canónica de un puesto frente a una lista de nombres (nivel a de resolverPuesto); si no está, el texto normalizado */
export function canonizarPuesto(texto, lista) {
  const r = resolverPuesto(texto, lista.map(nombre => ({ nombre })));
  return r.nivel === 'a' ? r.puesto.nombre : normalizarPuesto(texto);
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
