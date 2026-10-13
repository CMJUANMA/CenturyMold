/**
 * exportarOrganigrama.js — Excel del organigrama de autorización con la forma de la hoja "Niveles de autorización":
 * columna de niveles a la izquierda; Autorización 2 a todo lo ancho; debajo una columna por área con su Aut. 1 y sus
 * solicitantes (uno por fila). Solo asignaciones vigentes. exceljs se carga con import() dinámico desde la pantalla.
 */
import { formatoCorto } from './asignaciones.js';
import { nuevoLibro } from './formatosImportacion.js';

const C = { rojo: 'FFC8102E', aut2: 'FFDBEAFE', aut1: 'FFFEF08A', sol: 'FFFBCFE8', gris: 'FFF3F4F6', borde: 'FFD1D5DB', texto: 'FF1F2328', blanco: 'FFFFFFFF' };
const linea = { style: 'thin', color: { argb: C.borde } };

export function nombreArchivoOrganigrama(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `Organigrama_Autorizacion_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
}

/** Texto de una persona en una celda: nombre, puesto, nómina y, si aplica, "Temporal hasta DD/MM" */
export const textoPersona = (t, nombre) => [
  nombre(t), t.puesto, `Nómina ${t.nomina}`, t.temporalHasta ? `Temporal hasta ${formatoCorto(t.temporalHasta)}` : '',
].filter(Boolean).join('\n');

/**
 * @param {object} org   resultado de construirOrganigrama
 * @param {(t) => string} nombre  nombre para mostrar de una tarjeta
 */
export function construirLibroOrganigrama(org, nombre, fecha = new Date()) {
  const wb = nuevoLibro();
  const n = Math.max(org.columnas.length, 1);
  const ultima = n + 1; // la columna 1 lleva los rótulos de nivel
  const ws = wb.addWorksheet('Niveles de autorización');
  ws.getColumn(1).width = 18;
  for (let c = 2; c <= ultima; c++) ws.getColumn(c).width = 32;

  const celda = (fila, desde, hasta, valor, fondo, { negrita = false, color = C.texto, alto, alinear = 'center' } = {}) => {
    if (hasta > desde) ws.mergeCells(fila, desde, fila, hasta);
    for (let k = desde; k <= hasta; k++) {
      const c = ws.getCell(fila, k);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
      c.border = { top: linea, left: linea, bottom: linea, right: linea };
    }
    const c = ws.getCell(fila, desde);
    c.value = valor;
    c.font = { bold: negrita, color: { argb: color } };
    c.alignment = { vertical: 'middle', horizontal: alinear, wrapText: true };
    if (alto) ws.getRow(fila).height = Math.max(ws.getRow(fila).height ?? 0, alto);
  };

  celda(1, 1, ultima, `NIVELES DE AUTORIZACIÓN — TIEMPO EXTRA · Century Mold · ${fecha.toLocaleDateString('es-MX')}`, C.rojo, { negrita: true, color: C.blanco, alto: 26 });

  // Fila 2: Autorización 2 a todo lo ancho
  celda(2, 1, 1, 'Autorización 2', C.gris, { negrita: true });
  celda(2, 2, ultima, org.aut2.length ? org.aut2.map(t => textoPersona(t, nombre).replace(/\n/g, ' · ')).join('\n') : '(sin asignar)', C.aut2, { alto: 20 * Math.max(org.aut2.length, 1) + 8 });

  // Fila 3: áreas; fila 4: Autorización 1; filas 5…: solicitantes
  celda(3, 1, 1, 'Área', C.gris, { negrita: true, alto: 22 });
  celda(4, 1, 1, 'Autorización 1', C.gris, { negrita: true });
  const filasSol = Math.max(1, ...org.columnas.map(c => c.solicitantes.length));
  celda(5, 1, 1, 'Solicitantes', C.gris, { negrita: true });
  if (filasSol > 1) ws.mergeCells(5, 1, 4 + filasSol, 1);
  org.columnas.forEach((col, i) => {
    const c = i + 2;
    celda(3, c, c, col.area.nombre.toUpperCase(), C.rojo, { negrita: true, color: C.blanco });
    celda(4, c, c, col.aut1.length ? col.aut1.map(t => textoPersona(t, nombre)).join('\n\n') : 'Sin Autorización 1', C.aut1, { alto: 66 * Math.max(col.aut1.length, 1) });
    for (let r = 0; r < filasSol; r++) {
      const t = col.solicitantes[r];
      celda(5 + r, c, c, t ? textoPersona(t, nombre) : (r === 0 ? '(sin solicitantes)' : ''), t || r === 0 ? C.sol : C.blanco, { alto: 62 });
    }
  });
  return wb;
}

export async function descargarOrganigrama(org, nombre) {
  const buffer = await construirLibroOrganigrama(org, nombre).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombreArchivoOrganigrama() });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
