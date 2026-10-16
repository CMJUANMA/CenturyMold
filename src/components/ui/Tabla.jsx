/**
 * Tabla.jsx — Tabla del sistema de diseño: encabezado fijo (queda visible al desplazar), filas con hover suave, densidad cómoda y cifras
 * alineadas a la derecha. Folios, nóminas y horas van en IBM Plex Mono (prop `mono`).
 *
 *   <Tabla etiqueta="Próximos tiempos extra" alto="max-h-96">
 *     <thead><tr><Th>Folio</Th><Th derecha>Horas</Th></tr></thead>
 *     <tbody><Fila><Td mono>TE-2026-0001</Td><Td derecha mono>8</Td></Fila></tbody>
 *   </Tabla>
 */
export function Tabla({ etiqueta, alto, className = '', children }) {
  return (
    <div className={`overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] ${alto ?? ''} ${className}`}>
      <table className="w-full border-separate border-spacing-0 text-left text-xs" aria-label={etiqueta}>{children}</table>
    </div>
  );
}

export function Th({ derecha = false, className = '', children, ...resto }) {
  return (
    <th scope="col" className={`sticky top-0 z-10 whitespace-nowrap border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 py-3 text-xs font-medium text-[var(--text-secondary)] ${derecha ? 'text-right' : ''} ${className}`} {...resto}>
      {children}
    </th>
  );
}

export function Fila({ className = '', children, ...resto }) {
  return <tr className={`transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] ${className}`} {...resto}>{children}</tr>;
}

export function Td({ derecha = false, mono = false, className = '', children, ...resto }) {
  return (
    <td className={`border-b border-[var(--border-subtle)] px-4 py-3 text-[var(--text-main)] ${derecha ? 'text-right tabular-nums' : ''} ${mono ? 'font-mono whitespace-nowrap' : ''} ${className}`} {...resto}>
      {children}
    </td>
  );
}
