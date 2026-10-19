/**
 * exportarSolicitudes.js — Descarga el Excel maestro de transporte (una hoja por fecha de servicio y turno)
 * a partir de solicitudes que ya traen sus pasajeros. El libro se arma en libroProveedor.js; exceljs se descarga solo al exportar.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { construirLibroProveedor } from './libroProveedor';
import { bufferSeguro } from './excelSeguro.js';

/**
 * @param {Array}  solicitudesExport  solicitudes con su arreglo `pasajeros`
 * @param {{rutas: Array, comunidades: Array, puntos: Array, areas?: Array}} catalogos  para resolver nombres
 * @param {{success: Function, error: Function}} toast
 * @param {string} fileName
 */
export async function exportarSolicitudes(solicitudesExport, catalogos, toast, fileName) {
  if (solicitudesExport.length === 0) return toast.error('No hay solicitudes para exportar.');

  // exceljs pesa mucho: se descarga solo cuando se exporta
  const ExcelJS = (await import('exceljs')).default;

  // Empleados para completar el puesto: solo se leen si algún pasajero no lo trae
  let empList = [];
  const faltaPuesto = solicitudesExport.some(sol => (sol.pasajeros || []).some(p => !p.puesto));
  if (faltaPuesto) {
    try {
      const empSnap = await getDocs(collection(db, 'empleados'));
      empList = empSnap.docs.map(d => d.data());
    } catch (e) { console.error("Error al obtener empleados", e); }
  }

  const workbook = construirLibroProveedor({
    ExcelJS, solicitudes: solicitudesExport, catalogos, empleadoDe: (nomina) => empList.find(e => e.nomina === nomina) || {},
  });
  if (!workbook) return toast.error('No hay pasajeros válidos para exportar.');

  const buffer = await bufferSeguro(workbook);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);

  let tot = 0;
  for (const s of solicitudesExport) tot += (s.pasajeros || []).length;
  toast.success(`Archivo "${fileName}" generado con ${tot} pasajeros.`);
}
