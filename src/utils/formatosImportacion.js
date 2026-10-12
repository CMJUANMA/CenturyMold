/**
 * formatosImportacion.js
 * Formatos en blanco (ExcelJS) y lectura (SheetJS) de los archivos de importación
 * de empleados y directorio. Sin dependencias del navegador, para poder probarlo en Node.
 *
 * Cada formato tiene 3 hojas: "Instrucciones", la hoja de datos y "Ejemplo".
 * La lectura solo usa la hoja de datos; las otras dos se ignoran siempre.
 * El archivo es un documento: aquí se usan colores fijos, no tokens de la UI.
 */
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { buscarCoincidencias, normalizarPuesto } from './puestos.js';
import { esActivo } from './activo.js';
import { slugify } from './comparacionImportacion.js';

// ── Esquemas ──────────────────────────────────────────────────────────────
export const HOJA_DIR = 'Directorio';
export const HOJA_EMP = 'Empleados';
const HOJA_INSTR = 'Instrucciones';
const HOJA_EJEMPLO = 'Ejemplo';

/** formato: 'numero' | 'texto' | undefined (general) */
const COLUMNAS_DIR = [
  { h: 'RUTA',             ancho: 26, desc: 'Nombre completo de la ruta.',                         ej: 'RUTA NORTE' },
  { h: 'COMUNIDAD',        ancho: 30, desc: 'Colonia o comunidad que atiende la ruta.',            ej: 'COLONIA SAN PEDRO' },
  { h: 'PUNTO DE REUNION', ancho: 32, desc: 'Lugar donde el transporte recoge al personal.',       ej: 'PARQUE CENTRAL' },
  { h: 'CLAVE',            ancho: 12, formato: 'texto', desc: 'Identificador unico del punto de reunion. No se repite en el archivo.', ej: 'SN01' },
];
const COLUMNAS_EMP = [
  { h: 'NOMINA',       ancho: 12, formato: 'numero', desc: 'Numero de nomina: solo digitos y unico en el archivo.', ej: '12345' },
  { h: 'NOMBRE',       ancho: 40, desc: 'Nombre completo (apellidos y nombre).',                                    ej: 'GARCIA LOPEZ JUAN' },
  { h: 'PUESTO',       ancho: 32, desc: 'Elija de la lista desplegable o escriba uno nuevo.',                      ej: 'OPERADOR DE PRODUCCION' },
  { h: 'CLAVE PARADA', ancho: 16, formato: 'texto', opcional: true,
    desc: 'Clave del punto de reunion (columna CLAVE del directorio). Si se deja vacia, la ruta se pedira al solicitar transporte.', ej: 'SN01' },
];

export const DIR_HEADERS = COLUMNAS_DIR.map(c => c.h);
export const EMP_HEADERS = COLUMNAS_EMP.map(c => c.h);

const EJEMPLO_DIR = [
  ['RUTA NORTE', 'COLONIA SAN PEDRO',     'PARQUE CENTRAL',      'SN01'],
  ['RUTA NORTE', 'COLONIA SAN PEDRO',     'FARMACIA DEL AHORRO', 'SN02'],
  ['RUTA SUR',   'COLONIA VISTA HERMOSA', 'PLAZA COMERCIAL',     'SU01'],
];
const EJEMPLO_EMP = [
  [12345, 'GARCIA LOPEZ JUAN',      'OPERADOR DE PRODUCCION', 'SN01'],
  [67890, 'MARTINEZ RUIZ ANA',      'SUPERVISORA DE CALIDAD', 'SU01'],
  [11111, 'RODRIGUEZ PEREZ CARLOS', 'ALMACENISTA',            ''],
];

const FILAS_PREFORMATEADAS = 500;

// ── Estilo corporativo ────────────────────────────────────────────────────
const FMT = {
  rojo:         'FFC8102E',
  oscuro:       'FF1F2328',
  grisOscuro:   'FF3D434A',
  grisMedio:    'FF6B7280',
  grisClaroAlt: 'FFF3F4F6',
  grisBorde:    'FF9CA3AF',
  blanco:       'FFFFFFFF',
};
const NUM_FMT = { numero: '0', texto: '@' };

const relleno = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function bordeFino(cell) {
  const side = { style: 'thin', color: { argb: FMT.grisBorde } };
  cell.border = { top: side, left: side, bottom: side, right: side };
}

