/**
 * Modal.jsx — Ventana emergente de toda la app (detalles, formularios, confirmaciones, importación…). Reglas que cumple SIEMPRE:
 *   - Nunca es más alta que la pantalla: alto máximo = alto visible (dvh, que descuenta las barras del navegador en el celular) menos un margen.
 *     El encabezado queda fijo arriba, el contenido se desplaza por dentro y `pie` (si se da) queda fijo abajo: el botón de cerrar y las acciones
 *     siempre se alcanzan.
 *   - Centrada en pantallas grandes; en celular (menos de 640 px) sube desde abajo como una hoja que ocupa todo el ancho.
 *   - Bloquea el scroll del fondo mientras está abierta (también con varias abiertas a la vez) y regresa el foco a donde estaba al cerrarse.
 *   - Escape cierra solo la de encima; el foco se queda dentro de la ventana.
 * Props: isOpen, onClose, title, subtitulo (texto chico bajo el título), icono (componente de lucide), maxWidth (clase de Tailwind),
 *        grande (ventana para elegir de una lista: en celular ocupa toda la pantalla y en pantallas grandes llega hasta el 80% del alto),
 *        pie (acciones fijas abajo), preventCloseOnBackdrop (no cierra con clic afuera ni con Escape), cerrarDeshabilitado (el botón X no se puede usar).
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBloqueoScroll } from '../hooks/useBloqueoScroll';

// Pila de ventanas abiertas: solo la de encima responde a Escape
const abiertas = [];

// En celular la ventana es una hoja de todo el ancho; el ancho máximo solo vale desde 640 px (clases escritas completas para que Tailwind las genere)
const ANCHO_DESDE_SM = {
  'max-w-xs': 'sm:max-w-xs', 'max-w-sm': 'sm:max-w-sm', 'max-w-md': 'sm:max-w-md', 'max-w-lg': 'sm:max-w-lg', 'max-w-xl': 'sm:max-w-xl', 'max-w-2xl': 'sm:max-w-2xl',
  'max-w-3xl': 'sm:max-w-3xl', 'max-w-[720px]': 'sm:max-w-[720px]', 'max-w-4xl': 'sm:max-w-4xl', 'max-w-5xl': 'sm:max-w-5xl', 'max-w-6xl': 'sm:max-w-6xl', 'max-w-7xl': 'sm:max-w-7xl',
};

const FOCALIZABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitulo,
  icono: Icono,
  children,
  pie,
  maxWidth = 'max-w-md',
  preventCloseOnBackdrop = false,
  cerrarDeshabilitado = false,
  grande = false,
  className = '',
}) {
  const idTitulo = useId();
  const panel = useRef(null);
  const identidad = useRef({});
  const alCerrar = useRef(onClose);
  useEffect(() => { alCerrar.current = onClose; });

  useBloqueoScroll(!!isOpen);

  // Pila de ventanas, Escape (solo la de encima), foco dentro de la ventana y regreso del foco
  useEffect(() => {
    if (!isOpen) return undefined;
    const yo = identidad.current;
    abiertas.push(yo);
    const previo = document.activeElement;
    // El foco entra a la ventana salvo que un campo suyo ya lo haya tomado (autoFocus)
    const entrar = setTimeout(() => { if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus(); }, 0);
    const tecla = (e) => {
      if (abiertas[abiertas.length - 1] !== yo) return;
      if (e.key === 'Escape' && !preventCloseOnBackdrop) { e.stopPropagation(); alCerrar.current?.(); return; }
      if (e.key === 'Tab' && panel.current) {
        const lista = [...panel.current.querySelectorAll(FOCALIZABLES)].filter(el => el.getClientRects().length > 0);
        if (lista.length === 0) { e.preventDefault(); panel.current.focus(); return; }
        const primero = lista[0]; const ultimo = lista[lista.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      clearTimeout(entrar);
      window.removeEventListener('keydown', tecla);
      const i = abiertas.indexOf(yo);
      if (i >= 0) abiertas.splice(i, 1);
      if (previo && typeof previo.focus === 'function' && document.contains(previo)) previo.focus({ preventScroll: true });
    };
  }, [isOpen, preventCloseOnBackdrop]);

  if (!isOpen) return null;

  // En un portal sobre <body>: ningún ancestro con transform, filtro o animación puede volverse el bloque contenedor de la ventana y descolocarla
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !preventCloseOnBackdrop) onClose?.(); }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`anim-modal modal-panel flex w-full flex-col overflow-hidden rounded-t-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xl outline-none sm:rounded-lg ${ANCHO_DESDE_SM[maxWidth] ?? 'sm:max-w-md'} ${grande ? 'modal-grande' : ''} ${className}`}
      >
        {/* Encabezado: fijo arriba, con el botón de cerrar siempre a la vista */}
        <div className="flex shrink-0 !flex-nowrap items-start justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-3 sm:py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icono && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-hover)]">
                <Icono className="h-5 w-5 text-[var(--text-secondary)]" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h2 id={idTitulo} className="break-words text-lg font-semibold leading-snug">{title}</h2>
              {subtitulo && <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitulo}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={cerrarDeshabilitado}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:w-9"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Contenido: lo único que se desplaza */}
        <div className="modal-cuerpo min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {children}
        </div>

        {/* Acciones fijas abajo (opcional) */}
        {pie && (
          <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-5 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
