/**
 * RhCatalogos.jsx — Catálogos de transporte con CRUD y carga masiva
 * Acceso: roles rh y admin (esPersonalRH)
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Database, MapPin, Navigation, Upload, Loader2,
  Users, CheckCircle2, AlertTriangle, X, Download, FileSpreadsheet,
  Info, ChevronDown, ChevronUp, Plus, Pencil, ToggleLeft, ToggleRight,
  Search,
} from 'lucide-react';
import { buscarCoincidencias } from '../../components/PuestoCombobox';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import {
  collection, doc, writeBatch, getDocs, setDoc, updateDoc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import RevisarColecciones from './RevisarColecciones';
import Modal from '../../components/Modal';

// ── Esquema de columnas ───────────────────────────────────────────────────
const DIR_HEADERS = ['RUTA', 'COMUNIDAD', 'PUNTO DE REUNION', 'CLAVE'];
const EMP_HEADERS = ['NOMINA', 'NOMBRE', 'PUESTO', 'CLAVE PARADA'];

const DIR_COLS_INFO = [
  { letra: 'A', nombre: 'RUTA',            obligatorio: true,  ejemplo: 'RUTA NORTE',            descripcion: 'Nombre completo de la ruta' },
  { letra: 'B', nombre: 'COMUNIDAD',        obligatorio: true,  ejemplo: 'COLONIA SAN PEDRO',     descripcion: 'Colonia o comunidad' },
  { letra: 'C', nombre: 'PUNTO DE REUNION', obligatorio: true,  ejemplo: 'PARQUE CENTRAL',        descripcion: 'Nombre del punto de reunion' },
  { letra: 'D', nombre: 'CLAVE',            obligatorio: true,  ejemplo: 'SN01',                  descripcion: 'Identificador unico' },
];
const EMP_COLS_INFO = [
  { letra: 'A', nombre: 'NOMINA',       obligatorio: true,  ejemplo: '12345',                  descripcion: 'Numero de nomina (solo digitos)' },
  { letra: 'B', nombre: 'NOMBRE',       obligatorio: true,  ejemplo: 'GARCIA LOPEZ JUAN',      descripcion: 'Nombre completo' },
  { letra: 'C', nombre: 'PUESTO',       obligatorio: true,  ejemplo: 'OPERADOR DE PRODUCCION', descripcion: 'Puesto o cargo' },
  { letra: 'D', nombre: 'CLAVE PARADA', obligatorio: false, ejemplo: 'SN01',                  descripcion: 'Clave del punto de reunion' },
];

const TABS = [
  { id: 'rutas',        label: 'Rutas',            icon: Navigation },
  { id: 'comunidades',  label: 'Comunidades',      icon: MapPin },
  { id: 'puntos',       label: 'Puntos de reunion', icon: MapPin },
  { id: 'herramientas', label: 'Diagnostico',      icon: Database },
];

// ── Utilidades ────────────────────────────────────────────────────────────
const slugify = (text) =>
  String(text).trim().replace(/\s+/g, ' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-').replace(/^-+|-+$/g, '');

const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
const normLower = (v) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ── Paleta corporativa para los formatos en blanco ────────────────────────
const FMT = {
  rojo:        'FFC8102E',
  oscuro:      'FF1F2328',
  grisOscuro:  'FF3D434A',
  grisMedio:   'FF6B7280',
  grisClaroAlt:'FFF3F4F6',
  grisBorde:   'FF9CA3AF',
  blanco:      'FFFFFFFF',
  amarillo:    'FFFFF8DC',
};

/** Aplica borde fino a una celda de ExcelJS */
function bordeFinoEJ(cell) {
  const side = { style: 'thin', color: { argb: FMT.grisBorde } };
  cell.border = { top: side, left: side, bottom: side, right: side };
}

/** Descarga buffer como .xlsx en el navegador */
async function descargarBuffer(workbook, nombre) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

/** Estilo de encabezado de hoja de datos (fondo rojo corporativo) */
function estiloEncabezadoDatos(cell, opcional = false) {
  cell.font = { bold: true, color: { argb: FMT.blanco }, size: 10 };
  cell.fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: opcional ? FMT.grisOscuro : FMT.rojo },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  bordeFinoEJ(cell);
}

/**
 * Genera la hoja de Instrucciones con estilo corporativo.
 * @param {ExcelJS.Workbook} wb
 * @param {string} titulo
 * @param {string[]} reglas
 * @param {string[]} headers          — encabezados de la hoja de datos
 * @param {boolean[]} opcionales      — cuáles son opcionales (misma longitud)
 */
