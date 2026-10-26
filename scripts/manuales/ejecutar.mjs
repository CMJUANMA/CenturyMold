// npm run manuales — todo en uno: emuladores (si no están corriendo) → datos de ejemplo → app en modo emulador → capturas anotadas → PDF.
// Solo toca el EMULADOR y archivos de docs/manuales/. Con --sin-capturas solo regenera los PDF a partir de las capturas que ya hay.
import { spawn, spawnSync } from 'node:child_process';

const PUERTO_APP = 4174;
const sinCapturas = process.argv.includes('--sin-capturas');
const roles = process.argv.slice(2).filter(a => !a.startsWith('--'));
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const arriba = async (url) => { try { await fetch(url); return true; } catch { return false; } };
const hijos = [];
const lanzar = (cmd) => { const h = spawn(cmd, { shell: true, stdio: 'ignore', detached: false }); hijos.push(h); return h; };
const correr = (cmd) => { const r = spawnSync(cmd, { shell: true, stdio: 'inherit' }); if (r.status !== 0) throw new Error(`Falló: ${cmd}`); };
const matar = () => { for (const h of hijos) { try { spawnSync(`taskkill /pid ${h.pid} /T /F`, { shell: true, stdio: 'ignore' }); } catch { /* ya terminó */ } } };

try {
  if (!sinCapturas) {
    if (!(await arriba('http://127.0.0.1:8080'))) {
      console.log('Iniciando los emuladores…');
      lanzar('npx firebase emulators:start --only auth,firestore --project demo-solicitud-rutas');
      for (let i = 0; i < 40 && !(await arriba('http://127.0.0.1:8080')); i++) await esperar(2000);
    }
    console.log('Cargando datos de ejemplo…');
    correr('node scripts/manuales/datos-demo.mjs');
    console.log('Compilando la app en modo emulador…');
    correr('npm run capturas:build');
    if (!(await arriba(`http://localhost:${PUERTO_APP}`))) {
      lanzar(`npx vite preview --outDir .tmp/dist-emulador --port ${PUERTO_APP}`);
      for (let i = 0; i < 20 && !(await arriba(`http://localhost:${PUERTO_APP}`)); i++) await esperar(1000);
    }
    console.log('Tomando las capturas…');
    correr(`node scripts/manuales/capturas.mjs ${roles.join(' ')}`);
  }
  console.log('Generando los PDF…');
  correr(`node scripts/manuales/generar.mjs ${roles.join(' ')}`);
} finally {
  matar();
}
