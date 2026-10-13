/**
 * respaldoPadron.js — Respaldo del padrón de empleados en Excel (todos, activos e inactivos).
 * Se carga con import() dinámico desde Catálogos para no sumar exceljs al arranque.
 * Sin dependencias del navegador en construirRespaldoPadron (se prueba en Node).
 */
import { esActivo } from './activo.js';
import { agregarHojaReporte, nuevoLibro } from './formatosImportacion.js';

export const ENCABEZADOS_RESPALDO = [
  'nomina', 'nombre', 'puesto', 'puestoId', 'areaId', 'area', 'areaExcepcion', 'areaExcepcionMotivo',
  'ruta', 'comunidad', 'punto', 'turnoNomina', 'depto', 'descDepto', 'nivel', 'fechaAlta', 'activo',
];

/** Nombre del archivo: Respaldo_Padron_AAAA-MM-DD_HHmm.xlsx (hora local) */
export function nombreRespaldo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Respaldo_Padron_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
}

/** Libro con una hoja "Padron": una fila por empleado, ordenada por nómina. Nómina como texto. */
export function construirRespaldoPadron({ empleados, areas = [], rutas = [], comunidades = [], puntos = [] }) {
  const nombre = (lista, id) => (id ? lista.find(x => x.id === id)?.nombre ?? id : '');
  const txt = (v) => (v == null ? '' : String(v));
  const filas = [...empleados]
    .sort((a, b) => txt(a.nomina ?? a.id).localeCompare(txt(b.nomina ?? b.id), 'es', { numeric: true }))
    .map(e => [
      txt(e.nomina ?? e.id), txt(e.nombre), txt(e.puesto), txt(e.puestoId), txt(e.areaId), nombre(areas, e.areaId),
      txt(e.areaExcepcion), txt(e.areaExcepcionMotivo),
      nombre(rutas, e.rutaId), nombre(comunidades, e.comunidadId), nombre(puntos, e.puntoReunionId),
      txt(e.turnoNomina), txt(e.depto), txt(e.descDepto), txt(e.nivel), txt(e.fechaAlta), esActivo(e) ? 'Sí' : 'No',
    ]);
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'Padron', ENCABEZADOS_RESPALDO, filas);
  return wb;
}

/** Arma el libro y lo descarga en el navegador; devuelve cuántos empleados incluyó */
export async function descargarRespaldoPadron(datos) {
  const wb = construirRespaldoPadron(datos);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombreRespaldo(); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return datos.empleados.length;
}
