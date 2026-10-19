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
import RutaPuede from './components/RutaPuede';
import RutaFuncion from './components/RutaFuncion';
import { RUTAS_TRANSPORTE_SUELTO, RUTA_EDITAR_TRANSPORTE } from './funciones';
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
import { GRUPOS_DE_RUTAS, rutasDe } from './utils/permisos';
import { ToastProvider } from './components/Toast';
import { ConfirmarProvider } from './context/ConfirmarContext';
import { RecordatoriosProvider } from './context/RecordatoriosContext';

// Las pantallas. Quién entra a cada una NO se decide aquí: está en RUTAS_PROTEGIDAS (utils/permisos.js), la misma lista que usan
// la matriz de permisos y sus pruebas. Aquí solo se dice qué pantalla corresponde a cada id.
const PANTALLAS = {
  inicio: <Home />,
  miCuenta: <MiCuenta />,
  teNueva: <EditorTE />,
  teEditar: <EditorTE />,
  teMisSolicitudes: <MisSolicitudesTE />,
  teAutorizar: <BandejaTE />,
  teConsulta: <ConsultaTE />,
  teRecepcion: <RecepcionTE />,
  transporteSolicitudes: <RhSolicitudes />,
  transporteCatalogos: <RhCatalogos />,
  padron: <RhEmpleados />,
  estructura: <Estructura />,
  // Usuarios y accesos: cada pestaña decide qué muestra según los permisos de quien entra
  accesos: <UsuariosYAccesos />,
  accesosTab: <UsuariosYAccesos />,
  herramientas: <Herramientas />,
  guiaEstilo: <GuiaEstilo />,
};

/** Una ruta por pantalla, agrupadas por la capacidad que las protege ('todos' solo exige sesión) */
const rutasProtegidas = GRUPOS_DE_RUTAS.map(capacidad => {
  const children = rutasDe(capacidad).map(r => ({ path: r.ruta, element: PANTALLAS[r.id] }));
  return capacidad === 'todos' ? children : [{ element: <RutaPuede puede={capacidad} />, children }];
}).flat();

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [
    { path: '/cambiar-password', element: <CambiarPassword /> },
    {
      element: <Layout />,
      children: [
        ...rutasProtegidas,
        // Transporte suelto (funciones.js): apagado, estas rutas regresan al inicio. El código se conserva.
        {
          element: <RutaFuncion funcion="transporteSuelto" />,
          children: [
            { path: RUTAS_TRANSPORTE_SUELTO.misSolicitudes, element: <MisSolicitudes /> },
            {
              element: <RutaPuede puede="rh" />,
              children: [
                { path: RUTAS_TRANSPORTE_SUELTO.nueva, element: <NuevaSolicitud /> },
                { path: RUTA_EDITAR_TRANSPORTE, element: <EditarSolicitud /> },
              ],
            },
          ],
        },

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
