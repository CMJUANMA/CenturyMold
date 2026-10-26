/**
 * descargarFormatoNomina.js — Genera y baja el Excel del formato de tiempo extra y deja la descarga en la bitácora, con el tipo de descarga (`modo`):
 *   'area'  una sola área (si está vacía sale el formato en blanco, con encabezado, días y firmas) · 'conTE'  hoja Resumen y una hoja por cada área con al menos un empleado
 *   'todas' hoja Resumen y una hoja por CADA área, incluidas las vacías en blanco.
 * Lo usan Reportes de nómina (tarjetas) y la pantalla de revisión de un área. exceljs se carga solo al descargar.
 * @returns {Promise<string>} el nombre del archivo
 */
import { ACCIONES_DESCARGA, registrarDescarga } from './bitacoraDb';
import { nombreArchivoFormato, nombreArchivoTodas } from './formatoNomina';

export async function descargarFormatoAreas({ periodo, areas, modo = 'area', nombre }) {
  const ExcelJS = (await import('exceljs')).default;
  const { descargarFormatoNomina } = await import('./exportarFormatoNomina');
  const varias = modo !== 'area';
  const archivo = varias ? nombreArchivoTodas(periodo, modo) : nombreArchivoFormato(periodo, areas[0].nombre);
  await descargarFormatoNomina({
    ExcelJS, periodo, conResumen: varias, fecha: new Date(), nombre,
    areas: areas.map(a => ({ areaId: a.areaId, nombre: a.nombre, filas: a.filas })),
  }, archivo);
  registrarDescarga(ACCIONES_DESCARGA.formatoTENomina, { periodo: periodo.clave, areas: areas.length, modo, archivo });
  return archivo;
}
