/**
 * InsigniasTE.jsx — Insignias de una solicitud de tiempo extra en las listas y el detalle:
 *   "3 rutas" (aviso) cuando usa más de una ruta (cada ruta adicional cuesta), "Extensión de turno" y "Termina al día siguiente" (información; solo si alguien
 *   termina después de las 12:00 a. m.: el fin justo a medianoche, el turno 2 de siempre, no lo lleva). Sin ninguna no pinta nada.
 */
import { Moon, Route, Timer } from 'lucide-react';
import Insignia from './ui/Insignia';
import { minutosDeHoraTexto } from '../utils/horas';
import { esExtension, terminaDiaSiguiente } from '../utils/tiempoExtra';

/** ¿Algún bloque del resumen ("22:00 → 7:00") termina el día siguiente después de las 12:00 a. m.? */
const pasaDeMedianoche = (t) => Object.keys(t?.resumen?.porBloque ?? {}).some((b) => {
  const [ini, fin] = String(b).split('→').map(x => x.trim());
  return terminaDiaSiguiente(ini, fin) && minutosDeHoraTexto(fin) > 0;
});

export default function InsigniasTE({ t, className = '' }) {
  const rutas = t?.rutasDistintas ?? 0;
  const ext = esExtension(t);
  const noche = pasaDeMedianoche(t);
  if (rutas <= 1 && !ext && !noche) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {rutas > 1 && <span title="Cada ruta adicional representa un costo extra"><Insignia tono="aviso" icono={Route}>{rutas} rutas</Insignia></span>}
      {noche && <span title="Alguien termina después de la medianoche: su salida es al día siguiente"><Insignia tono="info" icono={Moon}>Termina al día siguiente</Insignia></span>}
      {ext && <span title="El empleado ya está en la planta y se queda más tiempo"><Insignia tono="info" icono={Timer}>Extensión de turno</Insignia></span>}
    </span>
  );
}
