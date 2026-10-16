/**
 * EncabezadoPagina.jsx — Cabecera de cada pantalla: título grande, UNA línea de descripción y UNA acción principal arriba a la derecha.
 *   En celular la acción pasa debajo del título a todo el ancho; con `fijaEnMovil` queda fija abajo de la pantalla (para formularios largos).
 *   Sin margen inferior: el espacio entre bloques lo da la pantalla (space-y-8 o space-y-10).
 *   `antetitulo` (pequeño, encima) y `ayuda` (el "?" de la pantalla, junto al título) son opcionales.
 */
export default function EncabezadoPagina({ titulo, descripcion, antetitulo, accion, ayuda, fijaEnMovil = false, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {antetitulo && <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">{antetitulo}</p>}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">{titulo}</h1>
          {ayuda}
        </div>
        {descripcion && <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{descripcion}</p>}
      </div>
      {accion && (
        <div className={fijaEnMovil
          ? 'fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 [&>*]:w-full sm:[&>*]:w-auto'
          : 'shrink-0 [&>*]:w-full sm:[&>*]:w-auto'}>
          {accion}
        </div>
      )}
    </header>
  );
}
