/**
 * Inicio.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Panel principal corporativo de Century Mold.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Clock,
  ClipboardList,
  Users,
  MapPin,
  FilePlus,
  Layers,
  ArrowRight,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { mismoMes, fechaLocal, fmtFecha, ymd } from '../utils/fechas';
import { useCatalogos } from '../hooks/useCatalogos';
import BadgeEstatus from '../components/BadgeEstatus';
import { ROL_LABELS, ROLES, ESTATUS_SOLICITUD } from '../utils/constantes';


// fechaServicio es "YYYY-MM-DD": se lee como fecha local para no desfasar un día
const formatFecha = (ymd) => fmtFecha(fechaLocal(ymd));

export default function Inicio() {
  const { usuario } = useAuth();
  const toast = useToast();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos dias' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const esAdminORh = usuario?.rol === ROLES.ADMIN || usuario?.rol === ROLES.RH;

  const [cargandoSol, setCargandoSol] = useState(true);
  const [statsSol, setStatsSol] = useState({ pendientes: 0, delMes: 0 });
  const [recientes, setRecientes] = useState([]);

  // Rutas y empleados activos: catálogos compartidos (una lectura por sesión)
  const { rutasActivas, empleadosActivos, cargando: cargandoCat, error: errorCat } = useCatalogos();
  const stats = { ...statsSol, empleados: empleadosActivos.length, rutas: rutasActivas.length };
  const cargando = cargandoSol || cargandoCat;

  useEffect(() => {
    if (errorCat) toast.error('Error cargando catálogos: ' + errorCat.message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCat]);

  const uid = usuario?.uid;

  // Solicitudes en vivo. La suscripción se crea y se cancela de forma síncrona (sin fugas).
  //  - RH: solo las próximas 5 (consulta con límite); los conteos se piden aparte al servidor.
  //  - Superintendente: sus propias solicitudes (filtradas por creadoPor).
  useEffect(() => {
    if (!uid) return;
    const col = collection(db, 'solicitudes');
    const qSols = esAdminORh
      ? query(col, where('fechaServicio', '>=', ymd()), orderBy('fechaServicio'), limit(5))
      : query(col, where('creadoPor', '==', uid));

    const unsub = onSnapshot(qSols, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const hoy = new Date();

      if (esAdminORh) {
        setRecientes(lista);
      } else {
        let pend = 0;
        let mesActual = 0;
        lista.forEach(val => {
          if (val.estatus === ESTATUS_SOLICITUD.PENDIENTE) pend++;
          if (mismoMes(val.fechaSolicitud, hoy)) mesActual++;
        });
        // Ordenar por fechaServicio ascendente y tomar las proximas 5 (que sean de hoy en adelante)
        lista.sort((a, b) => (fechaLocal(a.fechaServicio) ?? 0) - (fechaLocal(b.fechaServicio) ?? 0));
        const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        setRecientes(lista.filter(x => fechaLocal(x.fechaServicio) >= inicioDeHoy).slice(0, 5));
        setStatsSol({ pendientes: pend, delMes: mesActual });
      }
      setCargandoSol(false);
    }, (err) => {
      console.error('Error en solicitudes:', err);
      toast.error('No se pudieron cargar las solicitudes: ' + err.message);
      setCargandoSol(false);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, esAdminORh]);

  // RH: conteos directos en el servidor (1 lectura por cada 1000 documentos contados),
  // en vez de descargar todas las solicitudes.
  useEffect(() => {
    if (!uid || !esAdminORh) return;
    let cancelado = false;
    (async () => {
      try {
        const col = collection(db, 'solicitudes');
        const hoy = new Date();
        const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
        // fechaSolicitud es Timestamp en las solicitudes nuevas y string ISO en las viejas:
        // cada tipo se cuenta por separado (una consulta de rango no mezcla tipos) y se suman.
        const [pend, mesTs, mesIso] = await Promise.all([
          getCountFromServer(query(col, where('estatus', '==', ESTATUS_SOLICITUD.PENDIENTE))),
          getCountFromServer(query(col, where('fechaSolicitud', '>=', Timestamp.fromDate(ini)), where('fechaSolicitud', '<', Timestamp.fromDate(fin)))),
          getCountFromServer(query(col, where('fechaSolicitud', '>=', ini.toISOString()), where('fechaSolicitud', '<', fin.toISOString()))),
        ]);
        if (cancelado) return;
        setStatsSol({ pendientes: pend.data().count, delMes: mesTs.data().count + mesIso.data().count });
      } catch (err) {
        if (cancelado) return;
        console.error('Error contando solicitudes:', err);
        toast.error('No se pudieron calcular los indicadores: ' + err.message);
      }
    })();
    return () => { cancelado = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, esAdminORh]);

  return (
    <div className="space-y-6">
      {/* ── Encabezado institucional ─────────────────────────────────────── */}
      <div className="border-b border-[var(--border-color)] pb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Century Mold Mexico · Panel de Control
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
              {saludo}, {usuario?.nombre ?? 'Usuario'}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Plataforma para la programacion y autorizacion de transporte de personal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {ROL_LABELS[usuario?.rol] ?? usuario?.rol}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tarjetas de métricas (KPIs) ─────────────────────────────────── */}
      <section aria-label="Indicadores generales">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]   p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--status-warning-text)] ">
                Pendientes
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]   ">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--status-warning-text)] ">
                {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.pendientes}
              </span>
              <span className="text-xs text-[var(--status-warning-text)]/70 /70">solicitudes</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--status-warning-text)] ">Por revisar y autorizar</p>
          </div>

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Mes en curso</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-main)]">
                {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.delMes}
              </span>
              <span className="text-xs text-[var(--text-muted)]">solicitudes</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Registradas en el mes actual</p>
          </div>

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Personal activo</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]   ">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-main)]">
                {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.empleados}
              </span>
              <span className="text-xs text-[var(--text-muted)]">empleados</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Padron en plataforma</p>
          </div>

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Rutas activas</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]">
                <MapPin className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--text-main)]">
                {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.rutas}
              </span>
              <span className="text-xs text-[var(--text-muted)]">rutas</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">En servicio industrial</p>
          </div>
        </div>
      </section>

      {/* ── Accesos rápidos ──────────────────────────────────────────────── */}
      <section aria-label="Accesos directos">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Operaciones principales
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/solicitud/nueva" className="group flex items-start justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm hover:border-[var(--cm-red)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-[var(--cm-red)]/20 bg-[var(--cm-red-light)] p-2 text-[var(--cm-red)]">
                <FilePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--cm-red)] transition-colors">Nueva solicitud</h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Registrar transporte para turnos o TE</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--cm-red)] group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          <Link to="/mis-solicitudes" className="group flex items-start justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm hover:border-[var(--cm-red)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-2 text-[var(--text-secondary)]">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--cm-red)] transition-colors">Mis solicitudes</h3>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Consultar historial y estado propio</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--cm-red)] group-hover:translate-x-0.5 transition-all mt-1" />
          </Link>

          {esAdminORh ? (
            <Link to="/rh/solicitudes" className="group flex items-start justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-sm hover:border-[var(--cm-red)] transition-colors">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-2 text-[var(--text-secondary)]">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--cm-red)] transition-colors">Todas las solicitudes</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Aprobacion general y exportacion</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--cm-red)] group-hover:translate-x-0.5 transition-all mt-1" />
            </Link>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4 opacity-75">
              <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 text-[var(--text-muted)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Operacion autorizada</h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Permisos activos para generar solicitudes</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Tabla de solicitudes recientes ──────────────────────────────── */}
      <section aria-label="Proximas solicitudes">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Proximos servicios programados
          </h2>
          <Link to={esAdminORh ? "/rh/solicitudes" : "/mis-solicitudes"} className="text-xs font-semibold text-[var(--cm-red)] hover:underline">
            Ver todas
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Fecha de servicio</th>
                  {esAdminORh && <th className="px-4 py-3">Solicitante</th>}
                  <th className="px-4 py-3">Area / Puesto</th>
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3 text-center">Pasajeros</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {cargando ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                ) : recientes.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">No hay servicios proximos programados</td></tr>
                ) : recientes.map(s => (
                  <tr key={s.id} className="hover:bg-[var(--bg-surface-secondary)]">
                    <td className="px-4 py-2.5 font-mono text-[var(--text-muted)]">{s.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{formatFecha(s.fechaServicio)}</td>
                    {esAdminORh && <td className="px-4 py-2.5 text-[var(--text-secondary)] truncate max-w-[120px]">{s.solicitanteNombre}</td>}
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{s.puesto}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">Turno {s.turno}</td>
                    <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{s.totalPasajeros}</td>
                    <td className="px-4 py-2.5"><BadgeEstatus estatus={s.estatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
