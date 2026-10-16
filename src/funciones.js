/**
 * funciones.js — Interruptores de funciones que se pueden ocultar sin borrar su código.
 *
 *   transporteSuelto  "Nueva solicitud" de transporte, "Mis solicitudes" de transporte, editar una solicitud de transporte,
 *                     "Transporte (consulta)" y todo lo que solo sirve a ese flujo (aprobar / rechazar / revertir, "Todas las
 *                     pendientes", filtro de origen, contadores de novedades). Hoy el transporte se pide DENTRO del tiempo extra.
 *                     Para reactivarlo en el piloto: ponerlo en true. No hace falta tocar nada más.
 */
export const FUNCIONES = { transporteSuelto: false };

/** ¿Está activa la función? (`funciones` se puede pasar para probar los dos casos) */
export const funcionActiva = (nombre, funciones = FUNCIONES) => funciones?.[nombre] === true;

/** Pantallas del transporte suelto. Todo enlace a ellas debe salir de aquí y estar detrás de funcionActiva('transporteSuelto') */
export const RUTAS_TRANSPORTE_SUELTO = {
  nueva: '/transporte/nueva',
  editar: '/transporte/editar',
  misSolicitudes: '/transporte/mis-solicitudes',
};
export const RUTA_EDITAR_TRANSPORTE = `${RUTAS_TRANSPORTE_SUELTO.editar}/:id`;

/** Ruta para editar una solicitud de transporte concreta */
export const rutaEditarTransporte = (id) => `${RUTAS_TRANSPORTE_SUELTO.editar}/${id}`;

/** ¿Esta ruta (con o sin :id) es del transporte suelto? */
export const esRutaTransporteSuelto = (path) => Object.values(RUTAS_TRANSPORTE_SUELTO).some(r => path === r || path.startsWith(`${r}/`));

/** ¿Se puede entrar a esta ruta con las funciones dadas? */
export const rutaDisponible = (path, funciones = FUNCIONES) => !esRutaTransporteSuelto(path) || funcionActiva('transporteSuelto', funciones);
