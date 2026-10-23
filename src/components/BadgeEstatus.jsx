/**
 * BadgeEstatus.jsx — Insignia con el estatus de una solicitud: tono apagado + ícono + texto (nunca solo color).
 * Con `modulo="te"` usa los estatus de tiempo extra. El texto sale de ESTATUS_MAP / ESTATUS_TE_MAP (utils/constantes.js).
 * `conPunto` se conserva por compatibilidad (el ícono ya cumple esa función).
 */
import { CalendarX2, CheckCheck, CheckCircle2, Clock, PencilLine, Send, Undo2, XCircle } from 'lucide-react';
import Insignia from './ui/Insignia';
import { estatusVisible } from '../utils/tiempoExtra';
import { ESTATUS_MAP, ESTATUS_TE_MAP, normalizarEstatus } from '../utils/constantes';

// estatus → tono e ícono. Devuelta y pendiente piden atención (aviso); el error queda para lo rechazado
const ESTILO = {
  // transporte
  pendiente: { tono: 'aviso', icono: Clock },
  aprobada: { tono: 'exito', icono: CheckCircle2 },
  rechazada: { tono: 'error', icono: XCircle },
  cancelada: { tono: 'neutro', icono: XCircle },
  'enviada al proveedor': { tono: 'info', icono: Send },
  // tiempo extra
  borrador: { tono: 'neutro', icono: PencilLine },
  pendiente_aut1: { tono: 'info', icono: Clock },
  pendiente_aut2: { tono: 'info', icono: Clock },
  autorizada: { tono: 'exito', icono: CheckCircle2 },
  devuelta: { tono: 'aviso', icono: Undo2 },
  procesada: { tono: 'exito', icono: CheckCheck },
  vencida: { tono: 'neutro', icono: CalendarX2 },
};

/** Con `t` (la solicitud de tiempo extra) muestra «Vencida» cuando venció, en lugar de su estatus guardado */
export default function BadgeEstatus({ estatus, t, modulo = 'rutas', className = '' }) {
  const norm = t ? normalizarEstatus(estatusVisible(t)) : normalizarEstatus(estatus);
  const mapa = modulo === 'te' ? ESTATUS_TE_MAP : ESTATUS_MAP;
  const etiqueta = mapa[norm]?.label ?? norm;
  const estilo = ESTILO[norm] ?? { tono: 'neutro', icono: Clock };
  return <Insignia tono={estilo.tono} icono={estilo.icono} className={className}>{etiqueta}</Insignia>;
}
