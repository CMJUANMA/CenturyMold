/**
 * Herramientas.jsx — /herramientas (solo admin): diagnóstico y limpieza de una sola vez. Antes eran la pestaña "Diagnóstico" de Catálogos.
 *   Revisar colecciones (cuenta documentos y busca puntos huérfanos) · Limpiar estructura vieja (con respaldo JSON y confirmación).
 */
import RevisarColecciones from './rh/RevisarColecciones';
import LimpiezaEstructura from './rh/LimpiezaEstructura';

export default function Herramientas() {
  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold text-[var(--text-muted)]">Administrador</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-main)]">Diagnóstico y limpieza</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Herramientas que se usan pocas veces. Léelas con calma antes de ejecutar algo: algunas escriben en la base de datos.</p>
      </header>
      <RevisarColecciones />
      <LimpiezaEstructura />
    </div>
  );
}
