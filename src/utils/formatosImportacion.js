/**
 * formatosImportacion.js
 * Formatos en blanco y lectura de los archivos de importación (todo con ExcelJS; solo .xlsx)
 * de empleados y directorio. Sin dependencias del navegador, para poder probarlo en Node.
 *
 * Cada formato tiene 3 hojas: "Instrucciones", la hoja de datos y "Ejemplo".
 * La lectura solo usa la hoja de datos; las otras dos se ignoran siempre.
 * El archivo es un documento: aquí se usan colores fijos, no tokens de la UI.
 */
import ExcelJS from 'exceljs';
import { motivoArchivoNoValido, motivoLibroDemasiadoGrande } from './excelSeguro.js';
import { limpiarTexto, normalizarPuesto } from './puestos.js';
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
  { h: 'PUESTO',       ancho: 32, desc: 'Un puesto del catalogo (o su alias). Los demas se resuelven en la vista previa.',                      ej: 'PRODUCTION OPERATOR' },
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
  [12345, 'GARCIA LOPEZ JUAN',      'PRODUCTION OPERATOR', 'SN01'],
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
  filaCombinada('Century Mold Querétaro · Portal de procesos', { font: { size: 9, color: { argb: FMT.grisMedio } }, alto: 16 });

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
export function nuevoLibro() {
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
      'PUESTO: use un puesto del catalogo (o un alias ya confirmado). Los que no se reconozcan se resuelven en la vista previa antes de confirmar.',
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
export function agregarHojaReporte(wb, nombre, headers, filas, { anchoMax = 60, columnasAjuste = [] } = {}) {
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
    ...(plan.resolucion ? [
      ['Cambian de area', resumen.cambianArea],
      ['Area asignada (no tenian area)', resumen.areaAsignada],
      ['Excepciones de area nuevas', resumen.excepcionesNuevas],
      ['Puestos nuevos creados', resumen.puestosNuevos],
      ['Puestos con area cambiada', resumen.puestosCambioArea],
      ['Alias nuevos guardados', resumen.aliasNuevos],
      ['Empleados omitidos por puesto', resumen.omitidosPuesto],
    ] : []),
    ['Dados de baja', resumen.bajas],
    ['No aparecen y se dejaron activos', resumen.mantenidos],
    ['Omitidos por error', resumen.omitidos],
  ]);

  if (plan.resolucion) {
    // Cómo se resolvió cada puesto del archivo (y el área de cada uno)
    const ETIQUETA = {
      auto: 'Coincide', corregido: 'Corregido automaticamente', alias: 'Equivalencia confirmada (alias guardado)',
      nuevo: 'Puesto nuevo', omitir: 'Omitido', pendiente: 'Sin resolver',
    };
    const filasPuestos = plan.resolucion.grupos.map(g => {
      const r = plan.resolucion.porClave.get(g.clave);
      return [[...g.crudos].filter(Boolean).join(' | ') || g.texto, r.nombre, r.areaId, ETIQUETA[r.estado] ?? r.estado, g.empleados.length];
    });
    agregarHojaReporte(wb, 'Puestos', ['Puesto en el archivo', 'Puesto asignado', 'Area', 'Resultado', 'Empleados'], filasPuestos);

    // Una hoja por grupo del resumen final
    const emp = (lista) => lista.map(i => [
      i.clave, i.nombre, i.detalle, i.areaAnteriorNombre || '(sin area)', i.areaNombre || '(sin area)',
      i.excepcion ? `${i.areaNombre} (${i.excepcion.motivo || 'sin motivo'})` : '',
      i.cambios.map(c => `${c.campo}: ${c.antes} -> ${c.despues}`).join('\n'), i.filaExcel,
    ]);
    const colsEmp = ['Nomina', 'Nombre', 'Puesto', 'Area anterior', 'Area nueva', 'Excepcion', 'Cambios', 'Fila Excel'];
    const hojaEmp = (nombre, lista) => agregarHojaReporte(wb, nombre, colsEmp, emp(lista), { columnasAjuste: [6] });
    hojaEmp('Creados', plan.items.filter(i => i.accion === 'crear'));
    hojaEmp('Actualizados', plan.items.filter(i => i.accion === 'actualizar'));
    hojaEmp('Reactivados', plan.items.filter(i => i.accion === 'reactivar'));
    hojaEmp('Sin cambios', plan.items.filter(i => i.accion === 'sinCambios'));
    hojaEmp('Cambian de area', plan.items.filter(i => i.areaEstado === 'cambia'));
    agregarHojaReporte(wb, 'Excepciones nuevas', ['Nomina', 'Nombre', 'Puesto', 'Area del puesto', 'Area de excepcion', 'Motivo'],
      plan.items.filter(i => i.excepcionNueva).map(i => [i.clave, i.nombre, i.detalle,
        plan.areaNombres?.get(i.areaPuestoId) ?? i.areaPuestoId, i.areaNombre, i.excepcion.motivo]));
    agregarHojaReporte(wb, 'Puestos nuevos', ['Puesto', 'Area', 'Empleados'],
      plan.resolucion.puestosNuevos.map(p => [p.nombre, plan.areaNombres?.get(p.areaId) ?? p.areaId,
        plan.items.filter(i => i.puestoId === p.id).length]));
    agregarHojaReporte(wb, 'Alias nuevos', ['Puesto (id)', 'Alias'], plan.resolucion.aliasNuevos.map(a => [a.puestoId, a.alias]));
    agregarHojaReporte(wb, 'Puestos con area cambiada', ['Puesto', 'Area anterior', 'Area nueva', 'Del archivo', 'Fuera del archivo', 'Con excepcion (no se mueven)'],
      (plan.cambiosPuesto ?? []).map(c => [c.nombre, plan.areaNombres?.get(c.de) ?? c.de, plan.areaNombres?.get(c.a) ?? c.a, c.enArchivo, c.fueraArchivo.length, c.conExcepcion]));
    agregarHojaReporte(wb, 'Bajas', ['Nomina', 'Nombre', 'Puesto', 'Resultado'],
      plan.bajas.map(b => [b.clave, b.nombre, b.detalle, idsBaja.has(b.key) ? 'Dado de baja' : 'No aparece; se dejo activo']));
    agregarHojaReporte(wb, 'Omitidos', ['Fila Excel', 'Nomina', 'Nombre', 'Motivo'],
      plan.problemas.filter(f => f.estado === 'error').map(f => [f.filaExcel, f.datos.NOMINA ?? '', f.datos.NOMBRE ?? '', f.mensaje]));
    return wb;
  }

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
    detalle.push([f.filaExcel, 'Fila', Object.values(f.datos)[0] ?? '', Object.values(f.datos)[1] ?? '', 'Omitido por error', f.mensaje]);
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
/** Valor de una celda de ExcelJS como texto (números, fórmulas, texto con formato, hipervínculos) */
function textoCelda(cell) {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if (v.text != null) return String(v.text);
    return '';
  }
  return String(v);
}

