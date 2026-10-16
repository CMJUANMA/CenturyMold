/**
 * rutas.js — Todas las URLs de la aplicación en un solo lugar. Los enlaces, el menú y los accesos rápidos salen de aquí:
 * cambiar una URL es cambiar una línea. (Las del transporte suelto, que se puede apagar, están en funciones.js.)
 */
export const RUTAS = {
  inicio: '/',
  login: '/login',
  cambiarPassword: '/cambiar-password',
  miCuenta: '/perfil',

  // Tiempo extra
  teNueva: '/tiempo-extra/nueva',
  teEditar: '/tiempo-extra/:id/editar',
  teMisSolicitudes: '/tiempo-extra/mis-solicitudes',
  teAutorizar: '/tiempo-extra/autorizar',
  teConsulta: '/tiempo-extra/consulta',
  teRecepcion: '/tiempo-extra/recepcion',

  // Transporte
  transporteSolicitudes: '/rutas/rh/solicitudes',
  transporteCatalogos: '/rutas/rh/catalogos',

  // Personal y estructura
  padron: '/rutas/rh/empleados',
  estructura: '/rutas/rh/estructura',
  accesos: '/accesos',
  organigrama: '/accesos/organigrama',
  asignaciones: '/accesos/asignaciones',
};

/** Ruta de edición de un tiempo extra concreto */
export const rutaEditarTE = (id) => RUTAS.teEditar.replace(':id', id);

/** Consulta de tiempo extra ya filtrada por estatus (lo lee ConsultaTE) */
export const rutaConsultaTE = (estatus) => (estatus ? `${RUTAS.teConsulta}?estatus=${estatus}` : RUTAS.teConsulta);
