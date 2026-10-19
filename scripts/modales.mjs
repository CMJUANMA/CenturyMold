// Revisión automática (Playwright) de TODOS los modales, paneles y menús flotantes: los abre en cada medida de pantalla, con zoom del navegador al
// 125 % y 150 % y con «Letra grande», y comprueba que queden dentro de la pantalla, que el botón de cerrar y las acciones se alcancen y que el fondo
// no se desplace. Guarda una captura por caso en .tmp/capturas/modales/ y termina con código 1 si algo falla.
//
// Necesita lo mismo que scripts/capturas.mjs: emuladores sembrados (scripts/sembrar-emulador.mjs), `npm run capturas:build` y
//   npx vite preview --outDir .tmp/dist-emulador --port 4174
// Usa el Chrome instalado (no descarga navegadores). Uso:
//   node scripts/modales.mjs [--solo=detalle-borrador,formato-rutas] [--variantes=1366x768,390x844] [--rapido]
//   --rapido: solo las medidas base (sin zoom ni letra grande)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4174';
const SALIDA = '.tmp/capturas/modales';
const PASSWORD = process.env.CAP_PASSWORD ?? 'Prueba123';
const arg = (n) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? '').replace(`--${n}=`, '').split(',').filter(Boolean);
const SOLO = arg('solo');
const RAPIDO = process.argv.includes('--rapido');
mkdirSync(SALIDA, { recursive: true });

// ── Medidas ─────────────────────────────────────────────────────────────
const MEDIDAS = [[1366, 768], [1440, 900], [1920, 1080], [768, 1024], [390, 844], [360, 640]];
const VARIANTES = [];
for (const [w, h] of MEDIDAS) VARIANTES.push({ id: `${w}x${h}`, w, h, zoom: 1, letra: false });
if (!RAPIDO) {
  for (const [w, h] of [[1366, 768], [768, 1024], [390, 844], [360, 640]]) {
    VARIANTES.push({ id: `${w}x${h}-zoom125`, w, h, zoom: 1.25, letra: false });
    VARIANTES.push({ id: `${w}x${h}-zoom150`, w, h, zoom: 1.5, letra: false });
    VARIANTES.push({ id: `${w}x${h}-letra-grande`, w, h, zoom: 1, letra: true });
  }
}
const variantesElegidas = arg('variantes');

