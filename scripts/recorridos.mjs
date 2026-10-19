// Recorre cada paso de cada recorrido guiado en un navegador real (CDP) y guarda una captura por paso. También comprueba, por paso, que el globo
// y el resalte estén dentro de la pantalla y que el resalte rodee al elemento señalado.
// Necesita lo mismo que scripts/capturas.mjs: emuladores sembrados (scripts/sembrar-emulador.mjs), `npm run capturas:build` y un servidor:
//   npx vite preview --outDir .tmp/dist-emulador --port 4174
// Uso: node scripts/recorridos.mjs [carpeta de salida]   (por omisión .tmp/capturas/recorridos)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const salida = process.argv[2] ?? '.tmp/capturas/recorridos';
const BASE = process.env.BASE ?? 'http://localhost:4174';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASSWORD = process.env.CAP_PASSWORD ?? 'Prueba123';
const SOLO = (process.argv.find(a => a.startsWith('--solo=')) ?? '').replace('--solo=', '').split(',').filter(Boolean);

// Cada recorrido se prueba con una persona que sí ve esa pantalla con datos
const RECORRIDOS = [
  { id: 'solicitar', ruta: '/tiempo-extra/nueva', usuario: '50532' }, // solicitante de Moldes
  { id: 'solicitar-con-empleados', recorrido: 'solicitar', ruta: '/tiempo-extra/nueva', usuario: '50532', conEmpleados: true },
  { id: 'autorizar', ruta: '/tiempo-extra/autorizar', usuario: '50610' }, // Aut. 1 de Moldes
];
const VISTAS = [
  ['escritorio-1366', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }],
  ['escritorio-1440', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }],
  ['celular', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }],
];
const TEMAS = ['claro', 'oscuro'];
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

mkdirSync(salida, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9337', '--user-data-dir=' + (process.env.TEMP ?? '.') + '/cm-recorridos', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try { const l = await (await fetch('http://127.0.0.1:9337/json')).json(); const p = l.find(t => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { await esperar(250); }
}
await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (method, params = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
const ir = async (ruta, ms = 2500) => { await cdp('Page.navigate', { url: BASE + ruta }); await esperar(ms); };
const preparar = async (vista, tema) => {
  await cdp('Emulation.setDeviceMetricsOverride', vista);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }] });
};
const poner = async (idc, t) => { await js(`document.getElementById('${idc}').focus()`); await cdp('Input.insertText', { text: t }); };
const entrar = async (usuario) => {
  await js('localStorage.clear()');
  await cdp('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' });
  await ir('/login', 1800);
  await poner('login-nomina', usuario); await poner('login-password', PASSWORD);
  await js("document.getElementById('btn-ingresar').click()");
  await esperar(3500);
};

