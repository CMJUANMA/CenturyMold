/**
 * Proximamente.jsx — Pantalla de una función cuyo enlace ya existe en el menú pero todavía no se construye.
 * Se muestra en lugar de un error. Props: nombre (nombre de la función).
 */
import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';

export default function Proximamente({ nombre }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-secondary)]"><Hammer className="h-6 w-6 text-[var(--text-muted)]" /></span>
      <h1 className="text-lg font-bold text-[var(--text-main)]">{nombre}</h1>
      <p className="text-sm font-semibold text-[var(--cm-red)]">Próximamente</p>
      <p className="text-xs text-[var(--text-secondary)]">Esta función todavía no está disponible. Ya queda lista en tu menú para cuando se active.</p>
      <Link to="/" className="mt-2 text-xs font-semibold text-[var(--cm-red)] hover:underline">Volver al inicio</Link>
    </div>
  );
}
