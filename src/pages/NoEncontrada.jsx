/**
 * NoEncontrada.jsx — Cualquier URL que no existe: un mensaje claro y el camino de regreso al inicio.
 */
import { RUTAS } from '../rutas';
import EstadoVacio from '../components/ui/EstadoVacio';

export default function NoEncontrada() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
      <EstadoVacio titulo="No encontramos esa página" texto="Puede que el enlace esté mal escrito o que ya no exista." accion={{ texto: 'Volver al inicio', to: RUTAS.inicio }} />
    </div>
  );
}
