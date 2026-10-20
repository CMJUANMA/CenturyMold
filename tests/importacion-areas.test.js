// Importación del padrón: hojas del libro, celdas vacías, puestos con letra mal, áreas con excepciones
// y cambio de área por puesto. Todos los datos son ficticios y los libros se arman en memoria.
// Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ENCABEZADOS_NOMINA, construirReporteImportacion, leerEmpleados, leerEmpleadosArchivo,
} from '../src/utils/formatosImportacion.js';
import { compararEmpleados } from '../src/utils/comparacionImportacion.js';
import {
  GRUPO_SIN_AREA, agruparPorArea, impactoPuesto, resumenImportacion, resumenLista, todoConfirmado,
} from '../src/utils/areasImportacion.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

const catalogo = PUESTOS_INICIALES;
const areas = AREAS_INICIALES;

/** Libro con varias hojas; `hojas` = [{ nombre, filas }] (la primera fila de cada una son sus encabezados) */
async function libro(hojas) {
  const wb = new ExcelJS.Workbook();
  for (const { nombre, filas } of hojas) {
    const ws = wb.addWorksheet(nombre);
    filas.forEach(f => ws.addRow(f));
  }
  return wb.xlsx.writeBuffer();
}
const nomina = (filas) => [ENCABEZADOS_NOMINA, ...filas];
const FILAS = [
  [11, 'MALDONADO SALVADOR', '317', 'CALIDAD', 'A', 'QUALITY MANAGER', 'G1', '15/03/2010'],
  [7219, 'PEREZ JUAN', '316', 'MOLDEO', 'B', 'PRODUCTION OPERATOR _x0002_', 'G2', '06/01/2020'],
  [50001, 'LOPEZ ANA', '316', 'MOLDEO', 'C', 'PRODUCTION OPERATER', 'G2', null], // una letra mal
  [50002, 'RUIZ LUIS', '323', 'ALMACEN', 'A', 'FORKLIFT OPERATOR', 'G2', null],
  [50003, 'VEGA TOMAS', '999', 'NUEVO', 'A', 'DATA SCIENTIST', 'G2', null], // puesto nuevo
];

describe('libro con varias hojas', () => {
  const hojasBase = [
    { nombre: 'Comparativo', filas: [['concepto', 'valor'], ['total', 177]] },
    { nombre: 'Niveles Autorización', filas: [['nivel', 'descripcion'], ['G1', 'Directivo']] },
  ];

  it('usa sola la única hoja con los encabezados de nómina y dice cuál leyó y cuántas filas', async () => {
    const buffer = await libro([...hojasBase, { nombre: 'ND38QU', filas: nomina(FILAS) }]);
    const { filas, meta } = await leerEmpleadosArchivo(buffer, new Map());
    expect(meta).toMatchObject({ formato: 'nomina', hoja: 'ND38QU', filasHoja: FILAS.length, requiereHoja: false, candidatas: ['ND38QU'] });
    expect(meta.hojas).toEqual(['Comparativo', 'Niveles Autorización', 'ND38QU']);
    expect(filas).toHaveLength(FILAS.length);
    expect(filas.find(f => f.datos.NOMINA === '11').datos.NOMBRE).toBe('MALDONADO SALVADOR'); // nómina corta, como texto
  });

  it('con dos hojas candidatas no adivina: pide elegir, y lee la elegida', async () => {
    const buffer = await libro([
      { nombre: 'Enero', filas: nomina(FILAS.slice(0, 2)) },
      ...hojasBase,
      { nombre: 'Febrero', filas: nomina(FILAS.slice(0, 4)) },
    ]);
    const sinElegir = await leerEmpleadosArchivo(buffer, new Map());
    expect(sinElegir.meta.requiereHoja).toBe(true);
    expect(sinElegir.meta.candidatas).toEqual(['Enero', 'Febrero']);
    expect(sinElegir.filas).toEqual([]);
    const elegida = await leerEmpleadosArchivo(buffer, new Map(), { hoja: 'Febrero' });
    expect(elegida.meta).toMatchObject({ hoja: 'Febrero', filasHoja: 4, requiereHoja: false });
  });

  it('si ninguna hoja coincide, el error lista las hojas y los encabezados esperados', async () => {
    const buffer = await libro(hojasBase);
    const error = await leerEmpleados(buffer, new Map()).catch(e => e.message);
    expect(error).toContain('Comparativo, Niveles Autorización');
    expect(error).toContain('numero_i');
    expect(error).toContain('NOMINA');
  });
});

