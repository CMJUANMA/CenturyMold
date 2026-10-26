// Anotaciones sobre las capturas de los manuales: se dibuja un overlay SVG (fijo, sobre toda la ventana) justo ANTES de tomar la captura.
// Recuadros rojos (#d61110) alrededor del botón o campo, flechas y números en círculo (1, 2, 3) que coinciden con los pasos del texto.
//
//   await capturar(page, 'solicitante/01-entrar', [
//     { en: page.locator('#login-nomina'), n: 1 },                      // recuadro + círculo con el 1 en la esquina
//     { en: page.locator('#btn-ingresar'), n: 3, flecha: 'izquierda' },  // recuadro + círculo al lado con una flecha hacia el recuadro
//   ]);
// Cada anotación: { en: Locator, n?: número, flecha?: 'izquierda'|'derecha'|'arriba'|'abajo', margen?: px, sinCaja?: true }. `en` también puede ser una lista de locators (un solo recuadro que los abarca).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const ROJO = '#d61110';
export const CARPETA_CAPTURAS = 'docs/manuales/capturas';

async function caja(en) {
  const lista = Array.isArray(en) ? en : [en];
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const loc of lista) {
    const el = loc.first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const b = await el.boundingBox();
    if (!b) throw new Error('No se encontró el elemento para anotar: ' + String(loc));
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.width); y2 = Math.max(y2, b.y + b.height);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Dibuja las anotaciones en la página (ya medidas) */
async function dibujar(page, figuras) {
  await page.evaluate(({ figuras, ROJO }) => {
    document.getElementById('anotaciones-manual')?.remove();
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'anotaciones-manual';
    svg.setAttribute('width', String(window.innerWidth)); svg.setAttribute('height', String(window.innerHeight));
    svg.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647';
    const el = (nombre, attrs, padre = svg) => { const e = document.createElementNS(NS, nombre); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); padre.appendChild(e); return e; };
    const defs = el('defs', {});
    const marca = el('marker', { id: 'punta-manual', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: ROJO }, marca);
    for (const f of figuras) {
      if (!f.sinCaja) el('rect', { x: f.x, y: f.y, width: f.w, height: f.h, rx: 6, fill: 'none', stroke: ROJO, 'stroke-width': 3 });
      if (f.n == null) continue;
      const R = 13;
      // Posición del círculo: en la esquina superior izquierda (sin flecha) o a un lado con una flecha hacia el recuadro
      let cx = f.x - 4, cy = f.y - 4;
      if (f.flecha) {
        const sep = 46;
        if (f.flecha === 'izquierda') { cx = f.x - sep; cy = f.y + f.h / 2; el('line', { x1: cx + R, y1: cy, x2: f.x - 3, y2: cy, stroke: ROJO, 'stroke-width': 3, 'marker-end': 'url(#punta-manual)' }); }
        if (f.flecha === 'derecha') { cx = f.x + f.w + sep; cy = f.y + f.h / 2; el('line', { x1: cx - R, y1: cy, x2: f.x + f.w + 3, y2: cy, stroke: ROJO, 'stroke-width': 3, 'marker-end': 'url(#punta-manual)' }); }
        if (f.flecha === 'arriba') { cx = f.x + f.w / 2; cy = f.y - sep; el('line', { x1: cx, y1: cy + R, x2: cx, y2: f.y - 3, stroke: ROJO, 'stroke-width': 3, 'marker-end': 'url(#punta-manual)' }); }
        if (f.flecha === 'abajo') { cx = f.x + f.w / 2; cy = f.y + f.h + sep; el('line', { x1: cx, y1: cy - R, x2: cx, y2: f.y + f.h + 3, stroke: ROJO, 'stroke-width': 3, 'marker-end': 'url(#punta-manual)' }); }
      }
      cx = Math.max(R + 2, cx); cy = Math.max(R + 2, cy);
      el('circle', { cx, cy, r: R, fill: ROJO, stroke: '#fff', 'stroke-width': 2 });
      const t = el('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 15, 'font-weight': 700, 'font-family': 'Arial, sans-serif' });
      t.textContent = String(f.n);
    }
    document.body.appendChild(svg);
  }, { figuras, ROJO });
}

/**
 * Toma la captura de la ventana con las anotaciones. `nombre` sin extensión, relativo a docs/manuales/capturas (ej. 'solicitante/01-entrar').
 * @param {import('playwright').Page} page
 * @param {string} nombre
 * @param {{ en: any, n?: number, flecha?: string, margen?: number, sinCaja?: boolean }[]} anotaciones
 * @param {{ recorte?: { x, y, width, height }, completa?: boolean }} [opciones]  recorte: parte de la ventana (en píxeles de la ventana)
 */
export async function capturar(page, nombre, anotaciones = [], { recorte, completa = false } = {}) {
  await page.waitForTimeout(400);
  const figuras = [];
  for (const a of anotaciones) {
    const m = a.margen ?? 4;
    const b = await caja(a.en);
    figuras.push({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m, n: a.n, flecha: a.flecha, sinCaja: a.sinCaja });
  }
  await dibujar(page, figuras);
  const ruta = `${CARPETA_CAPTURAS}/${nombre}.png`;
  mkdirSync(dirname(ruta), { recursive: true });
  await page.screenshot({ path: ruta, ...(recorte ? { clip: recorte } : {}), fullPage: completa && !figuras.length });
  await page.evaluate(() => document.getElementById('anotaciones-manual')?.remove());
  return ruta;
}
