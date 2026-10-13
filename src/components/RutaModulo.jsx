/**
 * RutaModulo.jsx
 * Protege las rutas de un módulo del portal: si el usuario no tiene acceso a él (modulos.js)
 * lo regresa al portal. Espera a que lleguen sus asignaciones antes de decidir.
 * Props:
 *   modulo: string — id del módulo (ej. 'rutas', 'tiempo-extra')
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAccesos } from '../hooks/useAccesos';
import { moduloPorId } from '../modulos';
import Spinner from './Spinner';

export default function RutaModulo({ modulo }) {
  const { usuario } = useAuth();
  const accesos = useAccesos();
  const cfg = moduloPorId(modulo);
  if (!usuario) return <Navigate to="/login" replace />;
  if (!cfg) return <Navigate to="/" replace />;
  // El acceso depende de las asignaciones: hay que esperar a que lleguen
  if (accesos.cargando) return <Spinner />;
  if (!cfg.acceso(usuario, accesos)) return <Navigate to="/" replace />;
  return <Outlet />;
}