/** Encabezado de hoja de datos: rojo (obligatoria) o gris oscuro (opcional) */
function estiloEncabezado(cell, opcional) {
  cell.font = { bold: true, size: 10, color: { argb: FMT.blanco } };
  cell.fill = relleno(opcional ? FMT.grisOscuro : FMT.rojo);
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  bordeFino(cell);
}

/** Celda de cuerpo de tabla con borde fino y fila alternada */
function estiloCuerpo(cell, fila, formato) {
  cell.font = { size: 10 };
  bordeFino(cell);
  if (fila % 2 === 1) cell.fill = relleno(FMT.grisClaroAlt);
  if (formato) cell.numFmt = NUM_FMT[formato];
}

/** Altura de fila aproximada para texto con ajuste en un ancho dado (tamaño 10) */
function alturaPara(texto, ancho) {
  const lineas = String(texto).split('\n')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / Math.max(1, ancho - 1))), 0);
  return Math.max(18, lineas * 13 + 5);
}

// ── Hoja "Instrucciones" ──────────────────────────────────────────────────
/**
 * @returns {{ rangoPuestos: string | null }} rango con la lista de puestos (para validación)
 */
function agregarHojaInstrucciones(wb, { titulo, hojaDatos, columnas, reglas, puestos = null }) {
  const ws = wb.addWorksheet(HOJA_INSTR, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: FMT.oscuro } },
  });
  const numCols = Math.max(columnas.length, 4);
  const textoAncho = []; // filas con texto combinado, para calcular su altura al final
  let r = 1;

  const filaCombinada = (texto, { font, fill, alto, wrap = true } = {}) => {
    ws.mergeCells(r, 1, r, numCols);
    const c = ws.getCell(r, 1);
    c.value = texto;
    c.font = font ?? { size: 10 };
    if (fill) c.fill = relleno(fill);
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: wrap, indent: fill ? 1 : 0 };
    if (alto) ws.getRow(r).height = alto;
    else textoAncho.push({ fila: r, texto });
    r++;
  };
  const seccion = (texto) => {
    r++;
    filaCombinada(texto, { font: { bold: true, size: 10, color: { argb: FMT.oscuro } }, alto: 18 });
  };

  // Título
  filaCombinada(titulo, { font: { bold: true, size: 14, color: { argb: FMT.blanco } }, fill: FMT.oscuro, alto: 30, wrap: false });
  filaCombinada('Century Mold · Solicitud de rutas de transporte', { font: { size: 9, color: { argb: FMT.grisMedio } }, alto: 16 });

  // Reglas numeradas, una por fila
  seccion('REGLAS PARA LLENAR EL ARCHIVO');
  reglas.forEach((regla, i) => filaCombinada(`${i + 1}. ${regla}`));

  // Mini tabla: encabezados tal como deben quedar en la hoja de datos
  seccion(`ENCABEZADOS DE LA HOJA "${hojaDatos}" (FILA 1, TAL COMO DEBEN QUEDAR)`);
  ws.getRow(r).height = 24;
  columnas.forEach((col, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = col.h;
    estiloEncabezado(c, col.opcional);
  });
  r++;
  columnas.forEach((col, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = col.opcional ? 'Opcional' : 'Obligatoria';
    c.font = { italic: true, size: 9, color: { argb: col.opcional ? FMT.grisMedio : FMT.rojo } };
    c.alignment = { horizontal: 'center' };
  });
  r++;
  if (columnas.some(c => c.opcional)) {
    const opc = columnas.filter(c => c.opcional).map(c => c.h).join(', ');
    filaCombinada(
      `NOTA: Las columnas con encabezado gris oscuro (${opc}) son opcionales y pueden dejarse vacias. ` +
      'Su encabezado debe escribirse exactamente igual, sin agregar "(opcional)", para que el sistema reconozca el archivo.',
      { font: { italic: true, size: 9, color: { argb: FMT.grisMedio } } },
    );
  }

  // Detalle de columnas
  seccion('DETALLE DE COLUMNAS');
  ['Columna', 'Campo', 'Requerido', 'Descripcion y ejemplo'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1);
    c.value = h;
    estiloEncabezado(c, true);
  });
  ws.getRow(r).height = 20;
  r++;
  const filasDescripcion = [];
  columnas.forEach((col, i) => {
    const desc = `${col.desc} Ej.: ${col.ej}`;
    const valores = [String.fromCharCode(65 + i), col.h, col.opcional ? 'Opcional' : 'Obligatorio', desc];
    valores.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      estiloCuerpo(c, i);
      c.alignment = { vertical: 'middle', wrapText: ci === 3, horizontal: ci === 0 || ci === 2 ? 'center' : 'left' };
    });
    ws.getCell(r, 3).font = { size: 10, bold: !col.opcional, color: { argb: col.opcional ? FMT.grisMedio : FMT.rojo } };
    filasDescripcion.push({ fila: r, texto: desc });
    r++;
  });

  // Lista de puestos (fuente del desplegable de la columna PUESTO)
  let rangoPuestos = null;
  if (puestos) {
    seccion('PUESTOS REGISTRADOS (LISTA DESPLEGABLE DE LA COLUMNA PUESTO)');
    if (puestos.length === 0) {
      filaCombinada('Aun no hay puestos registrados. Escriba el puesto directamente en la columna PUESTO.',
        { font: { italic: true, size: 9, color: { argb: FMT.grisMedio } } });
    } else {
      const inicio = r;
      puestos.forEach((p, i) => {
        const n = ws.getCell(r, 1); n.value = i + 1;
        const c = ws.getCell(r, 2); c.value = p;
        estiloCuerpo(n, i); estiloCuerpo(c, i);
        n.alignment = { horizontal: 'center' };
        r++;
      });
      rangoPuestos = `'${HOJA_INSTR}'!$B$${inicio}:$B$${r - 1}`;
    }
  }

  // Ancho automático: según el contenido de las celdas no combinadas
  const anchos = Array(numCols).fill(8);
  ws.eachRow(row => row.eachCell((cell, ci) => {
    if (cell.isMerged || ci > numCols) return;
    const largo = String(cell.value ?? '').length;
    anchos[ci - 1] = Math.max(anchos[ci - 1], Math.min(largo + 3, ci === 4 ? 60 : 40));
  }));
  anchos.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Alturas para el texto ajustado
  const anchoTotal = anchos.reduce((a, b) => a + b, 0);
  textoAncho.forEach(({ fila, texto }) => { ws.getRow(fila).height = alturaPara(texto, anchoTotal); });
  filasDescripcion.forEach(({ fila, texto }) => { ws.getRow(fila).height = alturaPara(texto, anchos[3]); });

  return { rangoPuestos };
}

