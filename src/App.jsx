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
import RutaAcceso from './components/RutaAcceso';
import RutaFuncion from './components/RutaFuncion';
import { RUTAS_TRANSPORTE_SUELTO, RUTA_EDITAR_TRANSPORTE } from './funciones';
import { RUTAS } from './rutas';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import NoEncontrada from './pages/NoEncontrada';
const EditorTE = lazy(() => import('./pages/te/EditorTE'));
const MisSolicitudesTE = lazy(() => import('./pages/te/MisSolicitudesTE'));
const BandejaTE = lazy(() => import('./pages/te/BandejaTE'));
const ConsultaTE = lazy(() => import('./pages/te/ConsultaTE'));
const RecepcionTE = lazy(() => import('./pages/te/RecepcionTE'));
const Herramientas = lazy(() => import('./pages/Herramientas'));
const GuiaEstilo = lazy(() => import('./pages/GuiaEstilo'));
import RutaCapacidad from './components/RutaCapacidad';
import NuevaSolicitud from './pages/NuevaSolicitud';
import MisSolicitudes from './pages/MisSolicitudes';
import EditarSolicitud from './pages/EditarSolicitud';
import MiCuenta from './pages/MiCuenta';
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
import { RecordatoriosProvider } from './context/RecordatoriosContext';

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
        // Mi cuenta: datos, ayudas, tamaño de letra, tema y contraseña (todos los usuarios)
        { path: RUTAS.miCuenta, element: <MiCuenta /> },

        // Transporte y personal (solo RH y admin)
        {
          element: <RutaRol roles={ROLES_RH} />,
          children: [
            { path: RUTAS.transporteSolicitudes, element: <RhSolicitudes /> },
            { path: RUTAS.transporteCatalogos, element: <RhCatalogos /> },
            { path: RUTAS.padron, element: <RhEmpleados /> },
            { path: RUTAS.estructura, element: <Estructura /> },
          ],
        },
        // Herramientas (solo admin)
        {
          element: <RutaRol roles={['admin']} />,
          children: [
            { path: RUTAS.herramientas, element: <Herramientas /> },
            { path: RUTAS.guiaEstilo, element: <GuiaEstilo /> },
          ],
        },

        // Módulo de tiempo extra (el acceso sale de las asignaciones vigentes, no del puesto)
        {
          element: <RutaAcceso />,
          children: [
            {
              element: <RutaCapacidad puede="solicitar" />,
              children: [
                { path: RUTAS.teNueva, element: <EditorTE /> },
                { path: RUTAS.teEditar, element: <EditorTE /> },
                { path: RUTAS.teMisSolicitudes, element: <MisSolicitudesTE /> },
              ],
            },
            { element: <RutaCapacidad puede="autorizar" />, children: [{ path: RUTAS.teAutorizar, element: <BandejaTE /> }] },
            { element: <RutaCapacidad puede="consultar" />, children: [{ path: RUTAS.teConsulta, element: <ConsultaTE /> }] },
            { element: <RutaCapacidad puede="recibir" />, children: [{ path: RUTAS.teRecepcion, element: <RecepcionTE /> }] },
          ],
        },

        // Usuarios y accesos: cada pestaña decide qué muestra según los permisos de quien entra
        // (organigrama: todos; asignaciones: quien asigna; usuarios: RH/admin)
        { path: RUTAS.accesos, element: <UsuariosYAccesos /> },
        { path: `${RUTAS.accesos}/:tab`, element: <UsuariosYAccesos /> },

        // Cualquier otra URL
        { path: '*', element: <NoEncontrada /> },
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
                <RecordatoriosProvider>
                  <RouterProvider router={router} />
                </RecordatoriosProvider>
              </ConfirmarProvider>
            </ToastProvider>
          </CatalogosProvider>
        </AccesosProvider>
        </PreferenciasProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
