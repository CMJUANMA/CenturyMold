/**
 * InicioRH.jsx — Inicio de RH y admin (/): lo que requiere atención hoy y cómo va la semana de tiempo extra.
 *   Requieren atención (resaltado si es mayor a 0): por enviar al proveedor · fechas vencidas sin confirmar · por autorizar nivel 1 ·
 *   por autorizar nivel 2 (con la más antigua) · devueltas sin corregir. Cada indicador lleva a la pantalla donde se atiende.
 *   Esta semana: horas autorizadas (semana y mes) · empleados con tiempo extra · con transporte en los próximos 7 días.
 * Todo sale de las solicitudes de la planta que ya se escuchan en tiempo real (useResumenTE); solo "Solicitudes de transporte del mes"
 * hace un conteo en el servidor. Después: accesos rápidos y la tabla de los próximos 7 días.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getCountFromServer, query, where, Timestamp } from 'firebase/firestore';
import { AlertTriangle, BadgeCheck, Bus, CalendarX, Clock, Inbox, Layers, MapPin, ShieldCheck, Undo2, Users } from 'lucide-react';
import { db } from '../firebase';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useResumenTE } from '../hooks/useResumenTE';
import { useSaludo } from '../hooks/useSaludo';
import { formatoFecha } from '../utils/asignaciones';
import { indicadoresRH, proximos7Dias } from '../utils/resumenInicio';
import { RUTAS, rutaConsultaTE } from '../rutas';
import AyudaPantalla from '../components/AyudaPantalla';
import BadgeEstatus from '../components/BadgeEstatus';
import Spinner from '../components/Spinner';

function Tarjeta({ titulo, valor, ayuda, to, resaltar = false, Icono, cargando = false }) {
  const cuerpo = (
    <div className={`h-full rounded-lg border p-4 shadow-sm transition-colors ${resaltar
      ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
      : 'border-[var(--border-color)] bg-[var(--bg-surface)]'} ${to ? 'hover:border-[var(--cm-red)]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-secondary)]'}`}>{titulo}</h3>
        {Icono && <Icono className={`h-4 w-4 shrink-0 ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-muted)]'}`} />}
      </div>
      <p className={`mt-2 text-3xl font-bold ${resaltar ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-main)]'}`}>{cargando ? '…' : valor}</p>
      {ayuda && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{ayuda}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{cuerpo}</Link> : cuerpo;
}

function AccesoRapido({ to, Icono, titulo, ayuda }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 shadow-sm transition-colors hover:border-[var(--cm-red)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--cm-red-light)]"><Icono className="h-4 w-4 text-[var(--cm-red)]" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--cm-red)]">{titulo}</span>
        <span className="block text-[11px] text-[var(--text-secondary)]">{ayuda}</span>
      </span>
    </Link>
  );
}

const textoDias = (d) => (d === null ? null : d === 0 ? 'La más antigua: de hoy' : `La más antigua: hace ${d} ${d === 1 ? 'día' : 'días'}`);

export default function InicioRH() {
  const { planta, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { rutasActivas, empleadosActivos, cargando: cargandoCat } = useCatalogos();
  const nombresPadron = useMemo(() => empleadosActivos.map(e => e.nombre), [empleadosActivos]);
  const { saludo, nombre, descripcion } = useSaludo(nombresPadron);
  const [ahora] = useState(() => new Date());
  const [transporteMes, setTransporteMes] = useState(null);

  const ind = useMemo(() => indicadoresRH(planta, ahora), [planta, ahora]);
  const proximos = useMemo(() => proximos7Dias(planta, ahora), [planta, ahora]);
  const { atencion: a, semana: s } = ind;

  // Solicitudes de transporte del mes: conteo en el servidor (fechaSolicitud es Timestamp en las nuevas y texto ISO en las viejas)
  useEffect(() => {
    let cancelado = false;
    const ini = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    const col = collection(db, 'solicitudes');
    Promise.all([
      getCountFromServer(query(col, where('fechaSolicitud', '>=', Timestamp.fromDate(ini)), where('fechaSolicitud', '<', Timestamp.fromDate(fin)))),
      getCountFromServer(query(col, where('fechaSolicitud', '>=', ini.toISOString()), where('fechaSolicitud', '<', fin.toISOString()))),
    ]).then(([ts, iso]) => { if (!cancelado) setTransporteMes(ts.data().count + iso.data().count); })
      .catch(err => { console.error('Conteo de transporte del mes:', err); if (!cancelado) setTransporteMes(null); });
    return () => { cancelado = true; };
  }, [ahora]);

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{descripcion || 'Recursos Humanos'} · Century Mold Querétaro</div>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">{saludo}{nombre ? `, ${nombre}` : ''}</h1>
          <AyudaPantalla id="inicio" />
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Esto es lo que necesita tu atención hoy.</p>
      </header>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-[var(--status-error-text)]"><AlertTriangle className="h-4 w-4" />No se pudieron leer las solicitudes: {error.message}</p>
      )}
      {cargando && <Spinner />}

      <section aria-label="Requieren atención" className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Requieren atención</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Tarjeta titulo="Por enviar al proveedor" valor={a.porEnviar} to={RUTAS.teRecepcion} resaltar={a.porEnviar > 0} Icono={Inbox} cargando={cargando}
            ayuda="Autorizadas por confirmar" />
          <Tarjeta titulo="Fechas vencidas" valor={a.vencidas} to={RUTAS.teRecepcion} resaltar={a.vencidas > 0} Icono={CalendarX} cargando={cargando}
            ayuda="Sin confirmar y con fecha que ya pasó" />
          <Tarjeta titulo="Por autorizar · nivel 1" valor={a.nivel1} to={rutaConsultaTE('pendiente_aut1')} resaltar={a.nivel1 > 0} Icono={BadgeCheck} cargando={cargando}
            ayuda="Esperan al Aut. 1 de su área" />
          <Tarjeta titulo="Por autorizar · nivel 2" valor={a.nivel2} to={RUTAS.teAutorizar} resaltar={a.nivel2 > 0} Icono={ShieldCheck} cargando={cargando}
            ayuda={textoDias(a.masAntiguaNivel2) ?? 'Esperan la firma de nivel 2'} />
          <Tarjeta titulo="Devueltas sin corregir" valor={a.devueltas} to={rutaConsultaTE('devuelta')} resaltar={a.devueltas > 0} Icono={Undo2} cargando={cargando}
            ayuda="Esperan que el área las corrija" />
        </div>
      </section>

      <section aria-label="Esta semana" className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Esta semana</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Tarjeta titulo="Horas autorizadas" valor={s.horasSemana} to={RUTAS.teConsulta} Icono={Clock} cargando={cargando}
            ayuda={`de esta semana · ${s.horasMes} en el mes`} />
          <Tarjeta titulo="Empleados con tiempo extra" valor={s.empleadosSemana} to={RUTAS.teConsulta} Icono={Users} cargando={cargando}
            ayuda="autorizados esta semana" />
          <Tarjeta titulo="Con transporte" valor={s.transporte7} to={RUTAS.transporteSolicitudes} Icono={Bus} cargando={cargando}
            ayuda="empleados, en los próximos 7 días" />
        </div>
      </section>

      <section aria-label="Accesos rápidos" className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AccesoRapido to={RUTAS.teRecepcion} Icono={Inbox} titulo="Por enviar al proveedor" ayuda="Confirmar y bajar el formato de rutas" />
          <AccesoRapido to={RUTAS.teAutorizar} Icono={BadgeCheck} titulo="Por autorizar" ayuda="Firmar o devolver solicitudes" />
          <AccesoRapido to={RUTAS.teConsulta} Icono={Layers} titulo="Solicitudes de tiempo extra" ayuda="Ver todas, con filtros y Excel" />
          <AccesoRapido to={RUTAS.transporteSolicitudes} Icono={Bus} titulo="Solicitudes de transporte" ayuda="Las que se generan al confirmar" />
          <AccesoRapido to={RUTAS.padron} Icono={Users} titulo="Padrón de empleados" ayuda="Altas, bajas, rutas e importación" />
          <AccesoRapido to={RUTAS.accesos} Icono={ShieldCheck} titulo="Usuarios y accesos" ayuda="Cuentas y roles por área" />
        </div>
      </section>

      <section aria-label="Datos del sistema" className="grid gap-4 sm:grid-cols-3">
        <Tarjeta titulo="Transporte del mes" valor={transporteMes ?? '—'} to={RUTAS.transporteSolicitudes} Icono={Bus} ayuda="solicitudes de transporte registradas" />
        <Tarjeta titulo="Personal activo" valor={empleadosActivos.length} to={RUTAS.padron} Icono={Users} cargando={cargandoCat} ayuda="empleados en el padrón" />
        <Tarjeta titulo="Rutas activas" valor={rutasActivas.length} to={RUTAS.transporteCatalogos} Icono={MapPin} cargando={cargandoCat} ayuda="en servicio" />
      </section>

      <section aria-label="Próximos 7 días" className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <h2 className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Próximos tiempos extra (7 días)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-2 font-semibold">Folio</th><th className="px-4 py-2 font-semibold">Área</th><th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 text-right font-semibold">Empleados</th><th className="px-4 py-2 text-right font-semibold">Horas</th>
                <th className="px-4 py-2 text-right font-semibold">Transporte</th><th className="px-4 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {proximos.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--text-muted)]">No hay tiempos extra autorizados para los próximos 7 días.</td></tr>
              ) : proximos.map(p => (
                <tr key={p.id} className="hover:bg-[var(--bg-surface-secondary)]">
                  <td className="px-4 py-2"><Link to={`${RUTAS.teConsulta}?abrir=${p.id}`} className="font-mono font-semibold text-[var(--cm-red)] hover:underline">{p.folio}</Link></td>
                  <td className="px-4 py-2">{nombres.get(p.areaId) ?? p.areaId}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatoFecha(`${p.fecha}T12:00:00`)}</td>
                  <td className="px-4 py-2 text-right">{p.empleados}</td>
                  <td className="px-4 py-2 text-right">{p.horas}</td>
                  <td className="px-4 py-2 text-right">{p.transporte}</td>
                  <td className="px-4 py-2"><BadgeEstatus estatus={p.estatus} modulo="te" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
