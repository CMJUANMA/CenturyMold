/**
 * exportarFormatoNomina.js — Excel del FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA (réplica de la hoja en papel), una hoja por área, lista para imprimir
 * en carta horizontal. Cada área ocupa una página (hasta FILAS_POR_PAGINA empleados); si trae más, continúa en otra página repitiendo el encabezado,
 * y las firmas, las notas y el total van en la última. Con «todas las áreas» se agrega primero la hoja «Resumen» (horas por área, por empleado y por
 * motivo con su porcentaje y por número de P.O./TB). Usa las horas ya ajustadas por Nóminas. Sin dependencias del navegador; exceljs se carga con import() desde la pantalla.
 * Los saltos de página son manuales y la escala fija (Excel ignora los saltos manuales cuando se usa «ajustar a»).
 */
import { bufferSeguro } from './excelSeguro.js';
import {
  CASILLAS_AREA, DIAS_LARGO, FIRMAS_FORMATO, FILAS_POR_PAGINA, NOTAS_FORMATO, PIE_FORMATO, TITULO_FORMATO, casillaDeArea, etiquetaPeriodo, filasVigentes, resumenDelPeriodo,
  totalesDeFilas,
} from './formatoNomina.js';

// Columnas: A Item · B No. Empleado · C Nombre · D…J Lunes…Domingo · K Sub-Total · L P.O./TB · M Descripción
export const ANCHOS = [6, 11, 33, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 10, 14, 31];
const ESCALA = 80;
const ALTO_FILA = 21;
const NEGRO = 'FF000000', GRIS = 'FFD9D9D9', GRIS_CLARO = 'FFF2F2F2', ROJO = 'FFC8102E';

const linea = (estilo = 'thin') => ({ style: estilo, color: { argb: NEGRO } });
const caja = (estilo) => ({ top: linea(estilo), left: linea(estilo), bottom: linea(estilo), right: linea(estilo) });
const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const ddmm = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '');
const ddmmaaaa = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const hojaNombre = (nombre, usados) => {
  const base = String(nombre).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Área';
  let n = base, i = 2;
  while (usados.has(n.toLowerCase())) n = `${base.slice(0, 28)} ${i++}`;
  usados.add(n.toLowerCase());
  return n;
};

function configurarHoja(ws, ultimaFila, saltos) {
  ws.columns = ANCHOS.map(width => ({ width }));
  ws.pageSetup = {
    orientation: 'landscape', paperSize: 1, scale: ESCALA, horizontalCentered: true,
    margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
    printArea: `A1:M${ultimaFila}`,
  };
  ws.views = [{ showGridLines: false }];
  for (const fila of saltos) ws.getRow(fila).addPageBreak();
}

const celda = (ws, rango, valor, { negrita = false, tam = 10, h = 'left', v = 'middle', borde = null, fondo = null, wrap = false, cursiva = false, color = null } = {}) => {
  const [a, b] = rango.includes(':') ? rango.split(':') : [rango, rango];
  if (a !== b) ws.mergeCells(`${a}:${b}`);
  const c = ws.getCell(a);
  c.value = valor;
  c.font = { name: 'Arial', size: tam, bold: negrita, italic: cursiva, ...(color ? { color: { argb: color } } : {}) };
  c.alignment = { horizontal: h, vertical: v, wrapText: wrap };
  if (fondo) c.fill = relleno(fondo);
  if (borde) {
    // Los bordes de una celda combinada se ponen en todas las celdas del rango
    const cols = (x) => x.replace(/\d+/g, '');
    const fila = (x) => Number(x.replace(/\D+/g, ''));
    const cA = cols(a).charCodeAt(0), cB = cols(b).charCodeAt(0);
    for (let r = fila(a); r <= fila(b); r++) for (let k = cA; k <= cB; k++) ws.getCell(`${String.fromCharCode(k)}${r}`).border = borde;
  }
  return c;
};