function agregarHojaInstrucciones(wb, titulo, reglas, headers, opcionales) {
  const ws = wb.addWorksheet('Instrucciones');
  ws.showGridLines = false;

  // ── Fila 1: Título ──
  const numCols = Math.max(headers.length, 4);
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell('A1');
  titleCell.value = titulo;
  titleCell.font = { bold: true, size: 14, color: { argb: FMT.blanco } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.oscuro } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 32;

  // ── Reglas ──
  let row = 3;
  for (const regla of reglas) {
    const cell = ws.getCell(row, 1);
    ws.mergeCells(row, 1, row, numCols);
    cell.value = regla;
    cell.font = { size: 10 };
    cell.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(row).height = 18;
    row++;
  }

  // ── Mini tabla de encabezados ──
  row += 1;
  // Fila de título de la mini tabla
  ws.mergeCells(row, 1, row, numCols);
  const subCell = ws.getCell(row, 1);
  subCell.value = 'ESTRUCTURA DEL ARCHIVO';
  subCell.font = { bold: true, size: 10, color: { argb: FMT.blanco } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.oscuro } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 20;
  row++;

  // Fila de encabezados
  ['Columna', 'Campo', 'Obligatorio', 'Descripcion / Ejemplo'].forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: FMT.blanco } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.grisOscuro } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    bordeFinoEJ(c);
  });
  ws.getRow(row).height = 18;
  row++;

  const letras = 'ABCDEFGHIJ';
  headers.forEach((h, i) => {
    const esOpc = opcionales[i];
    const c1 = ws.getCell(row, 1); c1.value = letras[i];
    const c2 = ws.getCell(row, 2); c2.value = h;
    const c3 = ws.getCell(row, 3); c3.value = esOpc ? 'Opcional' : 'Obligatorio';
    const c4 = ws.getCell(row, 4);
    c4.value = esOpc ? 'Puede dejarse en blanco.' : 'Requerido para importar.';

    [c1, c2, c3, c4].forEach(c => {
      bordeFinoEJ(c);
      c.alignment = { vertical: 'middle', wrapText: true };
      c.font = { size: 10 };
      if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.grisClaroAlt } };
    });
    c3.font = { size: 10, color: { argb: esOpc ? FMT.grisMedio : FMT.rojo } };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row).height = 18;
    row++;
  });

  // ── Nota sobre opcionales ──
  if (opcionales.some(Boolean)) {
    row++;
    ws.mergeCells(row, 1, row, numCols);
    const nota = ws.getCell(row, 1);
    nota.value = 'NOTA: Las columnas marcadas como "Opcional" pueden dejarse vacias; el sistema las procesara sin error.';
    nota.font = { italic: true, size: 9, color: { argb: FMT.grisMedio } };
    nota.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(row).height = 18;
  }

  // Anchos de columnas
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 40;
}

/**
 * Aplica estilo completo a una hoja de datos:
 * encabezados rojos, filas alternas, bordes en 500 filas,
 * congelado fila 1 y autofiltro.
 */
function estilizarHojaDatos(ws, headers, opcionales, anchos, ejemploRows = []) {
  const NUM_FILAS_BLANCAS = 500;

  // Encabezados
  ws.getRow(1).height = 24;
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    estiloEncabezadoDatos(cell, opcionales[i]);
    ws.getColumn(i + 1).width = anchos[i];
  });

  // Congelar fila 1 y autofiltro
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  // Filas alternas vacías con bordes
  for (let r = 2; r <= NUM_FILAS_BLANCAS + 1; r++) {
    const xlRow = ws.getRow(r);
    for (let c = 1; c <= headers.length; c++) {
      const cell = xlRow.getCell(c);
      bordeFinoEJ(cell);
      if (r % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.grisClaroAlt } };
      }
    }
  }

  // Filas de ejemplo (si se pasan) — después de las vacías en la hoja Ejemplo
  ejemploRows.forEach((rowData, ri) => {
    const xlRow = ws.getRow(ri + 2);
    rowData.forEach((val, ci) => {
      const cell = xlRow.getCell(ci + 1);
      cell.value = val;
      cell.font = { size: 10 };
      bordeFinoEJ(cell);
      if ((ri + 2) % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FMT.grisClaroAlt } };
      }
    });
  });
}

// ── Generadores de formato en blanco (ExcelJS) ────────────────────────────
async function generarFormatoDirectorio() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CenturyMold';

  const headers  = DIR_HEADERS; // ['RUTA','COMUNIDAD','PUNTO DE REUNION','CLAVE']
  const opcional = [false, false, false, false];
  const anchos   = [26, 30, 34, 14];

  const reglas = [
    '1. No modifique los encabezados de la fila 1 en la hoja "Directorio".',
    '2. Escriba los datos a partir de la fila 2.',
    '3. No agregue ni elimine columnas.',
    '4. Guarde el archivo en formato .xlsx.',
    '5. Los registros existentes se actualizan; no se crean duplicados.',
    '6. La CLAVE debe ser unica en todo el archivo (ej: SN01, SU02).',
    '7. No importe la hoja "Instrucciones" ni "Ejemplo": el sistema las ignora.',
  ];

  agregarHojaInstrucciones(wb, 'INSTRUCCIONES — DIRECTORIO DE TRANSPORTE', reglas, headers, opcional);

  // Hoja Directorio
  const wsDir = wb.addWorksheet('Directorio');
  estilizarHojaDatos(wsDir, headers, opcional, anchos);

  // Hoja Ejemplo
  const wsEj = wb.addWorksheet('Ejemplo');
  const ejRows = [
    ['RUTA NORTE', 'COLONIA SAN PEDRO',    'PARQUE CENTRAL',      'SN01'],
    ['RUTA NORTE', 'COLONIA SAN PEDRO',    'FARMACIA DEL AHORRO', 'SN02'],
    ['RUTA SUR',   'COLONIA VISTA HERMOSA','PLAZA COMERCIAL',     'SU01'],
  ];
  estilizarHojaDatos(wsEj, headers, opcional, anchos, ejRows);

  await descargarBuffer(wb, 'Formato_Directorio.xlsx');
}

