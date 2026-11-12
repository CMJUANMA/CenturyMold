// Mide el margen de expresiones (de las 1000 que permite cada petición) de una regla: se le agrega relleno de costo conocido hasta que deja de pasar.
import { getDoc, doc } from 'firebase/firestore';
import { montar, sembrarBase } from './envio-te.js';
import { conRelleno, reglasDeCalibracion } from './variantes-reglas.js';

const TOPE = 1000;

/** ¿Pasa la prueba con estas reglas? `false` si la niegan (por el tope o por lo que sea). */
export async function pasa(reglas, escenario) {
  const env = await montar(reglas, 'demo-solicitud-rutas-margen');
  try {
    await sembrarBase(env, { padron: 12 }); // (el envío y la autorización no leen el padrón; la captura, solo hasta 10 empleados por lote)
    await escenario.preparar(env);
    await escenario.ejecutar(env);
    return true;
  } catch {
    return false;
  } finally {
    await env.cleanup();
  }
}

/** Mayor k que cumple `ok(k)` (ok es monótona: pasa hasta cierto k); -1 si ni k = 0 pasa. */
async function mayorK(ok, max) {
  if (!(await ok(0))) return -1;
  let bajo = 0, alto = max;
  while (bajo < alto) {
    const medio = Math.ceil((bajo + alto) / 2);
    if (await ok(medio)) bajo = medio; else alto = medio - 1;
  }
  return bajo;
}

/** Expresiones que cuesta cada unidad de relleno `1 == 1` (se calibra con una regla que no hace otra cosa) */
export async function costoDeUnidad(reglas) {
  const lectura = async (k) => {
    const env = await montar(reglasDeCalibracion(reglas, k), 'demo-solicitud-rutas-calibracion');
    try { await env.withSecurityRulesDisabled(async () => {}); await getDoc(doc(env.authenticatedContext('x').firestore(), 'calibracion', 'a')); return true; }
    catch { return false; } finally { await env.cleanup(); }
  };
  const k0 = await mayorK(lectura, 1500);
  return TOPE / (k0 + 1); // con k0 pasa y con k0 + 1 no: el tope cae entre esos dos
}

/**
 * Expresiones libres de la regla del escenario: 1000 menos lo que gasta. Negativo/`null` si ya se pasa del tope (no se puede medir con relleno).
 * @returns {Promise<number|null>} null si el escenario no pasa ni sin relleno
 */
export async function margen(reglas, escenario, unidad, regex = escenario.regla, nth = 0) {
  const k = await mayorK((n) => pasa(conRelleno(reglas, regex, n, nth), escenario), 400);
  return k < 0 ? null : Math.round(k * unidad);
}
