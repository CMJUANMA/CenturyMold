// Corre Lighthouse (escritorio y móvil) sobre el login y el Inicio de RH de la versión de emulador (ver scripts/capturas.mjs).
// Requiere: emuladores sembrados, `npm run capturas:build`, `npx vite preview --outDir .tmp/dist-emulador --port 4174` y Lighthouse en .tmp/lh:
//   (cd .tmp/lh && npm init -y && npm install lighthouse)
// Uso: node scripts/lighthouse.mjs <archivo-de-resultados.json>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const salida = process.argv[2] ?? '.tmp/lighthouse.json';
const BASE = process.env.BASE ?? 'http://localhost:4174';
const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const lhDir = resolve('.tmp/lh/node_modules/lighthouse');
const { default: lighthouse } = await import(pathToFileURL(`${lhDir}/core/index.js`).href);
const { default: desktopConfig } = await import(pathToFileURL(`${lhDir}/core/config/desktop-config.js`).href);

const PUERTO = 9335;
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PUERTO}`, '--user-data-dir=' + process.env.TEMP + '\\cm-lighthouse', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
    const p = lista.find(t => t.type === 'page');
    if (p) ws = new WebSocket(p.webSocketDebuggerUrl);
  } catch { await esperar(250); }
}
await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (method, params = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const js = (e) => cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });

const resultados = {};
const medir = async (nombre, ruta, factor) => {
  const opciones = { port: PUERTO, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'], disableStorageReset: true };
  const r = await lighthouse(BASE + ruta, opciones, factor === 'escritorio' ? desktopConfig : undefined);
  const c = r.lhr.categories;
  const a = r.lhr.audits;
  resultados[`${nombre}-${factor}`] = {
    rendimiento: Math.round(c.performance.score * 100), accesibilidad: Math.round(c.accessibility.score * 100), buenasPracticas: Math.round(c['best-practices'].score * 100),
    fcp: a['first-contentful-paint'].displayValue, lcp: a['largest-contentful-paint'].displayValue, tbt: a['total-blocking-time'].displayValue, cls: a['cumulative-layout-shift'].displayValue,
    kb: Math.round((a['total-byte-weight'].numericValue ?? 0) / 1024),
    fallosAccesibilidad: Object.values(a).filter(x => x.score === 0 && c.accessibility.auditRefs.some(ref => ref.id === x.id)).map(x => x.id),
  };
  console.log(nombre, factor, JSON.stringify(resultados[`${nombre}-${factor}`]));
};

// 1) Login sin sesión
for (const f of ['escritorio', 'movil']) await medir('login', '/login', f);
// 2) Iniciar sesión (la sesión queda en el perfil de Chrome) y medir el Inicio
await cdp('Page.enable');
await cdp('Page.navigate', { url: BASE + '/login' }); await esperar(2000);
const poner = async (campo, texto) => { await js(`document.getElementById('${campo}').focus()`); await cdp('Input.insertText', { text: texto }); };
await poner('login-nomina', process.env.CAP_USUARIO ?? '90001');
await poner('login-password', process.env.CAP_PASSWORD ?? 'Prueba123');
await js("document.getElementById('btn-ingresar').click()"); await esperar(3500);
for (const f of ['escritorio', 'movil']) await medir('inicio-rh', '/', f);

writeFileSync(salida, JSON.stringify(resultados, null, 2));
ws.close(); chrome.kill();
