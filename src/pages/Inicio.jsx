/**
 * Inicio.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Panel principal corporativo de Century Mold.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Clock,
  ClipboardList,
  Users,
  MapPin,
  FilePlus,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { esActivo } from '../utils/activo';

const ROL_LABELS = {
  admin: 'Administrador del sistema',
  rh: 'Recursos Humanos',
  superintendente: 'Superintendente de area',
};

// ── Badge de estatus (reutilizado)
const ESTATUS_MAP = {
  pendiente: { label: 'Pendiente', cls: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]  ' },
  aprobada: { label: 'Aprobada', cls: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]  ' },
  rechazada: { label: 'Rechazada', cls: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]  ' },
};
function BadgeEstatus({ estatus }) {
  const cfg = ESTATUS_MAP[estatus] ?? { label: estatus, cls: 'bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatFecha(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function Inicio() {
  const { usuario } = useAuth();
  const toast = useToast();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos dias' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const esAdminORh = usuario?.rol === 'admin' || usuario?.rol === 'rh';

  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState({ pendientes: 0, empleados: 0, rutas: 0, delMes: 0 });
  const [recientes, setRecientes] = useState([]);

  useEffect(() => {
    if (!usuario?.uid) return;
    
    let unsub = () => {};
    const cargar = async () => {
      try {
        const [snapRutas, snapEmp] = await Promise.all([
          getDocs(collection(db, 'rutas')),
          getDocs(collection(db, 'empleados'))
        ]);
        const countRutas = snapRutas.docs.filter(d => esActivo(d.data())).length;
        const countEmp = snapEmp.docs.filter(d => esActivo(d.data())).length;

        const qSols = esAdminORh 
          ? collection(db, 'solicitudes') 
          : query(collection(db, 'solicitudes'), where('creadoPor', '==', usuario.uid));

        unsub = onSnapshot(qSols, (snap) => {
          let pend = 0;
          let mesActual = 0;
          let lista = [];
          const hoy = new Date();
          
          snap.forEach(d => {
            const val = d.data();
            lista.push({ id: d.id, ...val });
            if (val.estatus === 'pendiente') pend++;
            if (val.fechaSolicitud && new Date(val.fechaSolicitud).getMonth() === hoy.getMonth()) {
              mesActual++;
            }
          });
          
          // Ordenar por fechaServicio ascendente y tomar las proximas 5 (que sean de hoy en adelante)
          lista.sort((a, b) => new Date(a.fechaServicio) - new Date(b.fechaServicio));
          const inicioDeHoy = new Date(hoy.setHours(0,0,0,0));
          const proximas = lista.filter(x => new Date(x.fechaServicio) >= inicioDeHoy).slice(0, 5);
          
          setStats({ pendientes: pend, empleados: countEmp, rutas: countRutas, delMes: mesActual });
          setRecientes(proximas);
          setCargando(false);
        }, (err) => {
          console.error('Error en solicitudes:', err);
          toast.error('No se pudieron cargar las solicitudes: ' + err.message);
          setCargando(false);
        });
      } catch (err) {
        console.error("Error cargando dashboard:", err);
        toast.error('Error cargando el dashboard: ' + err.message);
        setCargando(false);
      }
    };
    cargar();
    return () => unsub();
  }, [usuario, esAdminORh]);

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
