/**
 * RutaFuncion.jsx — Protege las rutas de una función que puede estar apagada (ver funciones.js): apagada, regresa al inicio.
 * Props: funcion — nombre en FUNCIONES (ej. 'transporteSuelto')
 */
import { Navigate, Outlet } from 'react-router-dom';
import { funcionActiva } from '../funciones';

export default function RutaFuncion({ funcion }) {
  return funcionActiva(funcion) ? <Outlet /> : <Navigate to="/" replace />;
}
