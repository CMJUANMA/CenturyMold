/**
 * TiempoExtraInicio.jsx — Entrada del módulo de tiempo extra.
 * Por ahora solo muestra qué puede hacer el usuario según la matriz de autorización;
 * las pantallas de captura y de autorización llegan en la siguiente etapa.
 */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAccesosTE } from '../hooks/useAccesosTE';
import { ROLES_RH } from '../utils/constantes';
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
  const { usuario } = useAuth();
  const { areasSolicitante, areasAut1, esAut2, cargando, error } = useAccesosTE();
  const esRH = ROLES_RH.includes(usuario?.rol);
  const nombres = (areas) => areas.map(a => a.nombre).join(', ');

  if (cargando) return <Spinner />;
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Century Mold</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Tiempo extra</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Tu participacion en el proceso, segun la matriz de niveles de autorizacion.</p>
      </div>

      {error && <p className="text-xs text-[var(--status-error-text)]">No se pudo leer la matriz: {error.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Bloque titulo="Solicitante">
          {areasSolicitante.length ? nombres(areasSolicitante) : <span className="text-[var(--text-muted)]">No capturas solicitudes</span>}
        </Bloque>
        <Bloque titulo="Autorizacion 1">
          {areasAut1.length ? nombres(areasAut1) : <span className="text-[var(--text-muted)]">No autorizas ningun area</span>}
        </Bloque>
        <Bloque titulo="Autorizacion 2">
          {esAut2 ? (esRH ? 'Si (Recursos Humanos)' : 'Si') : <span className="text-[var(--text-muted)]">No</span>}
        </Bloque>
      </div>

      <p className="text-xs text-[var(--text-muted)]">Las pantallas de captura y autorizacion estaran disponibles proximamente.</p>
      {esRH && (
        <Link to="/tiempo-extra/niveles" className="inline-block text-xs font-semibold text-[var(--cm-red)] hover:underline">
          Configurar niveles de autorizacion
        </Link>
      )}
    </div>
  );
}
