// npm run prueba:piloto — Prueba COMPLETA de punta a punta del día del arranque, con Playwright contra el EMULADOR (sin IA, repetible).
// Simula, desde cero: limpieza («Preparar para producción») → directorio de rutas → ruta de Almacén por importación → alta de usuarios →
// primer ingreso con cambio de contraseña → captura de tiempo extra → autorizaciones → RH y Formato de rutas → Nóminas y su Excel.
// Uso:  npm run prueba:piloto            (arranca emuladores y compila la app si hace falta)
//       npm run prueba:piloto -- --sin-build   (reutiliza la última compilación de .tmp/dist-emulador)
// Si algo no sale, se detiene con un mensaje claro (paso, causa, captura y URL). Nunca toca producción: todo es 127.0.0.1 y proyecto «demo-…».
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { etapaArranque } from './piloto/etapa-arranque.mjs';
import { etapaCaptura } from './piloto/etapa-captura.mjs';
import { etapaAutorizacion } from './piloto/etapa-autorizacion.mjs';
import { etapaNomina } from './piloto/etapa-nomina.mjs';
import { PASSWORD_NUEVA } from './piloto/datos.mjs';
import { abrirNavegador, apagarTodo, nuevaPagina, prepararEntorno, resultados, SALIDA } from './piloto/infra.mjs';

const sinBuild = process.argv.includes('--sin-build');
// Para depurar: --reusar deja los emuladores y la app corriendo al terminar; --desde=captura|autorizacion|nomina salta las etapas anteriores (reusa lo que quedó)
const reusar = process.argv.includes('--reusar');
const desde = (process.argv.find(a => a.startsWith('--desde='))?.split('=')[1]) ?? 'arranque';
const ORDEN = ['arranque', 'captura', 'autorizacion', 'nomina'];
const toca = (etapa) => ORDEN.indexOf(etapa) >= ORDEN.indexOf(desde);
const contexto = { claves: {}, solicitudes: {}, archivos: {} }; // lo que un paso le deja al siguiente (contraseñas, folios, descargas)
if (desde !== 'arranque') for (const c of ['aut1', 'solicitante', 'aut2', 'rh', 'nomina']) contexto.claves[c] = PASSWORD_NUEVA;
let browser;
let codigo = 0;
const t0 = Date.now();
mkdirSync(SALIDA, { recursive: true });
try {
  await prepararEntorno({ sinBuild, reusar });
  browser = await abrirNavegador();
  const nueva = () => nuevaPagina(browser);
  console.log('\nPrueba de punta a punta (emulador)\n');
  if (toca('arranque')) await etapaArranque({ nueva, contexto });
  if (toca('captura')) await etapaCaptura({ nueva, contexto });
  if (toca('autorizacion')) await etapaAutorizacion({ nueva, contexto });
  if (toca('nomina')) await etapaNomina({ nueva, contexto });
  console.log(`\n✔ TODO SALIÓ BIEN: ${resultados.length} pasos en ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
} catch (err) {
  codigo = 1;
  if (!err.yaMostrado) console.log(`\n✗ ${err.message}`);
  console.log(`\n✘ LA PRUEBA FALLÓ. ${resultados.filter(r => r.ok).length} pasos bien antes del error. ${err.message}`);
} finally {
  writeFileSync(`${SALIDA}/resultado.json`, JSON.stringify(resultados, null, 2));
  await browser?.close().catch(() => {});
  if (!reusar) apagarTodo();
}
process.exit(codigo);