/** Encabezado de una página; devuelve la fila siguiente */
function encabezado(ws, fila, { areaId, periodo, logoId, fecha }) {
  ws.getRow(fila).height = 46;
  celda(ws, `A${fila}:C${fila}`, '', { borde: caja('thin') });
  if (logoId !== null && logoId !== undefined) ws.addImage(logoId, { tl: { col: 0.15, row: fila - 1 + 0.12 }, ext: { width: 175, height: 40 } });
  celda(ws, `D${fila}:M${fila}`, TITULO_FORMATO, { negrita: true, tam: 17, h: 'center', borde: caja('thin') });

  // Área/Depto: ocho casillas en dos renglones; se marca la que corresponde
  const marcada = casillaDeArea(areaId);
  const tramos = [['C', 'C'], ['D', 'G'], ['H', 'K'], ['L', 'M']];
  celda(ws, `A${fila + 1}:B${fila + 2}`, 'Área / Depto:', { negrita: true, borde: caja('thin'), wrap: true });
  [0, 1].forEach(r => {
    ws.getRow(fila + 1 + r).height = 19;
    tramos.forEach(([a, b], i) => {
      const nombre = CASILLAS_AREA[r * 4 + i];
      const rango = a === b ? `${a}${fila + 1 + r}` : `${a}${fila + 1 + r}:${b}${fila + 1 + r}`;
      celda(ws, rango, `${nombre === marcada ? '☒' : '☐'}  ${nombre}`, { negrita: nombre === marcada, borde: caja('thin'), tam: 10 });
    });
  });
  ws.getRow(fila + 3).height = 20;
  celda(ws, `A${fila + 3}:B${fila + 3}`, 'No. Semana:', { negrita: true, borde: caja('thin') });
  celda(ws, `C${fila + 3}`, periodo.tipo === 'semana' ? `${periodo.semana}` : 'Rango', { negrita: true, h: 'center', borde: caja('thin') });
  celda(ws, `D${fila + 3}:J${fila + 3}`, periodo.tipo === 'semana' ? etiquetaPeriodo(periodo).replace(/^Semana \d+ · /, '') : etiquetaPeriodo(periodo), { h: 'center', borde: caja('thin') });
  celda(ws, `K${fila + 3}`, 'Fecha:', { negrita: true, h: 'center', borde: caja('thin') });
  celda(ws, `L${fila + 3}:M${fila + 3}`, ddmmaaaa(fecha), { h: 'center', borde: caja('thin') });
  ws.getRow(fila + 4).height = 6;
  return fila + 5;
}

/** Encabezado de la tabla (2 renglones: nombre del día y su fecha); devuelve la fila siguiente */
function encabezadoTabla(ws, fila, periodo) {
  ws.getRow(fila).height = 20;
  ws.getRow(fila + 1).height = 16;
  const est = { negrita: true, h: 'center', wrap: true, fondo: GRIS, borde: caja('thin'), tam: 9 };
  celda(ws, `A${fila}:A${fila + 1}`, 'Item', est);
  celda(ws, `B${fila}:B${fila + 1}`, 'No. Empleado', est);
  celda(ws, `C${fila}:C${fila + 1}`, 'Nombre Completo', est);
  DIAS_LARGO.forEach((d, i) => {
    const col = String.fromCharCode(68 + i);
    celda(ws, `${col}${fila}`, d, est);
    celda(ws, `${col}${fila + 1}`, ddmm(periodo.dias[i]), { ...est, negrita: false, fondo: GRIS_CLARO });
  });
  celda(ws, `K${fila}:K${fila + 1}`, 'Sub-Total', est);
  celda(ws, `L${fila}:L${fila + 1}`, 'P.O./TB', est);
  celda(ws, `M${fila}:M${fila + 1}`, 'Descripción Motivo / Razón', est);
  return fila + 2;
}

function pie(ws, fila) {
  ws.getRow(fila).height = 15;
  celda(ws, `A${fila}:C${fila}`, PIE_FORMATO.codigo, { tam: 8, color: 'FF555555' });
  celda(ws, `D${fila}:J${fila}`, PIE_FORMATO.revision, { tam: 8, h: 'center', color: 'FF555555' });
  celda(ws, `K${fila}:M${fila}`, PIE_FORMATO.fechaRev, { tam: 8, h: 'right', color: 'FF555555' });
  return fila + 1;
}

/** Firmas con su línea y etiqueta, y las dos notas del formato; devuelve la fila siguiente. */
function firmasYNotas(ws, fila) {
  ws.getRow(fila).height = 14;
  ws.getRow(fila + 1).height = 38;
  ws.getRow(fila + 2).height = 30;
  // Tramos (con una columna vacía entre firmas para que las líneas no se junten)
  const tramos = [['A', 'C'], ['E', 'G'], ['I', 'K'], ['M', 'M']];
  tramos.forEach(([a, b], i) => {
    const rango = a === b ? `${a}${fila + 2}` : `${a}${fila + 2}:${b}${fila + 2}`;
    const c = celda(ws, rango, FIRMAS_FORMATO[i], { h: 'center', v: 'top', wrap: true, tam: 8, negrita: true });
    for (let k = a.charCodeAt(0); k <= b.charCodeAt(0); k++) ws.getCell(`${String.fromCharCode(k)}${fila + 2}`).border = { top: linea('thin') };
    c.border = { top: linea('thin') };
  });
  let r = fila + 3;
  ws.getRow(r).height = 6;
  r++;
  for (const nota of NOTAS_FORMATO) {
    ws.getRow(r).height = 25;
    celda(ws, `A${r}:M${r}`, nota, { tam: 8, wrap: true, v: 'top', cursiva: true });
    r++;
  }
  return r;
}

