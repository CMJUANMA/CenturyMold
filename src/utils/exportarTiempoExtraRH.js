/**
 * exportarTiempoExtraRH.js — Excel del tiempo extra autorizado para RH (aparte del Excel del proveedor), con el MISMO estilo visual que el
 * formato del proveedor (banda de título oscura, encabezado rojo con letra blanca, bordes finos y filas alternadas).
 * Hojas: "Detalle" (una fila por empleado), "Horas por empleado" (para nómina), "Alimentos" (para el comedor) y "Resumen" (por área y fecha).
 * Sin dependencias del navegador; exceljs se carga con import() dinámico desde la pantalla.
 */
import { bufferSeguro } from './excelSeguro.js';
import { comparar, compararHoras } from './orden.js';
import { ESTATUS_DESCARGA, INCLUIR_DESCARGA, TEXTO_SENTIDO, calcularHoras, esExtension, etiquetaBloque, firmaTexto, motivoTexto, sentidoDe, textoRuta } from './tiempoExtra.js';

export const ENCABEZADOS_DETALLE_RH = [
  'Folio', 'Fecha', 'Área', 'Tipo', 'Motivo', 'Nómina', 'Nombre', 'Puesto', 'Entrada', 'Salida', 'Horas', 'Alimentos', 'Transporte', 'Sentido del transporte', 'Ruta',
  'Solicitante', 'Autorización 1', 'Autorización 2', 'Fecha de autorización',
];
export const ENCABEZADOS_HORAS = ['Nómina', 'Nombre', 'Área', 'Puesto', 'Días con tiempo extra', 'Horas totales'];
export const ENCABEZADOS_ALIMENTOS = ['Fecha', 'Horario', 'Alimentos'];
export const ENCABEZADOS_RESUMEN_RH = ['Fecha', 'Área', 'Solicitudes', 'Empleados', 'Horas'];

