/**
 * MenuRenglon.jsx — El menú «⋯» de un renglón de la hoja de revisión. Se dibuja fuera de la tabla (portal, posición fija) para que el desplazamiento
 * de la hoja no lo recorte; se cierra con Esc, al hacer clic afuera o al desplazar. Flechas ↑ ↓ para moverse.
 * acciones: [{ texto, icono, onClick, peligro?, deshabilitada?, ayuda? }] · `texto`: si se da, el disparador es un botón con ese texto («⋯ Más opciones») en lugar del icono solo
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

const ALTO_ITEM = 36;

export default function MenuRenglon({ etiqueta, acciones, texto = '', deshabilitado = false }) {
  const [pos, setPos] = useState(null);
  const boton = useRef(null);
  const lista = useRef(null);

  const cerrar = (devolverFoco = false) => { setPos(null); if (devolverFoco) boton.current?.focus(); };
  const abrir = () => {
    const r = boton.current.getBoundingClientRect();
    const alto = acciones.length * ALTO_ITEM + 12;
    const arriba = r.bottom + alto > window.innerHeight - 8 && r.top > alto;
    setPos({ derecha: Math.max(8, window.innerWidth - r.right), top: arriba ? r.top - alto - 4 : r.bottom + 4 });
  };

  useEffect(() => {
    if (!pos) return undefined;
    const fuera = (e) => { if (!lista.current?.contains(e.target) && !boton.current?.contains(e.target)) setPos(null); };
    const cierra = () => setPos(null);
    document.addEventListener('mousedown', fuera);
    window.addEventListener('scroll', cierra, true);
    window.addEventListener('resize', cierra);
    lista.current?.querySelector('button:not([disabled])')?.focus();
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('scroll', cierra, true); window.removeEventListener('resize', cierra); };
  }, [pos]);

  const teclas = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...lista.current.querySelectorAll('button:not([disabled])')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <>
      <button ref={boton} type="button" aria-label={etiqueta} title={etiqueta} aria-haspopup="menu" aria-expanded={!!pos} disabled={deshabilitado} onClick={() => (pos ? cerrar() : abrir())}
        className={texto
          ? 'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 md:h-9'
          : 'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />{texto}
      </button>
      {pos && createPortal(
        <div ref={lista} role="menu" aria-label={etiqueta} onKeyDown={teclas} style={{ position: 'fixed', top: pos.top, right: pos.derecha }}
          className="z-[120] w-60 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] py-1 shadow-lg">
          {acciones.map(a => (
            <button key={a.texto} type="button" role="menuitem" disabled={a.deshabilitada} title={a.ayuda}
              onClick={() => { cerrar(); a.onClick(); }}
              className={`flex h-9 w-full cursor-pointer items-center gap-2 px-3 text-left text-xs hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${a.peligro ? 'text-[var(--status-error-text)]' : 'text-[var(--text-main)]'}`}>
              {a.icono && <a.icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}{a.texto}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
