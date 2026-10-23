/** hojaNomina.js — Navegación con teclado de la hoja de revisión de nómina (celdas con data-f = renglón visible y data-c = día dentro de [data-hoja]). */

const COLUMNAS = 7;

/** Enfoca la celda vecina de la hoja: df = renglones, dc = días (salta los días que no existen en un rango libre y los renglones quitados) */
export function moverFoco(el, df, dc) {
  const hoja = el.closest('[data-hoja]');
  if (!hoja) return;
  let f = Number(el.dataset.f) + df, c = Number(el.dataset.c) + dc;
  const filas = Number(hoja.dataset.filas);
  while (f >= 0 && f < filas && c >= 0 && c < COLUMNAS) {
    const sig = hoja.querySelector(`[data-f="${f}"][data-c="${c}"]:not(:disabled)`);
    if (sig) { sig.focus(); return; }
    f += df; c += dc;
  }
}
