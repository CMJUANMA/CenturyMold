/**
 * App.jsx — Router principal
 *
 * Portal en "/" (una tarjeta por módulo) y cada módulo bajo su ruta base (ver modulos.js):
 *   /rutas/...        Transporte
 *   /tiempo-extra/... Tiempo extra
 */
import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CatalogosProvider } from './context/CatalogosContext';
import RutaProtegida from './components/RutaProtegida';
import RutaRol from './components/RutaRol';
import RutaModulo from './components/RutaModulo';
import Redirigir from './components/Redirigir';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Portal from './pages/Portal';
import Inicio from './pages/Inicio';
import TiempoExtraInicio from './pages/TiempoExtraInicio';
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
const Estructura = lazy(() => import('./pages/rh/Estructura'));
const NivelesAutorizacion = lazy(() => import('./pages/rh/NivelesAutorizacion'));
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
        { path: '/', element: <Portal /> },
        { path: '/perfil', element: <Perfil /> },

        // Módulo de transporte (rutas)
        {
          element: <RutaModulo modulo="rutas" />,
          children: [
            { path: '/rutas', element: <Inicio /> },
            { path: '/rutas/solicitud/nueva', element: <NuevaSolicitud /> },
            { path: '/rutas/solicitud/editar/:id', element: <EditarSolicitud /> },
            { path: '/rutas/mis-solicitudes', element: <MisSolicitudes /> },
            {
              element: <RutaRol roles={ROLES_RH} />,
              children: [
                { path: '/rutas/rh/solicitudes', element: <RhSolicitudes /> },
                { path: '/rutas/rh/empleados', element: <RhEmpleados /> },
                { path: '/rutas/rh/catalogos', element: <RhCatalogos /> },
                { path: '/rutas/rh/usuarios', element: <RhUsuarios /> },
                { path: '/rutas/rh/estructura', element: <Estructura /> },
              ],
            },
          ],
        },

        // Módulo de tiempo extra (el acceso sale de la matriz de autorización, no del rol)
        {
          element: <RutaModulo modulo="tiempo-extra" />,
          children: [
            { path: '/tiempo-extra', element: <TiempoExtraInicio /> },
            {
              element: <RutaRol roles={ROLES_RH} />,
              children: [
                { path: '/tiempo-extra/niveles', element: <NivelesAutorizacion /> },
              ],
            },
          ],
        },

        // URLs anteriores a los módulos
        { path: '/solicitud/nueva', element: <Redirigir a="/rutas/solicitud/nueva" /> },
        { path: '/solicitud/editar/:id', element: <Redirigir a="/rutas/solicitud/editar/:id" /> },
        { path: '/mis-solicitudes', element: <Redirigir a="/rutas/mis-solicitudes" /> },
        { path: '/rh/solicitudes', element: <Redirigir a="/rutas/rh/solicitudes" /> },
        { path: '/rh/empleados', element: <Redirigir a="/rutas/rh/empleados" /> },
        { path: '/rh/catalogos', element: <Redirigir a="/rutas/rh/catalogos" /> },
        { path: '/rh/usuarios', element: <Redirigir a="/rutas/rh/usuarios" /> },
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
