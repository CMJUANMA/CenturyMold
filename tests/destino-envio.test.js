// Diálogo corto de «Enviar a autorización»: a quién va, con nombre. Datos ficticios. Ejecutar con: npm run test:unit
import { describe, expect, it } from 'vitest';
import { crearFormateadorNombres } from '../src/utils/nombresPersona.js';
import { personaConPuesto, textoConfirmarEnvio } from '../src/utils/destinoEnvio.js';

const formato = crearFormateadorNombres(['RANGEL OROZCO FELIPE', 'IBARRA SALAZAR ROBERTO']);
const nombre = (n) => formato.nombre(n);
const felipe = { nombre: 'RANGEL OROZCO FELIPE', puesto: 'JEFE DE PRODUCCIÓN' };
const roberto = { nombre: 'IBARRA SALAZAR ROBERTO', puesto: 'GERENTE DE OPERACIONES' };

describe('personaConPuesto', () => {
  it('nombre en orden normal y puesto en minúsculas', () => { expect(personaConPuesto(felipe, nombre)).toBe('Felipe Rangel Orozco, jefe de producción'); });
  it('sin puesto, solo el nombre', () => { expect(personaConPuesto({ nombre: 'RANGEL OROZCO FELIPE' }, nombre)).toBe('Felipe Rangel Orozco'); });
});

describe('textoConfirmarEnvio', () => {
  it('a su Aut. 1, con nombre y puesto, y el resumen', () => {
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut1', aut1: [felipe], nombre, empleados: 4, horas: 36 }))
      .toBe('Se enviará a Felipe Rangel Orozco, jefe de producción, para autorizar. 4 empleados, 36 h.');
  });
  it('sin términos internos', () => {
    const t = textoConfirmarEnvio({ estatus: 'pendiente_aut1', aut1: [felipe], nombre, empleados: 4, horas: 36 });
    expect(t).not.toMatch(/Autorización [12]|RH|nivel|folio/i);
  });
  it('con dos que pueden autorizar, los nombra a los dos', () => {
    const otro = { nombre: 'IBARRA SALAZAR ROBERTO', puesto: 'SUPERVISOR' };
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut1', aut1: [felipe, otro], nombre, empleados: 2, horas: 18 }))
      .toBe('Se enviará a Felipe Rangel Orozco, jefe de producción o a Roberto Ibarra Salazar, supervisor, para autorizar. 2 empleados, 18 h.');
  });
  it('al Aut. 2 es la autorización final', () => {
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut2', aut2: [roberto], nombre, empleados: 1, horas: 9 }))
      .toBe('Se enviará a Roberto Ibarra Salazar, gerente de operaciones, para su autorización final. 1 empleado, 9 h.');
  });
  it('lo que captura un Aut. 2 queda autorizado', () => {
    expect(textoConfirmarEnvio({ estatus: 'autorizada', nombre, empleados: 3, horas: 27 }))
      .toBe('Quedará autorizada y pasará a Recursos Humanos para enviarse al proveedor. 3 empleados, 27 h.');
  });
  it('un reenvío lo dice y vuelve a empezar', () => {
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut1', aut1: [felipe], nombre, reenvio: true, empleados: 4, horas: 36 }))
      .toBe('Se reenviará a Felipe Rangel Orozco, jefe de producción, para autorizar. 4 empleados, 36 h. Vuelve a empezar su autorización.');
  });
  it('si no se pudo leer a quien autoriza, no inventa un nombre', () => {
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut1', nombre, empleados: 4, horas: 36.5 })).toBe('Se enviará a quien autoriza tu área. 4 empleados, 36.5 h.');
    expect(textoConfirmarEnvio({ estatus: 'pendiente_aut2', nombre, empleados: 4, horas: 36 })).toBe('Se enviará a quien autoriza al final. 4 empleados, 36 h.');
  });
});
