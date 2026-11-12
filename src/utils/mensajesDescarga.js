/**
 * mensajesDescarga.js — El mensaje de toda descarga, igual en todas las pantallas: qué se descargó y dónde buscarlo (quien tiene poca soltura no sabe qué es
 * «la carpeta de descargas del navegador»). Sin dependencias del navegador.
 */
export const DONDE_BUSCAR = 'Ábrelo desde el ícono de descargas del navegador (arriba a la derecha) o en la carpeta Descargas de tu computadora.';

/** @param {string} archivo nombre del archivo, si se conoce  @param {string} que descripción si no hay nombre ("el Excel de Producción") */
export function textoDescarga(archivo = '', que = 'el Excel') {
  return `Se descargó ${archivo ? `«${archivo}»` : que}. ${DONDE_BUSCAR}`;
}
