// Nombre para mostrar a partir del padrón (apellidos primero). Datos ficticios.
import { describe, expect, it } from 'vitest';
import { crearFormateadorNombres } from '../src/utils/nombresPersona.js';

const padron = [
  'MALDONADO SALVADOR', 'ESPINOSA MARCO', 'ACOSTA MARCOS', 'SANCHEZ JESUS', 'CABRERA NOE', 'GOMEZ ISMAEL', 'PEREZ LUIS', 'GONZALEZ MIGUEL',
  'GOMEZ HERNANDEZ ISMAEL', 'PEREZ GARCIA LUIS RODOLFO', 'GONZALEZ RUIZ JOSE JUAN', 'RAMIREZ LUIS MIGUEL',
];
const f = crearFormateadorNombres(padron);

describe('nombre para mostrar', () => {
  it('dos palabras: apellido nombre → nombre apellido', () => {
    expect(f.nombre('MALDONADO SALVADOR')).toBe('Salvador Maldonado');
  });
  it('dos apellidos y un nombre', () => {
    expect(f.nombre('GOMEZ HERNANDEZ ISMAEL')).toBe('Ismael Gomez Hernandez');
    expect(f.partir('GOMEZ HERNANDEZ ISMAEL')).toMatchObject({ nombre: 'Ismael', apellidos: 'Gomez Hernandez' });
  });
  it('dos apellidos y dos nombres', () => {
    expect(f.partir('PEREZ GARCIA LUIS RODOLFO')).toMatchObject({ nombre: 'Luis Rodolfo', apellidos: 'Perez Garcia' });
    expect(f.partir('GONZALEZ RUIZ JOSE JUAN')).toMatchObject({ nombre: 'Jose Juan', apellidos: 'Gonzalez Ruiz' });
  });
  it('si no se puede separar con seguridad, deja el nombre completo', () => {
    // RAMIREZ LUIS MIGUEL: 1 apellido + 2 nombres o 2 apellidos + 1 nombre, ambos posibles → se deja como está
    expect(f.partir('RAMIREZ LUIS MIGUEL')).toMatchObject({ separado: false, completo: 'Ramirez Luis Miguel' });
    expect(f.partir('UNO DOS TRES CUATRO CINCO').separado).toBe(false); // demasiadas palabras
    const raro = crearFormateadorNombres(['AAA BBB CCC', 'ZZZ YYY']);
    expect(raro.partir('AAA BBB CCC')).toMatchObject({ separado: false, completo: 'Aaa Bbb Ccc' });
    expect(raro.nombre('AAA BBB CCC')).toBe('Aaa Bbb Ccc');
  });
  it('iniciales de nombre de pila y primer apellido', () => {
    expect(f.iniciales('MALDONADO SALVADOR')).toBe('SM');
    expect(f.iniciales('GOMEZ HERNANDEZ ISMAEL')).toBe('IG');
    expect(f.iniciales('AAA BBB CCC')).toBe('AB'); // sin separar: las dos primeras palabras
    expect(f.iniciales('')).toBe('?');
  });
});

describe('Excel del organigrama', () => {
  it('rótulos de nivel, Aut. 2 a todo lo ancho, una columna por área y solicitantes por fila', async () => {
    const { construirLibroOrganigrama } = await import('../src/utils/exportarOrganigrama.js');
    const t = (nomina, nombre, puesto, extra = {}) => ({ nomina, nombre, puesto, ...extra });
    const org = {
      aut2: [t('11', 'MALDONADO SALVADOR', 'DIRECTOR'), t('50296', 'ESPINOSA MARCO', 'IT')],
      columnas: [
        { area: { nombre: 'Producción' }, aut1: [t('50610', 'GOMEZ ISMAEL', 'SUPER')], solicitantes: [t('1', 'ACOSTA MARCOS', 'SUP'), t('2', 'CARRERA JOEL', 'SUP')] },
        { area: { nombre: 'Moldes' }, aut1: [], solicitantes: [] },
      ],
    };
    const ws = construirLibroOrganigrama(org, (x) => x.nombre).getWorksheet('Niveles de autorización');
    expect(ws.getCell('A2').value).toBe('Autorización 2');
    expect(ws.getCell('B2').value).toContain('MALDONADO SALVADOR');
    expect(ws.getCell('B3').value).toBe('PRODUCCIÓN');
    expect(ws.getCell('C3').value).toBe('MOLDES');
    expect(ws.getCell('B4').value).toContain('GOMEZ ISMAEL');
    expect(ws.getCell('C4').value).toBe('Sin Autorización 1');
    expect(ws.getCell('B5').value).toContain('ACOSTA MARCOS');
    expect(ws.getCell('B6').value).toContain('CARRERA JOEL');
  });
});

describe('nombres de pila frecuentes', () => {
  it('separa aunque nadie más del padrón se llame igual', () => {
    const g = crearFormateadorNombres(['GOMEZ HERNANDEZ ISMAEL', 'PEREZ GARCIA LUIS RODOLFO', 'GONZALEZ RUIZ JOSE JUAN']);
    expect(g.nombre('GOMEZ HERNANDEZ ISMAEL')).toBe('Ismael Gomez Hernandez');
    expect(g.nombre('GONZALEZ RUIZ JOSE JUAN')).toBe('Jose Juan Gonzalez Ruiz');
  });
});