async function cargarLibro(buffer) {
  // Límites antes y después de leer: un archivo enorme o con millones de filas se rechaza (ver excelSeguro.js)
  const noValido = motivoArchivoNoValido(buffer?.byteLength ?? buffer?.length ?? 0);
  if (noValido) throw new Error(noValido);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error('No se pudo leer el archivo. Verifique que sea un .xlsx válido.');
  }
  const grande = motivoLibroDemasiadoGrande(wb.worksheets);
  if (grande) throw new Error(grande);
  return wb;
}

function filasDeHoja(wb, nombreHoja, headers) {
  const ws = wb.getWorksheet(nombreHoja);
  if (!ws) throw new Error(`No se encontro la hoja "${nombreHoja}".`);
  const total = ws.rowCount;
  if (!total) throw new Error(`La hoja "${nombreHoja}" esta vacia.`);
  // raw[i] = valores de la fila i+1 de Excel, solo las columnas esperadas
  const raw = [];
  for (let n = 1; n <= total; n++) {
    const row = ws.getRow(n);
    raw.push(headers.map((_, ci) => textoCelda(row.getCell(ci + 1))));
  }
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

async function leerHojaDatos(buffer, nombreHoja, headers) {
  return filasDeHoja(await cargarLibro(buffer), nombreHoja, headers);
}

// ── Reporte de nómina ─────────────────────────────────────────────────────
/** Encabezados del reporte de nómina (por ellos se detecta el formato) */
export const ENCABEZADOS_NOMINA = ['numero_i', 'nombre', 'depto', 'desc_depto', 'turno', 'puesto', 'nivel_g', 'alta_g'];
const NUCLEO_NOMINA = ['numero_i', 'nombre', 'depto', 'puesto'];
const normEnc = (v) => String(v ?? '').trim().toLowerCase();

/** Todas las hojas que traen los encabezados del reporte de nómina (se buscan en sus primeras filas) */
function buscarReportesNomina(wb) {
  const encontrados = [];
  for (const ws of wb.worksheets) {
    const tope = Math.min(ws.rowCount, 10);
    for (let n = 1; n <= tope; n++) {
      const cols = new Map();
      ws.getRow(n).eachCell({ includeEmpty: false }, (cell, ci) => cols.set(normEnc(textoCelda(cell)), ci));
      if (NUCLEO_NOMINA.every(h => cols.has(h))) { encontrados.push({ ws, filaEnc: n, cols }); break; }
    }
  }
  return encontrados;
}

/** Fecha de una celda como AAAA-MM-DD ('' si no se reconoce) */
function fechaCelda(cell) {
  const v = cell.value;
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return v > 20000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : '';
  const t = textoCelda(cell).trim();
  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : t;
}

/** Filas crudas del reporte de nómina, con la misma forma que las del formato propio */
function filasReporteNomina({ ws, filaEnc, cols }) {
  const filas = [];
  for (let n = filaEnc + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const txt = (h) => (cols.has(h) ? limpiarTexto(textoCelda(row.getCell(cols.get(h)))) : '');
    const nomina = txt('numero_i');
    const nombre = txt('nombre');
    const puesto = txt('puesto');
    const puestoCrudo = cols.has('puesto') ? textoCelda(row.getCell(cols.get('puesto'))) : '';
    const extra = {
      depto: txt('depto'),
      descDepto: txt('desc_depto'),
      turnoNomina: txt('turno'),
      nivel: txt('nivel_g'),
      fechaAlta: cols.has('alta_g') ? fechaCelda(row.getCell(cols.get('alta_g'))) : '',
    };
    if (!nomina && !nombre && !puesto && !extra.depto) continue;
    filas.push({ filaExcel: n, nomina: norm(nomina), nombre: norm(nombre), puesto: normalizarPuesto(puesto), claveParada: '', extra, puestoCrudo });
  }
  return filas;
}

export async function leerDirectorio(buffer) {
  const clavesSeen = new Map();
  return (await leerHojaDatos(buffer, HOJA_DIR, DIR_HEADERS)).map(({ filaExcel, valores }) => {
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

/**
 * Lee el padrón desde el formato propio (hoja "Empleados") o desde el reporte de nómina
 * (se detecta por sus encabezados: numero_i, nombre, depto, puesto...). Cada fila lleva `formato`
 * ('propio' | 'nomina'); las del reporte traen además `extra` { depto, descDepto, turnoNomina, nivel, fechaAlta }.
 *
 * Hoja del reporte de nómina: si solo una hoja trae los encabezados se usa sola; si hay varias, hay que
 * indicar `hoja` (si no, devuelve `meta.requiereHoja` y ninguna fila). `usarPrimera` toma la primera candidata.
 * @returns {{ filas: object[], meta: { formato, hoja, hojas: string[], candidatas: string[], requiereHoja: boolean, filasHoja?: number } }}
 */
export async function leerEmpleadosArchivo(buffer, puntosReunionMap, { hoja, usarPrimera = false } = {}) {
  const wb = await cargarLibro(buffer);
  const hojas = wb.worksheets.map(w => w.name);
  const reportes = buscarReportesNomina(wb);
  const candidatas = reportes.map(r => r.ws.name);
  const meta = { formato: reportes.length ? 'nomina' : 'propio', hoja: '', hojas, candidatas, requiereHoja: false };

  let reporte = null;
  if (reportes.length) {
    reporte = reportes.find(r => r.ws.name === hoja) ?? (usarPrimera || reportes.length === 1 ? reportes[0] : null);
    if (!reporte) return { filas: [], meta: { ...meta, requiereHoja: true } };
    meta.hoja = reporte.ws.name;
  } else {
    if (!wb.getWorksheet(HOJA_EMP)) {
      throw new Error(
        `No se encontro la hoja "${HOJA_EMP}" ni una hoja del reporte de nomina. Hojas del archivo: ${hojas.join(', ') || '(ninguna)'}. ` +
        `Se esperaba el reporte de nomina (encabezados ${ENCABEZADOS_NOMINA.join(', ')}) o el formato propio (hoja "${HOJA_EMP}" con ${EMP_HEADERS.join(', ')}).`,
      );
    }
    meta.hoja = HOJA_EMP;
  }
  const formato = meta.formato;
  const crudas = reporte
    ? filasReporteNomina(reporte)
    : filasDeHoja(wb, HOJA_EMP, EMP_HEADERS).map(({ filaExcel, valores }) => ({
      filaExcel, nomina: norm(valores[0]), nombre: norm(valores[1]),
      puesto: normalizarPuesto(valores[2]), claveParada: norm(valores[3]), extra: null, puestoCrudo: valores[2],
    }));

  const nominasSeen = new Map();
  const filasTmp = crudas.map(({ filaExcel, nomina, nombre, puesto, claveParada, extra, puestoCrudo }) => {
    const datos = { NOMINA: nomina, NOMBRE: nombre, PUESTO: puesto, 'CLAVE PARADA': claveParada };
    const errores = []; const advertencias = [];
    if (!nomina) errores.push('NOMINA obligatoria');
    else if (!/^\d+$/.test(nomina)) errores.push(`NOMINA "${nomina}" no es numerica`);
    else if (nominasSeen.has(nomina)) errores.push(`NOMINA "${nomina}" duplicada (fila ${nominasSeen.get(nomina)})`);
    else nominasSeen.set(nomina, filaExcel);
    if (!nombre) errores.push('NOMBRE obligatorio');
    // Puesto vacío: a un empleado existente se le conserva el puesto (lo decide la comparación); a uno nuevo se le omite
    if (!puesto) advertencias.push('PUESTO vacio: se conserva el puesto actual del empleado');
    let paradaInfo = null;
    if (claveParada) {
      if (!puntosReunionMap || puntosReunionMap.size === 0) advertencias.push(`CLAVE PARADA "${claveParada}": directorio vacio`);
      else if (!puntosReunionMap.has(claveParada)) advertencias.push(`CLAVE PARADA "${claveParada}" no existe; se conserva la ruta actual`);
      else if (!esActivo(puntosReunionMap.get(claveParada))) advertencias.push(`CLAVE PARADA "${claveParada}" esta inactiva; se conserva la ruta actual`);
      else paradaInfo = puntosReunionMap.get(claveParada);
    }
    return { filaExcel, formato, extra, datos, paradaInfo, puestoVacio: !puesto, puestoCrudo: String(puestoCrudo ?? ''), errores, advertencias };
  });
  const filas = filasTmp.map(({ errores, advertencias, ...f }) => ({
    ...f,
    estado: errores.length ? 'error' : advertencias.length ? 'advertencia' : 'valido',
    mensaje: (errores.length ? errores : advertencias).join('. '),
  }));
  return { filas, meta: { ...meta, filasHoja: filas.length } };
}

/** Solo las filas (si hay varias hojas candidatas toma la primera); la interfaz usa leerEmpleadosArchivo */
export async function leerEmpleados(buffer, puntosReunionMap) {
  return (await leerEmpleadosArchivo(buffer, puntosReunionMap, { usarPrimera: true })).filas;
}
