/**
 * Redirigir.jsx — Redirección con parámetros de la URL, para las rutas viejas (/solicitud/editar/:id → /rutas/...).
 * `a` puede traer segmentos ":nombre" que se sustituyen con los parámetros actuales; se conserva la query.
 */
import { Navigate, useLocation, useParams } from 'react-router-dom';

export default function Redirigir({ a }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const destino = a.replace(/:(\w+)/g, (_, k) => encodeURIComponent(params[k] ?? ''));
  return <Navigate to={`${destino}${search}${hash}`} replace />;
}
