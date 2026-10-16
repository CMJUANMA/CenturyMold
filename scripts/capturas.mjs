// Toma capturas de las pantallas principales en tema claro y oscuro, en escritorio y celular, con Chrome (protocolo CDP, sin dependencias).
// Necesita: los emuladores sembrados (scripts/sembrar-emulador.mjs), `npm run capturas:build` y un servidor sobre .tmp/dist-emulador:
//   npx vite preview --outDir .tmp/dist-emulador --port 4174
// Uso: node scripts/capturas.mjs <carpeta de salida> [--solo=login,inicio]   (ej. node scripts/capturas.mjs .tmp/capturas/antes)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const salida = process.argv[2] ?? '.tmp/capturas/antes';
const solo = (process.argv.find(a => a.startsWith('--solo=')) ?? '').replace('--solo=', '').split(',').filter(Boolean);
const BASE = process.env.BASE ?? 'http://localhost:4174';
const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USUARIO = process.env.CAP_USUARIO ?? '90001';
const PASSWORD = process.env.CAP_PASSWORD ?? 'Prueba123';

const PANTALLAS = [
  ['login', '/login', false],
  ['inicio-rh', '/', true],
  ['solicitar-te', '/tiempo-extra/nueva', true],
  ['por-autorizar', '/tiempo-extra/autorizar', true],
  ['por-enviar', '/tiempo-extra/recepcion', true],
  ['padron', '/personal/padron', true],
  ['organigrama', '/personal/accesos/organigrama', true],
  ['mi-cuenta', '/mi-cuenta', true],
  ['guia-de-estilo', '/herramientas/guia-de-estilo', true],
  ['consulta', '/tiempo-extra/consulta', true],
  ['mis-solicitudes', '/tiempo-extra/mis-solicitudes', true],
  ['estructura', '/personal/estructura', true],
  ['asignaciones', '/personal/accesos/asignaciones', true],
  ['transporte', '/transporte/solicitudes', true],
  ['catalogos', '/transporte/catalogos', true],
  ['usuarios', '/personal/accesos/usuarios', true],
  ['herramientas', '/herramientas', true],
  ['cambiar-password', '/cambiar-password', true],
  ['no-encontrada', '/esta-pagina-no-existe', true],
  // Con una acción previa (texto de un botón o pestaña que se pulsa antes de capturar)
  ['padron-importar', '/personal/padron', true, { id: 'btn-importar-empleados' }],
  ['padron-nuevo', '/personal/padron', true, { texto: 'Nuevo empleado' }],
  ['estructura-puestos', '/personal/estructura', true, { texto: 'Puestos' }],
  ['estructura-turnos', '/personal/estructura', true, { texto: 'Turnos' }],
  ['asignar-rol', '/personal/accesos/asignaciones', true, { id: 'btn-asignar-rol' }],
  ['catalogos-puntos', '/transporte/catalogos', true, { texto: 'Puntos de reunión' }],
];
const VISTAS = [
  ['escritorio', { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false }],
  ['escritorio-1366', { width: 1366, height: 768, deviceScaleFactor: 1.5, mobile: false, soloVista: true }], // solo lo que cabe en pantalla: así se ve si el menú necesita scroll
  ['celular', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }],
];
const TEMAS = ['claro', 'oscuro'];
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

mkdirSync(salida, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9334', '--user-data-dir=' + process.env.TEMP + '\\cm-capturas2', 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const lista = await (await fetch('http://127.0.0.1:9334/json')).json();
    const pagina = lista.find(t => t.type === 'page');
    if (pagina) ws = new WebSocket(pagina.webSocketDebuggerUrl);
  } catch { await esperar(250); }
}
await new Promise(r => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (method, params = {}) => new Promise(res => { const n = ++id; pend.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const js = async (expresion) => (await cdp('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true })).result?.result?.value;
const ir = async (ruta, ms = 2200) => { await cdp('Page.navigate', { url: BASE + ruta }); await esperar(ms); };
const preparar = async (vista, tema) => {
  const { soloVista, ...metricas } = vista;
  await cdp('Emulation.setDeviceMetricsOverride', metricas);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }] });
};
const capturar = async (nombre, vista, tema) => {
  const v = VISTAS.find(x => x[0] === vista)[1];
  const alto = v.soloVista ? v.height : await js('Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), 3200)');
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: v.width, height: Math.max(alto, v.height), scale: 1 } });
  writeFileSync(`${salida}/${nombre}-${vista}-${tema}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('captura', nombre, vista, tema);
};
const quiere = (nombre) => !solo.length || solo.includes(nombre);

await cdp('Page.enable');
// Sin sesión ni datos de corridas anteriores (si no, /login redirige al Inicio)
await cdp('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' });
// 1) Login (sin sesión)
if (quiere('login')) {
  for (const [vista, v] of VISTAS) for (const tema of TEMAS) { await preparar(v, tema); await ir('/login', 1500); await capturar('login', vista, tema); }
}
// 2) Entrar como admin
await preparar(VISTAS[0][1], 'claro');
await ir('/login', 1500);
const poner = (idCampo, texto) => js(`(() => { const e = document.getElementById('${idCampo}'); e.focus(); return true; })()`).then(() => cdp('Input.insertText', { text: texto }));
await poner('login-nomina', USUARIO);
await poner('login-password', PASSWORD);
await js("document.getElementById('btn-ingresar').click()");
await esperar(3500);
// 3) Pantallas con sesión
for (const [nombre, ruta, conSesion, accion] of PANTALLAS) {
  if (!conSesion || !quiere(nombre)) continue;
  for (const [vista, v] of VISTAS) {
    for (const tema of TEMAS) {
      await preparar(v, tema);
      await ir(ruta);
      if (accion?.id) { await js(`document.getElementById('${accion.id}')?.click()`); await esperar(700); }
      if (accion?.texto) { await js(`[...document.querySelectorAll('button, [role=tab], a')].find(e => e.textContent.trim().startsWith('${accion.texto}'))?.click()`); await esperar(700); }
      await capturar(nombre, vista, tema);
    }
  }
}
ws.close(); chrome.kill();
