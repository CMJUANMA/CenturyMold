/**
 * RutaAcceso.jsx — Protege las rutas de tiempo extra: quien no tiene ningún rol (RH, admin, Aut. 2, Aut. 1 o solicitante) vuelve al inicio.
 * Espera a que lleguen sus asignaciones antes de decidir.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import Spinner from './Spinner';

export default function RutaAcceso() {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  if (!usuario) return <Navigate to="/login" replace />;
  if (accesos.cargando) return <Spinner />;
  return accesos.tieneAcceso ? <Outlet /> : <Navigate to="/" replace />;
}