// ── Hojas de datos y ejemplo ──────────────────────────────────────────────
function agregarHojaTabla(wb, nombre, columnas, { filas = [], filasVacias = 0, tabColor }) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }],
    properties: { tabColor: { argb: tabColor } },
  });

  ws.getRow(1).height = 24;
  columnas.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.ancho;
    const c = ws.getCell(1, i + 1);
    c.value = col.h; // nombre exacto: es lo que valida la importación
    estiloEncabezado(c, col.opcional);
    if (col.opcional) c.note = 'Columna opcional: puede dejarse vacia.';
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  const total = Math.max(filas.length, filasVacias);
  for (let i = 0; i < total; i++) {
    const row = ws.getRow(i + 2);
    columnas.forEach((col, ci) => {
      const c = row.getCell(ci + 1);
      const v = filas[i]?.[ci];
      if (v !== undefined && v !== '') c.value = v;
      estiloCuerpo(c, i, col.formato);
    });
  }
  return ws;
}

/**
 * Validación de lista en la columna (filas 2..N+1) permitiendo escribir otros valores.
 * Se registra como un solo rango: asignarla celda por celda hace que ExcelJS genere
 * rangos traslapados (ordena "C10" antes que "C2") y Excel marca el archivo como dañado.
 */
function agregarListaDesplegable(ws, colIndex, rango, titulo) {
  const col = String.fromCharCode(64 + colIndex);
  ws.dataValidations.add(`${col}2:${col}${FILAS_PREFORMATEADAS + 1}`, {
    type: 'list',
    allowBlank: true,
    formulae: [rango],
    showInputMessage: true,
    promptTitle: titulo,
    prompt: 'Seleccione de la lista o escriba un valor nuevo.',
    showErrorMessage: false, // permite valores que no están en la lista
  });
}

// ── Constructores públicos ────────────────────────────────────────────────
function nuevoLibro() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Century Mold';
  wb.created = new Date();
  return wb;
}

