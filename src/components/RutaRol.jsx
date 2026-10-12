/**
 * RutaRol.jsx
 * Protege rutas que solo ciertos roles pueden ver.
 * Props:
 *   roles: string[]  — ej. ['rh', 'admin']
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RutaRol({ roles }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!roles.includes(usuario.rol)) return <Navigate to="/" replace />;
  return <Outlet />;
}
