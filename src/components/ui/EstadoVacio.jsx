/**
 * EstadoVacio.jsx — Cuando no hay nada que mostrar: texto corto que dice qué hacer y un botón para hacerlo. Sin ilustraciones.
 *   <EstadoVacio texto="Aún no tienes solicitudes." accion={{ texto: 'Solicitar tiempo extra', to: '/tiempo-extra/nueva' }} />
 */
import { Link } from 'react-router-dom';
import Boton from './Boton';

export default function EstadoVacio({ titulo, texto, accion, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}>
      {titulo && <h3 className="text-base font-semibold text-[var(--text-main)]">{titulo}</h3>}
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">{texto}</p>
      {accion && (accion.to
        ? <Link to={accion.to} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)] md:min-h-10">{accion.texto}</Link>
        : <Boton variante="contorno" onClick={accion.onClick}>{accion.texto}</Boton>)}
    </div>
  );
}