export function construirFormatoDirectorio() {
  const wb = nuevoLibro();
  agregarHojaInstrucciones(wb, {
    titulo: 'INSTRUCCIONES — DIRECTORIO DE TRANSPORTE',
    hojaDatos: HOJA_DIR,
    columnas: COLUMNAS_DIR,
    reglas: [
      `Capture los datos en la hoja "${HOJA_DIR}" a partir de la fila 2.`,
      'No modifique, mueva ni renombre los encabezados de la fila 1. No agregue ni elimine columnas.',
      'Todas las columnas son obligatorias. Una fila por punto de reunion.',
      'La CLAVE identifica al punto de reunion y no puede repetirse en el archivo (ej.: SN01, SU02).',
      'Si una ruta, comunidad o clave ya existe en el sistema, se actualiza; no se crean duplicados.',
      `La hoja "${HOJA_EJEMPLO}" es solo de referencia y esta hoja de instrucciones nunca se importan.`,
      'Guarde el archivo en formato .xlsx antes de importarlo.',
    ],
  });
  agregarHojaTabla(wb, HOJA_DIR, COLUMNAS_DIR, { filasVacias: FILAS_PREFORMATEADAS, tabColor: FMT.rojo });
  agregarHojaTabla(wb, HOJA_EJEMPLO, COLUMNAS_DIR, { filas: EJEMPLO_DIR, tabColor: FMT.grisMedio });
  return wb;
}

export function construirFormatoEmpleados(puestosExistentes = []) {
  const wb = nuevoLibro();
  const { rangoPuestos } = agregarHojaInstrucciones(wb, {
    titulo: 'INSTRUCCIONES — PADRON DE EMPLEADOS',
    hojaDatos: HOJA_EMP,
    columnas: COLUMNAS_EMP,
    puestos: puestosExistentes,
    reglas: [
      `Capture los datos en la hoja "${HOJA_EMP}" a partir de la fila 2.`,
      'No modifique, mueva ni renombre los encabezados de la fila 1. No agregue ni elimine columnas.',
      'NOMINA, NOMBRE y PUESTO son obligatorios. CLAVE PARADA es opcional.',
      'NOMINA debe contener solo digitos y no repetirse en el archivo.',
      'PUESTO: elija de la lista desplegable o escriba uno nuevo. Los puestos nuevos se aceptan y se muestran como "Puesto nuevo" en la vista previa.',
      'CLAVE PARADA debe existir en el directorio de transporte. Si se deja vacia, la ruta se pedira al solicitar transporte.',
      'Si la nomina ya existe en el sistema, el empleado se actualiza; no se crean duplicados.',
      `La hoja "${HOJA_EJEMPLO}" es solo de referencia y esta hoja de instrucciones nunca se importan.`,
      'Guarde el archivo en formato .xlsx antes de importarlo.',
    ],
  });
  const wsEmp = agregarHojaTabla(wb, HOJA_EMP, COLUMNAS_EMP, { filasVacias: FILAS_PREFORMATEADAS, tabColor: FMT.rojo });
  if (rangoPuestos) agregarListaDesplegable(wsEmp, EMP_HEADERS.indexOf('PUESTO') + 1, rangoPuestos, 'Puesto');
  agregarHojaTabla(wb, HOJA_EJEMPLO, COLUMNAS_EMP, { filas: EJEMPLO_EMP, tabColor: FMT.grisMedio });
  return wb;
}

// ── Reporte de resultado de importación ───────────────────────────────────
const RESULTADO = {
  crear: 'Creado', actualizar: 'Actualizado', sinCambios: 'Sin cambios', reactivar: 'Reactivado',
};

/** Tabla con encabezado rojo, bordes, filas alternadas y anchos automáticos */
function agregarHojaReporte(wb, nombre, headers, filas, { anchoMax = 60, columnasAjuste = [] } = {}) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }],
  });
  ws.getRow(1).height = 24;
  headers.forEach((h, i) => estiloEncabezado(Object.assign(ws.getCell(1, i + 1), { value: h }), false));
  filas.forEach((fila, r) => fila.forEach((v, ci) => {
    const c = ws.getCell(r + 2, ci + 1);
    c.value = v ?? '';
    estiloCuerpo(c, r);
    c.alignment = { vertical: 'top', wrapText: columnasAjuste.includes(ci) };
  }));
  headers.forEach((h, i) => {
    const largo = Math.max(h.length, ...filas.map(f => String(f[i] ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0)));
    ws.getColumn(i + 1).width = Math.min(Math.max(largo + 3, 10), anchoMax);
  });
  if (filas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return ws;
}

