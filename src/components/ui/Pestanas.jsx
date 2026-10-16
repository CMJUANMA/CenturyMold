/**
 * Pestanas.jsx — Pestañas del sistema de diseño: la activa lleva el acento de la marca (subrayado); las demás, gris. Con teclado: flechas.
 *   <Pestanas etiqueta="Secciones" items={[{ id, etiqueta, contador?, icono? }]} activa={id} onCambio={setId} />
 */
import { useRef } from 'react';

export default function Pestanas({ etiqueta = 'Secciones', items, activa, onCambio, className = '' }) {
  const refs = useRef([]);
  const mover = (e, i) => {
    const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!salto) return;
    e.preventDefault();
    const j = (i + salto + items.length) % items.length;
    refs.current[j]?.focus();
    onCambio(items[j].id);
  };
  return (
    <div className={`border-b border-[var(--border-color)] ${className}`}>
      <div role="tablist" aria-label={etiqueta} className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((it, i) => {
          const esActiva = it.id === activa;
          const Icono = it.icono;
          return (
            <button key={it.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={esActiva} tabIndex={esActiva ? 0 : -1}
              onClick={() => onCambio(it.id)} onKeyDown={(e) => mover(e, i)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors duration-150 ${esActiva
                ? 'border-[var(--accent)] text-[var(--text-main)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>
              {Icono && <Icono className="h-4 w-4" aria-hidden="true" />}
              {it.etiqueta}
              {it.contador != null && (
                <span className={`rounded-md px-1.5 text-xs font-medium tabular-nums ${esActiva ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'}`}>{it.contador}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
