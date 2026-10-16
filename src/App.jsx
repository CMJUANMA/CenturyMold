/**
 * App.jsx — Router principal
 *
 * Un solo Inicio en "/" por rol (RH y admin: indicadores; el resto: su panel). Las URLs salen de rutas.js.
 */
import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { PreferenciasProvider } from './context/PreferenciasContext';
import { AuthProvider } from './context/AuthContext';
import { CatalogosProvider } from './context/CatalogosContext';
import { AccesosProvider } from './context/AccesosContext';
import RutaProtegida from './components/RutaProtegida';
import RutaRol from './components/RutaRol';
import RutaModulo from './components/RutaModulo';
import Redirigir from './components/Redirigir';
import RutaFuncion from './components/RutaFuncion';
import { RUTAS_TRANSPORTE_SUELTO, RUTA_EDITAR_TRANSPORTE } from './funciones';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
const EditorTE = lazy(() => import('./pages/te/EditorTE'));
const MisSolicitudesTE = lazy(() => import('./pages/te/MisSolicitudesTE'));
const BandejaTE = lazy(() => import('./pages/te/BandejaTE'));
const ConsultaTE = lazy(() => import('./pages/te/ConsultaTE'));
const RecepcionTE = lazy(() => import('./pages/te/RecepcionTE'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
import RutaCapacidad from './components/RutaCapacidad';
import NuevaSolicitud from './pages/NuevaSolicitud';
import MisSolicitudes from './pages/MisSolicitudes';
import EditarSolicitud from './pages/EditarSolicitud';
import Perfil from './pages/Perfil';
import CambiarPassword from './pages/CambiarPassword';
// Las pantallas de RH se descargan solo cuando se visitan (no pesan en el bundle inicial)
const RhSolicitudes = lazy(() => import('./pages/rh/RhSolicitudes'));
const RhEmpleados = lazy(() => import('./pages/rh/RhEmpleados'));
const RhCatalogos = lazy(() => import('./pages/rh/RhCatalogos'));
const UsuariosYAccesos = lazy(() => import('./pages/rh/accesos/UsuariosYAccesos'));
const Estructura = lazy(() => import('./pages/rh/Estructura'));
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
        { path: '/', element: <Home /> },
        // Transporte suelto (funciones.js): apagado, estas rutas regresan al inicio. El código se conserva.
        {
          element: <RutaFuncion funcion="transporteSuelto" />,
          children: [
            { path: RUTAS_TRANSPORTE_SUELTO.misSolicitudes, element: <MisSolicitudes /> },
            {
              element: <RutaRol roles={ROLES_RH} />,
              children: [
                { path: RUTAS_TRANSPORTE_SUELTO.nueva, element: <NuevaSolicitud /> },
                { path: RUTA_EDITAR_TRANSPORTE, element: <EditarSolicitud /> },
              ],
            },
          ],
        },
        { path: '/perfil', element: <Perfil /> },
        // Configuración personal (ayudas, tamaño de letra y tema): para todos los usuarios
        { path: '/configuracion', element: <Configuracion /> },

        // Módulo de transporte (rutas)
        {
          element: <RutaModulo modulo="rutas" />,
          children: [
            {
              element: <RutaRol roles={ROLES_RH} />,
              children: [
                { path: '/rutas/rh/solicitudes', element: <RhSolicitudes /> },
                { path: '/rutas/rh/empleados', element: <RhEmpleados /> },
                { path: '/rutas/rh/catalogos', element: <RhCatalogos /> },
                { path: '/rutas/rh/estructura', element: <Estructura /> },
              ],
            },
          ],
        },

        // Módulo de tiempo extra (el acceso sale de las asignaciones vigentes, no del puesto)
        {
          element: <RutaModulo modulo="tiempo-extra" />,
          children: [
            {
              element: <RutaCapacidad puede="solicitar" />,
              children: [
                { path: '/tiempo-extra/nueva', element: <EditorTE /> },
                { path: '/tiempo-extra/:id/editar', element: <EditorTE /> },
                { path: '/tiempo-extra/mis-solicitudes', element: <MisSolicitudesTE /> },
              ],
            },
            { element: <RutaCapacidad puede="autorizar" />, children: [{ path: '/tiempo-extra/autorizar', element: <BandejaTE /> }] },
            { element: <RutaCapacidad puede="consultar" />, children: [{ path: '/tiempo-extra/consulta', element: <ConsultaTE /> }] },
            { element: <RutaCapacidad puede="recibir" />, children: [{ path: '/tiempo-extra/recepcion', element: <RecepcionTE /> }] },
          ],
        },

        // Usuarios y accesos: cada pestaña decide qué muestra según los permisos de quien entra
        // (organigrama: todos; asignaciones: quien asigna; usuarios: RH/admin)
        { path: '/accesos', element: <UsuariosYAccesos /> },
        { path: '/accesos/:tab', element: <UsuariosYAccesos /> },

        // URLs anteriores a los módulos
        { path: '/rh/solicitudes', element: <Redirigir a="/rutas/rh/solicitudes" /> },
        { path: '/rh/empleados', element: <Redirigir a="/rutas/rh/empleados" /> },
        { path: '/rh/catalogos', element: <Redirigir a="/rutas/rh/catalogos" /> },
        { path: '/rh/usuarios', element: <Redirigir a="/accesos" /> },
        { path: '/rutas/rh/usuarios', element: <Redirigir a="/accesos" /> },
        { path: '/tiempo-extra/niveles', element: <Redirigir a="/accesos/organigrama" /> },
      ],
    }],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PreferenciasProvider>
        <AccesosProvider>
          <CatalogosProvider>
            <ToastProvider>
              <ConfirmarProvider>
                <RouterProvider router={router} />
              </ConfirmarProvider>
            </ToastProvider>
          </CatalogosProvider>
        </AccesosProvider>
        </PreferenciasProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
