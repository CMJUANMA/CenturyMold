// Infraestructura de la prueba de punta a punta (npm run prueba:piloto): emuladores, app en modo emulador, navegador y utilidades.
// SOLO toca el EMULADOR (127.0.0.1, proyecto «demo-…»): nunca producción.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

export const PROYECTO = 'demo-solicitud-rutas';
export const PUERTO_APP = 4175;
export const BASE = `http://localhost:${PUERTO_APP}`;
export const FS = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const AUTH_URL = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
export const SALIDA = '.tmp/piloto';
mkdirSync(SALIDA, { recursive: true });

export const esperar = (ms) => new Promise(r => setTimeout(r, ms));
export const arriba = async (url) => { try { await fetch(url); return true; } catch { return false; } };

// ── Procesos ────────────────────────────────────────────────────────────────
const hijos = [];
export const lanzar = (cmd) => { const h = spawn(cmd, { shell: true, stdio: 'ignore' }); hijos.push(h); return h; };
export const correr = (cmd) => { const r = spawnSync(cmd, { shell: true, stdio: 'inherit' }); if (r.status !== 0) throw new Error(`Falló el comando: ${cmd}`); };
export const apagarTodo = () => { for (const h of hijos) { try { spawnSync(`taskkill /pid ${h.pid} /T /F`, { shell: true, stdio: 'ignore' }); } catch { /* ya terminó */ } } };

export async function prepararEntorno({ sinBuild }) {
  if (!(await arriba('http://127.0.0.1:8080'))) {
    console.log('Iniciando los emuladores (Auth y Firestore)…');
    lanzar(`npx firebase emulators:start --only auth,firestore --project ${PROYECTO}`);
    for (let i = 0; i < 45 && !(await arriba('http://127.0.0.1:8080') && await arriba('http://127.0.0.1:9099')); i++) await esperar(2000);
    if (!(await arriba('http://127.0.0.1:8080'))) throw new Error('Los emuladores no arrancaron (¿Java instalado? ¿puertos 8080 y 9099 libres?).');
  } else console.log('Usando los emuladores que ya estaban corriendo (si cambiaste firestore.rules, reinícialos).');
  if (!sinBuild) { console.log('Compilando la app en modo emulador…'); correr('npm run capturas:build'); }
  if (await arriba(`http://localhost:${PUERTO_APP}`)) throw new Error(`Ya hay algo en el puerto ${PUERTO_APP}: ciérralo para que la prueba use su propia copia compilada.`);
  lanzar(`npx vite preview --outDir .tmp/dist-emulador --port ${PUERTO_APP} --strictPort`);
  for (let i = 0; i < 30 && !(await arriba(`http://localhost:${PUERTO_APP}`)); i++) await esperar(1000);
  if (!(await arriba(`http://localhost:${PUERTO_APP}`))) throw new Error('La app compilada no arrancó.');
}

// ── Firestore y Auth del emulador (REST, con permisos de dueño: saltan las reglas) ─────────────────
async function http(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`${opciones?.method ?? 'GET'} ${url}: ${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}
const valor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
};
const desvalor = (v) => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(desvalor);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, desvalor(x)]));
  return undefined;
};
const dueno = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
export const guardar = (ruta, datos) => http(`${FS}/${ruta}`, { method: 'PATCH', headers: dueno, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valor(v)])) }) });
/** Documentos de una colección (id + datos), con la subcolección opcional «sub» */
export async function leerColeccion(ruta) {
  const docs = [];
  let token = '';
  do {
    const j = await http(`${FS}/${ruta}?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: dueno });
    for (const d of j.documents ?? []) docs.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, desvalor(v)])) });
    token = j.nextPageToken ?? '';
  } while (token);
  return docs;
}
export async function leerDoc(ruta) {
  const r = await fetch(`${FS}/${ruta}`, { headers: dueno });
  if (r.status === 404) return null;
  const d = await r.json();
  return Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, desvalor(v)]));
}
export const vaciarEmuladores = async () => {
  await http(`http://127.0.0.1:8080/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
  await http(`http://127.0.0.1:9099/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });
};
export async function crearCuenta(correo, password) {
  const j = await http(`${AUTH_URL}/accounts:signUp?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password, returnSecureToken: true }) });
  return j.localId;
}
/** Todas las cuentas de Authentication del emulador (correo y uid) */
export async function cuentasAuth() {
  const j = await http(`${AUTH_URL}/projects/${PROYECTO}/accounts:batchGet?maxResults=1000`, { headers: dueno });
  return (j.users ?? []).map(u => ({ uid: u.localId, correo: u.email }));
}
/** Equivale a borrar la cuenta en la consola de Firebase › Authentication */
export const borrarCuentaAuth = (uid) => http(`${AUTH_URL}/projects/${PROYECTO}/accounts:delete`, { method: 'POST', headers: dueno, body: JSON.stringify({ localId: uid }) });

// ── Navegador ───────────────────────────────────────────────────────────────
export async function abrirNavegador() {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); } catch { browser = await chromium.launch({ headless: true }); }
  return browser;
}
export async function nuevaPagina(browser, { carpetaDescargas } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, colorScheme: 'light', locale: 'es-MX', timezoneId: 'America/Mexico_City', acceptDownloads: true, ...(carpetaDescargas ? {} : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.errores = [];
  page.on('pageerror', e => page.errores.push(e.message));
  return page;
}

// ── Pasos con mensajes claros ───────────────────────────────────────────────
export const resultados = [];
let contador = 0;
export async function paso(descripcion, fn, { page } = {}) {
  contador++;
  const n = contador;
  const t0 = Date.now();
  try {
    const nota = await fn();
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    resultados.push({ n, descripcion, ok: true, nota: nota ?? '' });
    console.log(`  ✓ ${String(n).padStart(2, '0')}. ${descripcion}${nota ? ` — ${nota}` : ''} (${seg} s)`);
  } catch (err) {
    const msg = String(err.message ?? err).split('\n').filter(x => x.trim()).slice(0, 4).join(' ¦ ');
    resultados.push({ n, descripcion, ok: false, nota: msg });
    console.log(`  ✗ ${String(n).padStart(2, '0')}. ${descripcion}\n      → ${msg}`);
    if (page) { const f = `${SALIDA}/fallo-${String(n).padStart(2, '0')}.png`; await page.screenshot({ path: f, fullPage: false }).catch(() => {}); console.log(`      captura: ${f}  ·  URL: ${page.url()}`); }
    const e = new Error(`Falló el paso ${n}: ${descripcion}. ${msg}`); e.yaMostrado = true; throw e;
  }
}
export function verificar(condicion, mensaje) { if (!condicion) throw new Error(mensaje); }
export function igual(real, esperado, que) {
  const a = JSON.stringify(real); const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${que}: se esperaba ${b} y salió ${a}`);
}
