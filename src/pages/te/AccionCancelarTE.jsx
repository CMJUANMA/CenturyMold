/**
 * AccionCancelarTE.jsx — El botón (o el texto) de CANCELAR una solicitud de tiempo extra, igual en todas las pantallas
 * (Mis solicitudes, Por autorizar, Todas las solicitudes). Qué se muestra según quién eres y el estatus sale de utils/cancelacion.js:
 *   puede cancelar   → botón «Cancelar» (contorno de peligro) con confirmación y motivo obligatorio de 10+ caracteres
 *   RH sobre lo autorizado o confirmado → el flujo de RH (cancela también el transporte, o avisa si ya se envió al proveedor)
 *   el solicitante, ya autorizada → «Ya está autorizada. Para cancelarla, avisa a Recursos Humanos.»
 * «Devolver» regresa la solicitud para corregir; «Cancelar» la saca: ya no va.
 * Al cancelar queda quién, cuándo y por qué en la solicitud y en el historial; si no la cancela quien la solicitó, sale el recordatorio de avisarle.
 */
import { useState } from 'react';
import { XCircle } from 'lucide-react';
import Boton from '../../components/ui/Boton';
import { useAuth } from '../../hooks/useAuth';
import { useAccesos } from '../../hooks/useAccesos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { useAvisarTE } from '../../hooks/useAvisarTE';
import { MIN_MOTIVO_CANCELACION, quienPuedeCancelar } from '../../utils/cancelacion';
import { cancelarSolicitud } from '../../utils/tiempoExtraDb';
import AccionesRH from './AccionesRH';

export default function AccionCancelarTE({ t, onHecho, className = '', tamano = 'sm', id }) {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const confirmar = useConfirmar();
  const toast = useToast();
  const avisar = useAvisarTE();
  const [trabajando, setTrabajando] = useState(false);

  const { puede, flujoRH, mensaje } = quienPuedeCancelar({ t, uid: usuario?.uid, esRH: accesos.esRH, esAut2: accesos.esAut2, areasAut1: accesos.areasAut1 });
  if (!puede) return mensaje ? <p className="max-w-[15rem] text-xs text-[var(--text-secondary)]">{mensaje}</p> : null;
  if (flujoRH) return <AccionesRH t={t} acciones={['cancelar']} onHecho={onHecho} />;

  const cancelar = async () => {
    const propia = t.creadoPor === usuario.uid;
    const motivo = await confirmar({
      titulo: `Cancelar ${t.folio ?? 'la solicitud'}`,
      mensaje: `Cancelar es definitivo: la solicitud ya no irá a autorización ni a RH. Si solo hay que corregirla, usa «Devolver». ${propia ? '' : 'Se le avisa a quien la solicitó en tu pantalla.'}`,
      textoConfirmar: 'Cancelar solicitud', peligroso: true,
      campo: { etiqueta: 'Motivo de la cancelación', minLength: MIN_MOTIVO_CANCELACION, multilinea: true },
    });
    if (!motivo) return;
    setTrabajando(true);
    try {
      await cancelarSolicitud({ id: t.id, usuario, motivo });
      toast.success('Solicitud cancelada.');
      if (!propia) avisar.cancelacion({ folio: t.folio, creadoPorNombre: t.creadoPorNombre });
      onHecho?.();
    } catch (err) {
      toast.error(err.code === 'permission-denied'
        ? 'No se pudo cancelar: la solicitud ya cambió de estatus o ya no te corresponde. Actualiza la pantalla.'
        : `No se pudo cancelar: ${err.message}`, 8000);
    } finally { setTrabajando(false); }
  };

  return (
    <Boton id={id} tamano={tamano} variante="peligro" icono={XCircle} className={className} disabled={trabajando} onClick={cancelar}>Cancelar</Boton>
  );
}
