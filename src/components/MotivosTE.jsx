/**
 * MotivosTE.jsx — Los motivos de una solicitud de tiempo extra como etiquetas ("Cargo a P.O. 4551099797", "Inventario físico · apoyo a inventario"),
 * y el aviso «Requiere firma del Program Manager» cuando lleva P.O. o TB (`pm`: solo para quien lo necesita, Aut. 2 y Nóminas).
 * Las solicitudes anteriores muestran su motivo tal como lo guardaron. Sin motivos ni aviso no pinta nada.
 */
import { FileSignature } from 'lucide-react';
import Aviso from './ui/Aviso';
import Insignia from './ui/Insignia';
import { AVISO_PROGRAM_MANAGER, etiquetaMotivo, motivosDeTE, numerosDeTE, requiereProgramManager, textoNumero } from '../utils/motivosTE';

export default function MotivosTE({ t, pm = false, className = '' }) {
  const motivos = motivosDeTE(t).filter(m => m.nombre);
  const firma = pm && requiereProgramManager(t);
  if (!motivos.length && !firma) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 font-sans ${className}`}>
      {motivos.map((m, i) => <Insignia key={i} tono="neutro" sinIcono className="!whitespace-normal text-left">{etiquetaMotivo(m)}</Insignia>)}
      {firma && <Insignia tono="aviso" icono={FileSignature} className="!whitespace-normal text-left">{AVISO_PROGRAM_MANAGER}</Insignia>}
    </span>
  );
}

/** El aviso completo del detalle: qué P.O. o TB lleva y que necesita la firma (2) del Program Manager */
export function AvisoProgramManager({ t }) {
  if (!requiereProgramManager(t)) return null;
  return (
    <Aviso tono="aviso" icon={FileSignature} titulo={AVISO_PROGRAM_MANAGER}>
      Esta solicitud lleva cargo a {numerosDeTE(t).map(textoNumero).join(', ')}. El formato de autorización de tiempo extra necesita la firma (2) del Program Manager responsable de la cuenta.
    </Aviso>
  );
}
