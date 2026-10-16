/**
 * Esqueleto.jsx — Cargas con la forma del contenido (en vez de un giro): bloque suave que respira. Con prefers-reduced-motion queda quieto.
 *   Esqueleto (un bloque: se dimensiona con h-* y w-*), EsqueletoTabla (filas × columnas), EsqueletoIndicadores (tarjetas de cifras).
 */
export function Esqueleto({ className = 'h-4 w-full' }) {
  return <div className={`esqueleto ${className}`} aria-hidden="true" />;
}

export function EsqueletoTabla({ filas = 5, columnas = 5, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] ${className}`} role="status" aria-label="Cargando">
      <div className="flex gap-6 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 py-3.5">
        {Array.from({ length: columnas }, (_, i) => <Esqueleto key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className="flex gap-6 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0">
          {Array.from({ length: columnas }, (_, c) => <Esqueleto key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[8rem]' : ''}`} />)}
        </div>
      ))}
    </div>
  );
}

export function EsqueletoIndicadores({ cantidad = 4, className = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' }) {
  return (
    <div className={className} role="status" aria-label="Cargando">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
          <Esqueleto className="h-3 w-24" />
          <Esqueleto className="mt-4 h-9 w-16" />
          <Esqueleto className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