/**
 * Reporte de lo que hizo una importación.
 * @param {object} p { tipo, modo, fecha, usuario, plan, resumen, idsBaja:Set<string> }
 */
export function construirReporteImportacion({ tipo, modo, fecha, usuario, plan, resumen, idsBaja }) {
  const wb = nuevoLibro();
  agregarHojaReporte(wb, 'Resumen', ['Concepto', 'Valor'], [
    ['Importacion', tipo],
    ['Modo', modo],
    ['Fecha', fecha],
    ['Realizada por', usuario],
    ['Creados', resumen.creados],
    ['Actualizados', resumen.actualizados],
    ['Sin cambios', resumen.sinCambios],
    ['Reactivados', resumen.reactivados],
    ['Dados de baja', resumen.bajas],
    ['No aparecen y se dejaron activos', resumen.mantenidos],
    ['Omitidos por error', resumen.omitidos],
  ]);

  const detalle = [];
  for (const it of plan.items) {
    const notas = [...it.cambios.map(c => `${c.campo}: ${c.antes} -> ${c.despues}`), it.mensaje].filter(Boolean);
    detalle.push([it.filaExcel, it.entidad, it.clave, it.nombre, RESULTADO[it.accion], notas.join('\n')]);
  }
  for (const b of plan.bajas) {
    const dadoDeBaja = idsBaja.has(b.key);
    const nota = [b.detalle, b.asignados ? `${b.asignados} empleados activos asignados` : ''].filter(Boolean).join(' · ');
    detalle.push(['', b.entidad, b.clave, b.nombre, dadoDeBaja ? 'Dado de baja' : 'No aparece; se dejo activo', nota]);
  }
  for (const f of plan.problemas.filter(f => f.estado === 'error')) {
    detalle.push([f.filaExcel, tipo === 'Empleados' ? 'Empleado' : 'Fila', Object.values(f.datos)[0] ?? '', Object.values(f.datos)[1] ?? '', 'Omitido por error', f.mensaje]);
  }
  agregarHojaReporte(wb, 'Detalle', ['Fila Excel', 'Tipo', 'ID / Clave', 'Nombre', 'Resultado', 'Detalle'], detalle, { columnasAjuste: [5] });
  return wb;
}

// ── Lectura ───────────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Lee solo la hoja de datos (ignora "Instrucciones" y "Ejemplo") y valida encabezados.
 * Devuelve las filas de datos con su número de fila de Excel; omite filas vacías.
 */
function leerHojaDatos(buffer, nombreHoja, headers) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[nombreHoja];
  if (!ws) throw new Error(`No se encontro la hoja "${nombreHoja}".`);
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!raw.length) throw new Error(`La hoja "${nombreHoja}" esta vacia.`);
  const enc = raw[0].map(h => norm(h));
  headers.forEach((h, i) => {
    if (enc[i] !== h) {
      throw new Error(`Encabezado incorrecto en col ${String.fromCharCode(65 + i)}: esperado "${h}", encontrado "${enc[i] || '(vacio)'}"`);
    }
  });
  const filas = [];
  for (let i = 1; i < raw.length; i++) {
    const valores = headers.map((_, ci) => raw[i][ci]);
    if (valores.every(v => norm(v) === '')) continue;
    filas.push({ filaExcel: i + 1, valores });
  }
  return filas;
}

export function leerDirectorio(buffer) {
  const clavesSeen = new Map();
  return leerHojaDatos(buffer, HOJA_DIR, DIR_HEADERS).map(({ filaExcel, valores }) => {
    const [ruta, comunidad, puntoReunion, clave] = valores.map(norm);
    const datos = { RUTA: ruta, COMUNIDAD: comunidad, 'PUNTO DE REUNION': puntoReunion, CLAVE: clave };
    const errores = [];
    if (!ruta) errores.push('RUTA obligatoria');
    if (!comunidad) errores.push('COMUNIDAD obligatoria');
    if (!puntoReunion) errores.push('PUNTO DE REUNION obligatorio');
    if (!clave) errores.push('CLAVE obligatoria');
    // Los IDs se derivan del texto: debe quedar algo utilizable
    if (ruta && !slugify(ruta)) errores.push(`RUTA "${ruta}" debe contener letras o numeros`);
    if (comunidad && !slugify(comunidad)) errores.push(`COMUNIDAD "${comunidad}" debe contener letras o numeros`);
    if (clave && (clave.includes('/') || clave === '.' || clave === '..')) errores.push(`CLAVE "${clave}" no puede contener "/"`);
    if (clave && clavesSeen.has(clave)) errores.push(`CLAVE "${clave}" duplicada (fila ${clavesSeen.get(clave)})`);
    else if (clave) clavesSeen.set(clave, filaExcel);
    return errores.length
      ? { filaExcel, estado: 'error', mensaje: errores.join('. '), datos }
      : { filaExcel, estado: 'valido', mensaje: '', datos };
  });
}