/** Una hoja de área; las páginas se arman con los saltos manuales */
function hojaArea(wb, nombreHoja, { areaId, filas, periodo, logoId, fecha }) {
  const ws = wb.addWorksheet(nombreHoja);
  const vigentes = filasVigentes(filas);
  const paginas = [];
  for (let i = 0; i < Math.max(vigentes.length, 1); i += FILAS_POR_PAGINA) paginas.push(vigentes.slice(i, i + FILAS_POR_PAGINA));
  const saltos = [];
  let fila = 1, item = 1;
  paginas.forEach((pagina, p) => {
    const ultima = p === paginas.length - 1;
    fila = encabezado(ws, fila, { areaId, periodo, logoId, fecha });
    fila = encabezadoTabla(ws, fila, periodo);
    // En la última página se completa hasta FILAS_POR_PAGINA renglones para que parezca la hoja en blanco del formato
    const total = ultima ? Math.max(pagina.length, FILAS_POR_PAGINA) : pagina.length;
    for (let k = 0; k < total; k++, fila++) {
      const f = pagina[k];
      ws.getRow(fila).height = f && String(f.numero ?? '').length > 14 ? 34 : ALTO_FILA; // varios números en la semana: caben en dos o tres renglones
      const base = { borde: caja('thin'), tam: 10 };
      celda(ws, `A${fila}`, f ? item++ : '', { ...base, h: 'center' });
      celda(ws, `B${fila}`, f ? f.nomina : '', { ...base, h: 'center' });
      celda(ws, `C${fila}`, f ? f.nombre : '', { ...base, wrap: true, tam: 9 });
      for (let d = 0; d < 7; d++) {
        const dia = periodo.dias[d];
        celda(ws, `${String.fromCharCode(68 + d)}${fila}`, f && dia && f.horas[dia] > 0 ? f.horas[dia] : '', { ...base, h: 'center' });
      }
      celda(ws, `K${fila}`, f ? f.subtotal : '', { ...base, h: 'center', negrita: true });
      celda(ws, `L${fila}`, f ? f.numero ?? '' : '', { ...base, h: 'center', wrap: true, tam: 8 }); // P.O./TB del empleado
      celda(ws, `M${fila}`, f ? f.motivo : '', { ...base, wrap: true, tam: 8 });
    }
    if (ultima) {
      const t = totalesDeFilas(filas, periodo);
      ws.getRow(fila).height = 22;
      celda(ws, `A${fila}:C${fila}`, 'Total Hrs.', { negrita: true, h: 'right', fondo: GRIS, borde: caja('thin') });
      t.porDia.forEach((h, d) => celda(ws, `${String.fromCharCode(68 + d)}${fila}`, h > 0 ? h : '', { negrita: true, h: 'center', fondo: GRIS, borde: caja('thin') }));
      celda(ws, `K${fila}`, t.horas, { negrita: true, h: 'center', fondo: GRIS, borde: caja('medium') });
      celda(ws, `L${fila}:M${fila}`, '', { fondo: GRIS, borde: caja('thin') });
      fila++;
      fila = firmasYNotas(ws, fila + 1);
    }
    fila = pie(ws, fila);
    if (!ultima) { saltos.push(fila - 1); }
  });
  configurarHoja(ws, fila - 1, saltos);
  return ws;
}

