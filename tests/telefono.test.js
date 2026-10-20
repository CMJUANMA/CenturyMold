// Teléfono del empleado: limpieza, validación y formato (src/utils/telefono.js)
import { describe, expect, it } from 'vitest';
import { estadoTelefono, formatoTelefono, soloDigitosTelefono, telefonoValido } from '../src/utils/telefono.js';

describe('teléfono del empleado', () => {
  it('deja solo los dígitos y quita la lada de México', () => {
    expect(soloDigitosTelefono('(442) 123-4567')).toBe('4421234567');
    expect(soloDigitosTelefono('442 123 4567')).toBe('4421234567');
    expect(soloDigitosTelefono('+52 442 123 4567')).toBe('4421234567');
    expect(soloDigitosTelefono('+52 1 442 123 4567')).toBe('4421234567');
    expect(soloDigitosTelefono(4421234567)).toBe('4421234567');
    expect(soloDigitosTelefono(null)).toBe('');
    expect(soloDigitosTelefono('  ')).toBe('');
  });
  it('válido solo con 10 dígitos', () => {
    expect(telefonoValido('4421234567')).toBe(true);
    for (const malo of ['442123456', '44212345678', '', '442-123-4567', null]) expect(telefonoValido(malo)).toBe(false);
  });
  it('estado de lo capturado: vacío, incompleto o válido', () => {
    expect(estadoTelefono('')).toBe('vacio');
    expect(estadoTelefono(' ')).toBe('vacio');
    expect(estadoTelefono('442 123')).toBe('incompleto');
    expect(estadoTelefono('442 123 4567')).toBe('valido');
  });
  it('se muestra como 442 123 4567; lo incompleto, tal cual', () => {
    expect(formatoTelefono('4421234567')).toBe('442 123 4567');
    expect(formatoTelefono('')).toBe('');
    expect(formatoTelefono('442')).toBe('442');
  });
});

// ── Importación: columna TELÉFONO del formato propio ──────────────────────
import ExcelJS from 'exceljs';
import { EMP_HEADERS, HOJA_EMP, construirFormatoEmpleados, leerEmpleados } from '../src/utils/formatosImportacion.js';
import { compararEmpleados } from '../src/utils/comparacionImportacion.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

const libro = async (filas, encabezados = EMP_HEADERS) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(HOJA_EMP);
  ws.addRow(encabezados);
  filas.forEach(f => ws.addRow(f));
  return wb.xlsx.writeBuffer();
};
const plan = async (filas, { existentes = [], telefonos = new Map(), encabezados } = {}) => compararEmpleados(
  await leerEmpleados(await libro(filas, encabezados), new Map()), existentes, { catalogo: PUESTOS_INICIALES, areas: AREAS_INICIALES, telefonos },
);
const existente = { id: '7219', nomina: '7219', nombre: 'PEREZ JUAN', puesto: 'PRODUCTION OPERATOR', puestoId: 'production-operator', areaId: 'produccion', areaExcepcion: null, areaExcepcionMotivo: '', activo: true };

describe('importación: columna TELÉFONO', () => {
  it('la plantilla trae TELÉFONO como columna opcional', async () => {
    expect(EMP_HEADERS).toEqual(['NOMINA', 'NOMBRE', 'PUESTO', 'CLAVE PARADA', 'TELÉFONO']);
    const wb = construirFormatoEmpleados([]);
    const ws = wb.getWorksheet(HOJA_EMP);
    expect(ws.getRow(1).getCell(5).value).toBe('TELÉFONO');
  });
  it('un empleado nuevo con teléfono lo lleva en el plan (limpio, a la colección aparte, no al empleado)', async () => {
    const p = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '(442) 123-4567']]);
    expect(p.items[0].accion).toBe('crear');
    expect(p.items[0].telefono).toBe('4421234567');
    expect(p.items[0].datos.telefono).toBeUndefined();
  });
  it('un archivo anterior, sin la columna TELÉFONO, se sigue leyendo', async () => {
    const p = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '']], { encabezados: EMP_HEADERS.slice(0, 4) });
    expect(p.items[0].accion).toBe('crear');
    expect(p.items[0].telefono).toBeNull();
  });
  it('acepta el encabezado sin acento (TELEFONO)', async () => {
    const p = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '4421234567']], { encabezados: ['NOMINA', 'NOMBRE', 'PUESTO', 'CLAVE PARADA', 'TELEFONO'] });
    expect(p.items[0].telefono).toBe('4421234567');
  });
  it('teléfono vacío: no borra el que ya tiene (sin cambios)', async () => {
    const p = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '']], { existentes: [existente], telefonos: new Map([['7219', '4429990000']]) });
    expect(p.items[0].accion).toBe('sinCambios');
    expect(p.items[0].telefono).toBeNull();
  });
  it('teléfono distinto: es un cambio con antes y después; igual: sin cambios', async () => {
    const cambia = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '4421234567']], { existentes: [existente], telefonos: new Map([['7219', '4429990000']]) });
    expect(cambia.items[0].accion).toBe('actualizar');
    expect(cambia.items[0].cambios).toEqual([{ campo: 'TELÉFONO', antes: '4429990000', despues: '4421234567' }]);
    expect(cambia.items[0].telefono).toBe('4421234567');
    const igual = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '442 123 4567']], { existentes: [existente], telefonos: new Map([['7219', '4421234567']]) });
    expect(igual.items[0].accion).toBe('sinCambios');
  });
  it('un teléfono de menos de 10 dígitos se avisa y no se importa; lo demás de la fila sí', async () => {
    const filas = await leerEmpleados(await libro([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '442123']]), new Map());
    expect(filas[0].estado).toBe('advertencia');
    expect(filas[0].mensaje).toContain('TELEFONO');
    expect(filas[0].datos.TELEFONO).toBe('');
    const p = await plan([[7219, 'PEREZ JUAN', 'PRODUCTION OPERATOR', '', '442123']]);
    expect(p.items[0].telefono).toBeNull();
  });
});
