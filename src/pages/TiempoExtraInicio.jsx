/**
 * TiempoExtraInicio.jsx — Entrada del módulo de tiempo extra.
 * Por ahora solo muestra qué puede hacer el usuario según sus asignaciones vigentes;
 * las pantallas de captura y de autorización llegan en la siguiente etapa.
 */
import { Link } from 'react-router-dom';
import { useAccesos } from '../hooks/useAccesos';
import { useAreas } from '../hooks/useAreas';
import { puedeAsignarAlgo } from '../utils/asignaciones';
import Spinner from '../components/Spinner';

function Bloque({ titulo, children }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{titulo}</h2>
      <div className="mt-2 text-sm text-[var(--text-main)]">{children}</div>
    </div>
  );
}

export default function TiempoExtraInicio() {
  const accesos = useAccesos();
  const { areasSolicitante, areasAut1, esAut2, esRH, cargando, error } = accesos;
  const { nombres, cargando: cargandoAreas } = useAreas();
  const lista = (ids) => ids.map(id => nombres.get(id) ?? id).join(', ');

  if (cargando || cargandoAreas) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Century Mold</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Tiempo extra</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Tu participación en el proceso, según los roles que tienes asignados hoy.</p>
      </div>

      {error && <p className="text-xs text-[var(--status-error-text)]">No se pudieron leer tus asignaciones: {error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Bloque titulo="Solicitante">
          {areasSolicitante.length ? lista(areasSolicitante) : <span className="text-[var(--text-muted)]">No capturas solicitudes</span>}
        </Bloque>
        <Bloque titulo="Autorización 1">
          {areasAut1.length ? lista(areasAut1) : <span className="text-[var(--text-muted)]">No autorizas ninguna área</span>}
        </Bloque>
        <Bloque titulo="Autorización 2">
          {esAut2 ? 'Sí' : esRH ? 'Sí, firma como Recursos Humanos' : <span className="text-[var(--text-muted)]">No</span>}
        </Bloque>
      </div>

      <p className="text-xs text-[var(--text-muted)]">Las pantallas de captura y autorización estarán disponibles próximamente.</p>
      <div className="flex flex-wrap gap-4">
        <Link to="/accesos/organigrama" className="text-xs font-semibold text-[var(--cm-red)] hover:underline">Ver organigrama de autorización</Link>
        {puedeAsignarAlgo(accesos) && (
          <Link to="/accesos/asignaciones" className="text-xs font-semibold text-[var(--cm-red)] hover:underline">Asignar roles</Link>
        )}
      </div>
    </div>
  );
}
