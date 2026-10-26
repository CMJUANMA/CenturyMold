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
  guiaEstilo: '/herramientas/guia-de-estilo',

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
  formatoRutas: '/transporte/formato-rutas',

  // Reportes de nómina (Nóminas, RH y admin)
  nominaReportes: '/nomina/reportes',
  nominaRevisar: '/nomina/semana/:anioSemana/:areaId',

  // Personal y estructura
  padron: '/personal/padron',
  estructura: '/personal/estructura',
  accesos: '/personal/accesos',
  organigrama: '/personal/accesos/organigrama',
  asignaciones: '/personal/accesos/asignaciones',
};

/** Reportes de nómina en un periodo (la clave de la semana, "2026-43", o de un rango libre) */
export const rutaReportesNomina = (clave) => (clave ? `${RUTAS.nominaReportes}?periodo=${encodeURIComponent(clave)}` : RUTAS.nominaReportes);

/** La pantalla de revisión de un área en un periodo */
export const rutaRevisarNomina = (clave, areaId) => `/nomina/semana/${encodeURIComponent(clave)}/${encodeURIComponent(areaId)}`;

/** Pestaña de Usuarios y accesos: usuarios · asignaciones · organigrama */
export const rutaAccesos = (tab) => `${RUTAS.accesos}/${tab}`;

/** Mis solicitudes de tiempo extra abiertas en una pestaña: borrador · autorizacion · devuelta · autorizada · cancelada */
export const rutaMisSolicitudes = (pestana) => (pestana ? `${RUTAS.teMisSolicitudes}?pestana=${pestana}` : RUTAS.teMisSolicitudes);

/** Consulta de tiempo extra ya filtrada por estatus (lo lee ConsultaTE) */
export const rutaConsultaTE = (estatus) => (estatus ? `${RUTAS.teConsulta}?estatus=${estatus}` : RUTAS.teConsulta);
/** Consulta de tiempo extra solo con lo autorizado fuera de tiempo (filtro «Fuera de tiempo») */
export const rutaConsultaFueraDeTiempo = () => `${RUTAS.teConsulta}?fueraDeTiempo=1`;
