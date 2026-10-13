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
 *   acceso      (usuario, { te }) => boolean — quién ve el módulo
 *   useContador (usuario, { te }, activo) => número de pendientes (hook; se llama una vez por tarjeta)
 */
import { Bus, Clock } from 'lucide-react';
import { ROLES_SOLICITANTES } from './utils/constantes';
import { usePendientesRutas, usePendientesTE } from './hooks/usePendientes';

export const MODULOS = [
  {
    id: 'rutas',
    nombre: 'Transporte (rutas)',
    descripcion: 'Solicitudes de rutas de transporte para el personal.',
    icono: Bus,
    base: '/rutas',
    acceso: (usuario) => ROLES_SOLICITANTES.includes(usuario?.rol),
    useContador: (usuario, ctx, activo) => usePendientesRutas(usuario, activo).total,
  },
  {
    id: 'tiempo-extra',
    nombre: 'Tiempo extra',
    descripcion: 'Solicitud y autorización de tiempo extra por área.',
    icono: Clock,
    base: '/tiempo-extra',
    // El acceso sale de la matriz de autorización (por nómina), no del rol
    acceso: (usuario, ctx) => !!ctx?.te?.tieneAcceso,
    useContador: (usuario, ctx, activo) => usePendientesTE(usuario, ctx.te, activo),
  },
];

export const moduloPorId = (id) => MODULOS.find(m => m.id === id);

/** Módulos a los que el usuario tiene acceso */
export const modulosDe = (usuario, ctx) => (usuario ? MODULOS.filter(m => m.acceso(usuario, ctx)) : []);

/** Módulo al que pertenece una ruta (por prefijo), o null en el portal */
export const moduloDeRuta = (pathname) =>
  MODULOS.find(m => pathname === m.base || pathname.startsWith(`${m.base}/`)) ?? null;
