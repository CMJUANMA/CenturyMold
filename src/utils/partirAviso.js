/**
 * partirAviso.js — Un aviso (toast) nunca debe ocupar media pantalla: lo largo (p. ej. un error técnico de Firestore pegado al texto) se recorta y el
 * texto completo pasa al «Ver detalle». Sin dependencias del navegador; se prueba en Node.
 */
export const LARGO_MAXIMO_AVISO = 140;

/** @returns {{ msg: string, detalle: string }} lo que se ve y lo que queda oculto bajo «Ver detalle» ('' si no hay) */
export function partirAviso(msg, detalle = '') {
  const texto = String(msg ?? '');
  const extra = String(detalle ?? '');
  if (texto.length <= LARGO_MAXIMO_AVISO * 1.4) return { msg: texto, detalle: extra };
  const corte = texto.lastIndexOf(' ', LARGO_MAXIMO_AVISO);
  return { msg: texto.slice(0, corte > 60 ? corte : LARGO_MAXIMO_AVISO).trimEnd() + '…', detalle: [extra, texto].filter(Boolean).join('\n\n') };
}
