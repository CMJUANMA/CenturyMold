/**
 * RutaProtegida.jsx
 * Wrapper genérico: redirige a /login si no hay sesión.
 * Muestra una carga con la forma de la pantalla mientras se carga la sesión/perfil y una pantalla de error con
 * "Reintentar" y "Cerrar sesión" si el perfil no se pudo leer.
 * Si el perfil exige cambiar la contraseña (primer acceso), bloquea el resto de rutas.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Spinner from './Spinner';
import Boton from './ui/Boton';
import CierrePorInactividad from './CierrePorInactividad';

const RUTA_CAMBIAR_PASSWORD = '/cambiar-password';

export default function RutaProtegida() {
  const { usuario, fireUser, cargando, errorPerfil, reintentarPerfil, cerrarSesion } = useAuth();
  const { pathname } = useLocation();

  if (errorPerfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-4">
        <div role="alert" className="w-full max-w-sm rounded-lg border border-[var(--status-error-border)] bg-[var(--bg-surface)] p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-[var(--status-error-text)]" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-[var(--text-main)]">No se pudo cargar tu perfil</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {errorPerfil.code === 'permission-denied'
              ? 'No tienes permiso para leer tu perfil. Contacta a Recursos Humanos.'
              : 'Revisa tu conexión e inténtalo de nuevo.'}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Boton className="flex-1" onClick={cerrarSesion}>Cerrar sesión</Boton>
            <Boton variante="primario" className="flex-1" onClick={reintentarPerfil}>Reintentar</Boton>
          </div>
        </div>
      </div>
    );
  }

  // Hay sesión de Auth pero el perfil aún no llega
  if (cargando || (fireUser && !usuario)) return <Spinner fullScreen />;
  if (!usuario) return <Navigate to="/login" replace />;

  if (usuario.debeCambiarPassword === true && pathname !== RUTA_CAMBIAR_PASSWORD) {
    return <Navigate to={RUTA_CAMBIAR_PASSWORD} replace />;
  }
  return (
    <>
      <CierrePorInactividad />
      <Outlet />
    </>
  );
}
