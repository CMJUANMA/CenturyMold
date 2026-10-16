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
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
          {titulo && <h2 className="text-base font-semibold text-[var(--text-main)]">{titulo}</h2>}
          {accion}
        </header>
      )}
      <div className={cuerpoClassName}>{children}</div>
    </section>
  );
}

export function Indicador({ etiqueta, valor, ayuda, to, atencion = false, icono: Icono, cargando = false, className = '' }) {
  const cuerpo = (
    <div className={`flex h-full flex-col justify-between rounded-lg border p-5 transition-colors duration-150 ${atencion
      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
      : 'border-[var(--border-color)] bg-[var(--bg-surface)]'} ${to ? (atencion ? 'hover:border-[var(--status-warning-text)]' : 'hover:bg-[var(--bg-surface-hover)]') : ''} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-xs font-medium ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-secondary)]'}`}>{etiqueta}</h3>
        {Icono && <Icono className={`h-4 w-4 shrink-0 ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />}
      </div>
      <div className="mt-3">
        {cargando
          ? <div className="esqueleto h-9 w-16" role="status" aria-label="Cargando" />
          : <p className={`font-mono text-3xl font-medium tabular-nums ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>{valor}</p>}
        {ayuda && <p className={`mt-1.5 text-xs ${atencion ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`}>{ayuda}</p>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full rounded-lg">{cuerpo}</Link> : cuerpo;
}