let problemas = 0;
let capturas = 0;
await cdp('Page.enable');
let sesion = null;
for (const rec of RECORRIDOS) {
  if (SOLO.length && !SOLO.includes(rec.id)) continue;
  if (sesion !== rec.usuario) { await preparar(VISTAS[1][1], 'claro'); await entrar(rec.usuario); sesion = rec.usuario; }
  for (const [vista, v] of VISTAS) {
    for (const tema of TEMAS) {
      await preparar(v, tema);
      await ir(rec.ruta, 3000);
      // En este caso se agregan empleados antes (para que existan los pasos que dependen de ellos)
      if (rec.conEmpleados) {
        await js("document.getElementById('btn-agregar-empleados')?.click()"); await esperar(1200);
        await js("(() => { const c = [...document.querySelectorAll('[role=dialog] input[type=checkbox]')].slice(0, 3); c.forEach(x => x.click()); return c.length; })()");
        await esperar(300);
        await js("[...document.querySelectorAll('[role=dialog] button')].find(b => /^Agregar/.test(b.textContent.trim()) && !b.disabled)?.click()"); await esperar(1200);
      }
      // Abrir el "?" y pedir el recorrido
      await js("document.querySelector('[aria-label=\"Ayuda de esta pantalla\"]')?.click()"); await esperar(600);
      await js("[...document.querySelectorAll('[role=dialog] button')].find(b => /Ver el recorrido/.test(b.textContent))?.click()");
      let paso = 0;
      for (let guardia = 0; guardia < 12; guardia++) {
        // Esperar a que el globo esté visible (el recorrido espera a la pantalla y al desplazamiento por su cuenta)
        let info = null;
        for (let i = 0; i < 60; i++) {
          info = await js(`(() => {
            const g = document.querySelector('[data-recorrido] [role=region]');
            if (!g || getComputedStyle(g).visibility === 'hidden') return null;
            const b = g.getBoundingClientRect();
            const m = g.getAttribute('aria-label');
            const ring = document.querySelector('[data-recorrido] .ring-2');
            const r = ring ? ring.getBoundingClientRect() : null;
            return { globo: { top: b.top, left: b.left, width: b.width, height: b.height }, ring: r && { top: r.top, left: r.left, width: r.width, height: r.height }, titulo: m, vw: innerWidth, vh: innerHeight, ultimo: [...g.querySelectorAll('button')].some(x => x.textContent.trim() === 'Entendido') };
          })()`);
          if (info) break;
          await esperar(150);
        }
        if (!info) { if (paso === 0) { console.log(`✗ ${rec.id} ${vista} ${tema}: el recorrido no mostró ningún paso`); problemas++; } break; }
        await esperar(450); // deja terminar el pequeño movimiento del resalte y se vuelve a medir
        info = (await js(`(() => {
          const g = document.querySelector('[data-recorrido] [role=region]');
          const ring = document.querySelector('[data-recorrido] .ring-2');
          if (!g) return null;
          const b = g.getBoundingClientRect(); const r = ring ? ring.getBoundingClientRect() : null;
          return { globo: { top: b.top, left: b.left, width: b.width, height: b.height }, ring: r && { top: r.top, left: r.left, width: r.width, height: r.height }, vw: innerWidth, vh: innerHeight, ultimo: [...g.querySelectorAll('button')].some(x => x.textContent.trim() === 'Entendido') };
        })()`)) ?? info;
        paso++;
        // Comprobaciones: el globo cabe en la pantalla; el resalte rodea algo visible
        const g = info.globo;
        const dentro = g.top >= -1 && g.left >= -1 && g.top + g.height <= info.vh + 1 && g.left + g.width <= info.vw + 1;
        const resalte = info.ring && info.ring.width > 8 && info.ring.height > 8 && info.ring.top < info.vh && info.ring.top + info.ring.height > 0;
        const solapa = info.ring && !(info.vw < 640) && g.top < info.ring.top + info.ring.height && g.top + g.height > info.ring.top && g.left < info.ring.left + info.ring.width && g.left + g.width > info.ring.left;
        if (!dentro || !resalte || solapa) { problemas++; console.log(`✗ ${rec.id} paso ${paso} ${vista} ${tema}: ${!dentro ? 'globo fuera de la pantalla ' : ''}${!resalte ? 'sin resalte visible ' : ''}${solapa ? 'el globo tapa al elemento' : ''}`); }
        const r = await cdp('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${salida}/${rec.id}-paso${paso}-${vista}-${tema}.png`, Buffer.from(r.result.data, 'base64'));
        capturas++;
        await js("[...document.querySelectorAll('[data-recorrido] button')].find(b => /Siguiente|Entendido/.test(b.textContent))?.click()");
        if (info.ultimo) break;
        await esperar(400);
      }
      await esperar(500);
      const quedo = await js("!!document.querySelector('[data-recorrido]')");
      if (quedo) { problemas++; console.log(`✗ ${rec.id} ${vista} ${tema}: el recorrido no se cerró al terminar`); await js("[...document.querySelectorAll('[data-recorrido] button')].find(b => /Saltar/.test(b.textContent))?.click()"); }
      console.log(`${rec.id} ${vista} ${tema}: ${paso} pasos`);
    }
  }
}
console.log(`\n${capturas} capturas en ${salida}. ${problemas ? problemas + ' problemas.' : 'Sin problemas de posición.'}`);
ws.close(); chrome.kill();
process.exit(problemas ? 1 : 0);
