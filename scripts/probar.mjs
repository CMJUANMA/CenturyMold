// npm test: corre las pruebas unitarias y, si el emulador de Firestore puede arrancar (necesita Java),
// también las de reglas. Sin Java, avisa que se omitieron las de reglas (no falla por eso).
import { spawnSync } from 'node:child_process';

const correr = (cmd) => spawnSync(cmd, { stdio: 'inherit', shell: true }).status ?? 1;

console.log('\n▶ Pruebas unitarias (npm run test:unit)\n');
if (correr('npm run test:unit') !== 0) process.exit(1);

const java = spawnSync('java -version', { stdio: 'ignore', shell: true }).status === 0;
if (!java) {
  console.log('\n⚠ Java no está disponible: se omiten las pruebas de reglas (npm run test:rules).');
  process.exit(0);
}
console.log('\n▶ Pruebas de reglas de Firestore (npm run test:rules)\n');
process.exit(correr('npm run test:rules') === 0 ? 0 : 1);