describe('puesto con una letra mal pasando por compararEmpleados', () => {
  const planDe = async (decisiones = new Map(), existentes = []) => compararEmpleados(
    await leerEmpleados(await libro([{ nombre: 'ND38QU', filas: nomina(FILAS) }]), new Map()),
    existentes, { catalogo, areas, decisiones: new Map([['data scientist', { tipo: 'nuevo', areaId: 'administrativo' }], ...decisiones]) },
  );

  it('queda pendiente hasta que RH acepta la corrección; sus filas no entran al plan', async () => {
    const plan = await planDe();
    expect(plan.resolucion.pendientes.map(g => g.texto)).toEqual(['PRODUCTION OPERATER']);
    expect(plan.items.find(i => i.clave === '50001')).toBeUndefined();
  });

  it('al aceptar la corrección toma el puesto y el área del catálogo y guarda el alias', async () => {
    const plan = await planDe(new Map([['production operater', { tipo: 'usar' }]]));
    const it = plan.items.find(i => i.clave === '50001');
    expect(it).toMatchObject({ puestoId: 'production-operator', areaId: 'produccion', areaEstado: 'nuevo' });
    expect(plan.resolucion.aliasNuevos).toEqual([{ puestoId: 'production-operator', alias: 'PRODUCTION OPERATER' }]);
    expect(plan.resolucion.puestosNuevos.map(p => p.id)).toEqual(['data-scientist']);
    // "_x0002_" se limpia solo
    expect(plan.items.find(i => i.clave === '7219').puestoCorreccion).toMatchObject({ despues: 'PRODUCTION OPERATOR', tipo: 'automatica' });
  });
});

describe('celdas vacías no sobrescriben lo que ya existe', () => {
  const existente = {
    id: '7219', nomina: '7219', nombre: 'PEREZ JUAN', puesto: 'PRODUCTION OPERATOR', puestoId: 'production-operator',
    areaId: 'produccion', areaExcepcion: null, areaExcepcionMotivo: '', rutaId: 'r1', comunidadId: 'c1', puntoReunionId: 'p1',
    depto: '316', descDepto: 'MOLDEO', nivel: 'G2', fechaAlta: '2020-01-06', activo: true,
  };
  const planCon = async (fila) => compararEmpleados(
    await leerEmpleados(await libro([{ nombre: 'Hoja', filas: nomina([fila]) }]), new Map()), [existente], { catalogo, areas },
  );

  it('depto, descDepto, nivel, alta y puesto vacíos: sin cambios (no "con cambios")', async () => {
    const plan = await planCon([7219, 'PEREZ JUAN', '', '', '', '', '', null]);
    const it = plan.items[0];
    expect(it.accion).toBe('sinCambios');
    expect(it.datos).toEqual({});
    expect(plan.conteos.conCambios).toBe(0);
    expect(plan.conteos.sinCambios).toBe(1);
  });

  it('solo se actualiza lo que el archivo sí trae', async () => {
    const plan = await planCon([7219, 'PEREZ JUAN', '316', 'MOLDEO', 'C', '', 'G3', null]);
    const it = plan.items[0];
    expect(it.accion).toBe('actualizar');
    expect(it.datos).toEqual({ nivel: 'G3' });
    expect(it.cambios.map(c => c.campo)).toEqual(['NIVEL']);
  });

  it('puesto vacío en un empleado nuevo se omite como error', async () => {
    const plan = compararEmpleados(
      await leerEmpleados(await libro([{ nombre: 'Hoja', filas: nomina([[60001, 'NUEVO SIN PUESTO', '1', 'X', 'A', '', 'G1', null]]) }]), new Map()),
      [], { catalogo, areas },
    );
    expect(plan.items).toHaveLength(0);
    expect(plan.conteos.errores).toBe(1);
  });
});

