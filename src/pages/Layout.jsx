/**
 * Layout.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Estructura principal de la aplicación: menú lateral y contenedor de contenido.
 * El contenido aparece con un fundido suave (180 ms) cada vez que cambia la pantalla; "Saltar al contenido" es para quien navega con teclado.
 */
import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] antialiased">
      <a href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-[var(--bg-surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--text-main)]">
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" className="min-h-screen pt-16 lg:ml-72 lg:pt-0">
        <div key={pathname} className="anim-pagina mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
