/**
 * InicioRol.jsx — Inicio de quien NO es RH/admin: directamente su panel, según los roles que tiene hoy.
 * Una persona con varios roles ve la unión de lo que le toca a cada uno. Mientras no existan solicitudes de tiempo extra,
 * las tarjetas muestran 0 (sin error).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, Clock, FilePlus, Users } from 'lucide-react';
import { useAccesos } from '../hooks/useAccesos';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { usePorAutorizar } from '../hooks/usePendientes';
import { useAuth } from '../hooks/useAuth';
import { useSaludo } from '../hooks/useSaludo';
import { esActivo } from '../utils/activo';
import { RUTAS, rutaMisSolicitudes } from '../rutas';
import { contarMisSolicitudes, proximosAutorizados, semanaPorArea, ultimasDelArea } from '../utils/resumenInicio';
import { formatoFecha } from '../utils/asignaciones';
import AyudaPantalla from '../components/AyudaPantalla';
import BadgeEstatus from '../components/BadgeEstatus';
import Spinner from '../components/Spinner';

function Tarjeta({ titulo, valor, ayuda, to, resaltar = false, Icono }) {
  const cuerpo = (
    <div className={`h-full rounded-lg border p-4 shadow-sm transition-colors ${resaltar
      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
      : 'border-[var(--border-color)] bg-[var(--bg-surface)]'} ${to ? 'hover:border-[var(--cm-red)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-secondary)]'}`}>{titulo}</h3>
        {Icono && <Icono className={`h-4 w-4 ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`} />}
      </div>
      <p className={`mt-2 text-3xl font-bold ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>{valor}</p>
      {ayuda && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{ayuda}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{cuerpo}</Link> : cuerpo;
}

function Tabla({ titulo, columnas, filas, vacio }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
      <h2 className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{titulo}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[var(--text-muted)]"><tr>{columnas.map(c => <th key={c} className="px-4 py-2 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filas.length === 0
              ? <tr><td colSpan={columnas.length} className="px-4 py-6 text-center text-[var(--text-muted)]">{vacio}</td></tr>
              : filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j} className="px-4 py-2 text-[var(--text-main)]">{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function InicioRol() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { esAut2, areasAut1, areasSolicitante, cargando } = accesos;
  const { areas, nombres } = useAreas();
  const { empleados, cargando: cargandoEmp } = useCatalogos({ empleados: true });
  const resumen = useResumenTE();
  const porAutorizar = usePorAutorizar(usuario, accesos, true);
  const nombresPadron = useMemo(() => empleados.map(e => e.nombre), [empleados]);
  const { saludo, nombre, descripcion } = useSaludo(nombresPadron);

  const esSolicitante = areasSolicitante.length > 0;
  const esAut1 = areasAut1.length > 0;
  const misAreas = useMemo(() => [...new Set([...areasSolicitante, ...areasAut1])], [areasSolicitante, areasAut1]);
  const tieneRol = esSolicitante || esAut1 || esAut2;

  const [ahora] = useState(() => new Date());
  const mias = contarMisSolicitudes(resumen.propias, ahora);
  const proximos = proximosAutorizados(resumen.propias, ahora);
  const empleadosDeMiArea = empleados.filter(e => esActivo(e) && misAreas.includes(e.areaId)).length;
  const empleadosDePlanta = empleados.filter(esActivo).length;
  const nombreArea = (id) => nombres.get(id) ?? id;

  if (cargando) return <Spinner />;
  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Century Mold Querétaro</div>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">{saludo}{nombre ? `, ${nombre}` : ''}</h1>
          <AyudaPantalla id="inicioRol" />
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{descripcion || 'Sin roles asignados por ahora'}</p>
      </header>

      {!tieneRol && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-xs text-[var(--text-secondary)]">
          Pide acceso a Recursos Humanos.
        </div>
      )}

      {resumen.error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudieron leer las solicitudes: {resumen.error.message}</p>
      )}

      {(esSolicitante || esAut1) && (
        <Link to={RUTAS.teNueva}
          className="flex items-center justify-between gap-4 rounded-xl bg-[var(--cm-red)] px-6 py-5 text-white shadow-md transition-colors hover:bg-[var(--cm-red-hover)]">
          <span className="flex items-center gap-4">
            <FilePlus className="h-8 w-8" />
            <span><span className="block text-lg font-bold">Solicitar tiempo extra</span><span className="block text-xs opacity-90">Elige a tus empleados, las horas y la ruta de cada uno.</span></span>
          </span>
          <ArrowRight className="h-6 w-6" />
        </Link>
      )}

      {(esAut1 || esAut2) && (
        <Link to={RUTAS.teAutorizar} className="block">
          <div className={`flex items-center justify-between gap-4 rounded-xl border-2 px-6 py-5 shadow-sm transition-colors hover:border-[var(--cm-red)] ${porAutorizar.total > 0
            ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]' : 'border-[var(--border-color)] bg-[var(--bg-surface)]'}`}>
            <span className="flex items-center gap-4">
              <BadgeCheck className={`h-8 w-8 ${porAutorizar.total > 0 ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`} />
              <span>
                <span className={`block text-lg font-bold ${porAutorizar.total > 0 ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>Por autorizar ({porAutorizar.total})</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {esAut1 && esAut2 ? `Nivel 1: ${porAutorizar.aut1} · Nivel 2: ${porAutorizar.aut2}` : esAut2 ? 'Solicitudes esperando tu firma de nivel 2' : 'Solicitudes de tu área esperando tu firma'}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cm-red)]">Ir a la bandeja <ArrowRight className="h-4 w-4" /></span>
          </div>
        </Link>
      )}

      {(esSolicitante || esAut1) && (
        <section aria-label="Mi área" className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {misAreas.length === 1 ? `Mi área · ${nombreArea(misAreas[0])}` : `Mis áreas · ${misAreas.map(nombreArea).join(', ')}`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Tarjeta titulo="Empleados de mi área" valor={cargandoEmp ? '…' : empleadosDeMiArea} Icono={Users} />
            <Tarjeta titulo="En borrador" valor={mias.borrador} to={rutaMisSolicitudes('borrador')} ayuda="Aún no las envías" />
            <Tarjeta titulo="En autorización" valor={mias.enAutorizacion} to={rutaMisSolicitudes('autorizacion')} Icono={Clock} />
            <Tarjeta titulo="Devueltas" valor={mias.devueltas} to={rutaMisSolicitudes('devuelta')} resaltar={mias.devueltas > 0} Icono={AlertTriangle}
              ayuda={mias.devueltas > 0 ? 'Piden que las corrijas' : undefined} />
            <Tarjeta titulo="Autorizadas este mes" valor={mias.autorizadasMes} to={rutaMisSolicitudes('autorizada')} Icono={CheckCircle2} />
          </div>
          <Tabla titulo="Próximos tiempos extra autorizados" columnas={['Folio', 'Fecha', 'Empleados', 'Horas', 'Transporte']}
            filas={proximos.map(p => [<span key="f" className="font-mono font-semibold">{p.folio}</span>, formatoFecha(`${p.fecha}T12:00:00`), p.empleados, p.horas, p.transporte])}
            vacio="Todavía no tienes tiempos extra autorizados por venir." />
        </section>
      )}

      {esAut1 && (
        <Tabla titulo="Últimas solicitudes de mi área" columnas={['Folio', 'Área', 'Fecha', 'Estado']}
          filas={ultimasDelArea(resumen.delArea).map(s => [
            <span key="f" className="font-mono font-semibold">{s.folio ?? s.id}</span>, nombreArea(s.areaId), formatoFecha(`${s.fechaTE}T12:00:00`), <BadgeEstatus key="e" estatus={s.estatus} modulo="te" />,
          ])}
          vacio="Aún no hay solicitudes en tu área." />
      )}

      {esAut2 && (
        <section aria-label="Planta" className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Planta</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Tarjeta titulo="Por autorizar nivel 2" valor={porAutorizar.aut2} to={RUTAS.teAutorizar} resaltar={porAutorizar.aut2 > 0} Icono={BadgeCheck} />
            <Tarjeta titulo="Empleados de planta" valor={cargandoEmp ? '…' : empleadosDePlanta} Icono={Users} />
            <Tarjeta titulo="Solicitudes de la semana" valor={semanaPorArea(resumen.planta, areas, ahora).reduce((a, x) => a + x.total, 0)} to={RUTAS.teConsulta} />
          </div>
          <Tabla titulo="Solicitudes de la semana por área" columnas={['Área', 'Solicitudes']}
            filas={semanaPorArea(resumen.planta, areas.filter(a => a.participaTE), ahora).map(x => [x.nombre, x.total])} vacio="Sin áreas con tiempo extra." />
        </section>
      )}
    </div>
  );
}
