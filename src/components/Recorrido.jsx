/**
 * Recorrido.jsx — Recorrido guiado: globos que señalan cada parte de la pantalla, con "Anterior", "Siguiente" y "Saltar".
 *   <Recorrido pasos={[{ selector, titulo, texto }]} onTerminar={({ vacio }) => …} />
 * Cada paso señala el elemento que cumple su `selector` (atributo data-tour). Cómo se comporta:
 *   - Antes de empezar espera a que la pantalla esté lista (sin esqueletos de carga ni animaciones de entrada) y se queda solo con los pasos
 *     cuyo elemento existe; un paso cuyo elemento no existe (depende de datos) se salta, nunca flota un globo en medio. Si no queda ninguno,
 *     termina con { vacio: true } sin mostrar nada.
 *   - Lleva el elemento a la vista (suave) y espera a que termine el desplazamiento antes de colocar el globo.
 *   - Mientras el paso está a la vista sigue al elemento cuadro por cuadro: scroll, cambio de tamaño de la ventana, abrir o cerrar el menú
 *     lateral o que el propio elemento crezca o se mueva.
 *   - Resalta el elemento (el resto se oscurece) y coloca el globo donde hay espacio, con la flecha apuntando a él. En celular el globo es una
 *     tarjeta fija abajo y el elemento queda resaltado arriba.
 * Se dibuja en un portal sobre <body>: ningún ancestro con transform o animación puede descolocar el globo.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Boton from './ui/Boton';
import { colocarGlobo, desplazamientoNecesario, esMovil, recortarAVentana } from '../utils/recorrido';

const ANCHO_GLOBO = 340;
const AIRE = 6; // el resalte rodea un poco al elemento
const POLL_MS = 100;
const ESPERA_PANTALLA_MS = 7000;
const ESPERA_ELEMENTO_MS = 1800;

const espera = (ms) => new Promise(r => setTimeout(r, ms));
const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ventanaActual = () => ({ w: window.innerWidth, h: window.innerHeight });

/** Primer elemento visible que cumple el selector (los ocultos con display:none no cuentan) */
const buscar = (selector) => (selector ? [...document.querySelectorAll(selector)].find(el => el.getClientRects().length > 0) ?? null : null);

/** ¿Hay esqueletos de carga o animaciones de entrada en curso (las del propio recorrido y las infinitas, como giros, no cuentan)? */
function pantallaOcupada() {
  if (document.querySelector('main .esqueleto')) return true;
  return document.getAnimations().some((a) => {
    if (a.playState !== 'running') return false;
    if (a.effect?.target?.closest?.('[data-recorrido]')) return false;
    return a.effect?.getComputedTiming().iterations !== Infinity;
  });
}

/** Espera a que la pantalla no esté ocupada durante dos revisiones seguidas (o a que pase el tiempo máximo) */
async function esperarPantallaEstable(cancelado, maximo = ESPERA_PANTALLA_MS) {
  const fin = Date.now() + maximo;
  let seguidas = 0;
  while (!cancelado() && Date.now() < fin) {
    seguidas = pantallaOcupada() ? 0 : seguidas + 1;
    if (seguidas >= 2) return;
    await espera(POLL_MS);
  }
}

/** Espera a que aparezca (y se vea) un elemento; null si no llega a tiempo */
async function esperarElemento(selector, cancelado, maximo) {
  const fin = Date.now() + maximo;
  do {
    const el = buscar(selector);
    if (el) return el;
    await espera(POLL_MS);
  } while (!cancelado() && Date.now() < fin);
  return null;
}

/** Espera a que el desplazamiento suave termine: la posición del elemento queda quieta tres revisiones seguidas */
async function esperarFinDeScroll(el, cancelado) {
  let anterior = null; let quietas = 0;
  const fin = Date.now() + 2200;
  while (!cancelado() && Date.now() < fin) {
    const t = el.getBoundingClientRect().top;
    quietas = anterior !== null && Math.abs(t - anterior) < 0.5 ? quietas + 1 : 0;
    if (quietas >= 3) return;
    anterior = t;
    await espera(60);
  }
}

