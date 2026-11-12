// Margen de expresiones de las reglas de tiempo extra: cada petición a Firestore tiene un tope de 1000 expresiones y, al pasarse, la regla niega («maximum of 1000
// expressions to evaluate has been reached»). Para cada camino pesado se le agrega a la regla "relleno" de costo conocido hasta que deja de pasar: lo que cabe es el
// margen. Falla si algún camino queda con menos de MARGEN_MINIMO libres (así un cambio futuro a las reglas no vuelve a romper el envío sin que se note).
// Escribe docs/margen-expresiones.md. Con REGLAS=ruta mide otro archivo de reglas (y escribe .tmp/margen-otras.md).
// Ejecutar con: npm run test:margen  (requiere Java 11+; tarda unos minutos)
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESCENARIOS } from './helpers/envio-te.js';
import { costoDeUnidad, margen } from './helpers/margen.js';

const MARGEN_MINIMO = 150;
const archivo = process.env.REGLAS ?? 'firestore.rules';
const reglas = readFileSync(archivo, 'utf8');

const REGLA_CONTADOR = /allow update: if activo\(\) && id\.matches\('te-/;
const REGLA_HISTORIAL = /allow create: if activo\(\)\s*$/;
// [camino, escenario, regla que se mide (por defecto, la del escenario), nth]
const CAMINOS = [
  ['Crear el borrador', 'crear-borrador'],
  ['Guardar el borrador (150 empleados, 5 motivos)', 'guardar-borrador'],
  ['Enviar (Diana: 4 empleados, 2 motivos, 2 rutas)', 'enviar'],
  ['Enviar, 150 empleados y 5 motivos', 'enviar-150'],
  ['Enviar, el contador del folio (misma transacción)', 'enviar', REGLA_CONTADOR],
  ['Enviar, la entrada del historial (misma transacción)', 'enviar', REGLA_HISTORIAL, 1],
  ['Enviar como Aut. 1 del área (directo a Aut. 2)', 'enviar-aut1'],
  ['Enviar como Aut. 2 (queda autorizada)', 'enviar-aut2'],
  ['Enviar como admin (queda autorizada)', 'enviar-admin'],
  ['Reenviar tras devolución', 'reenviar'],
  ['Autorizar nivel 1', 'autorizar-1'],
  ['Autorizar nivel 2', 'autorizar-2'],
  ['Autorización múltiple (cada una en su transacción)', 'autorizar-varias'],
  ['Autorizar fuera de tiempo', 'fuera-de-tiempo'],
];

describe('margen de expresiones (de 1000 por petición)', () => {
  it('cada camino pesado deja margen', async () => {
    const unidad = await costoDeUnidad(reglas);
    const filas = [];
    for (const [nombre, id, regex, nth] of CAMINOS) {
      const escenario = ESCENARIOS.find(e => e.id === id);
      const libre = await margen(reglas, escenario, unidad, regex ?? escenario.regla, nth ?? 0);
      filas.push({ nombre, libre });
      const salida = ['# Margen de expresiones de las reglas de tiempo extra', '',
        `Cada petición a Firestore puede evaluar hasta **1000 expresiones** de reglas; al pasarse, la regla niega. Aquí, cuántas **sobran** en cada camino pesado (mientras más, mejor). Medido con \`${archivo}\`; se vuelve a generar con \`npm run test:margen\` y esa prueba falla si algún camino baja de ${MARGEN_MINIMO}.`, '',
        '| Camino | Expresiones libres | Usadas |', '|---|---:|---:|',
        ...filas.map(f => `| ${f.nombre} | ${f.libre ?? '**no pasa**'} | ${f.libre === null ? '> 1000' : 1000 - f.libre} |`), ''].join('\n');
      writeFileSync(process.env.REGLAS ? '.tmp/margen-otras.md' : 'docs/margen-expresiones.md', salida);
    }
    for (const f of filas) expect(f.libre, f.nombre).not.toBeNull();
    if (!process.env.REGLAS) for (const f of filas) expect(f.libre, f.nombre).toBeGreaterThanOrEqual(MARGEN_MINIMO);
  }, 1_800_000);
});
