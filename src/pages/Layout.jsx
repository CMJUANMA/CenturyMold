/**
 * Layout.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Estructura principal de la aplicación: barra lateral y contenedor de contenido.
 * Diseñado con aspecto corporativo y responsivo.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] antialiased">
      <Navbar />
      <main className="min-h-screen pt-14 lg:pt-0 lg:ml-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
