/**
 * Portal.jsx — Inicio después del login: una tarjeta por módulo, con el contador de pendientes del usuario.
 * Cada quien ve solo los módulos a los que tiene acceso (ver modulos.js).
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { useSaludo } from '../hooks/useSaludo';
import { modulosDe } from '../modulos';
import { contarPorEstatus } from '../utils/resumenInicio';
import Spinner from '../components/Spinner';

function TarjetaModulo({ modulo, usuario, accesos }) {
  const Icono = modulo.icono;
  const pendientes = modulo.useContador(usuario, accesos, true);
  return (
    <Link to={modulo.base}
      className="group flex items-start justify-between gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm transition-colors hover:border-[var(--cm-red)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cm-red-light)]">
          <Icono className="h-5 w-5 text-[var(--cm-red)]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--text-main)]">{modulo.nombre}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{modulo.descripcion}</p>
          <p className="mt-3 text-xs">
            {pendientes > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 font-semibold text-[var(--status-warning-text)]">
                {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">Sin pendientes</span>
            )}
          </p>
        </div>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--cm-red)]" />
    </Link>
  );
}

export default function Portal() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { empleados } = useCatalogos({ empleados: true });
  const nombresPadron = useMemo(() => empleados.map(e => e.nombre), [empleados]);
  const { saludo, nombre, descripcion } = useSaludo(nombresPadron);
  const { planta } = useResumenTE();
  const porRecibir = contarPorEstatus(planta, 'autorizada');
  const modulos = modulosDe(usuario, accesos);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {descripcion || 'Recursos Humanos'} · Century Mold Querétaro
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
          {saludo}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Elige el proceso con el que quieres trabajar.</p>
      </div>

      <Link to="/tiempo-extra" className="block">
        <div className={`flex items-center justify-between gap-4 rounded-lg border px-5 py-4 transition-colors hover:border-[var(--cm-red)] ${porRecibir > 0
          ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
          <span>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Autorizadas pendientes de recibir</span>
            <span className="block text-xs text-[var(--text-secondary)]">Tiempo extra ya autorizado que RH debe recibir.</span>
          </span>
          <span className="text-3xl font-bold text-[var(--text-main)]">{porRecibir}</span>
        </div>
      </Link>

      {accesos.cargando && modulos.length === 0 ? (
        <Spinner />
      ) : modulos.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-secondary)]">
          Todavía no tienes funciones asignadas. Pide a Recursos Humanos que te den acceso.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {modulos.map(m => <TarjetaModulo key={m.id} modulo={m} usuario={usuario} accesos={accesos} />)}
        </div>
      )}
    </div>
  );
}
