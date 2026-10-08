/**
 * App.jsx — Router principal
 */
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import RutaRol from './components/RutaRol';
import Layout from './pages/Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import NuevaSolicitud from './pages/NuevaSolicitud';
import MisSolicitudes from './pages/MisSolicitudes';
import EditarSolicitud from './pages/EditarSolicitud';
import Perfil from './pages/Perfil';
import RhSolicitudes from './pages/rh/RhSolicitudes';
import RhEmpleados from './pages/rh/RhEmpleados';
import RhCatalogos from './pages/rh/RhCatalogos';
import RhUsuarios from './pages/rh/RhUsuarios';
import { ROLES_RH } from './utils/roles';
import { ToastProvider } from './components/Toast';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [{
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
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
