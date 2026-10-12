/**
 * App.jsx — Router principal
 */
import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CatalogosProvider } from './context/CatalogosContext';
import RutaProtegida from './components/RutaProtegida';
import RutaRol from './components/RutaRol';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import NuevaSolicitud from './pages/NuevaSolicitud';
import MisSolicitudes from './pages/MisSolicitudes';
import EditarSolicitud from './pages/EditarSolicitud';
import Perfil from './pages/Perfil';
import CambiarPassword from './pages/CambiarPassword';
// Las pantallas de RH se descargan solo cuando se visitan (no pesan en el bundle inicial)
const RhSolicitudes = lazy(() => import('./pages/rh/RhSolicitudes'));
const RhEmpleados = lazy(() => import('./pages/rh/RhEmpleados'));
const RhCatalogos = lazy(() => import('./pages/rh/RhCatalogos'));
const RhUsuarios = lazy(() => import('./pages/rh/RhUsuarios'));
import { ROLES_RH } from './utils/roles';
import { ToastProvider } from './components/Toast';
import { ConfirmarProvider } from './context/ConfirmarContext';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [
    { path: '/cambiar-password', element: <CambiarPassword /> },
    {
      element: <Layout />,
      children: [
        { path: '/', element: <Inicio /> },
        { path: '/solicitud/nueva', element: <NuevaSolicitud /> },
        { path: '/solicitud/editar/:id', element: <EditarSolicitud /> },
        { path: '/mis-solicitudes', element: <MisSolicitudes /> },
        { path: '/perfil', element: <Perfil /> },
        {
          element: <RutaRol roles={ROLES_RH} />,
          children: [
            { path: '/rh/solicitudes', element: <RhSolicitudes /> },
            { path: '/rh/empleados', element: <RhEmpleados /> },
            { path: '/rh/catalogos', element: <RhCatalogos /> },
            { path: '/rh/usuarios', element: <RhUsuarios /> },
          ],
        },
      ],
    }],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CatalogosProvider>
          <ToastProvider>
            <ConfirmarProvider>
              <RouterProvider router={router} />
            </ConfirmarProvider>
          </ToastProvider>
        </CatalogosProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
