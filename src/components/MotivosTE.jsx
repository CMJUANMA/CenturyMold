/**
 * MotivosTE.jsx — Los motivos de una solicitud de tiempo extra como etiquetas ("Cargo a P.O. 4551099797", "Inventario físico · apoyo a inventario").
 * Las solicitudes anteriores muestran su motivo tal como lo guardaron. Sin motivos no pinta nada.
 */
import Insignia from './ui/Insignia';
import { etiquetaMotivo, motivosDeTE } from '../utils/motivosTE';

export default function MotivosTE({ t, className = '' }) {
  const motivos = motivosDeTE(t).filter(m => m.nombre);
  if (!motivos.length) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 font-sans ${className}`}>
      {motivos.map((m, i) => <Insignia key={i} tono="neutro" sinIcono className="!whitespace-normal text-left">{etiquetaMotivo(m)}</Insignia>)}
    </span>
  );
}
