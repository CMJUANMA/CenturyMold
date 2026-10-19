/**
 * exportarConsultaTE.js — Excel de la consulta de tiempo extra: hoja "Resumen" (por área y estatus) y hoja "Detalle"
 * (una fila por empleado, con quién firmó cada nivel). Estilo corporativo (nuevoLibro / agregarHojaReporte). exceljs se carga
 * con import() dinámico desde la pantalla.
 */
import { ESTATUS_TE_MAP } from './constantes.js';
import { agregarHojaReporte, nuevoLibro } from './formatosImportacion.js';
import { bufferSeguro } from './excelSeguro.js';
import { calcularHoras, etiquetaBloque, firmaTexto, motivoTexto, textoRuta } from './tiempoExtra.js';

const ORDEN_ESTATUS = ['pendiente_aut1', 'pendiente_aut2', 'autorizada', 'procesada', 'devuelta', 'cancelada'];
const etiqueta = (estatus) => ESTATUS_TE_MAP[estatus]?.label ?? estatus;

export const ENCABEZADOS_RESUMEN = ['Área', 'Estatus', 'Solicitudes', 'Empleados', 'Horas'];
export const ENCABEZADOS_DETALLE = [
  'Folio', 'Área', 'Fecha del TE', 'Motivo', 'Nómina', 'Empleado', 'Puesto', 'Horario', 'Horas', 'Alimentos', 'Transporte', 'Ruta', 'Estatus', 'Firmó nivel 1', 'Firmó nivel 2',
];

export const nombreArchivoConsulta = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `Consulta_Tiempo_Extra_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
};

/**
 * @param {object} p
 * @param {object[]} p.solicitudes  con `empleados` (docAEmpleado)
 * @param {Map<string,string>} p.nombresArea
 * @param {{rutas, comunidades, puntos}} p.catalogos
 * @param {(n:string)=>string} p.nombre  nombre para mostrar de una persona
 */
export function construirLibroConsulta({ solicitudes, nombresArea, catalogos, nombre = (x) => x }) {
  const area = (id) => nombresArea.get(id) ?? id;
  const grupos = new Map();
  for (const t of solicitudes) {
    const k = `${area(t.areaId)}|${t.estatus}`;
    const g = grupos.get(k) ?? { area: area(t.areaId), estatus: t.estatus, solicitudes: 0, empleados: 0, horas: 0 };
    g.solicitudes++;
    g.empleados += t.resumen?.totalEmpleados ?? t.empleados?.length ?? 0;
    g.horas += t.resumen?.totalHoras ?? 0;
    grupos.set(k, g);
  }
  const filas = [...grupos.values()].sort((a, b) => a.area.localeCompare(b.area, 'es') || ORDEN_ESTATUS.indexOf(a.estatus) - ORDEN_ESTATUS.indexOf(b.estatus));
  const total = filas.reduce((a, g) => ({ s: a.s + g.solicitudes, e: a.e + g.empleados, h: a.h + g.horas }), { s: 0, e: 0, h: 0 });
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'Resumen', ENCABEZADOS_RESUMEN, [
    ...filas.map(g => [g.area, etiqueta(g.estatus), g.solicitudes, g.empleados, Math.round(g.horas * 100) / 100]),
    ['TOTAL', '', total.s, total.e, Math.round(total.h * 100) / 100],
  ]);

  const detalle = [];
  for (const t of [...solicitudes].sort((a, b) => String(a.folio).localeCompare(String(b.folio)))) {
    for (const e of t.empleados ?? []) {
      detalle.push([
        t.folio ?? '', area(t.areaId), t.fechaTE ?? '', motivoTexto(t), String(e.nomina), nombre(e.nombre), e.puesto ?? '', etiquetaBloque(e), calcularHoras(e.horaEntrada, e.horaSalida),
        e.alimentos ? 'Sí' : 'No', e.transporte ? 'Sí' : 'No', e.transporte ? textoRuta(e, catalogos) : '', etiqueta(t.estatus), firmaTexto(t.aut1, nombre), firmaTexto(t.aut2, nombre),
      ]);
    }
  }
  agregarHojaReporte(wb, 'Detalle', ENCABEZADOS_DETALLE, detalle);
  return wb;
}

export async function descargarConsulta(datos) {
  const buffer = await bufferSeguro(construirLibroConsulta(datos));
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivoConsulta() });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
