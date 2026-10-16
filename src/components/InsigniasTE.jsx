/**
 * InsigniasTE.jsx — Insignias de una solicitud de tiempo extra en las listas y el detalle:
 *   "3 rutas" (aviso) cuando usa más de una ruta (cada ruta adicional cuesta) y "Extensión de turno" (información).
 * Sin ninguna de las dos no pinta nada.
 */
import { Route, Timer } from 'lucide-react';
import Insignia from './ui/Insignia';
import { esExtension } from '../utils/tiempoExtra';

export default function InsigniasTE({ t, className = '' }) {
  const rutas = t?.rutasDistintas ?? 0;
  const ext = esExtension(t);
  if (rutas <= 1 && !ext) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {rutas > 1 && <span title="Cada ruta adicional representa un costo extra"><Insignia tono="aviso" icono={Route}>{rutas} rutas</Insignia></span>}
      {ext && <span title="El empleado ya está en la planta y se queda más tiempo"><Insignia tono="info" icono={Timer}>Extensión de turno</Insignia></span>}
    </span>
  );
}
