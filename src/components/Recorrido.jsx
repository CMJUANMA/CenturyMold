/**
 * Recorrido.jsx — Recorrido guiado: globos que señalan cada parte de la pantalla, con "Siguiente" y "Saltar".
 * Cada paso señala el elemento que cumple su `selector` (atributo data-tour); si no está en pantalla, el globo sale al centro.
 *   <Recorrido pasos={[{ selector, titulo, texto }]} onTerminar={() => …} />
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const ANCHO_GLOBO = 320;
const MARGEN = 12;

/** Primer elemento visible que cumple el selector (los ocultos con display:none no cuentan) */
const buscar = (selector) => (selector ? [...document.querySelectorAll(selector)].find(el => el.getClientRects().length > 0) ?? null : null);

export default function Recorrido({ pasos, onTerminar }) {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState(null);
  const globoRef = useRef(null);
  const [alto, setAlto] = useState(160);
  const paso = pasos[indice];
  const ultimo = indice === pasos.length - 1;

  const medir = useCallback(() => {
    const el = buscar(paso?.selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [paso]);

  // Lleva el elemento a la vista y lo mide; se vuelve a medir al mover o cambiar de tamaño la ventana
  useEffect(() => {
    const el = buscar(paso?.selector);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(medir, 350);
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [paso, medir]);

  useLayoutEffect(() => { if (globoRef.current) setAlto(globoRef.current.offsetHeight); }, [indice, rect]);

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onTerminar?.(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onTerminar]);

  if (!paso) return null;
  const ancho = Math.min(ANCHO_GLOBO, window.innerWidth - 2 * MARGEN);
  let top; let left;
  if (rect) {
    const debajo = rect.top + rect.height + MARGEN;
    top = debajo + alto + MARGEN <= window.innerHeight ? debajo : Math.max(MARGEN, rect.top - alto - MARGEN);
    left = Math.min(Math.max(MARGEN, rect.left), window.innerWidth - ancho - MARGEN);
  } else {
    top = Math.max(MARGEN, (window.innerHeight - alto) / 2);
    left = (window.innerWidth - ancho) / 2;
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Recorrido guiado">
      {rect
        ? <div className="pointer-events-none fixed rounded-lg ring-2 ring-[var(--cm-red)] transition-all" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }} />
        : <div className="fixed inset-0 bg-black/55" />}
      <div ref={globoRef} className="fixed rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-2xl" style={{ top, left, width: ancho }}>
        <p className="text-xs font-semibold text-[var(--text-muted)]">Paso {indice + 1} de {pasos.length}</p>
        <h3 className="mt-1 text-sm font-semibold text-[var(--text-main)]">{paso.titulo}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{paso.texto}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => onTerminar?.()} className="cursor-pointer rounded-md px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">Saltar</button>
          <button type="button" autoFocus onClick={() => (ultimo ? onTerminar?.() : setIndice(i => i + 1))}
            className="cursor-pointer rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)]">{ultimo ? 'Entendido' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  );
}
