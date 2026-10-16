/**
 * Aviso.jsx — Mensaje en la pantalla (no flotante): fondo suave + ícono + texto. El error dice qué pasó y qué hacer, en lenguaje sencillo.
 *   tono: exito · aviso · error · info. `titulo` opcional en negritas; `accion` opcional (un botón o enlace) a la derecha.
 */
import { TONOS } from './estilos';

export default function Aviso({ tono = 'info', titulo, accion, icon, className = '', children, ...resto }) {
  const t = TONOS[tono] ?? TONOS.info;
  const Icono = icon ?? t.Icono;
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${t.caja} ${className}`} {...resto}>
      {Icono && <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className={titulo ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {accion}
    </div>
  );
}
