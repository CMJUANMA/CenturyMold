/**
 * UsuariosYAccesos.jsx — Usuarios, asignaciones de roles operativos y organigrama de autorización.
 *
 * Los permisos viven en el ROL y se asignan a personas (con área y, si es temporal, con fechas):
 *   Usuarios      RH/admin — cuentas y rol del sistema (admin | rh | usuario)
 *   Asignaciones  quien puede asignar (admin; RH y Aut. 2 vigente solo aut1 y solicitante)
 *   Organigrama   Aut. 2, RH y admin completo; el Aut. 1, solo su área (con el Nivel 2 arriba); el solicitante no lo ve.
 *                 Generado solo con las asignaciones vigentes
 * Ruta: /accesos/:tab
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { GitBranch, Loader2, ShieldCheck, UserCog, AlertTriangle } from 'lucide-react';
import { db } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useAccesos } from '../../../hooks/useAccesos';
import { useAreas } from '../../../hooks/useAreas';
import { useCatalogos } from '../../../hooks/useCatalogos';
import { useAsignaciones } from '../../../hooks/useAsignaciones';
import { useToast } from '../../../hooks/useToast';
import { puedeAsignarAlgo } from '../../../utils/asignaciones';
import { veOrganigrama } from '../../../utils/navegacion';
import Spinner from '../../../components/Spinner';
import TabUsuarios from './TabUsuarios';
import TabAsignaciones from './TabAsignaciones';
import TabOrganigrama from './TabOrganigrama';
import FormAsignacion from './FormAsignacion';
import ModalUsuario from './ModalUsuario';

export default function UsuariosYAccesos() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const { areas: todasLasAreas, nombres: nombresArea, cargando: cargandoAreas } = useAreas();
  const { empleados, cargando: cargandoEmp } = useCatalogos({ empleados: true });

  const asigna = puedeAsignarAlgo(accesos);
  const veTodo = accesos.esRH || accesos.esAut2;
  // El Aut. 1 que solo tiene su área ve "Mi área", no la pantalla de administración de accesos
  const soloMiArea = !veTodo && accesos.areasAut1.length > 0;
  // El Aut. 1 ve solo su área en el organigrama; Aut. 2, RH y admin, todas
  const areas = useMemo(() => (veTodo ? todasLasAreas : todasLasAreas.filter(a => accesos.areasAut1.includes(a.id))), [veTodo, todasLasAreas, accesos.areasAut1]);
  const { asignaciones, cargando: cargandoAsig, error: errorAsig } = useAsignaciones();
  // RH, admin y Aut. 2 pueden leer usuarios (reglas): sirve para el "Sin usuario" y para crear usuarios
  const leeUsuarios = accesos.esRH || accesos.esAut2;
  const tabs = [
    accesos.esRH && { id: 'usuarios', label: 'Usuarios', icon: UserCog },
    asigna && { id: 'asignaciones', label: 'Asignaciones', icon: ShieldCheck },
    veOrganigrama(accesos) && { id: 'organigrama', label: accesos.esRH || accesos.esAut2 ? 'Organigrama' : 'Mi área', icon: GitBranch },
  ].filter(Boolean);
  const tabActiva = tabs.find(t => t.id === tab)?.id;

  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());
  const [formAsig, setFormAsig] = useState(null);
  const [crearUsuario, setCrearUsuario] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!leeUsuarios) return;
    let vigente = true;
    getDocs(collection(db, 'usuarios'))
      .then(snap => { if (vigente) setUsuarios(snap.docs.map(d => ({ uid: d.id, ...d.data() }))); })
      .catch(err => { if (vigente) setError('No se pudieron leer los usuarios: ' + err.message); });
    return () => { vigente = false; };
  }, [leeUsuarios]);

  const actor = useMemo(() => ({
    uid: usuario?.uid, nombre: usuario?.nombre ?? '', nomina: usuario?.nomina ?? '',
    esAdmin: accesos.esAdmin, esRH: accesos.esRH, esAut2: accesos.esAut2,
  }), [usuario, accesos.esAdmin, accesos.esRH, accesos.esAut2]);

  if (accesos.cargando) return <Spinner />;
  // Un solicitante (o quien no tiene rol) no ve esta pantalla
  if (tabs.length === 0) return <Navigate to="/" replace />;
  if (!tabActiva) return <Navigate to={`/accesos/${tabs[0].id}`} replace />;

  const cargando = cargandoAsig || cargandoAreas || cargandoEmp || (leeUsuarios && !usuarios && !error);
  const abrirAsignar = (inicial) => setFormAsig(inicial);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        {soloMiArea ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Mi área</h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Organigrama de autorización de {areas.map(a => a.nombre).join(', ') || 'tu área'}
            </p>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Seguridad y accesos</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Usuarios y accesos</h1>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Los permisos viven en el rol: se asignan a personas, por área y con fechas si son temporales. El puesto no da permisos.
            </p>
          </>
        )}
      </div>

      {(error || errorAsig) && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error || `No se pudieron leer las asignaciones: ${errorAsig.message}`}</span>
        </div>
      )}

      {tabs.length > 1 && <div className="border-b border-[var(--border-color)]">
        <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Secciones">
          {tabs.map(t => {
            const Icono = t.icon;
            const activa = tabActiva === t.id;
            return (
              <button key={t.id} type="button" onClick={() => navigate(`/accesos/${t.id}`)} aria-current={activa ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${activa ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--border-color)]'}`}>
                <Icono className="h-3.5 w-3.5" />{t.label}
              </button>
            );
          })}
        </nav>
      </div>}

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Cargando…</span>
        </div>
      ) : (
        <>
          {tabActiva === 'usuarios' && (
            <TabUsuarios usuarios={usuarios ?? []} setUsuarios={setUsuarios} asignaciones={asignaciones} nombresArea={nombresArea}
              empleados={empleados} esAdmin={accesos.esAdmin} ahora={ahora} />
          )}
          {tabActiva === 'asignaciones' && (
            <TabAsignaciones asignaciones={asignaciones} nombresArea={nombresArea} actor={actor} ahora={ahora} onAsignar={abrirAsignar}
              empleados={empleados} usuarios={usuarios} onCargaTerminada={() => navigate('/accesos/organigrama')} />
          )}
          {tabActiva === 'organigrama' && (
            <TabOrganigrama asignaciones={asignaciones} areas={areas} empleados={empleados} usuarios={usuarios} actor={actor}
              ahora={ahora} nombresArea={nombresArea} onAsignar={abrirAsignar} />
          )}
        </>
      )}

      <FormAsignacion inicial={formAsig} actor={actor} areas={areas} empleados={empleados} usuarios={usuarios}
        asignaciones={asignaciones} onClose={() => setFormAsig(null)}
        onGuardado={(texto) => toast.success(`Rol asignado — ${texto}`)}
        onCrearUsuario={accesos.esRH ? (emp) => setCrearUsuario({ nomina: String(emp.nomina), nombre: emp.nombre ?? '' }) : null} />

      <ModalUsuario abierto={!!crearUsuario} onClose={() => setCrearUsuario(null)} precarga={crearUsuario}
        usuarios={usuarios ?? []} empleados={empleados} esAdmin={accesos.esAdmin}
        onGuardado={(u, { nuevo }) => setUsuarios(prev => (nuevo ? [...(prev ?? []), u] : (prev ?? []).map(x => (x.uid === u.uid ? u : x))))} />
    </div>
  );
}
