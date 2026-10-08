/**
 * RutaProtegida.jsx
 * Wrapper genérico: redirige a /login si no hay sesión.
 * Muestra spinner mientras cargando === true.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function RutaProtegida() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Spinner fullScreen />;
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}
