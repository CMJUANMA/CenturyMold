/**
 * rutas.js — Todas las URLs de la aplicación en un solo lugar. Los enlaces, el menú y los accesos rápidos salen de aquí:
 * cambiar una URL es cambiar una línea. (Las del transporte suelto, que se puede apagar, están en funciones.js.)
 */
export const RUTAS = {
  inicio: '/',
  login: '/login',
  cambiarPassword: '/cambiar-password',
  miCuenta: '/mi-cuenta',
  herramientas: '/herramientas',

  // Tiempo extra
  teNueva: '/tiempo-extra/nueva',
  teEditar: '/tiempo-extra/:id/editar',
  teMisSolicitudes: '/tiempo-extra/mis-solicitudes',
  teAutorizar: '/tiempo-extra/autorizar',
  teConsulta: '/tiempo-extra/consulta',
  teRecepcion: '/tiempo-extra/recepcion',

  // Transporte
  transporteSolicitudes: '/transporte/solicitudes',
  transporteCatalogos: '/transporte/catalogos',

  // Personal y estructura
  padron: '/personal/padron',
  estructura: '/personal/estructura',
  accesos: '/personal/accesos',
  organigrama: '/personal/accesos/organigrama',
  asignaciones: '/personal/accesos/asignaciones',
};

/** Pestaña de Usuarios y accesos: usuarios · asignaciones · organigrama */
export const rutaAccesos = (tab) => `${RUTAS.accesos}/${tab}`;

/** Mis solicitudes de tiempo extra abiertas en una pestaña: borrador · autorizacion · devuelta · autorizada · cancelada */
export const rutaMisSolicitudes = (pestana) => (pestana ? `${RUTAS.teMisSolicitudes}?pestana=${pestana}` : RUTAS.teMisSolicitudes);

/** Consulta de tiempo extra ya filtrada por estatus (lo lee ConsultaTE) */
export const rutaConsultaTE = (estatus) => (estatus ? `${RUTAS.teConsulta}?estatus=${estatus}` : RUTAS.teConsulta);
