/**
 * EditarSolicitud.jsx
 * Carga una solicitud existente, la muestra en el FormularioSolicitud y guarda los cambios
 * en una transacción (el estatus se evalúa sobre lo que hay en Firestore al guardar).
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useCatalogos } from '../hooks/useCatalogos';
import { useAccesos } from '../hooks/useAccesos';
import FormularioSolicitud from '../components/FormularioSolicitud';
import { ROLES_RH } from '../utils/roles';
import { ESTATUS_SOLICITUD } from '../utils/constantes';
import { fechaMinima, armarPasajeroDoc, resumenDeFormulario, cambiosPadron, cambiosPadronPermitidos } from '../utils/solicitudes';

// Error de negocio detectado dentro de la transacción: aborta sin guardar nada
const conflicto = (msg) => Object.assign(new Error(msg), { code: 'app/conflicto' });

export default function EditarSolicitud() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const esRH = ROLES_RH.includes(usuario?.rol);
  const { areasSolicitante } = useAccesos();

  // Catálogos compartidos, completos: los selects muestran activos más el valor ya guardado
  const { rutas, comunidades, puntos, empleados, cargando: cargandoCat, error: errorCat, parchearEmpleados } = useCatalogos();

  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [inicial, setInicial] = useState(null);

  useEffect(() => {
    if (errorCat) toast.error('Error al leer catálogos: ' + errorCat.message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCat]);

  useEffect(() => {
    async function cargar() {
      try {
        const docSnap = await getDoc(doc(db, 'solicitudes', id));
        if (!docSnap.exists()) {
          toast.error('Solicitud no encontrada.');
          navigate(-1);
          return;
        }
        const data = docSnap.data();

        // Reglas de edición en cliente (las reglas de Firestore y la transacción las vuelven a aplicar)
        const estatus = data.estatus || ESTATUS_SOLICITUD.PENDIENTE;
        if (!esRH) {
          if (data.creadoPor !== usuario.uid) {
            toast.error('No tienes permiso para editar esta solicitud.');
            navigate(-1); return;
          }
          if ([ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR, ESTATUS_SOLICITUD.CANCELADA, ESTATUS_SOLICITUD.RECHAZADA].includes(estatus)) {
            toast.error(`No puedes editar una solicitud que está ${estatus}.`);
            navigate(-1); return;
          }
          if (data.fechaServicio < fechaMinima()) {
            toast.error('No puedes editar solicitudes pasadas.');
            navigate(-1); return;
          }
        }

        const pasSnap = await getDocs(collection(db, `solicitudes/${id}/pasajeros`));
        const pasajeros = pasSnap.docs.map(d => {
          const pd = d.data();
          const emp = empleados.find(e => e.nomina === pd.nomina) || { nomina: pd.nomina, nombre: pd.nombre };
          return {
            id: pd.nomina,
            searchQuery: `${pd.nomina} - ${pd.nombre}`,
            showResults: false,
            empleadoSeleccionado: emp,
            puesto: pd.puesto || '',
            turno: pd.turno || '',
            horaEntrada: pd.horaEntrada || '',
            horaSalida: pd.horaSalida || '',
            alimentos: pd.alimentos || false,
            rutaId: pd.rutaId || '',
            comunidadId: pd.comunidadId || '',
            puntoReunionId: pd.puntoReunionId || '',
            needsConfirmation: false,
            isConfirmed: true,
          };
        });

        setSolicitud(data);
        setInicial({ fechaServicio: data.fechaServicio, solicitanteNombre: data.solicitanteNombre, pasajeros });
      } catch (err) {
        console.error(err);
        toast.error('Error al cargar datos: ' + err.message);
      } finally {
        setCargandoDatos(false);
      }
    }
    // Espera a que los catálogos compartidos estén listos; no se vuelve a ejecutar si cambian después
    // (eso borraría lo que el usuario ya editó en el formulario)
    if (usuario?.uid && !cargandoCat) cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, usuario?.uid, navigate, esRH, cargandoCat]);

  const guardar = async ({ fechaServicio, solicitanteNombre, comentario, pasajeros, puestos }) => {
    const estatusAlAbrir = (solicitud.estatus || ESTATUS_SOLICITUD.PENDIENTE).toLowerCase();

    try {
      setEnviando(true);
      const solRef = doc(db, 'solicitudes', id);

      // Los ids de pasajero son la nómina. Se juntan los ids que hay ahora en Firestore (lectura fuera
      // de la transacción: el SDK web no permite consultas dentro) para borrar los que ya no estén.
      const pasSnapActual = await getDocs(collection(db, `solicitudes/${id}/pasajeros`));
      const idsNuevos = new Set(pasajeros.map(p => p.empleadoSeleccionado.nomina));
      const idsABorrar = pasSnapActual.docs.map(d => d.id).filter(pid => !idsNuevos.has(pid));

      const cambiosEmp = cambiosPadronPermitidos(cambiosPadron(pasajeros), empleados, { esRH, areasSolicitante });
      const resumen = resumenDeFormulario(pasajeros, puestos);

      // 1 (solicitud) + borrados + pasajeros + empleados
      if (1 + idsABorrar.length + pasajeros.length + Object.keys(cambiosEmp).length > 500) {
        throw new Error('La edición supera el límite de operaciones de Firestore. Divide la solicitud en dos.');
      }

      await runTransaction(db, async (t) => {
        // ── Lecturas (todas antes de cualquier escritura) ──────────────────
        const solSnap = await t.get(solRef);
        if (!solSnap.exists()) throw conflicto('La solicitud ya no existe.');
        const actual = solSnap.data();
        const estatusActual = (actual.estatus || ESTATUS_SOLICITUD.PENDIENTE).toLowerCase();

        // Regla de negocio sobre el estatus leído AQUÍ, no el de cuando se abrió la página
        if (estatusActual !== estatusAlAbrir) {
          const respondidoRH = [ESTATUS_SOLICITUD.APROBADA, ESTATUS_SOLICITUD.RECHAZADA, ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR].includes(estatusActual);
          throw conflicto(respondidoRH
            ? 'RH ya respondió esta solicitud mientras la editabas. Recarga para ver el estado actual.'
            : `La solicitud cambió a "${estatusActual}" mientras la editabas. Recarga para ver el estado actual.`);
        }
        if (!esRH) {
          if (actual.creadoPor !== usuario.uid) throw conflicto('No tienes permiso para editar esta solicitud.');
          if (![ESTATUS_SOLICITUD.PENDIENTE, ESTATUS_SOLICITUD.APROBADA].includes(estatusActual)) {
            throw conflicto(`No puedes editar una solicitud que está ${estatusActual}.`);
          }
        }

        let nuevoEstatus = estatusActual;
        if (estatusActual === ESTATUS_SOLICITUD.APROBADA) nuevoEstatus = ESTATUS_SOLICITUD.PENDIENTE;
        if (esRH && estatusActual === ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR) nuevoEstatus = ESTATUS_SOLICITUD.PENDIENTE; // Pide reenvío

        // ── Escrituras ─────────────────────────────────────────────────────
        t.update(solRef, {
          fechaServicio,
          solicitanteNombre: solicitanteNombre || usuario?.nombre || '',
          ...resumen,
          estatus: nuevoEstatus,
          modificada: true,
          historial: arrayUnion({
            fecha: new Date().toISOString(),
            usuario: usuario?.nombre || '',
            accion: 'editada',
            comentario: comentario.trim() || 'Modificación general',
          }),
        });

        for (const pid of idsABorrar) {
          t.delete(doc(db, `solicitudes/${id}/pasajeros`, pid));
        }
        for (const p of pasajeros) {
          t.set(doc(db, `solicitudes/${id}/pasajeros`, p.empleadoSeleccionado.nomina), {
            ...armarPasajeroDoc(p, puestos),
            actualizadoPor: usuario?.uid,
          });
        }
        // Guardar en el padrón la ruta confirmada (si el empleado sigue existiendo y cambió)
        for (const [empId, cambios] of Object.entries(cambiosEmp)) {
          t.update(doc(db, 'empleados', empId), cambios);
        }
      });

      parchearEmpleados(cambiosEmp);
      toast.success('Solicitud actualizada correctamente.');
      navigate(-1);
    } catch (err) {
      console.error(err);
      if (err.code === 'app/conflicto') toast.error(err.message, 8000);
      else toast.error('Error al guardar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (cargandoDatos) {
    return (
      <div className="flex h-64 items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin" /><span>Cargando...</span>
      </div>
    );
  }
  if (!inicial) return null; // error o redirección ya avisados

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Operacion · Solicitudes</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Editar solicitud de transporte</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Folio: {id.slice(0, 8)}</p>
      </div>

      <FormularioSolicitud
        modo="editar"
        esRH={esRH}
        catalogos={{ rutas, comunidades, puntos, empleados }}
        inicial={inicial}
        comentarioObligatorio={solicitud.estatus === ESTATUS_SOLICITUD.APROBADA || esRH}
        enviando={enviando}
        onSubmit={guardar}
      />
    </div>
  );
}
