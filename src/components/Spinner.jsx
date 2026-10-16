/**
 * Spinner.jsx — Carga de pantalla completa o de página. Conserva el nombre por compatibilidad con las rutas protegidas, pero ya no gira:
 * muestra la forma de una página (encabezado + bloques) con el esqueleto del sistema de diseño. Con prefers-reduced-motion queda quieto.
 */
import { EsqueletoPagina } from './ui/Esqueleto';

export default function Spinner({ fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-app)] px-4 py-10">
        <div className="mx-auto max-w-3xl"><EsqueletoPagina /></div>
      </div>
    );
  }
  return <div className="py-6"><EsqueletoPagina /></div>;
}