export function leerEmpleados(buffer, puntosReunionMap, puestosExistentes = []) {
  const nominasSeen = new Map();
  const filasTmp = leerHojaDatos(buffer, HOJA_EMP, EMP_HEADERS).map(({ filaExcel, valores }) => {
    const nomina = norm(valores[0]); const nombre = norm(valores[1]);
    const puesto = normalizarPuesto(valores[2]); const claveParada = norm(valores[3]);
    const datos = { NOMINA: nomina, NOMBRE: nombre, PUESTO: puesto, 'CLAVE PARADA': claveParada };
    const errores = []; const advertencias = [];
    if (!nomina) errores.push('NOMINA obligatoria');
    else if (!/^\d+$/.test(nomina)) errores.push(`NOMINA "${nomina}" no es numerica`);
    else if (nominasSeen.has(nomina)) errores.push(`NOMINA "${nomina}" duplicada (fila ${nominasSeen.get(nomina)})`);
    else nominasSeen.set(nomina, filaExcel);
    if (!nombre) errores.push('NOMBRE obligatorio');
    if (!puesto) errores.push('PUESTO obligatorio');
    // Puesto: si equivale a uno existente se usa esa escritura; si no existe, es "Puesto nuevo" (no es error)
    let puestoNuevo = false;
    let puestoSimilar = null;
    if (puesto) {
      const { exacto, similares } = buscarCoincidencias(puesto, puestosExistentes);
      if (exacto) {
        if (exacto !== puesto) {
          datos.PUESTO = exacto;
          advertencias.push(`Puesto "${puesto}" es variante de "${exacto}"; se usara el existente`);
        }
      } else {
        puestoNuevo = true;
        if (similares.length > 0) {
          puestoSimilar = similares[0];
          advertencias.push(`Puesto nuevo "${puesto}": posible variante de "${similares[0]}"`);
        }
      }
    }
    let paradaInfo = null;
    if (claveParada) {
      if (!puntosReunionMap || puntosReunionMap.size === 0) advertencias.push(`CLAVE PARADA "${claveParada}": directorio vacio`);
      else if (!puntosReunionMap.has(claveParada)) advertencias.push(`CLAVE PARADA "${claveParada}" no existe; se conserva la ruta actual`);
      else if (!esActivo(puntosReunionMap.get(claveParada))) advertencias.push(`CLAVE PARADA "${claveParada}" esta inactiva; se conserva la ruta actual`);
      else paradaInfo = puntosReunionMap.get(claveParada);
    }
    return { filaExcel, datos, paradaInfo, puestoNuevo, puestoSimilar, errores, advertencias };
  });
  // Variantes entre puestos nuevos del mismo archivo (acentos o una letra de diferencia)
  const nuevosEnArchivo = [...new Set(filasTmp.filter(f => f.puestoNuevo).map(f => f.datos.PUESTO))];
  for (const f of filasTmp) {
    if (!f.puestoNuevo || f.puestoSimilar) continue;
    const otros = nuevosEnArchivo.filter(p => p !== f.datos.PUESTO);
    const { exacto, similares } = buscarCoincidencias(f.datos.PUESTO, otros);
    const variante = exacto ?? similares[0];
    if (variante) {
      f.puestoSimilar = variante;
      f.advertencias.push(`Puesto nuevo "${f.datos.PUESTO}": posible variante de "${variante}" (tambien en el archivo)`);
    }
  }
  return filasTmp.map(({ errores, advertencias, ...f }) => ({
    ...f,
    estado: errores.length ? 'error' : advertencias.length ? 'advertencia' : 'valido',
    mensaje: (errores.length ? errores : advertencias).join('. '),
  }));
}
