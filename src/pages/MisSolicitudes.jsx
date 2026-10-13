/**
 * MisSolicitudes.jsx — Vista del solicitante
 */
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { Layers, Loader2, Eye, XCircle, BellRing, Edit, MessageSquareWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { arrayUnion } from 'firebase/firestore';
import Modal from '../components/Modal';
import BadgeEstatus from '../components/BadgeEstatus';
import { useToast } from '../hooks/useToast';
import { useConfirmar } from '../hooks/useConfirmar';
import { fmtFechaHora, ymd } from '../utils/fechas';
import { ESTATUS_SOLICITUD } from '../utils/constantes';

export default function MisSolicitudes() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
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
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Mis solicitudes</h1>
        <p className="text-sm text-[var(--text-muted)]">Consulta en tiempo real el estatus de tus viajes.</p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-secondary)] border-b uppercase font-semibold text-[var(--text-secondary)]">
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
            {cargando ? <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></td></tr> :
             solicitudes.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]"><Layers className="h-8 w-8 mx-auto mb-2"/>No tienes solicitudes creadas.</td></tr> :
             solicitudes.map(sol => (
              <tr key={sol.id} className={`hover:bg-[var(--bg-surface-hover)] ${sol.vistoPorSolicitante === false ? 'bg-[var(--status-success-bg)] border-l-2 border-l-[var(--status-success-text)]' : ''}`}>
                <td className="px-4 py-3">{sol.vistoPorSolicitante === false && <BellRing className="h-4 w-4 text-[var(--status-success-text)] shrink-0"/>}</td>
                <td className="px-4 py-3 font-mono">{sol.id.slice(0,8)}</td>
                <td className="px-4 py-3 font-bold">{sol.fechaServicio}</td>
                <td className="px-4 py-3">{sol.totalPasajeros}</td>
                <td className="px-4 py-3">
                  <BadgeEstatus estatus={sol.estatus} />
                  {sol.estatus === ESTATUS_SOLICITUD.RECHAZADA && <p className="text-[9px] text-[var(--status-error-text)] mt-1 max-w-[150px] truncate">{sol.motivoRechazo}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={()=>abrirDetalle(sol)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] mr-2" title="Ver Detalle"><Eye className="h-4 w-4"/></button>
                  
                  {sol.estatus === ESTATUS_SOLICITUD.ENVIADA_PROVEEDOR ? (
                    <div className="mt-1 flex flex-col items-end gap-1">
                      <span className="text-[9px] text-[var(--text-muted)] max-w-[120px]">Ya fue enviada al proveedor.</span>
                      <button onClick={()=>avisarARH(sol)} className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"><MessageSquareWarning className="h-3 w-3"/> Avisar a RH</button>
                    </div>
                  ) : (
                    (sol.estatus === ESTATUS_SOLICITUD.PENDIENTE || sol.estatus === ESTATUS_SOLICITUD.APROBADA) && sol.fechaServicio >= hoy && (
                      <div className="inline-flex">
                        <button onClick={()=>navigate(`/rutas/solicitud/editar/${sol.id}`)} className="p-1 text-blue-600 hover:text-blue-800" title="Editar"><Edit className="h-4 w-4"/></button>
                        <button onClick={()=>setModalCancelar(sol)} className="p-1 text-[var(--status-error-text)] hover:opacity-80" title="Cancelar"><XCircle className="h-4 w-4"/></button>
                      </div>
                    )
                  )}
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
            
            <h3 className="font-bold text-sm mb-2 text-[var(--text-main)]">Historial</h3>
            <div className="space-y-2">
              {(detalle.historial || []).map((h, i) => (
                <div key={i} className={`p-2 rounded text-xs border ${h.esAviso ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]' : 'bg-[var(--bg-surface-secondary)] border-[var(--border-subtle)]'}`}>
                  <span className="font-bold text-[var(--text-main)]">{h.usuario}</span> <span className="text-[var(--text-secondary)]">el {fmtFechaHora(h.fecha)}</span> — <span className="uppercase font-semibold text-[var(--text-main)]">{h.accion}</span>
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
              <input type="text" autoFocus required value={motivoCancelacion} onChange={e=>setMotivoCancelacion(e.target.value)} placeholder="Motivo de cancelación..." className="w-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-main)] rounded px-3 py-2 text-sm mb-4 outline-none focus:border-[var(--cm-red)]" />
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setModalCancelar(null)} className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-main)] rounded text-xs font-bold hover:bg-[var(--bg-surface-hover)]">Cerrar</button>
                <button type="submit" className="bg-[var(--cm-red)] text-white px-4 py-2 rounded text-xs font-bold hover:bg-[var(--cm-red-hover)]">Confirmar</button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
