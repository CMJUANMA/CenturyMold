/**
 * TiempoExtraInicio.jsx — Entrada del módulo de tiempo extra.
 * Resumen de RH: qué puede hacer según sus asignaciones vigentes y la tarjeta "Por enviar al proveedor" (en tiempo real),
 * que lleva a esa pantalla.
 */
import { Link, Navigate } from 'react-router-dom';
import { useAccesos } from '../hooks/useAccesos';
import { useAuth } from '../hooks/useAuth';
import { usePorRecibir } from '../hooks/usePendientes';
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
  const { usuario } = useAuth();
  const porRecibir = usePorRecibir(usuario, true);
  const { areasSolicitante, areasAut1, esAut2, esRH, cargando, error } = accesos;
  const { nombres, cargando: cargandoAreas } = useAreas();
  const lista = (ids) => ids.map(id => nombres.get(id) ?? id).join(', ');

  if (cargando || cargandoAreas) return <Spinner />;
  // Quien no es RH/admin tiene su Inicio por rol: este resumen es del módulo de RH
  if (!esRH) return <Navigate to="/" replace />;
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

      <Link to="/tiempo-extra/recepcion" className="block">
        <div className={`flex items-center justify-between gap-4 rounded-lg border px-5 py-4 transition-colors hover:border-[var(--cm-red)] ${porRecibir > 0
          ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Por enviar al proveedor</span>
            <span className="block text-xs text-[var(--text-secondary)]">Autorizadas por confirmar: al confirmarlas se genera el transporte de quienes lo pidieron.</span>
          </span>
          <span className="text-3xl font-bold text-[var(--text-main)]">{porRecibir}</span>
        </div>
      </Link>
      <div className="flex flex-wrap gap-4">
        <Link to="/accesos/organigrama" className="text-xs font-semibold text-[var(--cm-red)] hover:underline">Ver organigrama de autorización</Link>
        {puedeAsignarAlgo(accesos) && (
          <Link to="/accesos/asignaciones" className="text-xs font-semibold text-[var(--cm-red)] hover:underline">Asignar roles</Link>
        )}
      </div>
    </div>
  );
}
