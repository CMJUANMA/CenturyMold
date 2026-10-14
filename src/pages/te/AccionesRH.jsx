/**
 * AccionesRH.jsx — Botones de RH sobre un tiempo extra autorizado o recibido (los usa Recepción y Consulta):
 *   Recibir y generar transporte · Devolver (motivo obligatorio) · Cancelar tiempo extra autorizado (motivo obligatorio).
 * En la recepción no se editan empleados: si algo está mal, RH devuelve.
 */
import { useState } from 'react';
import { CheckCircle2, Loader2, Undo2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { formatoFecha } from '../../utils/asignaciones';
import { MIN_MOTIVO_CANCELACION_RH, MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, NIVEL_RECEPCION } from '../../utils/tiempoExtra';
import { YaRespondida, cancelarAutorizada, devolverSolicitud, recibirSolicitud } from '../../utils/tiempoExtraDb';

const boton = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

/** Mensaje al cancelar según lo que pasó con el transporte (null si no hay nada que avisar) */
function avisoCancelacion(resultado) {
  if (resultado.transporte === 'enviado') {
    return { tipo: 'warning', texto: `El transporte de ${formatoFecha(`${resultado.fechaServicio}T12:00:00`)} ya se envió al proveedor; avísale por teléfono. La solicitud de transporte quedó marcada para revisión.` };
  }
  if (resultado.transporte === 'cancelado') return { tipo: 'success', texto: 'Tiempo extra cancelado; su solicitud de transporte también se canceló.' };
  return { tipo: 'success', texto: 'Tiempo extra cancelado.' };
}

/**
 * @param {object} props
 * @param {object} props.t                 la solicitud (id, folio, estatus, fechaTE)
 * @param {Array<'recibir'|'devolver'|'cancelar'>} props.acciones  cuáles mostrar
 * @param {() => void} props.onHecho       se llama al terminar (o si alguien más ya respondió): cierra el detalle
 */
export default function AccionesRH({ t, acciones, onHecho, onTrabajando }) {
  const { usuario } = useAuth();
  const confirmar = useConfirmar();
  const toast = useToast();
  const [trabajando, setTrabajando] = useState(false);

  const ejecutar = async (fn) => {
    setTrabajando(true); onTrabajando?.(true);
    try { await fn(); } catch (err) {
      if (err instanceof YaRespondida) { toast.warning(MSG_YA_RESPONDIDA, 7000); onHecho?.(); } else toast.error(`No se pudo completar: ${err.message}`, 9000);
    } finally { setTrabajando(false); onTrabajando?.(false); }
  };

  const recibir = () => ejecutar(async () => {
    const r = await recibirSolicitud({ id: t.id, usuario });
    toast.success(r.solicitudTransporteId ? `${t.folio} recibida: transporte solicitado para ${r.pasajeros} ${r.pasajeros === 1 ? 'empleado' : 'empleados'}.` : `${t.folio} recibida (sin empleados con transporte).`);
    onHecho?.();
  });

  const devolver = () => ejecutar(async () => {
    const motivo = await confirmar({
      titulo: `Devolver ${t.folio}`, mensaje: 'La solicitud regresa a su solicitante para que la corrija y la reenvíe a autorización.', textoConfirmar: 'Devolver', peligroso: true,
      campo: { etiqueta: 'Motivo de la devolución', minLength: MIN_MOTIVO_DEVOLUCION, multilinea: true },
    });
    if (!motivo) return;
    await devolverSolicitud({ id: t.id, usuario, nivel: NIVEL_RECEPCION, motivo });
    toast.success(`${t.folio} devuelta al solicitante.`);
    onHecho?.();
  });

  const cancelar = () => ejecutar(async () => {
    const recibida = t.estatus === 'procesada';
    const motivo = await confirmar({
      titulo: `Cancelar ${t.folio}`,
      mensaje: recibida ? 'Ya fue recibida: también se cancelará su solicitud de transporte, si todavía no se envía al proveedor.' : 'Se cancela el tiempo extra autorizado.',
      textoConfirmar: 'Cancelar tiempo extra', peligroso: true,
      campo: { etiqueta: 'Motivo de la cancelación', minLength: MIN_MOTIVO_CANCELACION_RH, multilinea: true },
    });
    if (!motivo) return;
    const r = await cancelarAutorizada({ id: t.id, usuario, motivo });
    const aviso = avisoCancelacion(r);
    toast[aviso.tipo](aviso.texto, r.transporte === 'enviado' ? 20000 : 5000);
    onHecho?.();
  });

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {acciones.includes('cancelar') && (
        <button type="button" id="btn-cancelar-autorizada" disabled={trabajando} onClick={cancelar}
          className={`${boton} border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><XCircle className="h-4 w-4" />Cancelar tiempo extra autorizado</button>
      )}
      {acciones.includes('devolver') && (
        <button type="button" id="btn-devolver-recepcion" disabled={trabajando} onClick={devolver}
          className={`${boton} border border-[var(--status-error-border)] bg-[var(--bg-surface)] text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]`}><Undo2 className="h-4 w-4" />Devolver</button>
      )}
      {acciones.includes('recibir') && (
        <button type="button" id="btn-recibir" disabled={trabajando} onClick={recibir} className={`${boton} bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)]`}>
          {trabajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Recibir y generar transporte
        </button>
      )}
    </div>
  );
}