const fmtYMD = (ymd) => { const [y, m, d] = String(ymd ?? '').split('-'); return y && m && d ? `${d}/${m}/${y}` : String(ymd ?? ''); };
const aDate = (f) => (typeof f?.toDate === 'function' ? f.toDate() : f instanceof Date ? f : null);
const fmtFechaHora = (f) => {
  const d = aDate(f);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const redondeo = (n) => Math.round(n * 100) / 100;

export const nombreArchivoTiempoExtra = (desde, hasta, d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  const rango = desde && hasta ? (desde === hasta ? desde : `${desde}_a_${hasta}`) : `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return `TiempoExtra_${rango}.xlsx`;
};

/** Solo lo autorizado o ya confirmado por RH (o solo esto último), dentro del rango de fechas del TE y del área elegida */
export function filtrarParaDescarga(solicitudes, { desde = '', hasta = '', areaId = '', estatus = ESTATUS_DESCARGA } = {}) {
  return solicitudes.filter(t => estatus.includes(t.estatus)
    && (!desde || String(t.fechaTE ?? '') >= desde) && (!hasta || String(t.fechaTE ?? '') <= hasta) && (!areaId || t.areaId === areaId));
}

const porFechaYFolio = (a, b) => comparar(a.fechaTE, b.fechaTE) || comparar(a.folio, b.folio);

/** Hoja "Detalle": una fila por empleado */
export function filasDetalle(solicitudes, { nombresArea, catalogos, nombre = (x) => x }) {
  const filas = [];
  for (const t of [...solicitudes].sort(porFechaYFolio)) {
    for (const e of [...(t.empleados ?? [])].sort((a, b) => comparar(a.nombre, b.nombre) || comparar(a.nomina, b.nomina))) {
      filas.push([
        t.folio ?? '', fmtYMD(t.fechaTE), nombresArea.get(t.areaId) ?? t.areaNombre ?? t.areaId, esExtension(t) ? 'Extensión de turno' : 'Turno extra', motivoTexto(t), String(e.nomina), nombre(e.nombre), e.puesto ?? '',
        e.horaEntrada ?? '', e.horaSalida ?? '', calcularHoras(e.horaEntrada, e.horaSalida), e.alimentos ? 'Sí' : 'No', e.transporte ? 'Sí' : 'No',
        e.transporte ? TEXTO_SENTIDO[sentidoDe(e) || 'ambos'] : '', e.transporte ? textoRuta({ ...e, transporteLlegada: true, transporteSalida: true }, catalogos) : '', nombre(t.creadoPorNombre ?? ''), firmaTexto(t.aut1, nombre), firmaTexto(t.aut2, nombre), fmtFechaHora(t.aut2?.fecha),
      ]);
    }
  }
  return filas;
}

/** Hoja "Horas por empleado": días con tiempo extra y horas totales de cada quien en el rango (para nómina) */
export function filasHorasPorEmpleado(solicitudes, { nombresArea, nombre = (x) => x }) {
  const porNomina = new Map();
  for (const t of solicitudes) {
    for (const e of t.empleados ?? []) {
      const g = porNomina.get(String(e.nomina)) ?? { nomina: String(e.nomina), nombre: e.nombre, puesto: e.puesto ?? '', area: nombresArea.get(t.areaId) ?? t.areaNombre ?? t.areaId, dias: new Set(), horas: 0 };
      g.dias.add(t.fechaTE);
      g.horas += calcularHoras(e.horaEntrada, e.horaSalida);
      porNomina.set(g.nomina, g);
    }
  }
  return [...porNomina.values()]
    .sort((a, b) => comparar(a.area, b.area) || comparar(a.nombre, b.nombre) || comparar(a.nomina, b.nomina))
    .map(g => [g.nomina, nombre(g.nombre), g.area, g.puesto, g.dias.size, redondeo(g.horas)]);
}

/** Hoja "Alimentos": cuántos empleados con alimentos hay por fecha y horario (para el comedor), con el total del rango */
export function filasAlimentos(solicitudes) {
  const grupos = new Map();
  for (const t of solicitudes) {
    for (const e of t.empleados ?? []) {
      if (!e.alimentos) continue;
      const k = `${t.fechaTE}|${etiquetaBloque(e)}`;
      const g = grupos.get(k) ?? { fecha: t.fechaTE, horario: etiquetaBloque(e), entrada: e.horaEntrada, salida: e.horaSalida, n: 0 };
      g.n++;
      grupos.set(k, g);
    }
  }
  // Los horarios se ordenan por su hora (9:00 antes que 16:00), no como texto; «Sin horario» al final
  const filas = [...grupos.values()].sort((a, b) => comparar(a.fecha, b.fecha) || compararHoras(a.entrada, b.entrada) || compararHoras(a.salida, b.salida) || comparar(a.horario, b.horario));
  return { filas: filas.map(g => [fmtYMD(g.fecha), g.horario, g.n]), total: filas.reduce((a, g) => a + g.n, 0) };
}

/** Hoja "Resumen": solicitudes, empleados y horas por fecha y área */
export function filasResumen(solicitudes, { nombresArea }) {
  const grupos = new Map();
  for (const t of solicitudes) {
    const area = nombresArea.get(t.areaId) ?? t.areaNombre ?? t.areaId;
    const k = `${t.fechaTE}|${area}`;
    const g = grupos.get(k) ?? { fecha: t.fechaTE, area, solicitudes: 0, empleados: 0, horas: 0 };
    g.solicitudes++;
    g.empleados += t.resumen?.totalEmpleados ?? t.empleados?.length ?? 0;
    g.horas += t.resumen?.totalHoras ?? (t.empleados ?? []).reduce((a, e) => a + calcularHoras(e.horaEntrada, e.horaSalida), 0);
    grupos.set(k, g);
  }
  const filas = [...grupos.values()].sort((a, b) => comparar(a.fecha, b.fecha) || comparar(a.area, b.area));
  const total = filas.reduce((a, g) => ({ s: a.s + g.solicitudes, e: a.e + g.empleados, h: a.h + g.horas }), { s: 0, e: 0, h: 0 });
  return { filas: filas.map(g => [fmtYMD(g.fecha), g.area, g.solicitudes, g.empleados, redondeo(g.horas)]), total: ['TOTAL', '', total.s, total.e, redondeo(total.h)] };
}

// ── Estilo del formato del proveedor ──────────────────────────────────────

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const borde = (argb) => ({ top: { style: 'thin', color: { argb } }, left: { style: 'thin', color: { argb } }, bottom: { style: 'thin', color: { argb } }, right: { style: 'thin', color: { argb } } });

/**
 * Hoja con la banda de título oscura (fila 1), el subtítulo (fila 2), el encabezado rojo (fila 4), las filas con bordes finos y
 * alternadas y, si se pide, una fila final de totales en gris. Columnas en `centradas` (índices desde 0) van centradas.
 */
function agregarHoja(wb, nombre, { titulo, subtitulo, headers, filas, totales = null, centradas = [] }) {
  const ws = wb.addWorksheet(nombre.substring(0, 31), {
    pageSetup: { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.25, bottom: 0.25, header: 0.1, footer: 0.1 } },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }],
  });
  ws.headerFooter.oddFooter = '&R&P / &N';
  const ultima = headers.length;

  ws.mergeCells(1, 1, 1, Math.max(ultima, 3));
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  t.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(2, 1, 2, Math.max(ultima, 3));
  const s = ws.getCell(2, 1);
  s.value = subtitulo;
  s.font = { italic: true, color: { argb: 'FFFFFFFF' } };
  s.alignment = { vertical: 'middle', horizontal: 'left' };
  for (let c = 1; c <= Math.max(ultima, 3); c++) { ws.getCell(1, c).fill = relleno('FF1F2328'); ws.getCell(2, c).fill = relleno('FF1F2328'); }

  const fh = ws.getRow(4);
  fh.height = 22;
  headers.forEach((h, i) => {
    const c = fh.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = relleno('FFC8102E');
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const anchos = headers.map(h => h.length);
  const ancho = (i, v) => { const n = String(v ?? '').length; if (n > anchos[i]) anchos[i] = Math.min(n, 45); };
  filas.forEach((fila, r) => {
    const row = ws.getRow(5 + r);
    fila.forEach((v, i) => {
      ancho(i, v);
      const c = row.getCell(i + 1);
      c.value = v ?? '';
      c.border = borde('FF9CA3AF');
      c.alignment = { vertical: 'middle', ...(centradas.includes(i) ? { horizontal: 'center' } : {}) };
      if (r % 2 === 1) c.fill = relleno('FFF3F4F6');
    });
  });
  if (totales) {
    const row = ws.getRow(5 + filas.length + 1);
    totales.forEach((v, i) => {
      ancho(i, v);
      const c = row.getCell(i + 1);
      c.value = v ?? '';
      c.font = { bold: true };
      c.fill = relleno('FFE5E7EB');
      c.border = borde('FF000000');
      if (centradas.includes(i)) c.alignment = { horizontal: 'center' };
    });
  }
  anchos.forEach((n, i) => { ws.getColumn(i + 1).width = Math.max(n + 3, 10); });
  if (filas.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: ultima } };
  return ws;
}

/**
 * @param {object} p
 * @param {object} p.ExcelJS
 * @param {object[]} p.solicitudes  con `empleados` (docAEmpleado); solo autorizadas y procesadas
 * @param {Map<string,string>} p.nombresArea
 * @param {{rutas, comunidades, puntos}} p.catalogos
 * @param {{desde?: string, hasta?: string, areaId?: string, estatus?: string[]}} p.filtros
 * @param {(n:string)=>string} [p.nombre]
 */
export function construirLibroTiempoExtra({ ExcelJS, solicitudes, nombresArea, catalogos, filtros = {}, nombre = (x) => x }) {
  const lista = filtrarParaDescarga(solicitudes, filtros);
  const rango = filtros.desde || filtros.hasta ? `Fechas del tiempo extra: ${fmtYMD(filtros.desde) || '…'} al ${fmtYMD(filtros.hasta) || '…'}` : 'Todas las fechas';
  const area = filtros.areaId ? `Área: ${nombresArea.get(filtros.areaId) ?? filtros.areaId}` : 'Todas las áreas';
  const incluir = filtros.estatus && filtros.estatus.length === 1 && filtros.estatus[0] === 'procesada'
    ? INCLUIR_DESCARGA[1].label : 'Todas las autorizadas (incluye las ya confirmadas por RH)';
  const sub = `${rango} · ${area} · ${incluir}`;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CenturyMold';
  wb.created = new Date();

  agregarHoja(wb, 'Detalle', {
    titulo: 'Tiempo extra autorizado · Detalle', subtitulo: sub, headers: ENCABEZADOS_DETALLE_RH,
    filas: filasDetalle(lista, { nombresArea, catalogos, nombre }), centradas: [0, 1, 3, 4, 7, 8, 9, 10, 11, 12, 13],
  });
  agregarHoja(wb, 'Horas por empleado', {
    titulo: 'Tiempo extra autorizado · Horas por empleado (nómina)', subtitulo: sub, headers: ENCABEZADOS_HORAS,
    filas: filasHorasPorEmpleado(lista, { nombresArea, nombre }), centradas: [0, 4, 5],
  });
  const ali = filasAlimentos(lista);
  agregarHoja(wb, 'Alimentos', {
    titulo: 'Tiempo extra autorizado · Alimentos (comedor)', subtitulo: sub, headers: ENCABEZADOS_ALIMENTOS,
    filas: ali.filas, totales: ['TOTAL', '', ali.total], centradas: [0, 2],
  });
  const res = filasResumen(lista, { nombresArea });
  agregarHoja(wb, 'Resumen', {
    titulo: 'Tiempo extra autorizado · Resumen por área y fecha', subtitulo: sub, headers: ENCABEZADOS_RESUMEN_RH,
    filas: res.filas, totales: res.total, centradas: [0, 2, 3, 4],
  });
  return wb;
}

export async function descargarTiempoExtra(datos) {
  const buffer = await bufferSeguro(construirLibroTiempoExtra(datos));
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivoTiempoExtra(datos.filtros?.desde, datos.filtros?.hasta) });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
