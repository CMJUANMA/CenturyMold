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

describe('nombres de pila frecuentes', () => {
  it('separa aunque nadie más del padrón se llame igual', () => {
    const g = crearFormateadorNombres(['GOMEZ HERNANDEZ ISMAEL', 'PEREZ GARCIA LUIS RODOLFO', 'GONZALEZ RUIZ JOSE JUAN']);
    expect(g.nombre('GOMEZ HERNANDEZ ISMAEL')).toBe('Ismael Gomez Hernandez');
    expect(g.nombre('GONZALEZ RUIZ JOSE JUAN')).toBe('Jose Juan Gonzalez Ruiz');
  });
});
