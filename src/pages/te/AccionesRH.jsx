/**
 * AccionesRH.jsx — Botones de RH sobre un tiempo extra autorizado o ya confirmado (los usan "Por enviar al proveedor" y Consulta):
 *   Confirmar y generar transporte (o "Confirmar (sin transporte)") · Devolver (motivo obligatorio) · Cancelar tiempo extra autorizado (motivo obligatorio).
 * Aquí no se editan empleados: si algo está mal, RH devuelve.
 */
import { useState } from 'react';
import { CheckCircle2, Undo2, XCircle } from 'lucide-react';
import Boton from '../../components/ui/Boton';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { formatoFecha } from '../../utils/asignaciones';
import { MIN_MOTIVO_CANCELACION_RH, MIN_MOTIVO_DEVOLUCION, MSG_YA_RESPONDIDA, NIVEL_RECEPCION, mensajeConfirmada, textoConfirmar } from '../../utils/tiempoExtra';
import { YaRespondida, cancelarAutorizada, devolverSolicitud, recibirSolicitud } from '../../utils/tiempoExtraDb';

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
 * @param {(t: object, r: object) => void} [props.onConfirmada]  si se da, la pantalla muestra el aviso "Listo…" con su enlace; si no, un toast
 */
export default function AccionesRH({ t, acciones, onHecho, onTrabajando, onConfirmada }) {
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
    if (onConfirmada) onConfirmada(t, r);
    else toast.success(mensajeConfirmada({ fecha: t.fechaTE, pasajeros: r.pasajeros }), 9000);
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
    const recibida = t.estatus === 'procesada'; // ya confirmada por RH
    const motivo = await confirmar({
      titulo: `Cancelar ${t.folio}`,
      mensaje: recibida ? 'Ya fue confirmada: también se cancelará su solicitud de transporte, si todavía no se envía al proveedor.' : 'Se cancela el tiempo extra autorizado.',
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
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {acciones.includes('cancelar') && (
        <Boton id="btn-cancelar-autorizada" variante="peligro" icono={XCircle} disabled={trabajando} onClick={cancelar}>Cancelar tiempo extra autorizado</Boton>
      )}
      {acciones.includes('devolver') && (
        <Boton id="btn-devolver-recepcion" variante="peligro" icono={Undo2} disabled={trabajando} onClick={devolver}>Devolver</Boton>
      )}
      {acciones.includes('recibir') && (
        <Boton id="btn-recibir" variante="primario" icono={CheckCircle2} estado={trabajando ? 'cargando' : undefined} onClick={recibir}>{textoConfirmar(t)}</Boton>
      )}
    </div>
  );
}
