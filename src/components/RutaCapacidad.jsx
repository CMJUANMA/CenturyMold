/**
 * RutaCapacidad.jsx — Protege una ruta según lo que la persona hace (no según el módulo): si no le toca, vuelve al inicio.
 * Props: puede — 'solicitar' (solicitante, Aut. 1 o RH) | 'autorizar' (Aut. 1, Aut. 2 o RH) | 'consultar' (Aut. 2 o RH) | 'recibir' (RH o admin)
 *        | 'organigrama' (Aut. 2, RH o Aut. 1: su área)
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAccesos } from '../hooks/useAccesos';
import { veOrganigrama } from '../utils/navegacion';
import Spinner from './Spinner';

const REGLAS = {
  solicitar: (a) => a.esRH || a.areasSolicitante.length > 0 || a.areasAut1.length > 0,
  autorizar: (a) => a.esRH || a.esAut2 || a.areasAut1.length > 0,
  consultar: (a) => a.esRH || a.esAut2,
  recibir: (a) => a.esRH,
  organigrama: (a) => veOrganigrama(a),
};

export default function RutaCapacidad({ puede }) {
  const accesos = useAccesos();
  if (accesos.cargando) return <Spinner />;
  return REGLAS[puede]?.(accesos) ? <Outlet /> : <Navigate to="/" replace />;
}