export default function Recorrido({ pasos, onTerminar }) {
  const [lista, setLista] = useState(null); // pasos cuyo elemento existe, ya con la pantalla estable
  const [indice, setIndice] = useState(0);
  const [objetivo, setObjetivo] = useState(null); // el elemento del paso actual, ya a la vista
  const [medida, setMedida] = useState(null); // { rect, ventana } del elemento (se actualiza cuadro por cuadro)
  const [globo, setGlobo] = useState({ w: ANCHO_GLOBO, h: 170, medido: false });
  const globoRef = useRef(null);
  const alturaGloboRef = useRef(190); // última altura medida del globo (para dejarle sitio al desplazar)
  const raiz = useRef(null);
  const vivo = useRef(true);
  // onTerminar suele ser una función nueva en cada render del padre: se guarda en una referencia para no reiniciar el recorrido
  const onTerminarRef = useRef(onTerminar);
  useEffect(() => { onTerminarRef.current = onTerminar; });
  const terminar = useCallback((info) => onTerminarRef.current?.(info), []);

  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  // 1) Esperar a que la pantalla esté lista y quedarse con los pasos que sí existen
  useEffect(() => {
    let cancelado = false;
    const caducado = () => cancelado || !vivo.current;
    (async () => {
      await esperarPantallaEstable(caducado);
      let disponibles = pasos.filter(p => buscar(p.selector));
      // Si todavía no hay nada (datos que tardan), se espera un poco más
      for (let i = 0; i < 20 && disponibles.length === 0 && !caducado(); i++) {
        await espera(POLL_MS);
        disponibles = pasos.filter(p => buscar(p.selector));
      }
      if (caducado()) return;
      if (disponibles.length === 0) { terminar({ vacio: true }); return; }
      setLista(disponibles);
    })();
    return () => { cancelado = true; };
  }, [pasos, terminar]);

  const paso = lista?.[indice];
  const ultimo = !!lista && indice === lista.length - 1;
  const avanzar = useCallback(() => {
    if (!lista) return;
    if (indice >= lista.length - 1) terminar({ vacio: false });
    else setIndice(i => i + 1);
  }, [lista, indice, terminar]);

  // 2) Preparar el paso: encontrar el elemento, llevarlo a la vista y esperar a que termine de moverse
  useEffect(() => {
    if (!paso) return undefined;
    let cancelado = false;
    const caducado = () => cancelado || !vivo.current;
    setObjetivo(null);
    setMedida(null);
    (async () => {
      const el = await esperarElemento(paso.selector, caducado, ESPERA_ELEMENTO_MS);
      if (caducado()) return;
      if (!el) { avanzar(); return; } // el elemento ya no está: se salta el paso
      const fijo = ['sticky', 'fixed'].includes(getComputedStyle(el).position); // no se mueve con la página
      const ventana = ventanaActual();
      const r = el.getBoundingClientRect();
      const delta = desplazamientoNecesario({ rect: r, ventana, alturaTarjeta: esMovil(ventana.w) ? Math.max(210, alturaGloboRef.current) : 0, alturaGlobo: Math.max(190, alturaGloboRef.current) });
      if (!fijo && Math.abs(delta) > 2) {
        window.scrollBy({ top: delta, behavior: reducirMovimiento() ? 'auto' : 'smooth' });
        await esperarFinDeScroll(el, caducado);
        if (caducado()) return;
      }
      setObjetivo(el);
    })();
    return () => { cancelado = true; };
  }, [paso, avanzar]);

  // 3) Seguir al elemento mientras el paso está a la vista (scroll, tamaño de la ventana, menú lateral, cambios del propio elemento)
  useEffect(() => {
    if (!objetivo) return undefined;
    let cuadro = 0;
    let ultima = null;
    const medir = () => {
      if (!objetivo.isConnected) {
        const otra = buscar(paso?.selector);
        if (!otra) { avanzar(); return; } // desapareció: se salta
        setObjetivo(otra);
        return;
      }
      const r = objetivo.getBoundingClientRect();
      const v = ventanaActual();
      const igual = ultima && Math.abs(ultima.top - r.top) < 0.5 && Math.abs(ultima.left - r.left) < 0.5
        && Math.abs(ultima.width - r.width) < 0.5 && Math.abs(ultima.height - r.height) < 0.5 && ultima.w === v.w && ultima.h === v.h;
      if (!igual) {
        ultima = { top: r.top, left: r.left, width: r.width, height: r.height, w: v.w, h: v.h };
        setMedida({ rect: { top: r.top, left: r.left, width: r.width, height: r.height }, ventana: v });
      }
    };
    const bucle = () => { medir(); cuadro = requestAnimationFrame(bucle); };
    cuadro = requestAnimationFrame(bucle);
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(objetivo);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      cancelAnimationFrame(cuadro);
      observador?.disconnect();
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [objetivo, paso, avanzar]);

  // Tamaño real del globo (para colocarlo sin salirse de la pantalla)
  useLayoutEffect(() => {
    const el = globoRef.current;
    if (!el) return;
    const w = el.offsetWidth; const h = el.offsetHeight;
    alturaGloboRef.current = h;
    setGlobo(g => (g.w === w && g.h === h && g.medido ? g : { w, h, medido: true }));
  }, [indice, medida, lista]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') terminar({ vacio: false });
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (document.activeElement?.tagName !== 'BUTTON') avanzar(); }
      else if (e.key === 'ArrowLeft') setIndice(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [terminar, avanzar]);

  if (!lista) return null; // preparando: aún no se muestra nada
  const ventana = medida?.ventana ?? ventanaActual();
  const movil = esMovil(ventana.w);
  const dimGlobo = { w: Math.min(ANCHO_GLOBO, ventana.w - 24), h: globo.h };
  const visible0 = medida ? recortarAVentana(medida.rect, ventana) : null;
  const pos = colocarGlobo({ rect: visible0, ventana, globo: dimGlobo });
  // En celular el resalte se limita a la zona que la tarjeta no tapa (y a la que no tapa la barra superior)
  const limites = movil && pos.modo === 'tarjeta'
    ? (pos.arriba ? { top: pos.top + globo.h + 8 } : { top: 64, bottom: pos.top - 8 })
    : {};
  const visible = medida ? recortarAVentana(medida.rect, ventana, limites) : null;
  const listoParaMostrar = !!paso && !!objetivo && !!medida;
  const lado = pos.lado;

  // Flecha: un cuadrito girado en el borde del globo que da hacia el elemento
  const estiloFlecha = lado && pos.flecha != null ? {
    abajo: { top: -6, left: pos.flecha - 6, borderWidth: '1px 0 0 1px' },
    arriba: { bottom: -6, left: pos.flecha - 6, borderWidth: '0 1px 1px 0' },
    derecha: { left: -6, top: pos.flecha - 6, borderWidth: '0 0 1px 1px' },
    izquierda: { right: -6, top: pos.flecha - 6, borderWidth: '1px 1px 0 0' },
  }[lado] : null;

  return createPortal(
    <div ref={raiz} data-recorrido className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Recorrido guiado">
      {/* Captura los clics para que la pantalla de atrás no se toque durante el recorrido */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />
      {listoParaMostrar && visible
        ? <div className="pointer-events-none fixed rounded-xl ring-2 ring-white" style={{ top: visible.top - AIRE, left: visible.left - AIRE, width: visible.width + 2 * AIRE, height: visible.height + 2 * AIRE, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)', transition: 'top 120ms, left 120ms, width 120ms, height 120ms' }} />
        : <div className="pointer-events-none fixed inset-0 bg-black/60" />}
      {paso && (
        <div ref={globoRef} role="region" aria-live="polite" aria-label={`Paso ${indice + 1} de ${lista.length}: ${paso.titulo}`}
          className="fixed rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl"
          style={{ top: pos.top, left: pos.left, width: pos.ancho, visibility: listoParaMostrar && globo.medido ? 'visible' : 'hidden' }}>
          {estiloFlecha && <span aria-hidden="true" className="absolute h-3 w-3 rotate-45 border-solid border-[var(--border-color)] bg-[var(--bg-surface)]" style={estiloFlecha} />}
          <div className="relative p-4" style={{ maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', ...(pos.modo === 'tarjeta' ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' } : {}) }}>
          <p className="text-xs font-semibold text-[var(--text-muted)]">Paso {indice + 1} de {lista.length}</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--text-main)]">{paso.titulo}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{paso.texto}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Boton variante="fantasma" onClick={() => terminar({ vacio: false })}>Saltar</Boton>
            <div className="flex gap-2">
              {indice > 0 && <Boton onClick={() => setIndice(i => Math.max(0, i - 1))}>Anterior</Boton>}
              <Boton variante="primario" autoFocus onClick={avanzar}>{ultimo ? 'Entendido' : 'Siguiente'}</Boton>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
