// Genera los Excel de prueba de la resolución de puestos en scripts/salida/ (formato del reporte de nómina).
// Uso: node scripts/generar-excel-prueba.mjs
import { mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { ENCABEZADOS_NOMINA } from '../src/utils/formatosImportacion.js';

mkdirSync('scripts/salida', { recursive: true });

async function libro(archivo, filas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.addRow(ENCABEZADOS_NOMINA);
  filas.forEach(f => ws.addRow(f));
  await wb.xlsx.writeFile(`scripts/salida/${archivo}`);
  console.log('creado scripts/salida/' + archivo);
}

const fila = (nomina, nombre, depto, puesto) => [nomina, nombre, depto, 'PRUEBA', 'A', puesto, 'G1', '2024-01-15'];

// 1ª importación: corrección automática, corrección propuesta, puestos nuevos e inventado
await libro('Prueba_Puestos_1.xlsx', [
  fila(90001, 'PRUEBA AUTOMATICA UNO', '316', '  production   operator    _x0002_'), // nivel a: espacios + _x0002_ + minúsculas
  fila(90002, 'PRUEBA PROPUESTA DOS', '323', 'FORKLIF OPERATOR'),                      // nivel b: una letra mal
  fila(90003, 'PRUEBA NUEVO TRES', '472', 'PRUEBA A1'),                                // nivel c: puesto nuevo (agrégalo)
  fila(90004, 'PRUEBA NUEVO CUATRO', '472', 'PRUEBA A2'),                              // nivel c: puesto nuevo (agrégalo)
  fila(90005, 'PRUEBA INVENTADO CINCO', '999', 'ZZ PUESTO INVENTADO'),                 // nivel c: "Es igual a…" u omitir
]);

// 2ª importación (después de la 1ª): PRUEBA A3 está a 1 letra de PRUEBA A1 y de PRUEBA A2 → ambiguo, no se propone
await libro('Prueba_Puestos_2.xlsx', [
  fila(90006, 'PRUEBA AMBIGUO SEIS', '472', 'PRUEBA A3'),
]);
