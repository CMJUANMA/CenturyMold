/**
 * excelSeguro.js — Seguridad de los archivos Excel. Sin dependencias del navegador ni de exceljs (se prueba en Node).
 *
 * 1. Inyección de fórmulas: un texto que empieza con = + - @ (o tabulador / retorno de carro) puede ejecutarse como fórmula si alguien lo edita
 *    o lo abre como CSV. Todo texto de un libro que se descarga pasa por neutralizarLibro: se le antepone una comilla simple (que Excel muestra
 *    como texto). Nombres, puestos, motivos o comentarios capturados por usuarios llegan a los Excel, así que NINGÚN libro se escribe sin pasar por aquí.
 * 2. Límites de lectura: los archivos que se importan se rechazan si pesan o tienen demasiado más de lo razonable (ver LIMITES_IMPORTACION).
 */

/** Primer carácter que Excel/LibreOffice/Sheets interpretan como inicio de fórmula (lista de OWASP) */
const INICIO_FORMULA = /^[=+\-@\t\r]/;

export const esTextoPeligroso = (v) => typeof v === 'string' && INICIO_FORMULA.test(v);

/** El mismo texto, inofensivo: con una comilla simple delante si pudiera tomarse como fórmula */
export const neutralizarTexto = (v) => (esTextoPeligroso(v) ? `'${v}` : v);

/**
 * Neutraliza todos los textos de todas las hojas (valores de texto, texto con formato y texto de hipervínculos). Cambia el libro en el lugar.
 * @param {{ eachSheet: Function }} wb libro de ExcelJS
 * @returns {number} cuántas celdas se neutralizaron
 */
export function neutralizarLibro(wb) {
  let n = 0;
  wb.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (typeof v === 'string') {
          if (esTextoPeligroso(v)) { cell.value = `'${v}`; n++; }
        } else if (v && typeof v === 'object' && !(v instanceof Date)) {
          if (Array.isArray(v.richText) && v.richText.length && esTextoPeligroso(v.richText[0].text)) {
            v.richText[0].text = `'${v.richText[0].text}`; cell.value = v; n++;
          } else if (typeof v.text === 'string' && esTextoPeligroso(v.text)) {
            cell.value = { ...v, text: `'${v.text}` }; n++;
          }
          // Una celda con fórmula ({ formula }) no la crea esta app; si alguna vez aparece, se descarta en vez de conservarla
          if (v.formula !== undefined || v.sharedFormula !== undefined) { cell.value = null; n++; }
        }
      });
    });
  });
  return n;
}

/** Escribe el libro neutralizado como bytes de .xlsx (siempre úsalo en lugar de wb.xlsx.writeBuffer()) */
export async function bufferSeguro(wb) {
  neutralizarLibro(wb);
  return wb.xlsx.writeBuffer();
}

// ── Importaciones ─────────────────────────────────────────────────────────

/** Tope de lo que se acepta al importar: el padrón de la planta son cientos de filas; esto deja mucho margen sin permitir archivos bomba */
export const LIMITES_IMPORTACION = { bytes: 5 * 1024 * 1024, filas: 20000, columnas: 60, hojas: 30 };

/** Mensaje de por qué un archivo no se acepta (null si está bien). `bytes` = tamaño del archivo */
export function motivoArchivoNoValido(bytes, limites = LIMITES_IMPORTACION) {
  if (!(bytes > 0)) return 'El archivo está vacío.';
  if (bytes > limites.bytes) return `El archivo pesa ${(bytes / 1048576).toFixed(1)} MB; el máximo es ${limites.bytes / 1048576} MB. Revisa que sea el archivo correcto.`;
  return null;
}

/** Mensaje de por qué un libro ya leído es demasiado grande (null si está bien) */
export function motivoLibroDemasiadoGrande(hojas, limites = LIMITES_IMPORTACION) {
  if (hojas.length > limites.hojas) return `El archivo tiene ${hojas.length} hojas; el máximo es ${limites.hojas}.`;
  for (const h of hojas) {
    if (h.rowCount > limites.filas) return `La hoja "${h.name}" tiene ${h.rowCount} filas; el máximo es ${limites.filas}.`;
    if (h.columnCount > limites.columnas) return `La hoja "${h.name}" tiene ${h.columnCount} columnas; el máximo es ${limites.columnas}.`;
  }
  return null;
}