/** Hoja «Resumen» de «todas las áreas»: para capturar la nómina y ver las horas por motivo */
function hojaResumen(wb, areas, periodo, nombre) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 30 }, { width: 14 }, { width: 38 }, { width: 14 }];
  ws.pageSetup = { orientation: 'portrait', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.1, footer: 0.1 } };
  ws.views = [{ showGridLines: false }];
  const r = resumenDelPeriodo(areas, periodo);
  celda(ws, 'A1:D1', 'Tiempo extra autorizado · Resumen', { negrita: true, tam: 14, color: 'FFFFFFFF', fondo: 'FF1F2328' });
  celda(ws, 'A2:D2', `${etiquetaPeriodo(periodo)} · Horas ya ajustadas por Nóminas`, { cursiva: true, color: 'FFFFFFFF', fondo: 'FF1F2328' });
  let fila = 4;
  const titulo = (txt) => { celda(ws, `A${fila}:D${fila}`, txt, { negrita: true, tam: 11 }); fila++; };
  const cabecera = (cols) => { cols.forEach((c, i) => celda(ws, `${'ABCD'[i]}${fila}`, c, { negrita: true, h: 'center', color: 'FFFFFFFF', fondo: ROJO, borde: caja('thin') })); fila++; };
  const renglon = (vals, { total = false, centradas = [] } = {}) => {
    vals.forEach((v, i) => celda(ws, `${'ABCD'[i]}${fila}`, v, { negrita: total, h: centradas.includes(i) ? 'center' : 'left', fondo: total ? GRIS : null, borde: caja('thin') }));
    fila++;
  };

  titulo('Horas por área');
  cabecera(['Área', 'Empleados', '', 'Horas']);
  r.porArea.forEach(([a, e, h]) => renglon([nombre(a), e, '', h], { centradas: [1, 3] }));
  renglon(['TOTAL', r.total.empleados, '', r.total.horas], { total: true, centradas: [1, 3] });
  fila++;

  titulo('Horas por empleado (para capturar la nómina)');
  cabecera(['Área', 'No. Empleado', 'Nombre', 'Horas']);
  r.porEmpleado.forEach(([a, n, nom, h]) => renglon([nombre(a), n, nombre(nom), h], { centradas: [1, 3] }));
  renglon(['TOTAL', '', '', r.total.horas], { total: true, centradas: [3] });
  fila++;

  titulo('Horas por motivo');
  cabecera(['Motivo', 'Horas', '', '% del total']);
  r.porMotivo.forEach(([m, h, pct]) => renglon([m, h, '', `${pct}%`], { centradas: [1, 3] }));
  renglon(['TOTAL', r.total.horas, '', r.total.horas > 0 ? '100%' : '0%'], { total: true, centradas: [1, 3] });

  if (r.porNumero.length) {
    fila++;
    titulo('Horas por número de P.O./TB');
    cabecera(['P.O. / TB', 'Horas', 'Áreas', 'Empleados']);
    r.porNumero.forEach(([n, h, personas, areasTexto]) => renglon([n, h, areasTexto, personas], { centradas: [1, 3] }));
    renglon(['TOTAL', Math.round(r.porNumero.reduce((a, x) => a + x[1], 0) * 100) / 100, '', ''], { total: true, centradas: [1] });
  }
  return ws;
}

/**
 * @param {object} p
 * @param {object} p.ExcelJS
 * @param {object} p.periodo  semana o rango libre (formatoNomina.js)
 * @param {{areaId:string, nombre:string, filas:object[]}[]} p.areas  con las filas ya ajustadas
 * @param {string|null} [p.logo]  imagen PNG en base64 (sin el prefijo data:)
 * @param {Date} [p.fecha]  la fecha de descarga que sale en «Fecha:»
 * @param {boolean} [p.conResumen]  agrega la hoja «Resumen» al principio (la descarga de todas las áreas)
 * @param {(n:string)=>string} [p.nombre]  formateador de nombres de personas
 */
export function construirLibroFormatoNomina({ ExcelJS, periodo, areas, logo = null, fecha = new Date(), conResumen = false, nombre = (x) => x }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CenturyMold';
  wb.created = new Date();
  const usados = new Set(conResumen ? ['resumen'] : []);
  if (conResumen) hojaResumen(wb, areas, periodo, nombre);
  const logoId = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;
  for (const a of areas) {
    hojaArea(wb, hojaNombre(a.nombre, usados), {
      areaId: a.areaId, periodo, logoId, fecha,
      filas: a.filas.map(f => ({ ...f, nombre: nombre(f.nombre) })),
    });
  }
  return wb;
}

async function logoBase64() {
  try {
    const url = (await import('../assets/marca/century-mold.png')).default;
    const buf = await (await fetch(url)).arrayBuffer();
    let bin = '';
    new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  } catch { return null; }
}

/** Descarga el libro (en el navegador) con el logo de la empresa */
export async function descargarFormatoNomina(datos, nombreArchivo) {
  const buffer = await bufferSeguro(construirLibroFormatoNomina({ ...datos, logo: await logoBase64() }));
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
