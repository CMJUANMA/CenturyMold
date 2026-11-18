// Importación de Personal: ruta, comunidad y punto por nómina con las columnas RUTA, COMUNIDAD y PUNTO (además de CLAVE PARADA). Datos ficticios.
// Ejecutar con: npm run test:unit
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { EMP_HEADERS, HOJA_EMP, construirFormatoEmpleados, leerEmpleados, resolverParadaPorNombre } from '../src/utils/formatosImportacion.js';
import { compararEmpleados } from '../src/utils/comparacionImportacion.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

const rutas = [{ id: 'ruta-norte', nombre: 'RUTA NORTE', activo: true }, { id: 'ruta-sur', nombre: 'RUTA SUR', activo: true }];
const comunidades = [
  { id: 'ruta-norte__colonia-san-pedro', nombre: 'COLONIA SAN PEDRO', rutaId: 'ruta-norte', activo: true },
  { id: 'ruta-sur__colonia-vista-hermosa', nombre: 'COLONIA VISTA HERMOSA', rutaId: 'ruta-sur', activo: true },
];
const puntos = [
  { id: 'SN01', nombre: 'PARQUE CENTRAL', comunidadId: 'ruta-norte__colonia-san-pedro', rutaId: 'ruta-norte', activo: true },
  { id: 'SU01', nombre: 'PLAZA COMERCIAL', comunidadId: 'ruta-sur__colonia-vista-hermosa', rutaId: 'ruta-sur', activo: true },
  { id: 'SU02', nombre: 'FARMACIA', comunidadId: 'ruta-sur__colonia-vista-hermosa', rutaId: 'ruta-sur', activo: false },
];
const mapa = new Map(puntos.map(p => [p.id, { clave: p.id, ...p }]));

const libro = async (filas, encabezados = EMP_HEADERS) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(HOJA_EMP);
  ws.addRow(encabezados);
  filas.forEach(f => ws.addRow(f));
  return wb.xlsx.writeBuffer();
};
const leer = async (filas, encabezados) => leerEmpleados(await libro(filas, encabezados), mapa);
// leerEmpleados no recibe el catálogo: se prueba también con la lectura completa (con rutas y comunidades) más abajo
import { leerEmpleadosArchivo } from '../src/utils/formatosImportacion.js';
const leerConCatalogo = async (filas) => (await leerEmpleadosArchivo(await libro(filas), mapa, { usarPrimera: true, rutas, comunidades })).filas;

describe('plantilla: RUTA, COMUNIDAD y PUNTO por nómina', () => {
  it('la plantilla en blanco trae las tres columnas opcionales y un ejemplo con ellas', () => {
    expect(EMP_HEADERS.slice(-3)).toEqual(['RUTA', 'COMUNIDAD', 'PUNTO']);
    const wb = construirFormatoEmpleados([]);
    expect(wb.getWorksheet(HOJA_EMP).getRow(1).values.slice(1)).toEqual(EMP_HEADERS);
    expect(wb.getWorksheet('Ejemplo').getRow(3).getCell(7).value).toBe('RUTA SUR');
  });
});

describe('resolverParadaPorNombre', () => {
  const cat = { rutas, comunidades, puntos };
  it('encuentra el punto por los tres nombres, sin importar acentos ni mayúsculas', () => {
    expect(resolverParadaPorNombre({ ruta: 'ruta norte', comunidad: 'Colonia San Pedro', punto: 'parque central' }, cat).punto.id).toBe('SN01');
  });
  it('pide las tres; avisa si la ruta, la comunidad o el punto no existen o el punto está inactivo', () => {
    expect(resolverParadaPorNombre({ ruta: 'RUTA NORTE', comunidad: '', punto: '' }, cat).aviso).toMatch(/van juntos/);
    expect(resolverParadaPorNombre({ ruta: 'RUTA X', comunidad: 'A', punto: 'B' }, cat).aviso).toMatch(/RUTA "RUTA X" no existe/);
    expect(resolverParadaPorNombre({ ruta: 'RUTA NORTE', comunidad: 'OTRA', punto: 'B' }, cat).aviso).toMatch(/COMUNIDAD "OTRA" no existe/);
    expect(resolverParadaPorNombre({ ruta: 'RUTA NORTE', comunidad: 'COLONIA SAN PEDRO', punto: 'NADA' }, cat).aviso).toMatch(/PUNTO "NADA" no existe/);
    expect(resolverParadaPorNombre({ ruta: 'RUTA SUR', comunidad: 'COLONIA VISTA HERMOSA', punto: 'FARMACIA' }, cat).aviso).toMatch(/inactivo/);
  });
  it('sin rutas ni comunidades cargadas usa los ids que genera la importación del directorio', () => {
    expect(resolverParadaPorNombre({ ruta: 'RUTA NORTE', comunidad: 'COLONIA SAN PEDRO', punto: 'PARQUE CENTRAL' }, { puntos }).punto.id).toBe('SN01');
  });
});

