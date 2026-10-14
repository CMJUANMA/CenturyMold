/**
 * InsigniasTE.jsx — Insignias de una solicitud de tiempo extra en las listas y el detalle:
 *   "3 rutas" (ámbar) cuando usa más de una ruta (cada ruta adicional cuesta) y "Extensión de turno" (azul).
 * Sin ninguna de las dos no pinta nada.
 */
import { Route, Timer } from 'lucide-react';
import { esExtension } from '../utils/tiempoExtra';

export default function InsigniasTE({ t, className = '' }) {
  const rutas = t?.rutasDistintas ?? 0;
  const ext = esExtension(t);
  if (rutas <= 1 && !ext) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {rutas > 1 && (
        <span title="Cada ruta adicional representa un costo extra" className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-warning-text)]">
          <Route className="h-3 w-3" />{rutas} rutas
        </span>
      )}
      {ext && (
        <span title="El empleado ya está en la planta y se queda más tiempo" className="inline-flex items-center gap-1 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--status-info-text)]">
          <Timer className="h-3 w-3" />Extensión de turno
        </span>
      )}
    </span>
  );
}