// ── Datos extra para los modales de transporte (solicitudes de hoy con pasajeros) ──
const PROYECTO = 'demo-solicitud-rutas';
const FS = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const valor = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
};
async function guardar(ruta, datos) {
  const r = await fetch(`${FS}/${ruta}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, valor(v)])) }) });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
}
const hoy = new Date();
const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
async function sembrarTransporte() {
  const pas = (n, nombre, extra = {}) => ({ nomina: n, nombre, puesto: 'MOLDEADOR', areaId: 'moldes', turno: '1', horaEntrada: '7:00AM', horaSalida: '4:00PM', alimentos: false, rutaId: 'norte', comunidadId: 'pueblito', puntoReunionId: 'plaza', ...extra });
  await guardar('solicitudes/modalA', {
    fechaSolicitud: new Date(Date.now() - 3600_000), fechaServicio: ymd, solicitanteNombre: 'ACOSTA OSCAR', solicitanteNomina: '50532', creadoPor: 'semilla', estatus: 'aprobada', areaId: 'moldes',
    origen: 'tiempo_extra', tiempoExtraId: 'semilla1', folioTE: 'TE-2026-0012', totalPasajeros: 3, totalAlimentos: 1, conteoTurnos: { 'Turno 1': 3 }, conteoPuestos: { MOLDEADOR: 3 }, historial: [],
  });
  await guardar('solicitudes/modalA/pasajeros/700', pas(700, 'GARCÍA LÓPEZ JOSÉ'));
  await guardar('solicitudes/modalA/pasajeros/701', pas(701, 'HERNÁNDEZ RUIZ MARÍA', { turno: '2', horaEntrada: '4:00PM', horaSalida: '12:00AM', alimentos: true }));
  await guardar('solicitudes/modalA/pasajeros/702', pas(702, 'MARTÍNEZ SOTO LUIS', { horaEntrada: 'YA EN PLANTA', horaSalida: '7:00PM' }));
  await guardar('solicitudes/modalB', {
    fechaSolicitud: new Date(Date.now() - 7200_000), fechaServicio: ymd, solicitanteNombre: 'MENDOZA ANSELMO', solicitanteNomina: '50610', creadoPor: 'semilla', estatus: 'aprobada', areaId: 'produccion',
    origen: 'tiempo_extra', tiempoExtraId: 'semilla2', folioTE: 'TE-2026-0013', totalPasajeros: 3, totalAlimentos: 0, conteoTurnos: { 'Turno 3': 3 }, conteoPuestos: { OPERADOR: 3 }, historial: [],
  });
  for (const [n, nombre] of [[710, 'TORRES VEGA PEDRO'], [711, 'FLORES MORA CARLOS'], [712, 'RIVERA DÍAZ ELENA']]) await guardar(`solicitudes/modalB/pasajeros/${n}`, pas(n, nombre, { turno: '3', horaEntrada: '12:00AM', horaSalida: '7:00AM', areaId: 'produccion' }));
  await guardar('solicitudes/modalVieja', { fechaSolicitud: '2026-10-10T10:00:00.000Z', fechaServicio: ymd, solicitanteNombre: 'PEREZ JUAN', creadoPor: 'semilla', estatus: 'aprobada', totalPasajeros: 1, conteoTurnos: {}, conteoPuestos: {}, historial: [] });
  await guardar('solicitudes/modalVieja/pasajeros/900', pas(900, 'ZAMORA LUIS'));
}

// ── Escenarios: cada uno abre un modal, panel o menú ─────────────────────
const abrirPorTexto = (nombre, opciones = {}) => async (p) => { const b = p.getByRole('button', { name: nombre, ...opciones }).first(); await b.waitFor({ timeout: 6000 }); await b.click(); };
const porId = (id) => async (p) => { const b = p.locator(`#${id}`).first(); await b.waitFor({ timeout: 6000 }); await b.click(); };
const ESCENARIOS = [
  // Solicitante (Oscar, Moldes)
  { id: 'detalle-borrador', usuario: '50532', ruta: '/tiempo-extra/mis-solicitudes?pestana=borrador', abrir: abrirPorTexto(/^Ver/) },
  { id: 'detalle-en-autorizacion', usuario: '50532', ruta: '/tiempo-extra/mis-solicitudes?pestana=autorizacion', abrir: abrirPorTexto(/^Ver/) },
  { id: 'detalle-autorizada', usuario: '50532', ruta: '/tiempo-extra/mis-solicitudes?pestana=autorizada', abrir: abrirPorTexto(/^Ver/) },
  { id: 'confirmar-eliminar-borrador', usuario: '50532', ruta: '/tiempo-extra/mis-solicitudes?pestana=borrador', abrir: abrirPorTexto(/^Eliminar/) },
  { id: 'confirmar-cancelar-solicitud', usuario: '50532', ruta: '/tiempo-extra/mis-solicitudes?pestana=autorizacion', abrir: abrirPorTexto(/^Cancelar/) },
  { id: 'ayuda-solicitar', usuario: '50532', ruta: '/tiempo-extra/nueva', abrir: async (p) => { await p.locator('[aria-label="Ayuda de esta pantalla"]').first().click(); } },
  { id: 'selector-empleados', usuario: '50532', ruta: '/tiempo-extra/nueva', abrir: porId('btn-agregar-empleados') },
  // Aut. 1 (Anselmo)
  { id: 'bandeja-detalle', usuario: '50610', ruta: '/tiempo-extra/autorizar', abrir: abrirPorTexto(/Revisar/) },
  { id: 'bandeja-confirmar-cancelar', usuario: '50610', ruta: '/tiempo-extra/autorizar', abrir: async (p) => { await abrirPorTexto(/Revisar/)(p); await p.locator('#btn-cancelar-solicitud').click(); } },
  // RH
  { id: 'recepcion-detalle', usuario: '90002', ruta: '/tiempo-extra/recepcion', abrir: abrirPorTexto(/^Revisar/) },
  { id: 'formato-rutas', usuario: '90002', ruta: '/tiempo-extra/recepcion', abrir: porId('btn-formato-rutas-recepcion') },
  { id: 'descarga-resumen-horas', usuario: '90002', ruta: '/tiempo-extra/recepcion', abrir: porId('btn-descargar-te-recepcion') },
  { id: 'consulta-detalle', usuario: '90002', ruta: '/tiempo-extra/consulta', abrir: abrirPorTexto(/^Ver/) },
  { id: 'transporte-detalle', usuario: '90002', ruta: '/transporte/solicitudes', abrir: async (p) => { await p.getByRole('button', { name: /Ver detalle/ }).first().click(); } },
  { id: 'padron-nuevo-empleado', usuario: '90002', ruta: '/personal/padron', abrir: abrirPorTexto(/Nuevo empleado/) },
  { id: 'padron-importar', usuario: '90002', ruta: '/personal/padron', abrir: porId('btn-importar-empleados') },
  { id: 'estructura-puestos-nuevo', usuario: '90002', ruta: '/personal/estructura', abrir: async (p) => { await p.getByRole('tab', { name: /Puestos/ }).click(); await abrirPorTexto(/Nuevo puesto|Agregar puesto|Nuevo/)(p); } },
  { id: 'catalogos-nueva-ruta', usuario: '90002', ruta: '/transporte/catalogos', abrir: abrirPorTexto(/Nueva ruta|Nuevo|Agregar/) },
  // Admin
  { id: 'usuarios-nuevo', usuario: '90001', ruta: '/personal/accesos/usuarios', abrir: abrirPorTexto(/Nuevo usuario/) },
  { id: 'usuarios-editar', usuario: '90001', ruta: '/personal/accesos/usuarios', abrir: async (p) => { await p.locator('button[title="Editar"]').first().click(); } },
  { id: 'usuarios-lote', usuario: '90001', ruta: '/personal/accesos/usuarios', abrir: porId('btn-usuarios-lote') },
  { id: 'usuarios-restablecer-acceso', usuario: '90001', ruta: '/personal/accesos/usuarios', abrir: async (p) => { await p.locator('button[title="Restablecer acceso"]').first().click(); } },
  { id: 'asignar-rol', usuario: '90001', ruta: '/personal/accesos/asignaciones', abrir: porId('btn-asignar-rol') },
  { id: 'asignaciones-carga-inicial', usuario: '90001', ruta: '/personal/accesos/asignaciones', abrir: porId('btn-carga-inicial') },
  { id: 'panel-persona', usuario: '90001', ruta: '/personal/accesos/organigrama', abrir: async (p) => { await p.locator('button:visible:has-text("MENDOZA"), button:visible:has-text("ACOSTA"), [role=button]:visible:has-text("MENDOZA")').first().click({ timeout: 8000 }); }, panel: true },
  // Pantalla de acceso
  { id: 'login-olvide-contrasena', usuario: null, ruta: '/login', abrir: porId('btn-olvide-password') },
  // Menú lateral en celular y tableta
  { id: 'menu-lateral-celular', usuario: '90002', ruta: '/', abrir: async (p) => { await p.locator('#btn-menu-movil').click(); }, soloAncho: 1023, panel: true, menu: true },
];

// ── Comprobaciones dentro de la página ───────────────────────────────────
const MEDIR = (menu) => {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const cajas = [...document.querySelectorAll(menu ? '#menu-lateral' : '[role=dialog][aria-modal=true], aside[role=dialog]')].filter(e => e.getClientRects().length > 0);
  // El de encima: el último en el documento, salvo el menú lateral cuando hay un modal
  const panel = cajas.filter(e => e.id !== 'menu-lateral').pop() ?? cajas[0] ?? null;
  if (!panel) return { hay: false, vw, vh };
  const r = panel.getBoundingClientRect();
  const el = document.documentElement;
  const cierre = panel.querySelector('button[aria-label="Cerrar"], button[aria-label="Cerrar panel"], button[aria-label="Cerrar menú"]') ?? document.querySelector('#btn-menu-movil');
  const rc = cierre?.getBoundingClientRect();
  // Zona que se desplaza dentro del panel
  const cuerpo = panel.querySelector('.modal-cuerpo') ?? [...panel.querySelectorAll('*')].find(e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1; }) ?? null;
  const hayScroll = !!cuerpo && cuerpo.scrollHeight > cuerpo.clientHeight + 1;
  return {
    hay: true, vw, vh,
    rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
    cierre: rc ? { top: rc.top, left: rc.left, right: rc.right, bottom: rc.bottom, visible: cierre.getClientRects().length > 0 } : null,
    fondoBloqueado: getComputedStyle(el).overflow === 'hidden' || getComputedStyle(document.body).overflow === 'hidden',
    hayScroll, scrollable: !!cuerpo && ['auto', 'scroll'].includes(getComputedStyle(cuerpo).overflowY),
    scrollHorizontalPagina: el.scrollWidth > vw + 1,
    scrollHorizontalPanel: panel.scrollWidth > panel.clientWidth + 1,
  };
};

/** Cada botón o campo del panel: lo lleva a la vista dentro del panel y dice si queda dentro de la pantalla y del panel */
const ALCANCE = (menu) => {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const cajas = [...document.querySelectorAll(menu ? '#menu-lateral' : '[role=dialog][aria-modal=true], aside[role=dialog]')].filter(e => e.getClientRects().length > 0);
  const panel = cajas.filter(e => e.id !== 'menu-lateral').pop() ?? cajas[0];
  if (!panel) return [];
  const fallas = [];
  const controles = [...panel.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(e => e.getClientRects().length > 0 && !e.disabled && !e.closest('[hidden]'));
  for (const c of controles) {
    c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = c.getBoundingClientRect(); const p = panel.getBoundingClientRect();
    const enPantalla = r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1;
    const enPanel = r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.left >= p.left - 1 && r.right <= p.right + 1;
    if (!enPantalla || !enPanel) fallas.push(`${c.tagName.toLowerCase()} «${(c.getAttribute('aria-label') ?? c.textContent ?? c.placeholder ?? '').trim().slice(0, 40)}» ${!enPantalla ? 'fuera de la pantalla' : 'fuera del panel'}`);
  }
  // Se deja el scroll arriba otra vez
  for (const e of panel.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0;
  return fallas;
};

function juzgar(m, esc, v) {
  const fallas = [];
  if (!m.hay) return ['no se abrió (no se encontró un diálogo visible)'];
  const { rect: r, vw, vh } = m;
  const tol = 1.5;
  if (r.top < -tol || r.left < -tol || r.right > vw + tol || r.bottom > vh + tol) fallas.push(`se sale de la pantalla (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)} de ${vh}; left ${Math.round(r.left)}, right ${Math.round(r.right)} de ${vw})`);
  if (r.height > vh + tol) fallas.push(`más alto que la pantalla (${Math.round(r.height)} > ${vh})`);
  if (m.cierre && (!m.cierre.visible || m.cierre.top < -tol || m.cierre.bottom > vh + tol || m.cierre.left < -tol || m.cierre.right > vw + tol)) fallas.push('el botón de cerrar no está a la vista');
  if (!m.cierre && !esc.panel) fallas.push('no tiene botón de cerrar');
  if (!m.fondoBloqueado) fallas.push('el fondo sigue desplazándose (scroll no bloqueado)');
  if (m.hayScroll && !m.scrollable) fallas.push('el contenido no cabe y no se puede desplazar');
  if (m.scrollHorizontalPanel) fallas.push('el contenido se sale por un lado (scroll horizontal dentro del panel)');
  if (vw < 640 && !esc.panel && (Math.abs(r.width - vw) > 2 || r.bottom < vh - 2)) fallas.push('en celular debería ser una hoja de todo el ancho pegada abajo');
  return fallas;
}

// ── Ejecución ───────────────────────────────────────────────────────────
const navegador = await chromium.launch({ channel: 'chrome' });
await sembrarTransporte();
const sesiones = new Map(); // usuario → estado de sesión guardado
async function sesionDe(usuario) {
  if (sesiones.has(usuario)) return sesiones.get(usuario);
  const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('#login-nomina', usuario); await p.fill('#login-password', PASSWORD); await p.click('#btn-ingresar');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await p.waitForTimeout(1500);
  const estado = await ctx.storageState({ indexedDB: true });
  await ctx.close();
  sesiones.set(usuario, estado);
  return estado;
}

const resultados = [];
let revisados = 0;
for (const v of VARIANTES) {
  if (variantesElegidas.length && !variantesElegidas.includes(v.id.split('-')[0]) && !variantesElegidas.includes(v.id)) continue;
  const usuarios = [...new Set(ESCENARIOS.map(e => e.usuario))];
  for (const usuario of usuarios) {
    const escs = ESCENARIOS.filter(e => e.usuario === usuario && (!SOLO.length || SOLO.includes(e.id)) && (!e.soloAncho || v.w <= e.soloAncho));
    if (!escs.length) continue;
    const estado = usuario ? await sesionDe(usuario) : undefined;
    const ctx = await navegador.newContext({ viewport: { width: Math.round(v.w / v.zoom), height: Math.round(v.h / v.zoom) }, deviceScaleFactor: v.zoom, storageState: estado, isMobile: v.w < 640, hasTouch: v.w < 800 });
    const p = await ctx.newPage();
    let rutaActual = null;
    for (const esc of escs) {
      const etiqueta = `${esc.id} @ ${v.id}`;
      try {
        if (rutaActual !== esc.ruta) { await p.goto(`${BASE}${esc.ruta}`); rutaActual = esc.ruta; await p.waitForTimeout(2500); }
        if (v.letra) await p.evaluate(() => { document.documentElement.style.fontSize = '120%'; });
        await p.evaluate(() => { window.scrollTo(0, 0); });
        await esc.abrir(p);
        await p.waitForTimeout(700);
        const medida = await p.evaluate(MEDIR, !!esc.menu);
        let fallas = juzgar(medida, esc, v);
        const sinAlcance = medida.hay ? await p.evaluate(ALCANCE, !!esc.menu) : [];
        fallas = fallas.concat(sinAlcance.map(f => `no se alcanza: ${f}`));
        await p.screenshot({ path: `${SALIDA}/${esc.id}-${v.id}.jpg`, type: 'jpeg', quality: 55 });
        resultados.push({ etiqueta, fallas });
        revisados++;
        if (fallas.length) console.log(`✗ ${etiqueta}\n    - ${fallas.join('\n    - ')}`);
        // Cerrar para el siguiente caso (Escape; si no cierra, se recarga la ruta)
        await p.keyboard.press('Escape');
        await p.waitForTimeout(250);
        if (await p.locator('[role=dialog][aria-modal=true], aside[role=dialog]').count()) { rutaActual = null; }
      } catch (err) {
        resultados.push({ etiqueta, fallas: [`error al abrir: ${err.message.split('\n')[0]}`] });
        console.log(`✗ ${etiqueta}: error al abrir: ${err.message.split('\n')[0]}`);
        rutaActual = null;
      }
    }
    await ctx.close();
  }
  console.log(`… ${v.id} listo`);
}
await navegador.close();

const malos = resultados.filter(r => r.fallas.length);
writeFileSync(`${SALIDA}/resultado.json`, JSON.stringify({ total: resultados.length, fallidos: malos.length, malos }, null, 2));
console.log(`\n${resultados.length} casos revisados, ${malos.length} con problemas. Capturas en ${SALIDA}/`);
process.exit(malos.length ? 1 : 0);
