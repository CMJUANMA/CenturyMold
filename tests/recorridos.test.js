// Recorridos guiados: cada paso apunta a algo que existe en la pantalla, y la geometría de los globos. Sin navegador (el recorrido real, paso por
// paso, se prueba con scripts/recorridos.mjs, que guarda una captura por paso).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AYUDAS, recorridoDe } from '../src/utils/ayudas.js';
import {
  ANCHO_MOVIL, MARGEN_GLOBO, TOPE_SUPERIOR_MOVIL, colocarGlobo, desplazamientoNecesario, esMovil, recortarAVentana,
} from '../src/utils/recorrido.js';

const archivos = (dir) => readdirSync(dir).flatMap(n => {
  const f = join(dir, n);
  return statSync(f).isDirectory() ? archivos(f) : /\.jsx$/.test(f) ? [f] : [];
});
const fuentes = archivos('src').map(f => ({ f, c: readFileSync(f, 'utf8') }));
const pantallaDe = (id) => fuentes.filter(({ c }) => c.includes(`<AyudaPantalla id="${id}"`));
const nombreDelSelector = (sel) => sel.match(/^\[data-tour="([\w-]+)"\]$/)?.[1];

describe('los pasos de cada recorrido apuntan a algo que existe', () => {
  const ids = Object.keys(AYUDAS.recorridos);
  it('hay recorridos y cada uno tiene su pantalla (con el "?" que lo abre)', () => {
    expect(ids.sort()).toEqual(['autorizar', 'inicioNomina', 'solicitar']);
    for (const id of ids) expect(pantallaDe(id).length, `pantalla de «${id}»`).toBeGreaterThan(0);
  });
  for (const id of Object.keys(AYUDAS.recorridos)) {
    it(`«${id}»: cada selector es data-tour="…" y está escrito en el código de su pantalla`, () => {
      const pantallas = pantallaDe(id);
      for (const paso of recorridoDe(id)) {
        const nombre = nombreDelSelector(paso.selector);
        expect(nombre, `selector ${paso.selector}`).toBeTruthy();
        expect(pantallas.some(({ c }) => c.includes(`data-tour="${nombre}"`) || c.includes(`'${nombre}'`)), `${id} › ${nombre}`).toBe(true);
        expect(paso.titulo.length).toBeGreaterThan(2);
        expect(paso.texto.length).toBeGreaterThan(10);
      }
    });
    it(`«${id}»: no hay dos pasos que señalen lo mismo ni data-tour de más sin paso`, () => {
      const usados = recorridoDe(id).map(p => nombreDelSelector(p.selector));
      expect(new Set(usados).size).toBe(usados.length);
      const enPantalla = pantallaDe(id).flatMap(({ c }) => [...c.matchAll(new RegExp(`data-tour="(${id}-[\\w-]+)"|'(${id}-[\\w-]+)'`, 'g'))].map(m => m[1] ?? m[2]));
      for (const nombre of new Set(enPantalla)) expect(usados, `data-tour «${nombre}» sin paso`).toContain(nombre);
    });
  }
  it('la fila de empleado recibe su data-tour desde la pantalla (primera fila) y el espacio vacío tiene el suyo', () => {
    const editor = fuentes.find(({ f }) => f.endsWith('EditorTE.jsx')).c;
    expect(editor).toContain("tour={i === 0 ? 'solicitar-empleado-fila' : undefined}");
    expect(editor).toContain('data-tour="solicitar-empleados-vacio"');
    expect(fuentes.find(({ f }) => f.endsWith('FilaEmpleadoTE.jsx')).c).toContain('data-tour={tour}');
  });
  it('todo "?" (AyudaPantalla) apunta a una explicación que existe', () => {
    for (const { c } of fuentes) for (const m of c.matchAll(/<AyudaPantalla id="(\w+)"/g)) expect(AYUDAS.pantallas[m[1]], `AyudaPantalla «${m[1]}»`).toBeTruthy();
  });
  it('cada botón o texto entre comillas de las ayudas existe en la aplicación', () => {
    const todo = fuentes.map(({ c }) => c).join('\n');
    const textos = Object.values(AYUDAS.pantallas).flatMap(p => p.pasos).flatMap(t => [...t.matchAll(/"([^"]{3,60})"/g)].map(m => m[1].replace(/[.,]$/, '')));
    for (const t of textos) expect(todo.includes(t) || readFileSync('src/utils/ayudas.js', 'utf8').includes(t), t).toBe(true);
  });
});

describe('Mi cuenta: "Volver a ver los recorridos"', () => {
  it('el botón reinicia los recorridos marcados como vistos', () => {
    const p = readFileSync('src/components/PreferenciasPanel.jsx', 'utf8');
    expect(p).toContain('Volver a ver los recorridos');
    expect(p).toContain('recorridosVistos: []');
  });
});

describe('Recorrido.jsx: comportamiento acordado', () => {
  const r = readFileSync('src/components/Recorrido.jsx', 'utf8');
  it('espera a la pantalla, lleva el elemento a la vista, lo sigue y se dibuja en un portal', () => {
    for (const parte of ['createPortal', 'ResizeObserver', 'requestAnimationFrame', 'getAnimations', "'main .esqueleto'", 'scrollBy', 'esperarFinDeScroll', 'esperarPantallaEstable', 'vacio: true']) {
      expect(r, parte).toContain(parte);
    }
  });
  it('un paso sin elemento se salta (nunca un globo flotando en medio)', () => {
    expect(r).toContain('se salta el paso');
    expect(r).not.toContain('globo sale al centro');
  });
});

describe('geometría del globo', () => {
  const ventana = { w: 1366, h: 768 };
  const globo = { w: 340, h: 180 };
  const r = (top, left, width, height) => ({ top, left, width, height });
  const dentro = (p) => p.top >= MARGEN_GLOBO - 0.01 && p.left >= MARGEN_GLOBO - 0.01 && p.top + globo.h <= ventana.h - MARGEN_GLOBO + 0.01 && p.left + p.ancho <= ventana.w - MARGEN_GLOBO + 0.01;
  it('abajo si hay espacio, y la flecha apunta al centro del elemento', () => {
    const p = colocarGlobo({ rect: r(100, 500, 200, 40), ventana, globo });
    expect(p).toMatchObject({ modo: 'flotante', lado: 'abajo' });
    expect(p.top).toBeGreaterThan(140);
    expect(p.left + p.flecha).toBeCloseTo(600, 0);
    expect(dentro(p)).toBe(true);
  });
  it('arriba si abajo no cabe', () => {
    const p = colocarGlobo({ rect: r(650, 500, 200, 40), ventana, globo });
    expect(p.lado).toBe('arriba');
    expect(p.top + globo.h).toBeLessThan(650);
    expect(dentro(p)).toBe(true);
  });
  it('a un lado si no cabe ni arriba ni abajo (elemento alto)', () => {
    const p = colocarGlobo({ rect: r(20, 20, 300, 728), ventana, globo });
    expect(['derecha', 'izquierda']).toContain(p.lado);
    expect(p.flecha).toBeGreaterThanOrEqual(18);
    expect(dentro(p)).toBe(true);
  });
  it('en el borde derecho y en el izquierdo el globo no se sale de la pantalla y la flecha sigue apuntando', () => {
    for (const left of [0, 1250]) {
      const p = colocarGlobo({ rect: r(200, left, 110, 40), ventana, globo });
      expect(dentro(p)).toBe(true);
      expect(p.flecha).toBeGreaterThanOrEqual(18);
      expect(p.flecha).toBeLessThanOrEqual(p.ancho - 18);
    }
  });
  it('si el elemento ocupa toda la pantalla, el globo va dentro, abajo y sin flecha', () => {
    const p = colocarGlobo({ rect: r(0, 0, 1366, 768), ventana, globo });
    expect(p).toMatchObject({ modo: 'flotante', lado: null, flecha: null });
    expect(dentro(p)).toBe(true);
  });
  it('sin elemento solo existe el modo centro (el componente nunca lo usa: salta el paso)', () => {
    const p = colocarGlobo({ rect: null, ventana, globo });
    expect(p.modo).toBe('centro');
    expect(p.top).toBeCloseTo((768 - 180) / 2, 0);
  });
  it('un globo más ancho que una ventana angosta se encoge', () => {
    const p = colocarGlobo({ rect: r(100, 10, 100, 30), ventana: { w: 700, h: 768 }, globo: { w: 340, h: 180 } });
    expect(p.ancho).toBeLessThanOrEqual(340);
    expect(p.left + p.ancho).toBeLessThanOrEqual(700 - MARGEN_GLOBO + 0.01);
  });
  it('celular: tarjeta fija abajo (y arriba si el elemento está al pie), ancho completo', () => {
    const m = { w: 390, h: 844 };
    expect(esMovil(m.w)).toBe(true);
    expect(esMovil(ANCHO_MOVIL)).toBe(false);
    const abajo = colocarGlobo({ rect: r(150, 20, 350, 300), ventana: m, globo });
    expect(abajo).toMatchObject({ modo: 'tarjeta', arriba: false, left: MARGEN_GLOBO, ancho: 390 - 2 * MARGEN_GLOBO });
    expect(abajo.top + globo.h).toBeLessThanOrEqual(844);
    const pie = colocarGlobo({ rect: r(700, 20, 350, 100), ventana: m, globo });
    expect(pie.arriba).toBe(true);
    expect(pie.top).toBeLessThan(150);
  });
  it('recorta lo que se ve de un elemento más alto que la pantalla, y respeta límites', () => {
    expect(recortarAVentana(r(-100, 10, 200, 2000), ventana)).toEqual({ top: 0, left: 10, width: 200, height: 768 });
    expect(recortarAVentana(r(900, 10, 200, 50), ventana)).toBeNull();
    expect(recortarAVentana(r(0, 0, 100, 500), { w: 390, h: 844 }, { top: 64, bottom: 300 })).toEqual({ top: 64, left: 0, width: 100, height: 236 });
  });
  it('desplazamiento: escritorio centra elemento + globo; celular lo deja entre la barra superior y la tarjeta', () => {
    const e = r(600, 400, 300, 60);
    const d = desplazamientoNecesario({ rect: e, ventana, alturaGlobo: 180 });
    const nuevaTop = e.top - d;
    // el conjunto (elemento + separación + globo) queda centrado
    expect((nuevaTop + (60 + 14 + 180) / 2)).toBeCloseTo(768 / 2, 0);
    const m = { w: 390, h: 844 };
    const dm = desplazamientoNecesario({ rect: r(1500, 20, 350, 100), ventana: m, alturaTarjeta: 210 });
    const top = 1500 - dm;
    expect(top).toBeGreaterThanOrEqual(TOPE_SUPERIOR_MOVIL);
    expect(top + 100).toBeLessThanOrEqual(844 - 210 - MARGEN_GLOBO);
  });
});
