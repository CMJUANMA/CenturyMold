/**
 * RutaModulo.jsx
 * Protege las rutas de un módulo del portal: si el usuario no tiene acceso a él (modulos.js)
 * lo regresa al portal. Espera a que cargue la matriz de tiempo extra antes de decidir.
 * Props:
 *   modulo: string — id del módulo (ej. 'rutas', 'tiempo-extra')
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAccesosTE } from '../hooks/useAccesosTE';
import { moduloPorId } from '../modulos';
import Spinner from './Spinner';

export default function RutaModulo({ modulo }) {
  const { usuario } = useAuth();
  const te = useAccesosTE();
  const cfg = moduloPorId(modulo);
  if (!usuario) return <Navigate to="/login" replace />;
  if (!cfg) return <Navigate to="/" replace />;
  // El acceso a tiempo extra depende de la matriz: hay que esperar a que llegue
  if (modulo === 'tiempo-extra' && te.cargando) return <Spinner />;
  if (!cfg.acceso(usuario, { te })) return <Navigate to="/" replace />;
  return <Outlet />;
}
