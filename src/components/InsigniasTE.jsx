/**
 * InsigniasTE.jsx — Insignias de una solicitud de tiempo extra en las listas y el detalle:
 *   "Autorizada fuera de tiempo" (aviso) cuando Aut. 2 la autorizó ya vencida, "3 rutas" (aviso) cuando usa más de una ruta (cada ruta adicional cuesta), "Extensión de turno" y "Termina al día siguiente" (información; solo si alguien
 *   termina después de las 12:00 a. m.: el fin justo a medianoche, el turno 2 de siempre, no lo lleva). Sin ninguna no pinta nada.
 */
import { Moon, Route, ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import Insignia from './ui/Insignia';
import { minutosDeHoraTexto } from '../utils/horas';
import { ETIQUETA_FUERA_DE_TIEMPO, esAutorizadaFueraDeTiempo, esExtension, terminaDiaSiguiente } from '../utils/tiempoExtra';

/** ¿Algún bloque del resumen ("22:00 → 7:00") termina el día siguiente después de las 12:00 a. m.? */
const pasaDeMedianoche = (t) => Object.keys(t?.resumen?.porBloque ?? {}).some((b) => {
  const [ini, fin] = String(b).split('→').map(x => x.trim());
  return terminaDiaSiguiente(ini, fin) && minutosDeHoraTexto(fin) > 0;
});

export default function InsigniasTE({ t, className = '' }) {
  const rutas = t?.rutasDistintas ?? 0;
  const ext = esExtension(t);
  const noche = pasaDeMedianoche(t);
  const fuera = esAutorizadaFueraDeTiempo(t);
  const admin = t?.accionAdmin === true;
  if (rutas <= 1 && !ext && !noche && !fuera && !admin) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {fuera && <span title="Aut. 2 la autorizó después de su fecha; el motivo está en el detalle"><Insignia tono="aviso" icono={ShieldCheck}>{ETIQUETA_FUERA_DE_TIEMPO}</Insignia></span>}
      {admin && <span title="El admin hizo al menos una acción en esta solicitud en modo admin; el historial dice cuáles"><Insignia tono="aviso" icono={ShieldAlert}>Acción de admin</Insignia></span>}
      {rutas > 1 && <span title="Cada ruta adicional representa un costo extra"><Insignia tono="aviso" icono={Route}>{rutas} rutas</Insignia></span>}
      {noche && <span title="Alguien termina después de la medianoche: su salida es al día siguiente"><Insignia tono="info" icono={Moon}>Termina al día siguiente</Insignia></span>}
      {ext && <span title="El empleado ya está en la planta y se queda más tiempo"><Insignia tono="info" icono={Timer}>Extensión de turno</Insignia></span>}
    </span>
  );
}
