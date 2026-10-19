/**
 * useBloqueoScroll.js — Bloquea el scroll del documento mientras `activo` sea true (se pueden anidar: el scroll vuelve cuando se cierra la última).
 * Lo usan Modal, el panel lateral de una persona y el menú lateral abierto en celular. Compensa el ancho de la barra de scroll para que la
 * página no se mueva al abrir.
 */
import { useEffect } from 'react';

let bloqueos = 0;
let estiloPrevio = null;

export function useBloqueoScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    const el = document.documentElement;
    if (bloqueos === 0) {
      estiloPrevio = { overflow: el.style.overflow, paddingRight: el.style.paddingRight };
      const ancho = window.innerWidth - el.clientWidth;
      el.style.overflow = 'hidden';
      if (ancho > 0) el.style.paddingRight = `${ancho}px`;
    }
    bloqueos++;
    return () => {
      bloqueos--;
      if (bloqueos === 0 && estiloPrevio) { el.style.overflow = estiloPrevio.overflow; el.style.paddingRight = estiloPrevio.paddingRight; estiloPrevio = null; }
    };
  }, [activo]);
}
