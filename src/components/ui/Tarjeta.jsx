/**
 * Tarjeta.jsx — Contenedor e indicador del sistema de diseño.
 *   Tarjeta:   superficie con borde de 1 px, sin sombra; título y acción opcionales.
 *   Indicador: número grande, etiqueta pequeña y, si lleva `to`, es un enlace a donde se atiende. `atencion` lo resalta en tono de aviso
 *              (con el ícono y el texto: nunca solo color); el rojo de la marca no se usa aquí.
 */
import { Link } from 'react-router-dom';

export function Tarjeta({ titulo, accion, className = '', cuerpoClassName = 'p-5', children }) {
  return (
    <section className={`rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] ${className}`}>
      {(titulo || accion) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
          {titulo && <h2 className="text-base font-semibold text-[var(--text-main)]">{titulo}</h2>}
          {accion}
        </header>
      )}
      <div className={cuerpoClassName}>{children}</div>
    </section>
  );
}

/**
 * Indicador: etiqueta arriba (alto fijo de 2 líneas), cifra en una posición fija y descripción abajo (alto fijo, máximo 2 líneas), para que
 * las cifras de varias tarjetas en una fila queden a la misma altura. La cifra va en IBM Plex Sans con cifras tabulares (la mono es solo
 * para folios, nóminas y horas dentro de tablas).
 */
export function Indicador({ etiqueta, valor, ayuda, to, atencion = false, icono: Icono, cargando = false, className = '' }) {
  const cuerpo = (
    <div className={`flex h-full flex-col rounded-lg border p-5 transition-colors duration-150 ${atencion
      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
      : 'border-[var(--border-color)] bg-[var(--bg-surface)]'} ${to ? (atencion ? 'hover:border-[var(--status-warning-text)]' : 'hover:bg-[var(--bg-surface-hover)]') : ''} ${className}`}>
      <div className="flex min-h-10 items-start justify-between gap-3">
        <h3 className={`text-xs font-medium ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-secondary)]'}`}>{etiqueta}</h3>
        {Icono && <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />}
      </div>
      <div className="mt-1 flex h-10 items-center">
        {cargando
          ? <div className="esqueleto h-8 w-16" role="status" aria-label="Cargando" />
          : <p className={`text-3xl font-medium tabular-nums ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>{valor}</p>}
      </div>
      <p className={`mt-2 min-h-10 line-clamp-2 text-xs ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`}>{ayuda}</p>
    </div>
  );
  return to ? <Link to={to} className="block h-full rounded-lg">{cuerpo}</Link> : cuerpo;
}

/**
 * IndicadorCompacto: cifra pequeña y etiqueta en una celda (sin tarjeta grande). Se usa en una fila para lo que está en 0 o no pide atención.
 * Agrupar dentro de <FilaIndicadores>.
 */
export function IndicadorCompacto({ etiqueta, valor, to }) {
  const cuerpo = (
    <div className="flex h-full items-baseline gap-2 bg-[var(--bg-surface)] px-4 py-3 transition-colors duration-150 hover:bg-[var(--bg-surface-hover)]">
      <span className="text-lg font-medium tabular-nums text-[var(--text-main)]">{valor}</span>
      <span className="text-xs text-[var(--text-secondary)]">{etiqueta}</span>
    </div>
  );
  return to ? <Link to={to} className="block">{cuerpo}</Link> : cuerpo;
}

export function FilaIndicadores({ className = '', children }) {
  return <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--border-subtle)] sm:grid-cols-3 lg:grid-cols-5 ${className}`}>{children}</div>;
}
