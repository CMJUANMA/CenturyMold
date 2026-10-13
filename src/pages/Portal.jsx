/**
 * Portal.jsx — Inicio después del login: una tarjeta por módulo, con el contador de pendientes del usuario.
 * Cada quien ve solo los módulos a los que tiene acceso (ver modulos.js).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAccesosTE } from '../hooks/useAccesosTE';
import { modulosDe } from '../modulos';
import { ROL_LABELS } from '../utils/constantes';
import Spinner from '../components/Spinner';

function TarjetaModulo({ modulo, usuario, ctx }) {
  const Icono = modulo.icono;
  const pendientes = modulo.useContador(usuario, ctx, true);
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
  const te = useAccesosTE();
  const ctx = { te };
  const [hora] = useState(() => new Date().getHours());
  const saludo = hora < 12 ? 'Buenos dias' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const modulos = modulosDe(usuario, ctx);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {ROL_LABELS[usuario?.rol] ?? usuario?.rol} · Century Mold
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
          {saludo}, {usuario?.nombre?.split(' ')[0] ?? ''}
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Elige el proceso con el que quieres trabajar.</p>
      </div>

      {te.cargando && modulos.length === 0 ? (
        <Spinner />
      ) : modulos.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-secondary)]">
          Todavia no tienes modulos asignados. Pide a Recursos Humanos que te de acceso.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {modulos.map(m => <TarjetaModulo key={m.id} modulo={m} usuario={usuario} ctx={ctx} />)}
        </div>
      )}
    </div>
  );
}
