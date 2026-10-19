/**
 * recorrido.js — Geometría del recorrido guiado (dónde va el globo y hacia dónde apunta su flecha). Sin dependencias del navegador: se prueba en Node.
 * Todo son coordenadas de la ventana (position: fixed), en píxeles.
 */

export const MARGEN_GLOBO = 12;
/** Separación entre el elemento y el globo (aquí cabe la flecha) */
export const SEPARACION_GLOBO = 14;
/** Por debajo de este ancho de ventana el globo es una tarjeta fija abajo */
export const ANCHO_MOVIL = 640;
/** Zona de arriba que tapa la barra superior fija del celular (más aire) */
export const TOPE_SUPERIOR_MOVIL = 80;

export const esMovil = (anchoVentana) => anchoVentana < ANCHO_MOVIL;

/**
 * La parte del rectángulo que se ve en la ventana (null si queda totalmente fuera). Un elemento más alto que la pantalla se recorta;
 * `limites` ({ top, bottom }) reduce además la zona donde se resalta (en celular, la que no tapa la tarjeta ni la barra superior).
 */
export function recortarAVentana(r, { w, h }, limites = {}) {
  const top = Math.max(limites.top ?? 0, r.top);
  const left = Math.max(0, r.left);
  const bottom = Math.min(limites.bottom ?? h, r.top + r.height);
  const right = Math.min(w, r.left + r.width);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
}

const entre = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Dónde poner el globo.
 * @param {{ top, left, width, height }|null} rect  lo que se ve del elemento señalado (null = no hay: globo al centro)
 * @param {{ w: number, h: number }} ventana
 * @param {{ w: number, h: number }} globo  tamaño del globo ya medido
 * @returns {{ modo: 'tarjeta'|'flotante'|'centro', lado: 'abajo'|'arriba'|'derecha'|'izquierda'|null, top, left, ancho, flecha: number|null, arriba?: boolean }}
 *   (en celular, `arriba` = la tarjeta fija va arriba en vez de abajo porque el elemento está al pie de la pantalla)
 *   lado = en qué lado del elemento queda el globo; flecha = distancia de la flecha al borde del globo (null = sin flecha)
 */
export function colocarGlobo({ rect, ventana, globo, margen = MARGEN_GLOBO, separacion = SEPARACION_GLOBO }) {
  const { w, h } = ventana;
  if (esMovil(w)) {
    const ancho = w - 2 * margen;
    const topAbajo = Math.max(margen, h - globo.h - margen);
    // La tarjeta va abajo; si el elemento señalado empieza donde iría la tarjeta (p. ej. una barra fija al pie), la tarjeta pasa arriba
    const tapa = !!rect && rect.top >= topAbajo - 40;
    return { modo: 'tarjeta', lado: null, top: tapa ? TOPE_SUPERIOR_MOVIL - margen : topAbajo, left: margen, ancho, flecha: null, arriba: tapa };
  }
  const ancho = Math.min(globo.w, w - 2 * margen);
  if (!rect) {
    return { modo: 'centro', lado: null, top: Math.max(margen, (h - globo.h) / 2), left: (w - ancho) / 2, ancho, flecha: null };
  }
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const espacio = {
    abajo: h - (rect.top + rect.height) - separacion,
    arriba: rect.top - separacion,
    derecha: w - (rect.left + rect.width) - separacion,
    izquierda: rect.left - separacion,
  };
  const cabe = {
    abajo: espacio.abajo >= globo.h + margen,
    arriba: espacio.arriba >= globo.h + margen,
    derecha: espacio.derecha >= ancho + margen,
    izquierda: espacio.izquierda >= ancho + margen,
  };
  let lado = ['abajo', 'arriba', 'derecha', 'izquierda'].find(l => cabe[l]);
  if (!lado) {
    // El elemento ocupa casi toda la pantalla: el globo va dentro, abajo, sin flecha
    return { modo: 'flotante', lado: null, top: Math.max(margen, h - globo.h - margen), left: entre(cx - ancho / 2, margen, w - ancho - margen), ancho, flecha: null };
  }
  let top; let left; let flecha;
  if (lado === 'abajo' || lado === 'arriba') {
    left = entre(cx - ancho / 2, margen, w - ancho - margen);
    top = lado === 'abajo' ? rect.top + rect.height + separacion : rect.top - separacion - globo.h;
    flecha = entre(cx - left, 18, ancho - 18);
  } else {
    top = entre(cy - globo.h / 2, margen, h - globo.h - margen);
    left = lado === 'derecha' ? rect.left + rect.width + separacion : rect.left - separacion - ancho;
    flecha = entre(cy - top, 18, globo.h - 18);
  }
  return { modo: 'flotante', lado, top, left, ancho, flecha };
}

/**
 * Cuánto hay que desplazar la página (positivo = bajar) para que el elemento quede a la vista.
 * Escritorio: el conjunto elemento + globo queda centrado (si el elemento es tan alto que no caben los dos, se centra el elemento y el globo
 * va dentro). Celular: arriba (debajo de la barra superior) y por encima de la tarjeta fija de abajo.
 */
export function desplazamientoNecesario({ rect, ventana, alturaTarjeta = 0, alturaGlobo = 0 }) {
  const { w, h } = ventana;
  if (esMovil(w)) {
    const libreTop = TOPE_SUPERIOR_MOVIL;
    const libreBottom = h - alturaTarjeta - 2 * MARGEN_GLOBO;
    const disponible = libreBottom - libreTop;
    // Si cabe, queda dentro de la zona libre (lo más arriba posible); si es más alto, se ve su inicio
    const objetivo = rect.height <= disponible ? libreTop + (disponible - rect.height) / 3 : libreTop;
    return rect.top - objetivo;
  }
  const bloque = rect.height + SEPARACION_GLOBO + alturaGlobo;
  if (alturaGlobo > 0 && bloque <= h - 2 * MARGEN_GLOBO) return rect.top - (h - bloque) / 2;
  return rect.top + rect.height / 2 - h / 2;
}
