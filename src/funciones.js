/**
 * funciones.js — Interruptores de funciones que se pueden ocultar sin borrar su código.
 *
 *   transporteSuelto  "Nueva solicitud" de transporte, "Mis solicitudes" de transporte, editar una solicitud de transporte,
 *                     "Transporte (consulta)" y todo lo que solo sirve a ese flujo (aprobar / rechazar / revertir, "Todas las
 *                     pendientes", filtro de origen, contadores de novedades). Hoy el transporte se pide DENTRO del tiempo extra.
 *                     Para reactivarlo en el piloto: ponerlo en true. No hace falta tocar nada más.
 */
export const FUNCIONES = { transporteSuelto: false };

/**
 * Duración máxima de un tiempo extra, en horas (de la hora de inicio a la de fin, aunque cruce la medianoche). null = sin límite (hoy no hay).
 * Con un número, la captura rechaza lo que dure más y la extensión de turno no ofrece salidas que lo pasen.
 */
export const duracionMaximaHoras = null;

/**
 * Nómina: ¿en qué día y semana cuentan las horas de un tiempo extra que cruza la medianoche?
 *   'inicio'  (por defecto) todas en el día en que EMPIEZA: 23:00 del domingo a 7:00 del lunes = 8 h del domingo, en su semana.
 *   'dividir' cada hora en su día calendario: 1 h del domingo y 7 h del lunes (que cae en la semana siguiente).
 * Lo leen Reportes de nómina y su Excel (formatoNomina.js). Cambiarlo no toca las solicitudes: solo cómo se reparten en el formato.
 */
export const horasNominaPor = 'inicio';

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
