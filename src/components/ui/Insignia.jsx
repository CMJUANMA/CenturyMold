/**
 * Insignia.jsx — Etiqueta pequeña de estado o de dato. Siempre lleva texto y, en los tonos de estado, un ícono.
 *   tono: exito · aviso · error · info · neutro. `icono` reemplaza al ícono del tono; `sinIcono` lo quita (solo neutro).
 */
import { TONOS } from './estilos';

export default function Insignia({ tono = 'neutro', icono, sinIcono = false, className = '', children }) {
  const t = TONOS[tono] ?? TONOS.neutro;
  const Icono = sinIcono ? null : (icono ?? t.Icono);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${t.caja} ${className}`}>
      {Icono && <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}
