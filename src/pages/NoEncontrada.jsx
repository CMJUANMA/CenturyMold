/**
 * NoEncontrada.jsx — Cualquier URL que no existe: un mensaje claro y el camino de regreso al inicio.
 */
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { RUTAS } from '../rutas';

export default function NoEncontrada() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-secondary)]"><SearchX className="h-6 w-6 text-[var(--text-muted)]" /></span>
      <h1 className="text-lg font-semibold text-[var(--text-main)]">No encontramos esa página</h1>
      <p className="text-xs text-[var(--text-secondary)]">Puede que el enlace esté mal escrito o que ya no exista.</p>
      <Link to={RUTAS.inicio} className="mt-2 text-xs font-semibold text-[var(--accent-text)] hover:underline">Volver al inicio</Link>
    </div>
  );
}