async function generarFormatoEmpleados(puestosExistentes = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CenturyMold';

  const headers  = EMP_HEADERS; // ['NOMINA','NOMBRE','PUESTO','CLAVE PARADA']
  const opcional = [false, false, false, true];
  const anchos   = [12, 40, 34, 18];

  const reglas = [
    '1. No modifique los encabezados de la fila 1 en la hoja "Empleados".',
    '2. Escriba los datos a partir de la fila 2.',
    '3. No agregue ni elimine columnas.',
    '4. Guarde el archivo en formato .xlsx.',
    '5. Los empleados existentes se actualizan; no se crean duplicados.',
    '6. NOMINA debe ser un numero entero unico (solo digitos).',
    '7. CLAVE PARADA es opcional: si se omite, se podra asignar al solicitar transporte.',
    '8. PUESTO: use el desplegable o escriba el nombre exacto. Valores nuevos son aceptados.',
    '9. No importe la hoja "Instrucciones" ni "Ejemplo": el sistema las ignora.',
  ];

  agregarHojaInstrucciones(wb, 'INSTRUCCIONES — PADRON DE EMPLEADOS', reglas, headers, opcional);

  // Hoja Empleados
  const wsEmp = wb.addWorksheet('Empleados');
  estilizarHojaDatos(wsEmp, headers, opcional, anchos);

  // Formato numerico para columna NOMINA (A) y texto para CLAVE PARADA (D)
  wsEmp.getColumn(1).numFmt = '0';
  wsEmp.getColumn(4).numFmt = '@';

  // Validacion de datos en columna PUESTO (C) si hay puestos cargados
  if (puestosExistentes.length > 0 && puestosExistentes.length <= 255) {
    const lista = puestosExistentes.slice(0, 255).map(p => `"${p}"`).join(',');
    for (let r = 2; r <= 501; r++) {
      wsEmp.getCell(r, 3).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${puestosExistentes.slice(0, 255).join(',')}"`],
        showErrorMessage: false, // permite escribir valores nuevos
        promptTitle: 'Puesto',
        prompt: 'Seleccione un puesto o escriba uno nuevo.',
      };
    }
    void lista; // evitar warning
  }

  // Hoja Ejemplo
  const wsEj = wb.addWorksheet('Ejemplo');
  const ejRows = [
    ['12345', 'GARCIA LOPEZ JUAN',      'OPERADOR DE PRODUCCION', 'SN01'],
    ['67890', 'MARTINEZ RUIZ ANA',      'SUPERVISORA DE CALIDAD', 'SU01'],
    ['11111', 'RODRIGUEZ PEREZ CARLOS', 'ALMACENISTA',            ''   ],
  ];
  estilizarHojaDatos(wsEj, headers, opcional, anchos, ejRows);
  wsEj.getColumn(1).numFmt = '0';
  wsEj.getColumn(4).numFmt = '@';

  await descargarBuffer(wb, 'Formato_Empleados.xlsx');
}

