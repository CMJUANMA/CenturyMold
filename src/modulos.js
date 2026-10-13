/**
 * modulos.js — Configuración de los módulos del portal (tarjetas de Inicio y secciones de la barra lateral).
 * Para agregar un proceso nuevo: una entrada aquí, sus rutas bajo `base` en App.jsx y, si lleva
 * contador, su hook en hooks/usePendientes.js.
 *
 *   id          identificador del módulo
 *   nombre      título de la tarjeta y de la sección del menú
 *   descripcion texto corto de la tarjeta
 *   icono       componente de lucide-react
 *   base        ruta base; sus pantallas cuelgan de aquí
 *   acceso      (usuario, accesos) => boolean — quién ve el módulo (accesos = useAccesos())
 *   useContador (usuario, accesos, activo) => número de pendientes (hook; se llama una vez por tarjeta)
 */
import { Bus, Clock } from 'lucide-react';
import { ROLES_RH } from './utils/constantes';
import { usePendientesRutas, usePendientesTE } from './hooks/usePendientes';

export const MODULOS = [
  {
    id: 'rutas',
    nombre: 'Transporte (rutas)',
    descripcion: 'Solicitudes de transporte para el personal (RH).',
    icono: Bus,
    base: '/rutas',
    // Solo RH/admin crean transporte suelto; los solicitantes lo piden dentro del tiempo extra (su consulta de lo anterior
    // vive aparte, en /rutas/mis-solicitudes, sin este módulo)
    acceso: (usuario) => ROLES_RH.includes(usuario?.rol),
    useContador: (usuario, accesos, activo) => usePendientesRutas(usuario, accesos, activo).total,
  },
  {
    id: 'tiempo-extra',
    nombre: 'Tiempo extra',
    descripcion: 'Solicitud y autorización de tiempo extra por área.',
    icono: Clock,
    base: '/tiempo-extra',
    // El acceso sale de las asignaciones vigentes (rol operativo por área), no del puesto
    acceso: (usuario, accesos) => !!accesos?.tieneAcceso,
    useContador: (usuario, accesos, activo) => usePendientesTE(usuario, accesos, activo),
  },
];

export const moduloPorId = (id) => MODULOS.find(m => m.id === id);

/** Módulos a los que el usuario tiene acceso */
export const modulosDe = (usuario, accesos) => (usuario ? MODULOS.filter(m => m.acceso(usuario, accesos)) : []);

/** Módulo al que pertenece una ruta (por prefijo), o null en el portal */
export const moduloDeRuta = (pathname) =>
  MODULOS.find(m => pathname === m.base || pathname.startsWith(`${m.base}/`)) ?? null;
