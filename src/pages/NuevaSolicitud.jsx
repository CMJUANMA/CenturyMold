/**
 * NuevaSolicitud.jsx
 * Alta de una solicitud de transporte: toma los catálogos compartidos, muestra el
 * FormularioSolicitud y guarda la solicitud con sus pasajeros en un solo batch.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useCatalogos } from '../hooks/useCatalogos';
import FormularioSolicitud from '../components/FormularioSolicitud';
import { ROLES_RH } from '../utils/roles';
import { ESTATUS_SOLICITUD } from '../utils/constantes';
import { armarPasajeroDoc, resumenDeFormulario, cambiosPadron } from '../utils/solicitudes';

export default function NuevaSolicitud() {
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const esRH = ROLES_RH.includes(usuario?.rol);

  // Catálogos compartidos (una lectura por sesión); aquí solo el padrón activo
  const {
    rutas, comunidades, puntos, empleadosActivos,
    cargando, error: errorCat, parchearEmpleados,
  } = useCatalogos();
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (errorCat) toast.error('Error al leer catálogos: ' + errorCat.message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCat]);

  const guardar = async ({ fechaServicio, solicitanteNombre, pasajeros, puestos }) => {
    try {
      setEnviando(true);
      const batch = writeBatch(db);

      const solId = doc(collection(db, 'solicitudes')).id;
      const solRef = doc(db, 'solicitudes', solId);

      batch.set(solRef, {
        fechaSolicitud:    serverTimestamp(),
        fechaServicio,
        solicitanteNombre: solicitanteNombre || usuario?.nombre || '',
        creadoPor:         usuario?.uid,
        estatus:           ESTATUS_SOLICITUD.PENDIENTE,
        ...resumenDeFormulario(pasajeros, puestos),
        historial: [{
          fecha: new Date().toISOString(),
          usuario: usuario?.nombre || '',
          accion: 'creada',
          comentario: 'Solicitud creada.',
        }],
      });

      for (const p of pasajeros) {
        batch.set(
          doc(db, `solicitudes/${solId}/pasajeros`, p.empleadoSeleccionado.nomina),
          { ...armarPasajeroDoc(p, puestos), creadoPor: usuario?.uid },
        );
      }

      // Guardar en el padrón la ruta confirmada, solo si cambió
      const cambiosEmp = cambiosPadron(pasajeros);
      for (const [empId, cambios] of Object.entries(cambiosEmp)) {
        batch.update(doc(db, 'empleados', empId), cambios);
      }

      await batch.commit();
      parchearEmpleados(cambiosEmp);
      toast.success('Solicitud registrada correctamente.');
      navigate('/mis-solicitudes');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-[var(--text-secondary)]">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Cargando datos maestros...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Operacion · Solicitudes</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Nueva solicitud de transporte</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Complete los campos para programar el servicio. Solicitante: <span className="font-semibold">{usuario?.nombre}</span>
        </p>
      </div>

      <FormularioSolicitud
        modo="nueva"
        esRH={esRH}
        catalogos={{ rutas, comunidades, puntos, empleados: empleadosActivos }}
        inicial={{ fechaServicio: '', solicitanteNombre: usuario?.nombre || '' }}
        enviando={enviando}
        onSubmit={guardar}
      />
    </div>
  );
}