describe('cálculo de áreas con excepciones y cambio de área por puesto', () => {
  const emp = (nomina, puestoId, extra = {}) => ({
    id: nomina, nomina, nombre: `EMPLEADO ${nomina}`, puesto: puestoId.toUpperCase().replace(/-/g, ' '), puestoId,
    areaId: catalogo.find(p => p.id === puestoId).areaId, areaExcepcion: null, areaExcepcionMotivo: '', activo: true, ...extra,
  });
  const existentes = [
    emp('1001', 'quality-inspector'),
    emp('1002', 'quality-inspector'),
    emp('1003', 'quality-inspector', { areaId: 'moldes', areaExcepcion: 'moldes', areaExcepcionMotivo: 'Prestado' }), // con excepción
    emp('1004', 'quality-inspector'), // activo en el padrón pero NO viene en el archivo
    emp('1005', 'quality-inspector', { areaId: 'moldes', areaExcepcion: 'moldes', areaExcepcionMotivo: 'Prestado' }), // excepción, fuera del archivo
    emp('2001', 'forklift-operator'),
  ];
  const archivo = ['1001', '1002', '1003', '2001', '3001'].map(n => ({
    estado: 'valido', filaExcel: 2, formato: 'nomina', extra: null, paradaInfo: null, puestoCrudo: '',
    datos: { NOMINA: n, NOMBRE: `EMPLEADO ${n}`, PUESTO: n === '2001' ? 'FORKLIFT OPERATOR' : 'QUALITY INSPECTOR', 'CLAVE PARADA': '' },
  }));
  const planDe = (opciones = {}) => compararEmpleados(archivo, existentes, { catalogo, areas, ...opciones });

  it('la excepción vigente manda sobre el área del puesto y no se pisa', () => {
    const plan = planDe();
    expect(plan.items.find(i => i.clave === '1003')).toMatchObject({
      areaId: 'moldes', areaEstado: 'sinCambio', excepcion: { areaId: 'moldes', motivo: 'Prestado' }, excepcionNueva: false,
    });
    expect(plan.items.find(i => i.clave === '1003').datos.areaExcepcion).toBeUndefined();
    expect(plan.items.find(i => i.clave === '1001')).toMatchObject({ areaId: 'calidad', areaEstado: 'sinCambio' });
    expect(plan.items.find(i => i.clave === '3001')).toMatchObject({ accion: 'crear', areaEstado: 'nuevo', areaId: 'calidad' });
  });

  it('"Solo esta persona": crea una excepción con motivo y la marca como nueva', () => {
    const plan = planDe({ excepciones: new Map([['1001', { areaId: 'produccion', motivo: 'Ajustado en importación 13/10/2026' }]]) });
    const it = plan.items.find(i => i.clave === '1001');
    expect(it).toMatchObject({ areaId: 'produccion', areaEstado: 'cambia', areaAnteriorId: 'calidad', excepcionNueva: true });
    expect(it.datos).toMatchObject({ areaId: 'produccion', areaExcepcion: 'produccion', areaExcepcionMotivo: 'Ajustado en importación 13/10/2026' });
    expect(plan.items.find(i => i.clave === '1002').areaId).toBe('calidad'); // el resto no se mueve
    expect(resumenImportacion(plan).excepcionesNuevas).toBe(1);
  });

  it('RH puede quitar una excepción: vuelve al área del puesto', () => {
    const plan = planDe({ excepciones: new Map([['1003', null]]) });
    const it = plan.items.find(i => i.clave === '1003');
    expect(it).toMatchObject({ areaId: 'calidad', areaEstado: 'cambia', excepcion: null });
    expect(it.datos).toMatchObject({ areaId: 'calidad', areaExcepcion: null, areaExcepcionMotivo: '' });
  });

  it('"Todo el puesto": mueve a los del archivo sin excepción y a los del padrón que no vienen, no a los de excepción', () => {
    const plan = planDe({ puestoArea: new Map([['quality-inspector', 'produccion']]) });
    expect(plan.items.filter(i => i.puestoId === 'quality-inspector').map(i => [i.clave, i.areaId]).sort())
      .toEqual([['1001', 'produccion'], ['1002', 'produccion'], ['1003', 'moldes'], ['3001', 'produccion']]);
    expect(plan.items.find(i => i.clave === '2001').areaId).toBe('almacen');
    expect(plan.cambiosPuesto).toHaveLength(1);
    const c = plan.cambiosPuesto[0];
    expect(c).toMatchObject({ puestoId: 'quality-inspector', de: 'calidad', a: 'produccion', enArchivo: 3 });
    expect(c.fueraArchivo.map(e => e.id)).toEqual(['1004']); // 1005 tiene excepción
    expect(c.conExcepcion).toBe(2); // 1003 (archivo) y 1005 (fuera)
    expect(resumenImportacion(plan)).toMatchObject({ cambianArea: 2, puestosCambioArea: 1 }); // 1001 y 1002; 3001 es nuevo
  });

  it('impactoPuesto cuenta antes de aplicar', () => {
    const plan = planDe();
    const item = plan.items.find(i => i.clave === '1001');
    expect(impactoPuesto(plan, item, 'produccion', existentes)).toEqual({ enArchivo: 3, fueraArchivo: 1, conExcepcion: 2 });
  });

  it('el puesto sin área deja a la persona en "Sin área" y la lista lo cuenta', () => {
    const sinArea = catalogo.map(p => (p.id === 'forklift-operator' ? { ...p, areaId: '' } : p));
    const plan = compararEmpleados(archivo, existentes, { catalogo: sinArea, areas });
    expect(plan.items.find(i => i.clave === '2001')).toMatchObject({ areaId: '', areaEstado: 'cambia' });
    const grupos = agruparPorArea(plan.items, areas);
    expect(grupos.at(-1)).toMatchObject({ id: GRUPO_SIN_AREA, nombre: 'Sin área' });
    expect(resumenLista(plan.items, grupos)).toMatchObject({ total: 5, sinArea: 1 });
  });

  it('una confirmación de grupo solo vale mientras el grupo no cambie', () => {
    const plan = planDe();
    const grupos = agruparPorArea(plan.items, areas);
    const confirmadas = new Map(grupos.map(g => [g.id, g.firma]));
    expect(todoConfirmado(grupos, confirmadas)).toBe(true);
    const movido = agruparPorArea(planDe({ excepciones: new Map([['1001', { areaId: 'produccion', motivo: 'x' }]]) }).items, areas);
    expect(todoConfirmado(movido, confirmadas)).toBe(false);
  });
});