function descargarReporteErrores(filas, tipo) {
  const wb = XLSX.utils.book_new();
  const keys = Object.keys(filas[0]?.datos ?? {});
  const rows = [['Fila Excel', 'Estado', 'Mensaje', ...keys]];
  for (const f of filas) {
    if (f.estado === 'error' || f.estado === 'advertencia') {
      rows.push([f.filaExcel, f.estado.toUpperCase(), f.mensaje, ...keys.map((k) => f.datos?.[k] ?? '')]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 55 }, ...keys.map(() => ({ wch: 22 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `Reporte_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Parsers ───────────────────────────────────────────────────────────────
async function parsearDirectorio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets['Directorio'];
        if (!ws) { reject(new Error('No se encontro la hoja "Directorio".')); return; }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!raw.length) { reject(new Error('La hoja "Directorio" esta vacia.')); return; }
        const enc = raw[0].map(h => norm(h));
        for (let i = 0; i < DIR_HEADERS.length; i++) {
          if (enc[i] !== DIR_HEADERS[i]) {
            reject(new Error(`Encabezado incorrecto en col ${String.fromCharCode(65+i)}: esperado "${DIR_HEADERS[i]}", encontrado "${enc[i]||'(vacio)'}"`));
            return;
          }
        }
        const clavesSeen = new Map();
        const resultado = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i]; const filaExcel = i + 1;
          const ruta = norm(row[0]); const comunidad = norm(row[1]);
          const puntoReunion = norm(row[2]); const clave = norm(row[3]);
          const datos = { RUTA: ruta, COMUNIDAD: comunidad, 'PUNTO DE REUNION': puntoReunion, CLAVE: clave };
          if (!ruta && !comunidad && !puntoReunion && !clave) continue;
          const errores = [];
          if (!ruta) errores.push('RUTA obligatoria');
          if (!comunidad) errores.push('COMUNIDAD obligatoria');
          if (!puntoReunion) errores.push('PUNTO DE REUNION obligatorio');
          if (!clave) errores.push('CLAVE obligatoria');
          if (clave && clavesSeen.has(clave)) errores.push(`CLAVE "${clave}" duplicada (fila ${clavesSeen.get(clave)})`);
          else if (clave) clavesSeen.set(clave, filaExcel);
          resultado.push(errores.length ? { filaExcel, estado: 'error', mensaje: errores.join('. '), datos } : { filaExcel, estado: 'valido', mensaje: '', datos });
        }
        resolve(resultado);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

async function parsearEmpleados(file, puntosReunionMap, puestosExistentes = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets['Empleados'];
        if (!ws) { reject(new Error('No se encontro la hoja "Empleados".')); return; }
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!raw.length) { reject(new Error('La hoja "Empleados" esta vacia.')); return; }
        const enc = raw[0].map(h => norm(h));
        for (let i = 0; i < EMP_HEADERS.length; i++) {
          if (enc[i] !== EMP_HEADERS[i]) {
            reject(new Error(`Encabezado incorrecto en col ${String.fromCharCode(65+i)}: esperado "${EMP_HEADERS[i]}", encontrado "${enc[i]||'(vacio)'}"`));
            return;
          }
        }
        const nominasSeen = new Map();
        const resultado = [];
        // Conteo de puestos nuevos para el resumen
        const puestosNuevosSet = new Set();
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i]; const filaExcel = i + 1;
          const nomina = norm(row[0]); const nombre = norm(row[1]);
          const puesto = norm(row[2]); const claveParada = norm(row[3]);
          const datos = { NOMINA: nomina, NOMBRE: nombre, PUESTO: puesto, 'CLAVE PARADA': claveParada };
          if (!nomina && !nombre && !puesto && !claveParada) continue;
          const errores = []; const advertencias = [];
          if (!nomina) errores.push('NOMINA obligatoria');
          else if (!/^\d+$/.test(nomina)) errores.push(`NOMINA "${nomina}" no es numerica`);
          else if (nominasSeen.has(nomina)) errores.push(`NOMINA "${nomina}" duplicada (fila ${nominasSeen.get(nomina)})`);
          else nominasSeen.set(nomina, filaExcel);
          if (!nombre) errores.push('NOMBRE obligatorio');
          if (!puesto) errores.push('PUESTO obligatorio');
          // Analizar puesto vs lista existente
          let puestoNuevo = false;
          let puestoSimilar = null;
          if (puesto && puestosExistentes.length > 0) {
            const { exacto, similares } = buscarCoincidencias(puesto, puestosExistentes);
            if (!exacto && !puestosExistentes.includes(puesto)) {
              puestoNuevo = true;
              puestosNuevosSet.add(puesto);
              if (similares.length > 0) {
                puestoSimilar = similares[0];
                advertencias.push(`Puesto nuevo "${puesto}" similar a "${similares[0]}"`);
              }
            }
          }
          let paradaInfo = null;
          if (claveParada) {
            if (!puntosReunionMap || puntosReunionMap.size === 0) advertencias.push(`CLAVE PARADA "${claveParada}": directorio vacio`);
            else if (!puntosReunionMap.has(claveParada)) advertencias.push(`CLAVE PARADA "${claveParada}" no existe`);
            else paradaInfo = puntosReunionMap.get(claveParada);
          }
          if (errores.length) resultado.push({ filaExcel, estado: 'error', mensaje: errores.join('. '), datos, paradaInfo, puestoNuevo, puestoSimilar });
          else if (advertencias.length) resultado.push({ filaExcel, estado: 'advertencia', mensaje: advertencias.join('. '), datos, paradaInfo, puestoNuevo, puestoSimilar });
          else resultado.push({ filaExcel, estado: 'valido', mensaje: '', datos, paradaInfo, puestoNuevo: false, puestoSimilar: null });
        }
        resolve(resultado);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Guardado Firestore ────────────────────────────────────────────────────
async function guardarDirectorio(filas) {
  const validas = filas.filter(f => f.estado === 'valido');
  const existingPaths = new Set();
  try {
    const snaps = await Promise.all([getDocs(collection(db,'rutas')), getDocs(collection(db,'comunidades')), getDocs(collection(db,'puntosReunion'))]);
    snaps.forEach(s => s.docs.forEach(d => existingPaths.add(d.ref.path)));
  } catch { /* continua */ }
  let batch = writeBatch(db); let count = 0; let creados = 0; let actualizados = 0; const commits = [];
  for (const fila of validas) {
    const { RUTA, COMUNIDAD } = fila.datos;
    const puntoNombre = fila.datos['PUNTO DE REUNION'];
    const CLAVE = fila.datos['CLAVE'];
    const rutaId = slugify(RUTA); const comunidadId = `${slugify(RUTA)}__${slugify(COMUNIDAD)}`;
    const rutaRef = doc(db, 'rutas', rutaId);
    batch.set(rutaRef, { nombre: RUTA, activo: true }, { merge: true });
    existingPaths.has(rutaRef.path) ? actualizados++ : creados++;
    const comRef = doc(db, 'comunidades', comunidadId);
    batch.set(comRef, { nombre: COMUNIDAD, rutaId, activo: true }, { merge: true });
    if (!existingPaths.has(comRef.path)) creados++;
    const puntoRef = doc(db, 'puntosReunion', CLAVE);
    batch.set(puntoRef, { nombre: puntoNombre, clave: CLAVE, comunidadId, rutaId, activo: true }, { merge: true });
    if (!existingPaths.has(puntoRef.path)) creados++;
    count += 3;
    if (count >= 498) { commits.push(batch.commit()); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
  return { creados, actualizados, omitidos: filas.filter(f => f.estado === 'error').length };
}

async function guardarEmpleados(filas) {
  const importables = filas.filter(f => f.estado === 'valido' || f.estado === 'advertencia');
  const existingSnap = await getDocs(collection(db, 'empleados')).catch(() => ({ docs: [] }));
  const existingIds = new Set(existingSnap.docs.map(d => d.id));
  let batch = writeBatch(db); let count = 0; let creados = 0; let actualizados = 0; const commits = [];
  for (const fila of importables) {
    const { NOMINA, NOMBRE, PUESTO } = fila.datos;
    const nominaStr = String(NOMINA);
    const empRef = doc(db, 'empleados', nominaStr);
    const payload = { nomina: nominaStr, nombre: NOMBRE, nombreLower: normLower(NOMBRE), puesto: PUESTO, activo: true };
    if (fila.paradaInfo) { payload.rutaId = fila.paradaInfo.rutaId; payload.comunidadId = fila.paradaInfo.comunidadId; payload.puntoReunionId = fila.paradaInfo.clave; }
    batch.set(empRef, payload, { merge: true });
    existingIds.has(nominaStr) ? actualizados++ : creados++;
    count++;
    if (count >= 500) { commits.push(batch.commit()); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) commits.push(batch.commit());
  await Promise.all(commits);
  return { creados, actualizados, omitidos: filas.filter(f => f.estado === 'error').length, advertencias: filas.filter(f => f.estado === 'advertencia').length };
}

// ── Componentes compartidos ───────────────────────────────────────────────
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)]';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer';
const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';

function ModalBase({ titulo, onClose, children }) {
  return (
    <Modal isOpen={true} onClose={onClose} title={titulo} maxWidth="max-w-lg">
      {children}
    </Modal>
  );
}

function AlertError({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}

function AlertSuccess({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-color)]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-xs text-[var(--text-secondary)] text-center">{msg}</p>
    </div>
  );
}

// ── Tab Rutas ─────────────────────────────────────────────────────────────
function TabRutas({ rutas, comunidades, puntos, reload }) {
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null); // null | { modo: 'crear'|'editar', ruta? }
  const [form, setForm] = useState({ nombre: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const filtradas = rutas.filter(r => !busqueda || r.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  const abrirCrear = () => { setForm({ nombre: '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (r) => { setForm({ nombre: r.nombre }); setError(''); setExito(''); setModal({ modo: 'editar', ruta: r }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = slugify(nombre);
        const existe = rutas.find(r => r.id === id);
        if (existe) { setError('Ya existe una ruta con ese nombre.'); return; }
        await setDoc(doc(db, 'rutas', id), { nombre, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'rutas', modal.ruta.id), { nombre });
      }
      setExito(modal.modo === 'crear' ? 'Ruta creada correctamente.' : 'Ruta actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (r) => {
    const comsDep = comunidades.filter(c => c.rutaId === r.id).length;
    const ptosDep = puntos.filter(p => p.rutaId === r.id).length;
    const accion = r.activo !== false ? 'desactivar' : 'activar';
    let msg = `¿Deseas ${accion} la ruta "${r.nombre}"?`;
    if (r.activo !== false && (comsDep || ptosDep)) msg += ` Dependen de ella ${comsDep} comunidad(es) y ${ptosDep} punto(s).`;
    if (!confirm(msg)) return;
    await updateDoc(doc(db, 'rutas', r.id), { activo: r.activo === false });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtradas.length} ruta(s)</span>
          <button type="button" onClick={abrirCrear} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nueva ruta
          </button>
        </div>
      </div>

      {filtradas.length === 0
        ? <EmptyState icon={Navigation} msg="No hay rutas. Use 'Nueva ruta' o 'Importar directorio'." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nombre de la ruta</th>
                  <th className="px-4 py-3 w-24 text-center">Comunidades</th>
                  <th className="px-4 py-3 w-20 text-center">Puntos</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtradas.map(r => {
                  const nComs = comunidades.filter(c => c.rutaId === r.id).length;
                  const nPtos = puntos.filter(p => p.rutaId === r.id).length;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{r.nombre}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nComs}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nPtos}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {r.activo !== false ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(r)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(r)} className={btnIcon} title={r.activo !== false ? 'Desactivar' : 'Activar'}>
                            {r.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nueva ruta' : 'Editar ruta'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre de la ruta</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: RUTA NORTE" />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">El ID no cambia al editar; solo el nombre visible.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear ruta' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Tab Comunidades ───────────────────────────────────────────────────────
function TabComunidades({ comunidades, rutas, puntos, reload }) {
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(r => r.activo !== false);
  const filtradas = comunidades.filter(c => !busqueda ||
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === c.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirCrear = () => { setForm({ nombre: '', rutaId: rutasActivas[0]?.id ?? '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (c) => { setForm({ nombre: c.nombre, rutaId: c.rutaId }); setError(''); setExito(''); setModal({ modo: 'editar', com: c }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    const rutaId = form.rutaId;
    if (!nombre || !rutaId) { setError('Nombre y ruta son obligatorios.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = `${rutaId}__${slugify(nombre)}`;
        await setDoc(doc(db, 'comunidades', id), { nombre, rutaId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'comunidades', modal.com.id), { nombre, rutaId });
      }
      setExito(modal.modo === 'crear' ? 'Comunidad creada.' : 'Comunidad actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (c) => {
    const accion = c.activo !== false ? 'desactivar' : 'activar';
    const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
    if (!confirm(`¿${accion} la comunidad "${c.nombre}" de ruta "${rutaNombre}"?`)) return;
    await updateDoc(doc(db, 'comunidades', c.id), { activo: c.activo === false });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar comunidad o ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtradas.length} comunidad(es)</span>
          <button type="button" onClick={abrirCrear} disabled={rutasActivas.length === 0} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nueva comunidad
          </button>
        </div>
      </div>
      {rutasActivas.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Primero crea al menos una ruta activa antes de agregar comunidades.</span>
        </div>
      )}
      {filtradas.length === 0
        ? <EmptyState icon={MapPin} msg="No hay comunidades. Cree una o importe el directorio." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Comunidad</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3 w-20 text-center">Puntos</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtradas.map(c => {
                  const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
                  const nPtos = puntos.filter(p => p.comunidadId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{rutaNombre}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nPtos}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {c.activo !== false ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(c)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(c)} className={btnIcon} title={c.activo !== false ? 'Desactivar' : 'Activar'}>
                            {c.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nueva comunidad' : 'Editar comunidad'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ruta</label>
              <select required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar ruta...</option>
                {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre de la comunidad</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: COLONIA SAN PEDRO" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Tab Puntos ────────────────────────────────────────────────────────────
function TabPuntos({ puntos, comunidades, rutas, reload }) {
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '', comunidadId: '', clave: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(r => r.activo !== false);
  const comsDeRuta = comunidades.filter(c => c.rutaId === form.rutaId && c.activo !== false);

  const filtrados = puntos.filter(p => !busqueda ||
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.clave?.toLowerCase().includes(busqueda.toLowerCase()) ||
    comunidades.find(c => c.id === p.comunidadId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === p.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const generarClave = (rutaId, comunidadId) => {
    const ruta = rutas.find(r => r.id === rutaId);
    const com = comunidades.find(c => c.id === comunidadId);
    if (!ruta || !com) return '';
    const iniciales = ruta.nombre.split(' ').map(w => w[0] ?? '').join('').slice(0, 3).toUpperCase();
    const existentes = puntos.filter(p => p.comunidadId === comunidadId).length;
    return `${iniciales}${String(existentes + 1).padStart(2, '0')}`;
  };

  const abrirCrear = () => {
    const rutaId = rutasActivas[0]?.id ?? '';
    const comsInit = comunidades.filter(c => c.rutaId === rutaId && c.activo !== false);
    const comunidadId = comsInit[0]?.id ?? '';
    setForm({ nombre: '', rutaId, comunidadId, clave: '' });
    setError(''); setExito(''); setModal({ modo: 'crear' });
  };
  const abrirEditar = (p) => { setForm({ nombre: p.nombre, rutaId: p.rutaId, comunidadId: p.comunidadId, clave: p.clave }); setError(''); setExito(''); setModal({ modo: 'editar', punto: p }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const { nombre, rutaId, comunidadId, clave } = form;
    if (!nombre.trim() || !rutaId || !comunidadId) { setError('Nombre, ruta y comunidad son obligatorios.'); return; }
    const claveReal = (clave.trim() || generarClave(rutaId, comunidadId)).toUpperCase();
    if (!claveReal) { setError('No se pudo generar la clave. Ingresela manualmente.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const existe = puntos.find(p => p.clave === claveReal);
        if (existe) { setError(`La clave "${claveReal}" ya existe.`); return; }
        await setDoc(doc(db, 'puntosReunion', claveReal), { nombre: nombre.trim().toUpperCase(), clave: claveReal, rutaId, comunidadId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'puntosReunion', modal.punto.id), { nombre: nombre.trim().toUpperCase(), rutaId, comunidadId });
      }
      setExito(modal.modo === 'crear' ? `Punto creado con clave ${claveReal}.` : 'Punto actualizado.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1400);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (p) => {
    const accion = p.activo !== false ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion} el punto "${p.nombre}" (clave: ${p.clave})?`)) return;
    await updateDoc(doc(db, 'puntosReunion', p.id), { activo: p.activo === false });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar punto, clave, comunidad o ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtrados.length} punto(s)</span>
          <button type="button" onClick={abrirCrear} disabled={rutasActivas.length === 0} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nuevo punto
          </button>
        </div>
      </div>
      {filtrados.length === 0
        ? <EmptyState icon={MapPin} msg="No hay puntos de reunion. Cree uno o importe el directorio." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-20">Clave</th>
                  <th className="px-4 py-3">Nombre del punto</th>
                  <th className="px-4 py-3">Comunidad</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtrados.map(p => {
                  const comNombre = comunidades.find(c => c.id === p.comunidadId)?.nombre ?? p.comunidadId;
                  const rutaNombre = rutas.find(r => r.id === p.rutaId)?.nombre ?? p.rutaId;
                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-[var(--cm-red)]">{p.clave}</td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{comNombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{rutaNombre}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {p.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(p)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(p)} className={btnIcon} title={p.activo !== false ? 'Desactivar' : 'Activar'}>
                            {p.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nuevo punto de reunion' : 'Editar punto de reunion'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ruta</label>
                <select required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value, comunidadId: '' }))} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Comunidad</label>
                <select required value={form.comunidadId} onChange={e => setForm(f => ({ ...f, comunidadId: e.target.value }))} className={inputCls} disabled={!form.rutaId}>
                  <option value="">Seleccionar...</option>
                  {comsDeRuta.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre del punto</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: PARQUE CENTRAL" />
            </div>
            {modal.modo === 'crear' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Clave <span className="text-[var(--text-muted)]">(dejar vacío para generar automáticamente)</span>
                </label>
                <input value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} className={inputCls} placeholder="Ej: SN01" maxLength={10} />
                {form.rutaId && form.comunidadId && !form.clave && (
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Se generará: <strong>{generarClave(form.rutaId, form.comunidadId)}</strong>
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear punto' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Modal de importacion ──────────────────────────────────────────────────
function ModalImportacion({ tipo, onClose, onImportado }) {
  const esDir = tipo === 'directorio';
  const titulo = esDir ? 'Importar directorio de transporte' : 'Importar empleados';
  const descripcion = esDir
    ? 'Carga masiva de rutas, comunidades y puntos desde un .xlsx con formato fijo.'
    : 'Carga masiva del padron de empleados desde un .xlsx con formato fijo.';
  const colsInfo = esDir ? DIR_COLS_INFO : EMP_COLS_INFO;
  const nombreHoja = esDir ? 'Directorio' : 'Empleados';

  const fileRef = useRef(null);
  const [paso, setPaso] = useState('inicio');
  const [parseando, setParseando] = useState(false);
  const [errorParse, setErrorParse] = useState('');
  const [filas, setFilas] = useState([]);
  const [alertaDirectorio, setAlertaDirectorio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [puntosMap, setPuntosMap] = useState(null);
  const [puestosExistentes, setPuestosExistentes] = useState([]);
  const [expandirInstr, setExpandirInstr] = useState(false);

  useEffect(() => {
    if (!esDir) {
      // Cargar puntos de reunion
      getDocs(collection(db, 'puntosReunion'))
        .then(snap => {
          if (snap.empty) { setAlertaDirectorio(true); setPuntosMap(new Map()); }
          else { const m = new Map(); snap.docs.forEach(d => m.set(d.id, { clave: d.id, ...d.data() })); setPuntosMap(m); }
        })
        .catch(() => setPuntosMap(new Map()));
      // Cargar puestos existentes del padron
      getDocs(collection(db, 'empleados'))
        .then(snap => {
          const lista = [...new Set(snap.docs.map(d => d.data().puesto).filter(Boolean))].sort();
          setPuestosExistentes(lista);
        })
        .catch(() => {});
    }
  }, [esDir]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setErrorParse(''); setParseando(true);
    try {
      const parsed = esDir
        ? await parsearDirectorio(file)
        : await parsearEmpleados(file, puntosMap ?? new Map(), puestosExistentes);
      setFilas(parsed); setPaso('previa');
    } catch (err) { setErrorParse(err.message); }
    finally { setParseando(false); }
  }, [esDir, puntosMap, puestosExistentes]);

  const handleConfirmar = async () => {
    setGuardando(true); setPaso('guardando');
    try {
      const res = esDir ? await guardarDirectorio(filas) : await guardarEmpleados(filas);
      setResultado(res); setPaso('resultado'); onImportado?.();
    } catch (err) { setErrorParse(`Error al guardar: ${err.message}`); setPaso('previa'); }
    finally { setGuardando(false); }
  };

  const validas = filas.filter(f => f.estado === 'valido');
  const advertencias = filas.filter(f => f.estado === 'advertencia');
  const errores = filas.filter(f => f.estado === 'error');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity" onClick={(e) => { if(e.target===e.currentTarget && paso!=='guardando') onClose(); }}>
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden text-[var(--text-main)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--cm-red-light)] flex-shrink-0 mt-0.5">
              <FileSpreadsheet className="h-5 w-5 text-[var(--cm-red)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">{titulo}</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-xl">{descripcion}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={btnIcon}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {!esDir && alertaDirectorio && (
            <div className="flex items-start gap-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning-text)]">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span><strong>Directorio vacio.</strong> Se recomienda importar primero el directorio. Los empleados con CLAVE PARADA se importaran sin parada.</span>
            </div>
          )}
          <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
            <button type="button" onClick={() => setExpandirInstr(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-secondary)] text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors active:scale-95 cursor-pointer">
              <span className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />Instrucciones de uso</span>
              {expandirInstr ? <ChevronUp className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
            </button>
            {expandirInstr && (
              <div className="px-4 py-3 text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Descargue el formato en blanco.</li>
                  <li>Llene la hoja <strong>{nombreHoja}</strong> a partir de la fila 2 sin modificar encabezados.</li>
                  <li>Guarde como <strong>.xlsx</strong>.</li>
                  <li>Seleccione el archivo y revise la vista previa.</li>
                </ol>
              </div>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr><th className="px-3 py-2 w-8">Col.</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2 w-24">Requerido</th><th className="px-3 py-2">Ejemplo</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {colsInfo.map(col => (
                  <tr key={col.letra} className="hover:bg-[var(--bg-surface-secondary)]">
                    <td className="px-3 py-2 font-mono font-bold text-[var(--cm-red)]">{col.letra}</td>
                    <td className="px-3 py-2 font-semibold text-[var(--text-main)]">{col.nombre}</td>
                    <td className="px-3 py-2">
                      {col.obligatorio
                        ? <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--status-error-bg)] text-[var(--status-error-text)]  ">Obligatoria</span>
                        : <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--bg-surface-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">Opcional</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{col.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)]" />
            <span>Si ya existen registros con los mismos identificadores, se actualizan. No se crean duplicados.</span>
          </div>
          {errorParse && <AlertError msg={errorParse} />}
          {paso === 'previa' && filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-success-bg)] border border-[var(--status-success-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-success-text)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />{validas.length} validas
                </span>
                {advertencias.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-warning-text)]"><AlertTriangle className="h-3.5 w-3.5" />{advertencias.length} advertencias</span>}
                {errores.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-error-bg)] border border-[var(--status-error-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-error-text)]"><X className="h-3.5 w-3.5" />{errores.length} errores</span>}
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--border-color)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 w-16">Fila</th><th className="px-3 py-2 w-20">Estado</th>
                      {Object.keys(filas[0]?.datos ?? {}).map(k => <th key={k} className="px-3 py-2 whitespace-nowrap">{k}</th>)}
                      <th className="px-3 py-2">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filas.map(fila => (
                      <tr key={fila.filaExcel} className={fila.estado === 'error' ? 'bg-[var(--status-error-bg)]' : fila.estado === 'advertencia' ? 'bg-[var(--status-warning-bg)]' : 'hover:bg-[var(--bg-surface-secondary)]'}>
                        <td className="px-3 py-2 font-mono text-[var(--text-muted)]">{fila.filaExcel}</td>
                        <td className="px-3 py-2">
                          {fila.estado === 'valido' && <span className="inline-flex items-center gap-1 text-[var(--status-success-text)] font-semibold"><CheckCircle2 className="h-3 w-3" />Ok</span>}
                          {fila.estado === 'advertencia' && <span className="inline-flex items-center gap-1 text-[var(--status-warning-text)] font-semibold"><AlertTriangle className="h-3 w-3" />Aviso</span>}
                          {fila.estado === 'error' && <span className="inline-flex items-center gap-1 text-[var(--status-error-text)] font-semibold"><X className="h-3 w-3" />Error</span>}
                        </td>
                        {Object.entries(fila.datos).map(([k, v], vi) => (
                          <td key={vi} className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate text-[var(--text-main)]">
                            {/* Columna PUESTO: mostrar badge si es nuevo/similar */}
                            {!esDir && k === 'PUESTO' && fila.puestoNuevo ? (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">{v}</span>
                                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                                  {fila.puestoSimilar ? `~${fila.puestoSimilar}` : 'Nuevo'}
                                </span>
                              </span>
                            ) : v}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[220px]">{fila.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {paso === 'guardando' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cm-red)]" />
              <p className="text-sm text-[var(--text-secondary)]">Guardando en la base de datos...</p>
            </div>
          )}
          {paso === 'resultado' && resultado && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--status-success-text)] mt-0.5" />
                <div className="text-xs text-[var(--status-success-text)]">
                  <p className="font-bold text-sm mb-1">Importacion completada</p>
                  <ul className="space-y-0.5">
                    <li><strong>Creados:</strong> {resultado.creados}</li>
                    <li><strong>Actualizados:</strong> {resultado.actualizados}</li>
                    <li><strong>Omitidos (error):</strong> {resultado.omitidos}</li>
                    {resultado.advertencias != null && <li><strong>Advertencias:</strong> {resultado.advertencias}</li>}
                  </ul>
                </div>
              </div>
              {(errores.length > 0 || advertencias.length > 0) && (
                <button type="button" onClick={() => descargarReporteErrores(filas, esDir ? 'Directorio' : 'Empleados')} className={btnSecondary}>
                  <Download className="h-4 w-4" />Descargar reporte de errores
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-6 py-4 flex-shrink-0 bg-[var(--bg-surface-secondary)]">
          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={() => esDir ? generarFormatoDirectorio() : generarFormatoEmpleados(puestosExistentes)}
              className={btnSecondary}>
              <Download className="h-3.5 w-3.5 text-[var(--text-secondary)]" />Descargar formato en blanco
            </button>
            {paso !== 'resultado' && paso !== 'guardando' && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={parseando || (!esDir && puntosMap === null)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--cm-red)] bg-[var(--cm-red-light)] px-3 py-2 text-xs font-semibold text-[var(--cm-red)] hover:bg-[var(--cm-red)] hover:text-white active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
                  {parseando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {parseando ? 'Leyendo...' : 'Seleccionar archivo (.xlsx)'}
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {paso === 'previa' && (validas.length + advertencias.length) > 0 && (
              <button type="button" onClick={handleConfirmar} disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirmar ({validas.length + advertencias.length} filas)
              </button>
            )}
            <button type="button" onClick={onClose} className={btnSecondary}>
              {paso === 'resultado' ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function RhCatalogos() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('rutas');
  const [modalTipo, setModalTipo] = useState(null);

  const [rutas, setRutas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [rev, setRev] = useState(0); // fuerza recarga

  const reload = () => setRev(v => v + 1);

  useEffect(() => {
    setCargando(true); setErrorCarga('');
    Promise.all([
      getDocs(collection(db, 'rutas')),
      getDocs(collection(db, 'comunidades')),
      getDocs(collection(db, 'puntosReunion')),
    ])
      .then(([rutasSnap, comsSnap, ptsSnap]) => {
        setRutas(rutasSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setComunidades(comsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setPuntos(ptsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.clave ?? '').localeCompare(b.clave ?? '')));
      })
      .catch(err => setErrorCarga('Error al cargar datos: ' + err.message))
      .finally(() => setCargando(false));
  }, [rev]);

  const puedeCargarMasivo = usuario?.rol === 'admin' || usuario?.rol === 'rh';

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recursos Humanos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Catalogos</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Administracion de rutas, comunidades y puntos de reunion</p>
        </div>
        {puedeCargarMasivo && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] hidden sm:block">Carga masiva:</span>
            <button type="button" id="btn-importar-directorio" onClick={() => setModalTipo('directorio')} className={btnSecondary}>
              <Upload className="h-4 w-4 text-[var(--text-secondary)]" />Importar directorio
            </button>
            <button type="button" id="btn-importar-empleados" onClick={() => setModalTipo('empleados')} className={btnSecondary}>
              <Users className="h-4 w-4 text-[var(--text-secondary)]" />Importar empleados
            </button>
          </div>
        )}
      </div>

      {errorCarga && <AlertError msg={errorCarga} />}

      {/* Tabs */}
      <div className="border-b border-[var(--border-color)]">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const activa = tabActiva === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setTabActiva(tab.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${activa ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--border-color)]'}`}>
                <Icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido */}
      <div className="min-h-[200px]">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Cargando catalogos...</span>
          </div>
        ) : (
          <>
            {tabActiva === 'rutas' && <TabRutas rutas={rutas} comunidades={comunidades} puntos={puntos} reload={reload} />}
            {tabActiva === 'comunidades' && <TabComunidades comunidades={comunidades} rutas={rutas} puntos={puntos} reload={reload} />}
            {tabActiva === 'puntos' && <TabPuntos puntos={puntos} comunidades={comunidades} rutas={rutas} reload={reload} />}
            {tabActiva === 'herramientas' && <RevisarColecciones />}
          </>
        )}
      </div>

      {/* Modal importacion */}
      {modalTipo && <ModalImportacion tipo={modalTipo} onClose={() => { setModalTipo(null); reload(); }} onImportado={reload} />}
    </div>
  );
}
