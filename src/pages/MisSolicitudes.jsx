/**
 * MisSolicitudes.jsx — Vista del solicitante
 */
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { rutaEditarTransporte } from '../funciones';
import { Eye, XCircle, BellRing, Edit, MessageSquareWarning } from 'lucide-react';
import Boton from '../components/ui/Boton';
import { Entrada } from '../components/ui/Campo';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import EstadoVacio from '../components/ui/EstadoVacio';
import { EsqueletoTabla } from '../components/ui/Esqueleto';
import { useNavigate } from 'react-router-dom';
import { arrayUnion } from 'firebase/firestore';
import Modal from '../components/Modal';
import BadgeEstatus from '../components/BadgeEstatus';
import { useToast } from '../hooks/useToast';
import { useConfirmar } from '../hooks/useConfirmar';
import { fmtFechaHora, ymd } from '../utils/fechas';
import { ESTATUS_SOLICITUD, ROLES_RH } from '../utils/constantes';

export default function MisSolicitudes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  // Quien no es RH/admin ya no crea transporte suelto: aquí solo consulta lo que tenga de antes
  const soloConsulta = !ROLES_RH.includes(usuario?.rol);
  const toast = useToast();
  const [hoy] = useState(() => ymd()); // YYYY-MM-DD local, fijo mientras la pantalla esté abierta
  const confirmar = useConfirmar();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState(null);
  
  const [modalCancelar, setModalCancelar] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');

  useEffect(() => {
    if (!usuario?.uid) return;
    const q = query(collection(db, 'solicitudes'), where('creadoPor', '==', usuario.uid));
    const unsub = onSnapshot(q, snap => {
      let sols = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, estatus: data.estatus?.toLowerCase() || ESTATUS_SOLICITUD.PENDIENTE };
      });
      sols = sols.filter(s => s.origen !== 'tiempo_extra'); // las de tiempo extra las ve RH en Todas las solicitudes
      // Sort client-side avoiding composite index errors
      sols.sort((a,b) => (b.fechaServicio||'').localeCompare(a.fechaServicio||''));
      setSolicitudes(sols);
      setCargando(false);
    }, err => {
      console.error('MisSolicitudes:', err);
      toast.error('No se pudieron cargar tus solicitudes: ' + err.message);
      setCargando(false);
    });
    return () => unsub();
  }, [usuario, toast]);

  const abrirDetalle = async (sol) => {
    setDetalle(sol);
    if (sol.vistoPorSolicitante === false) {
      await updateDoc(doc(db, 'solicitudes', sol.id), { vistoPorSolicitante: true });
    }
  };

  const confirmarCancelacion = async (e) => {
    e.preventDefault();
    if (!motivoCancelacion.trim()) return toast.warning('Debes escribir un motivo corto.');
    try {
      await updateDoc(doc(db, 'solicitudes', modalCancelar.id), { 
        estatus: ESTATUS_SOLICITUD.CANCELADA,
        historial: arrayUnion({
          fecha: new Date().toISOString(),
          usuario: usuario?.nombre || '',
          accion: ESTATUS_SOLICITUD.CANCELADA,
          comentario: motivoCancelacion.trim()
        })
      });
      setModalCancelar(null);
      setMotivoCancelacion('');
    } catch (err) {
      toast.error('Error al cancelar: ' + err.message);
    }
  };

  const avisarARH = async (sol) => {
    const nota = await confirmar({
      titulo: 'Avisar a RH',
      mensaje: 'Escribe tu mensaje para RH; quedará en el historial de la solicitud.',
      textoConfirmar: 'Enviar aviso',
      campo: { etiqueta: 'Mensaje', placeholder: 'Ej. Cambió el horario de entrada...', multilinea: true, minLength: 3 },
    });
    if (!nota) return;
    try {
      await updateDoc(doc(db, 'solicitudes', sol.id), {
        historial: arrayUnion({
          fecha: new Date().toISOString(),
          usuario: usuario?.nombre || '',
          accion: 'nota',
          comentario: nota,
          esAviso: true
        })
      });
      toast.success('Aviso enviado a RH.');
    } catch (err) {
      toast.error('Error al enviar aviso: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo={soloConsulta ? 'Transporte · mis solicitudes anteriores' : 'Mis solicitudes'} descripcion="Consulta en tiempo real el estatus de tus viajes." />

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-secondary)] border-b font-semibold text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3">Novedad</th>
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Fecha Servicio</th>
              <th className="px-4 py-3">Pasajeros</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cargando ? <tr><td colSpan={6} className="p-4"><EsqueletoTabla filas={3} columnas={5} /></td></tr> :
             solicitudes.length === 0 ? <tr><td colSpan={6}><EstadoVacio titulo="Sin solicitudes" texto="No tienes solicitudes creadas." /></td></tr> :
             solicitudes.map(sol => (
              <tr key={sol.id} className={`hover:bg-[var(--bg-surface-hover)] ${sol.vistoPorSolicitante === false ? 'bg-[var(--status-success-bg)] border-l-2 border-l-[var(--status-success-text)]' : ''}`}>
                <td className="px-4 py-3">{sol.vistoPorSolicitante === false && <BellRing className="h-4 w-4 text-[var(--status-success-text)] shrink-0"/>}</td>
                <td className="px-4 py-3 font-mono">{sol.id.slice(0,8)}</td>
                <td className="px-4 py-3 font-semibold">{sol.fechaServicio}</td>
                <td className="px-4 py-3">{sol.totalPasajeros}</td>
                <td className="px-4 py-3">
                  <BadgeEstatus estatus={sol.estatus} />
                  {sol.estatus === ESTATUS_SOLICITUD.RECHAZADA && <p className="text-xs text-[var(--status-error-text)] mt-1 max-w-[150px] truncate">{sol.motivoRechazo}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={()=>abrirDetalle(sol)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] mr-2" title="Ver Detalle"><Eye className="h-4 w-4"/></button>
                  
                  {!soloConsulta && (sol.estatus === ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR ? (
                    <div className="mt-1 flex flex-col items-end gap-1">
                      <span className="text-xs text-[var(--text-muted)] max-w-[120px]">Ya fue enviada al proveedor.</span>
                      <Boton tamano="sm" icono={MessageSquareWarning} onClick={() => avisarARH(sol)}>Avisar a RH</Boton>
                    </div>
                  ) : (
                    (sol.estatus === ESTATUS_SOLICITUD.PENDIENTE || sol.estatus === ESTATUS_SOLICITUD.APROBADA) && sol.fechaServicio >= hoy && (
                      <div className="inline-flex">
                        <Boton variante="fantasma" tamano="icono" onClick={() => navigate(rutaEditarTransporte(sol.id))} title="Editar" aria-label="Editar"><Edit className="h-4 w-4" aria-hidden="true" /></Boton>
                        <Boton variante="peligro" tamano="icono" onClick={() => setModalCancelar(sol)} title="Cancelar" aria-label="Cancelar"><XCircle className="h-4 w-4" aria-hidden="true" /></Boton>
                      </div>
                    )
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `Detalle ${detalle.id.slice(0,8)}` : ''} maxWidth="max-w-2xl">
        {detalle && (
          <>
            <div className="grid grid-cols-2 text-sm gap-2 mb-4 p-4 border border-[var(--border-color)] rounded bg-[var(--bg-surface-secondary)]">
              <p><strong>Estatus:</strong> <BadgeEstatus estatus={detalle.estatus} /></p>
              <p><strong>Fecha Servicio:</strong> {detalle.fechaServicio}</p>
              <p><strong>Total Pasajeros:</strong> {detalle.totalPasajeros}</p>
              {detalle.estatus === ESTATUS_SOLICITUD.RECHAZADA && <p className="col-span-2 text-[var(--status-error-text)]"><strong>Motivo de rechazo:</strong> {detalle.motivoRechazo}</p>}
            </div>
            
            <h3 className="font-semibold text-sm mb-2 text-[var(--text-main)]">Historial</h3>
            <div className="space-y-2">
              {(detalle.historial || []).map((h, i) => (
                <div key={i} className={`p-2 rounded text-xs border ${h.esAviso ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]' : 'bg-[var(--bg-surface-secondary)] border-[var(--border-subtle)]'}`}>
                  <span className="font-semibold text-[var(--text-main)]">{h.usuario}</span> <span className="text-[var(--text-secondary)]">el {fmtFechaHora(h.fecha)}</span> — <span className="uppercase font-semibold text-[var(--text-main)]">{h.accion}</span>
                  <p className="mt-1 text-[var(--text-main)]">{h.comentario}</p>
                </div>
              ))}
              {(!detalle.historial || detalle.historial.length === 0) && <p className="text-xs text-[var(--text-muted)]">Sin historial registrado.</p>}
            </div>
          </>
        )}
      </Modal>

      <Modal isOpen={!!modalCancelar} onClose={() => setModalCancelar(null)} title="Cancelar Solicitud" maxWidth="max-w-sm" preventCloseOnBackdrop={true}>
        {modalCancelar && (
          <>
            <p className="text-xs text-[var(--text-secondary)] mb-4">Por favor, escribe un motivo corto por el cual cancelas esta solicitud.</p>
            <form onSubmit={confirmarCancelacion}>
              <Entrada type="text" autoFocus required value={motivoCancelacion} onChange={e => setMotivoCancelacion(e.target.value)} placeholder="Motivo de cancelación" aria-label="Motivo de cancelación" className="mb-4" />
              <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
                <Boton onClick={() => setModalCancelar(null)}>Cerrar</Boton>
                <Boton type="submit" variante="peligro">Cancelar solicitud</Boton>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
