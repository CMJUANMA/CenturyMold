/**
 * descargarFormatoNomina.js — Genera y baja el Excel del formato de tiempo extra (un área, o todas con su hoja Resumen) y deja la descarga en la bitácora.
 * Lo usan Reportes de nómina (tarjetas) y la pantalla de revisión de un área. exceljs se carga solo al descargar.
 * @returns {Promise<string>} el nombre del archivo
 */
import { ACCIONES_DESCARGA, registrarDescarga } from './bitacoraDb';
import { nombreArchivoFormato } from './formatoNomina';

export async function descargarFormatoAreas({ periodo, areas, todas = false, nombre }) {
  const ExcelJS = (await import('exceljs')).default;
  const { descargarFormatoNomina } = await import('./exportarFormatoNomina');
  const archivo = nombreArchivoFormato(periodo, todas ? '' : areas[0].nombre);
  await descargarFormatoNomina({
    ExcelJS, periodo, conResumen: todas, fecha: new Date(), nombre,
    areas: areas.map(a => ({ areaId: a.areaId, nombre: a.nombre, filas: a.filas })),
  }, archivo);
  registrarDescarga(ACCIONES_DESCARGA.formatoTENomina, { periodo: periodo.clave, areas: areas.length, archivo });
  return archivo;
}