describe('importación con RUTA, COMUNIDAD y PUNTO', () => {
  const plan = (filas, existentes = []) => compararEmpleados(filas, existentes, { catalogo: PUESTOS_INICIALES, areas: AREAS_INICIALES });
  const fila = (nomina, ruta, comunidad, punto, clave = '') => [nomina, `EMPLEADO ${nomina}`, 'PRODUCTION OPERATOR', clave, '', '', ruta, comunidad, punto];

  it('asigna ruta, comunidad y punto por nómina a un empleado nuevo y a uno existente', async () => {
    const filas = await leerConCatalogo([fila(7001, 'RUTA NORTE', 'COLONIA SAN PEDRO', 'PARQUE CENTRAL'), fila(7002, 'RUTA SUR', 'COLONIA VISTA HERMOSA', 'PLAZA COMERCIAL')]);
    expect(filas.map(f => f.estado)).toEqual(['valido', 'valido']);
    const existente = { id: '7002', nomina: '7002', nombre: 'EMPLEADO 7002', puesto: 'PRODUCTION OPERATOR', puestoId: 'production-operator', areaId: 'produccion', areaExcepcion: null, areaExcepcionMotivo: '', activo: true, rutaId: '', comunidadId: '', puntoReunionId: '' };
    const p = plan(filas, [existente]);
    const por = Object.fromEntries(p.items.map(i => [i.clave, i]));
    expect(por['7001'].accion).toBe('crear');
    expect(por['7001'].datos).toMatchObject({ rutaId: 'ruta-norte', comunidadId: 'ruta-norte__colonia-san-pedro', puntoReunionId: 'SN01' });
    expect(por['7002'].accion).toBe('actualizar');
    expect(por['7002'].datos).toMatchObject({ rutaId: 'ruta-sur', comunidadId: 'ruta-sur__colonia-vista-hermosa', puntoReunionId: 'SU01' });
  });

  it('si no coinciden con el directorio, la fila se importa con aviso y sin tocar la ruta que ya tenía', async () => {
    const filas = await leerConCatalogo([fila(7003, 'RUTA NORTE', 'COLONIA INEXISTENTE', 'PARQUE CENTRAL')]);
    expect(filas[0].estado).toBe('advertencia');
    expect(filas[0].mensaje).toMatch(/COMUNIDAD/);
    expect(filas[0].paradaInfo).toBeNull();
  });

  it('CLAVE PARADA manda sobre los nombres', async () => {
    const filas = await leerConCatalogo([fila(7004, 'RUTA NORTE', 'COLONIA SAN PEDRO', 'PARQUE CENTRAL', 'SU01')]);
    expect(filas[0].paradaInfo.clave).toBe('SU01');
  });

  it('un archivo anterior (sin las columnas nuevas) se sigue leyendo', async () => {
    const f = await leer([[7005, 'PEREZ JUAN', 'PRODUCTION OPERATOR', 'SN01']], EMP_HEADERS.slice(0, 4));
    expect(f[0].estado).not.toBe('error');
    expect(f[0].paradaInfo.clave).toBe('SN01');
  });
});
