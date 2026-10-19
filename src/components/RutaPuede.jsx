/**
 * RutaPuede.jsx — Protege un grupo de rutas según una capacidad de utils/permisos.js (CAPACIDADES): si no le toca, vuelve al inicio.
 * Las que dependen de las asignaciones esperan a que lleguen; las que solo dependen del rol del sistema (rh, admin) no esperan nada.
 * Props: puede — 'rh' | 'admin' | 'solicitar' | 'autorizar' | 'consultar' | 'recibir' | 'accesos' | …
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { DEPENDE_DE_ASIGNACIONES, puede as tienePermiso } from '../utils/permisos';
import Spinner from './Spinner';

export default function RutaPuede({ puede }) {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  if (!usuario) return <Navigate to="/login" replace />;
  if (DEPENDE_DE_ASIGNACIONES.has(puede) && accesos.cargando) return <Spinner />;
  return tienePermiso(puede, accesos) ? <Outlet /> : <Navigate to="/" replace />;
}
