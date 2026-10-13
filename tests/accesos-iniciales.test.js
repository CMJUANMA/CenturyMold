// Crear usuarios en lote: contraseñas temporales, candidatos y Excel de entrega. Datos ficticios en memoria.
import { describe, expect, it } from 'vitest';
import {
  ALFABETO_PASSWORD, candidatosSinCuenta, construirLibroAccesos, generarPassword, nombreArchivoAccesos, ENCABEZADOS_ACCESOS,
} from '../src/utils/accesosIniciales.js';

describe('contraseña temporal', () => {
  it('tiene el formato CM-XXXX-XXXX y nunca usa caracteres ambiguos', () => {
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
      const p = generarPassword();
      expect(p).toMatch(/^CM-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(p.slice(3)).not.toMatch(/[01OIL]/);
      vistos.add(p);
    }
    expect(vistos.size).toBe(2000); // no se repiten
    expect(ALFABETO_PASSWORD).not.toMatch(/[01OIl]/);
  });
  it('reparte parejo: todo el alfabeto aparece y los bytes sesgados se descartan', () => {
    const letras = new Set();
    for (let i = 0; i < 400; i++) generarPassword().slice(3).replace('-', '').split('').forEach(c => letras.add(c));
    expect(letras.size).toBe(ALFABETO_PASSWORD.length);
    // con bytes fijos 255 (descartado) y luego 0 → siempre la primera letra
    let n = 0;
    const p = generarPassword(() => new Uint8Array(16).fill(n++ === 0 ? 255 : 0));
    expect(p).toBe('CM-AAAA-AAAA');
  });
});

describe('candidatos sin cuenta', () => {
  const HOY = new Date(2026, 9, 13, 12);
  const a = (nomina, rol, areaId, extra = {}) => ({ id: `${nomina}_${rol}_${areaId}`, nomina, nombre: `H${nomina}`, rol, areaId, desde: new Date(2026, 9, 1), hasta: null, activo: true, ...extra });
  const empleados = [
    { nomina: '11', nombre: 'MALDONADO SALVADOR', puesto: 'DIRECTOR', areaId: 'administrativo' },
    { nomina: '50610', nombre: 'GOMEZ ISMAEL', puesto: 'SUPERINTENDENT', areaId: 'produccion' },
    { nomina: '50532', nombre: 'ACOSTA MARCOS', puesto: 'SUPERVISOR', areaId: 'produccion' },
  ];
  it('solo vigentes y sin cuenta; junta los roles de la misma persona, con datos del padrón', () => {
    const lista = candidatosSinCuenta({
      asignaciones: [
        a('11', 'aut2', null), a('50610', 'aut1', 'produccion'), a('50610', 'solicitante', 'produccion'),
        a('50532', 'solicitante', 'produccion'),                    // ya tiene cuenta
        a('7', 'aut1', 'moldes', { hasta: new Date(2026, 9, 5) }), // vencida
        a('8', 'aut1', 'moldes', { activo: false }),               // revocada
      ],
      usuarios: [{ nomina: '50532' }], empleados, nombresArea: new Map([['produccion', 'Producción']]), ahora: HOY,
    });
    expect(lista.map(c => c.nomina)).toEqual(['50610', '11']); // por nombre
    expect(lista[0]).toMatchObject({ nombre: 'GOMEZ ISMAEL', puesto: 'SUPERINTENDENT', areaId: 'produccion', roles: ['Aut. 1 · Producción', 'Solicitante · Producción'] });
    expect(lista[1].roles).toEqual(['Aut. 2']);
  });
});

describe('Excel de accesos', () => {
  it('trae las columnas pedidas, el usuario es la nómina, y una hoja de instrucciones', () => {
    const wb = construirLibroAccesos([{ nomina: '50610', nombre: 'GOMEZ ISMAEL', area: 'Producción', roles: 'Aut. 1 · Producción', password: 'CM-7K4P-Q9TX' }]);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Accesos', 'Instrucciones']);
    const hoja = wb.getWorksheet('Accesos');
    expect(hoja.getRow(1).values.slice(1)).toEqual(ENCABEZADOS_ACCESOS);
    expect(hoja.getRow(2).values.slice(1)).toEqual(['50610', 'GOMEZ ISMAEL', 'Producción', 'Aut. 1 · Producción', '50610', 'CM-7K4P-Q9TX']);
    const texto = wb.getWorksheet('Instrucciones').getColumn(2).values.join(' ');
    expect(texto).toMatch(/contraseña nueva/);
    expect(texto).toMatch(/CONTIENE CONTRASEÑAS/);
  });
  it('el nombre del archivo lleva fecha y hora', () => {
    expect(nombreArchivoAccesos(new Date(2026, 9, 13, 9, 5))).toBe('Accesos_Iniciales_2026-10-13_0905.xlsx');
  });
});
