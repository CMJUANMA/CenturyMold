/**
 * UsuariosYAccesos.jsx — Usuarios, asignaciones de roles operativos y organigrama de autorización.
 *
 * Los permisos viven en el ROL y se asignan a personas (con área y, si es temporal, con fechas):
 *   Usuarios      RH/admin — cuentas y rol del sistema (admin | rh | usuario)
 *   Asignaciones  quien puede asignar (admin; RH y Aut. 2 vigente solo aut1 y solicitante)
 *   Organigrama   Aut. 2, RH y admin completo; el Aut. 1, solo su área (con el Nivel 2 arriba, sin poder abrirlo); el solicitante no lo ve.
 *                 Generado solo con las asignaciones vigentes
 * Ruta: /personal/accesos/:tab (ver rutas.js)
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { GitBranch, ShieldCheck, UserCog } from 'lucide-react';
import { db } from '../../../firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useAccesos } from '../../../hooks/useAccesos';
import { useAreas } from '../../../hooks/useAreas';
import { useCatalogos } from '../../../hooks/useCatalogos';
import { useAsignaciones } from '../../../hooks/useAsignaciones';
import { useToast } from '../../../hooks/useToast';
import { RUTAS, rutaAccesos } from '../../../rutas';
import { pestanasAccesos } from '../../../utils/permisos';
import AyudaPantalla from '../../../components/AyudaPantalla';
import Aviso from '../../../components/ui/Aviso';
import EncabezadoPagina from '../../../components/ui/EncabezadoPagina';
import { EsqueletoTabla } from '../../../components/ui/Esqueleto';
import Pestanas from '../../../components/ui/Pestanas';
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

  const veTodo = accesos.esRH || accesos.esAut2;
  // El Aut. 1 que solo tiene su área ve "Mi área", no la pantalla de administración de accesos
  const soloMiArea = !veTodo && accesos.areasAut1.length > 0;
  // El Aut. 1 ve solo su área en el organigrama; Aut. 2, RH y admin, todas
  const areas = useMemo(() => (veTodo ? todasLasAreas : todasLasAreas.filter(a => accesos.areasAut1.includes(a.id))), [veTodo, todasLasAreas, accesos.areasAut1]);
  const { asignaciones, cargando: cargandoAsig, error: errorAsig } = useAsignaciones();
  // RH, admin y Aut. 2 pueden leer usuarios (reglas): sirve para el "Sin usuario" y para crear usuarios
  const leeUsuarios = accesos.esRH || accesos.esAut2;
  // Qué pestañas ve cada quien sale de la matriz de permisos (utils/permisos.js)
  const INFO_TAB = {
    usuarios: { etiqueta: 'Usuarios', icono: UserCog },
    asignaciones: { etiqueta: 'Asignaciones', icono: ShieldCheck },
    organigrama: { etiqueta: veTodo ? 'Organigrama' : 'Mi área', icono: GitBranch },
  };
  const tabs = pestanasAccesos(accesos).map(id => ({ id, ...INFO_TAB[id] }));
  const tabActiva = tabs.find(t => t.id === tab)?.id;

  const [usuarios, setUsuarios] = useState(null);
  // Catálogo de puestos (lo lee cualquier usuario activo): da el nivelJerarquico que ordena el organigrama, también al Aut. 1
  const [puestos, setPuestos] = useState([]);
  useEffect(() => {
    let vivo = true;
    getDocs(collection(db, 'puestos')).then(snap => vivo && setPuestos(snap.docs.map(d => ({ id: d.id, nivelJerarquico: d.data().nivelJerarquico })))).catch(() => {});
    return () => { vivo = false; };
  }, []);
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
    esAdmin: accesos.esAdmin, esRH: accesos.esRH, esAut2: accesos.esAut2, esAut1: accesos.areasAut1.length > 0,
  }), [usuario, accesos.esAdmin, accesos.esRH, accesos.esAut2, accesos.areasAut1.length]);

  if (accesos.cargando) return <div className="space-y-8"><EsqueletoTabla filas={4} columnas={5} /></div>;
  // Un solicitante (o quien no tiene rol) no ve esta pantalla
  if (tabs.length === 0) return <Navigate to="/" replace />;
  if (!tabActiva) return <Navigate to={rutaAccesos(tabs[0].id)} replace />;

  const cargando = cargandoAsig || cargandoAreas || cargandoEmp || (leeUsuarios && !usuarios && !error);
  const abrirAsignar = (inicial) => setFormAsig(inicial);

  return (
    <div className="space-y-8">
      {soloMiArea ? (
        <EncabezadoPagina titulo="Mi área" descripcion={`Organigrama de autorización de ${areas.map(a => a.nombre).join(', ') || 'tu área'}`} ayuda={<AyudaPantalla id="organigrama" />} />
      ) : (
        <EncabezadoPagina
          antetitulo="Seguridad y accesos"
          titulo="Usuarios y accesos"
          descripcion="Los permisos viven en el rol: se asignan a personas, por área y con fechas si son temporales. El puesto no da permisos."
          ayuda={tabActiva === 'organigrama' ? <AyudaPantalla id="organigrama" /> : tabActiva === 'asignaciones' ? <AyudaPantalla id="asignaciones" /> : null}
        />
      )}

      {(error || errorAsig) && <Aviso tono="error" titulo="No se pudo leer la información">{error || `No se pudieron leer las asignaciones: ${errorAsig.message}`}</Aviso>}

      {tabs.length > 1 && <Pestanas etiqueta="Secciones" items={tabs} activa={tabActiva} onCambio={(id) => navigate(rutaAccesos(id))} />}

      {cargando ? (
        <EsqueletoTabla filas={4} columnas={5} />
      ) : (
        <>
          {tabActiva === 'usuarios' && (
            <TabUsuarios usuarios={usuarios ?? []} setUsuarios={setUsuarios} asignaciones={asignaciones} nombresArea={nombresArea}
              empleados={empleados} esAdmin={accesos.esAdmin} ahora={ahora} />
          )}
          {tabActiva === 'asignaciones' && (
            <TabAsignaciones asignaciones={asignaciones} nombresArea={nombresArea} actor={actor} ahora={ahora} onAsignar={abrirAsignar}
              empleados={empleados} usuarios={usuarios} onCargaTerminada={() => navigate(RUTAS.organigrama)} />
          )}
          {tabActiva === 'organigrama' && (
            <TabOrganigrama asignaciones={asignaciones} areas={areas} empleados={empleados} puestos={puestos} usuarios={usuarios} actor={actor}
              ahora={ahora} nombresArea={nombresArea} onAsignar={abrirAsignar} />
          )}
        </>
      )}

      <FormAsignacion inicial={formAsig} actor={actor} areas={areas} empleados={empleados} usuarios={usuarios}
        asignaciones={asignaciones} onClose={() => setFormAsig(null)}
        onGuardado={(texto) => toast.success(`Rol asignado — ${texto}`)}
        onCrearUsuario={accesos.esRH || accesos.esAut2 ? (emp) => setCrearUsuario({ nomina: String(emp.nomina), nombre: emp.nombre ?? '' }) : null} />

      <ModalUsuario abierto={!!crearUsuario} onClose={() => setCrearUsuario(null)} precarga={crearUsuario}
        usuarios={usuarios ?? []} empleados={empleados} esAdmin={accesos.esAdmin}
        onGuardado={(u, { nuevo }) => setUsuarios(prev => (nuevo ? [...(prev ?? []), u] : (prev ?? []).map(x => (x.uid === u.uid ? u : x))))} />
    </div>
  );
}