describe('reporte de resultado', () => {
  it('tiene una hoja por grupo del resumen final', async () => {
    const filas = await leerEmpleados(await libro([{ nombre: 'ND38QU', filas: nomina(FILAS.slice(0, 2)) }]), new Map());
    const plan = compararEmpleados(filas, [], { catalogo, areas });
    const wb = construirReporteImportacion({
      tipo: 'Empleados', modo: 'Agregar y actualizar', fecha: '13/10/2026', usuario: 'RH', plan,
      resumen: resumenImportacion(plan), idsBaja: new Set(),
    });
    expect(wb.worksheets.map(w => w.name)).toEqual([
      'Resumen', 'Puestos', 'Creados', 'Actualizados', 'Reactivados', 'Sin cambios', 'Cambian de area', 'Excepciones nuevas',
      'Puestos nuevos', 'Alias nuevos', 'Puestos con area cambiada', 'Bajas', 'Omitidos',
    ]);
    expect(wb.getWorksheet('Creados').rowCount).toBe(3); // encabezado + 2 empleados
  });
});

describe('respaldo del padrón', () => {
  it('incluye activos e inactivos, nómina como texto y nombres de área/ruta', async () => {
    const { construirRespaldoPadron, ENCABEZADOS_RESPALDO, nombreRespaldo } = await import('../src/utils/respaldoPadron.js');
    const wb = construirRespaldoPadron({
      empleados: [
        { id: '7219', nomina: '7219', nombre: 'PEREZ JUAN', puesto: 'PRODUCTION OPERATOR', puestoId: 'production-operator', areaId: 'produccion', rutaId: 'r1', activo: true },
        { id: '11', nomina: '11', nombre: 'BAJA PRUEBA', areaExcepcion: 'moldes', areaExcepcionMotivo: 'Prestado', activo: false },
      ],
      areas, rutas: [{ id: 'r1', nombre: 'RUTA NORTE' }],
    });
    const ws = wb.getWorksheet('Padron');
    expect(ws.getRow(1).values.slice(1)).toEqual(ENCABEZADOS_RESPALDO);
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(2).getCell(1).value).toBe('11'); // texto, ordenado por nómina
    expect(ws.getRow(2).getCell(17).value).toBe('No');
    expect(ws.getRow(3).getCell(6).value).toBe('Producción');
    expect(ws.getRow(3).getCell(9).value).toBe('RUTA NORTE');
    expect(nombreRespaldo(new Date(2026, 9, 13, 8, 5))).toBe('Respaldo_Padron_2026-10-13_0805.xlsx');
  });
});
