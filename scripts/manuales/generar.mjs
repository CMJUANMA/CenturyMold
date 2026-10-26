// Genera los manuales: HTML (docs/manuales/fuentes/manual-<rol>.html) y PDF (docs/manuales/manual-<rol>.pdf) con Playwright.
// Carta vertical, portada sin encabezado, índice con número de página, encabezado con logo y «Página X de Y» (la portada no cuenta).
// Uso: node scripts/manuales/generar.mjs [solicitante …]   (sin rol: todos los que tienen contenido en scripts/manuales/contenido/)
import { chromium } from 'playwright';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFRef } from 'pdf-lib';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const VERSION = '1.0';
export const URL_PORTAL = 'https://centurymold-qro.web.app';
const SALIDA = 'docs/manuales';
const FUENTES = `${SALIDA}/fuentes`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const hoy = new Date();
const FECHA = `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`;

/** Etiquetas de estatus: mismas que la aplicación (utils/constantes.js → ESTATUS_TE_MAP); el color sale de los mismos tonos del tema claro */
const ESTATUS = [
  { etiqueta: 'Borrador', tono: 'info', significa: 'La guardaste, pero todavía no la envías. Solo tú la ves.', haz: 'Toca <b>Continuar</b> para terminarla y enviarla, o <b>Eliminar</b> si ya no la necesitas.' },
  { etiqueta: 'En autorización (nivel 1)', tono: 'warning', significa: 'Espera la firma del jefe de tu área (Autorización 1).', haz: 'Nada. Puedes <b>Cancelar</b> si ya no se necesita.' },
  { etiqueta: 'En autorización (nivel 2)', tono: 'warning', significa: 'Ya firmó el jefe de tu área. Espera la segunda firma (Autorización 2).', haz: 'Nada. Puedes <b>Cancelar</b> si ya no se necesita.' },
  { etiqueta: 'Devuelta', tono: 'error', significa: 'Alguien pidió que la corrijas. El motivo viene en la solicitud.', haz: 'Toca <b>Corregir y reenviar</b>.' },
  { etiqueta: 'Autorizada', tono: 'success', significa: 'Ya tiene las dos firmas. Recursos Humanos la confirmará y pedirá el transporte.', haz: 'Nada. Si hay un error, pide a Recursos Humanos que la cancele.' },
  { etiqueta: 'Confirmada por RH', tono: 'info', significa: 'Recursos Humanos ya la confirmó y pidió el transporte al proveedor.', haz: 'Nada.' },
  { etiqueta: 'Vencida', tono: 'gris', significa: 'Pasó el día del tiempo extra sin terminar de autorizarse.', haz: 'Toca <b>Duplicar con otra fecha</b>.' },
  { etiqueta: 'Cancelada', tono: 'gris', significa: 'Se canceló. Ya no se puede usar.', haz: 'Si la necesitas, crea una nueva.' },
];

const CSS = `
  :root { --rojo: #d61110; --texto: #111214; --suave: #4B5058; --borde: #D9DCE0; --fondo: #F6F7F9; }
  * { box-sizing: border-box; }
  html { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: var(--texto); font-size: 10pt; line-height: 1.4; }
  body { margin: 0; }
  h1, h2, h3 { line-height: 1.2; margin: 0; }
  h2 { font-size: 17pt; color: var(--texto); border-bottom: 3px solid var(--rojo); padding-bottom: 4px; margin: 0 0 12px; break-after: avoid; }
  h3 { font-size: 12pt; margin: 12px 0 5px; color: var(--rojo); break-after: avoid; }
  section { margin: 0 0 14px; }
  section.nueva-pagina { break-before: page; }
  p { margin: 0 0 8px; }
  ul.lista { margin: 4px 0 10px 18px; padding: 0; } ul.lista li { margin: 2px 0; }
  .portada { height: 245mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 0 12mm; }
  .portada img { width: 105mm; margin-bottom: 30mm; }
  .portada .sub { font-size: 12pt; color: var(--suave); letter-spacing: .08em; text-transform: uppercase; }
  .portada h1 { font-size: 28pt; margin: 6px 0 4px; }
  .portada .rol { font-size: 24pt; font-weight: 700; color: var(--rojo); margin-bottom: 14mm; }
  .portada .enlace { font-size: 13pt; margin-bottom: 4mm; }
  .portada .meta { font-size: 11pt; color: var(--suave); }
  .portada .quien { max-width: 120mm; margin-top: 14mm; font-size: 11pt; color: var(--suave); }
  .indice h2 { margin-bottom: 14px; }
  .indice ol { list-style: none; padding: 0; margin: 0; }
  .indice li { display: flex; align-items: baseline; gap: 6px; padding: 5px 0; border-bottom: 1px dotted var(--borde); font-size: 11.5pt; }
  .indice li a { color: var(--texto); text-decoration: none; }
  .indice li .pag { margin-left: auto; font-weight: 700; color: var(--rojo); }
  .indice li .num { color: var(--rojo); font-weight: 700; min-width: 20px; }
  .bloque { break-inside: avoid; margin: 6px 0 10px; }
  .bloque.largo { break-inside: auto; }
  figure { margin: 0 0 8px; text-align: center; }
  figure img { width: 100%; border: 1px solid var(--borde); border-radius: 4px; display: block; }
  figure.chico img { width: 62%; margin: 0 auto; }
  .lado { display: flex; gap: 12px; align-items: flex-start; }
  .lado figure { flex: 0 0 58%; margin: 0; } .lado.chico figure { flex-basis: 46%; }
  .lado > div { flex: 1; font-size: 9.6pt; line-height: 1.38; } .lado ol.pasos { margin-top: 0; } .lado ol.pasos li { padding-left: 28px; padding-bottom: 4px; }
  .lado ol.pasos li::before { width: 20px; height: 20px; line-height: 20px; font-size: 9pt; }
  .fila-celular { display: flex; gap: 12px; align-items: flex-start; }
  .fila-celular figure { flex: 0 0 5.2cm; margin: 0; } .fila-celular figure img { width: 100%; }
  ol.pasos { list-style: none; counter-reset: paso; margin: 6px 0 4px; padding: 0; }
  ol.pasos li { counter-increment: paso; position: relative; padding: 0 0 5px 32px; min-height: 24px; }
  ol.pasos li::before { content: counter(paso); position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--rojo); color: #fff; font-weight: 700; font-size: 10pt; text-align: center; line-height: 22px; }
  .nota, .aviso { border-radius: 6px; padding: 8px 12px; margin: 8px 0 12px; border: 1px solid; break-inside: avoid; }
  .nota { background: #E8F0F8; border-color: #C9DAEC; color: #1d4670; } .nota::before { content: "Consejo · "; font-weight: 700; }
  .aviso { background: #FBF3E1; border-color: #EBDDB8; color: #6e4700; } .aviso::before { content: "Cuidado · "; font-weight: 700; }
  table.estatus { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.estatus th { text-align: left; background: var(--fondo); padding: 6px 8px; border: 1px solid var(--borde); }
  table.estatus td { padding: 7px 8px; border: 1px solid var(--borde); vertical-align: top; }
  table.estatus tr { break-inside: avoid; }
  .pastilla { display: inline-block; padding: 2px 9px; border-radius: 999px; border: 1px solid; font-weight: 600; font-size: 9pt; white-space: nowrap; }
  .pastilla.info { background: #E8F0F8; color: #2A5A8C; border-color: #C9DAEC; } .pastilla.warning { background: #FBF3E1; color: #8A5A00; border-color: #EBDDB8; }
  .pastilla.success { background: #E8F3EC; color: #1F6B3A; border-color: #CBE3D3; } .pastilla.error { background: #FBEFED; color: #A3281F; border-color: #F0CFCB; }
  .pastilla.gris { background: #EEF0F2; color: #4B5058; border-color: #D9DCE0; }
  .pregunta { break-inside: avoid; margin: 0 0 10px; } .pregunta b.q { display: block; color: var(--texto); }
`;

function pasos(items) {
  return `<ol class="pasos">${items.map(t => `<li>${t}</li>`).join('')}</ol>`;
}
function figura(img, ancho) {
  return `<figure class="${ancho === 'chico' ? 'chico' : ''}"><img src="../capturas/${img}.png" alt=""></figure>`;
}
function bloque(b) {
  if (b.h) return `<h3>${b.h}</h3>`;
  if (b.p) return `<p>${b.p}</p>`;
  if (b.nota) return `<div class="nota">${b.nota}</div>`;
  if (b.aviso) return `<div class="aviso">${b.aviso}</div>`;
  if (b.lista) return `<ul class="lista">${b.lista.map(t => `<li>${t}</li>`).join('')}</ul>`;
  if (b.preguntas) return b.preguntas.map(([q, a]) => `<div class="pregunta"><b class="q">${q}</b>${a}</div>`).join('');
  if (b.tabla === 'estatus') {
    return `<table class="estatus"><thead><tr><th>Estatus</th><th>Qué significa</th><th>Qué haces tú</th></tr></thead><tbody>${
      ESTATUS.map(e => `<tr><td><span class="pastilla ${e.tono}">${e.etiqueta}</span></td><td>${e.significa}</td><td>${e.haz}</td></tr>`).join('')}</tbody></table>`;
  }
  if (b.pasos && b.img && b.ancho === 'celular') return `<div class="bloque fila-celular">${figura(b.img)}<div>${pasos(b.pasos)}</div></div>`;
  if (b.pasos && b.img) return `<div class="bloque lado ${b.ancho === 'chico' ? 'chico' : ''}">${figura(b.img)}<div>${pasos(b.pasos)}</div></div>`;
  if (b.pasos) return `<div class="bloque">${pasos(b.pasos)}</div>`;
  if (b.img) return `<div class="bloque">${figura(b.img, b.ancho)}</div>`;
  throw new Error('Bloque desconocido: ' + JSON.stringify(b).slice(0, 80));
}

/** Documentos HTML del manual: portada (sin encabezado) y cuerpo (índice + secciones). `paginas`: id de sección → página (se conoce tras una primera pasada) */
export function htmlManual(m, paginas = {}) {
  const cabeza = (titulo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${CSS}</style></head><body>`;
  const logo = '../../../public/marca/century-mold-original.png';
  const portada = `${cabeza(`Portal de procesos – Manual de ${m.rol}`)}
    <div class="portada">
      <img src="${logo}" alt="Century Mold">
      <div class="sub">Portal de procesos</div>
      <h1>Manual de</h1><div class="rol">${m.rol}</div>
      <div class="enlace"><b>${URL_PORTAL}</b></div>
      <div class="meta">Versión ${VERSION} · ${FECHA}</div>
      <div class="quien">${m.quien}</div>
    </div></body></html>`;
  const indice = `<div class="indice"><h2>Índice</h2><ol>${m.secciones.map((s, i) =>
    `<li><span class="num">${i + 1}</span><a href="#${s.id}">${s.titulo}</a><span class="pag">${paginas[s.id] ?? '00'}</span></li>`).join('')}</ol></div>`;
  const cuerpo = m.secciones.map((s, i) =>
    `<section id="${s.id}" ${i === 0 ? 'class="nueva-pagina"' : ''}><h2>${i + 1}. ${s.titulo}</h2>${s.bloques.map(bloque).join('\n')}</section>`).join('\n');
  const contenido = `${cabeza(`Manual de ${m.rol}`)}${indice}${cuerpo}</body></html>`;
  return { portada, contenido };
}

/** Guía rápida: una sola hoja carta con lo esencial */
export function htmlGuia(m) {
  const g = m.guia;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${g.titulo}</title><style>${CSS}
    html { font-size: 13.5pt; line-height: 1.5; } .guia-cab { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid var(--rojo); padding-bottom: 8px; margin-bottom: 12px; }
    .guia-cab img { height: 40px; } .guia-cab h1 { font-size: 24pt; text-align: right; } .guia-cab small { display: block; font-size: 10pt; color: var(--suave); font-weight: 400; }
    .guia ol { list-style: none; counter-reset: g; padding: 0; margin: 0 0 12px; } .guia ol li { counter-increment: g; position: relative; padding: 8px 0 8px 44px; border-bottom: 1px dotted var(--borde); }
    .guia ol li::before { content: counter(g); position: absolute; left: 0; top: 4px; width: 28px; height: 28px; border-radius: 50%; background: var(--rojo); color: #fff; font-weight: 700; text-align: center; line-height: 28px; }
    .guia li b.t { color: var(--rojo); margin-right: 4px; } .recuerda { background: #FBF3E1; border: 1px solid #EBDDB8; border-radius: 8px; padding: 8px 14px; } .recuerda h3 { margin: 0 0 4px; color: #6e4700; }
    .recuerda ul { margin: 0; padding-left: 18px; } .pie { margin-top: 12px; font-size: 10pt; color: var(--suave); text-align: center; }
  </style></head><body><div class="guia">
    <div class="guia-cab"><img src="../../../public/marca/century-mold-original.png" alt="Century Mold"><h1>${g.titulo}<small>Portal de procesos · ${URL_PORTAL.replace('https://', '')}</small></h1></div>
    <ol>${g.pasos.map(([t, d]) => `<li><b class="t">${t}.</b> ${d}</li>`).join('')}</ol>
    <div class="recuerda"><h3>Recuerda</h3><ul>${g.recuerda.map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div class="pie">${g.contacto}<br>Versión ${VERSION} · ${FECHA}</div>
  </div></body></html>`;
}

const dataUri = (ruta) => `data:image/png;base64,${readFileSync(ruta).toString('base64')}`;

/** Páginas (1 = primera del cuerpo) de cada sección, leídas del índice de marcadores que Chromium escribe en el PDF */
async function paginasDeSecciones(bytes, secciones) {
  const doc = await PDFDocument.load(bytes);
  const paginas = doc.getPages().map(p => p.ref);
  const raiz = doc.catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict);
  const titulo = (d) => { const t = d.lookup(PDFName.of('Title')); return t instanceof PDFString || t instanceof PDFHexString ? t.decodeText() : ''; };
  const resultado = {};
  const pagina = (d) => {
    let dest = d.get(PDFName.of('Dest')) ?? d.lookupMaybe(PDFName.of('A'), PDFDict)?.get(PDFName.of('D'));
    if (dest instanceof PDFRef) dest = doc.context.lookup(dest);
    const ref = dest instanceof PDFArray ? dest.get(0) : null;
    return ref ? paginas.findIndex(r => r.toString() === ref.toString()) + 1 : 0;
  };
  const recorrer = (item) => {
    let it = item;
    while (it) {
      const t = titulo(it); if (process.env.DEBUG_OUTLINE) console.log(JSON.stringify(t), pagina(it));
      const s = secciones.find((x, i) => t.startsWith(`${i + 1}. ${x.titulo}`));
      if (s) resultado[s.id] = pagina(it);
      const hijo = it.lookupMaybe(PDFName.of('First'), PDFDict);
      if (hijo) recorrer(hijo);
      it = it.lookupMaybe(PDFName.of('Next'), PDFDict);
    }
  };
  if (raiz) recorrer(raiz.lookupMaybe(PDFName.of('First'), PDFDict));
  return resultado;
}

export async function generarManual(m, browser) {
  mkdirSync(FUENTES, { recursive: true });
  const logo = dataUri('public/marca/century-mold-original.png');
  const encabezado = `<div style="width:100%;font-size:8px;padding:0 16mm;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;color:#4B5058;">
    <img src="${logo}" style="height:22px"><span>Portal de procesos – Manual de ${m.rol}</span></div>`;
  const pie = `<div style="width:100%;font-size:9px;padding:0 16mm;text-align:center;font-family:Arial,sans-serif;color:#4B5058;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`;
  const ruta = (n) => `${FUENTES}/manual-${m.archivo}${n}.html`;

  const imprimir = async (html, archivoHtml, opciones) => {
    writeFileSync(archivoHtml, html);
    const page = await browser.newPage();
    await page.goto(pathToFileURL(archivoHtml).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const bytes = await page.pdf({ format: 'Letter', printBackground: true, ...opciones });
    await page.close();
    return bytes;
  };
  const opcionesCuerpo = { margin: { top: '22mm', bottom: '15mm', left: '16mm', right: '16mm' }, displayHeaderFooter: true, headerTemplate: encabezado, footerTemplate: pie, outline: true, tagged: true };

  // 1.ª pasada: sin números de página en el índice; de ahí se leen las páginas de cada sección. 2.ª pasada: con los números (el largo del índice no cambia).
  const { portada, contenido } = htmlManual(m);
  const prueba = await imprimir(contenido, ruta('-prueba'), opcionesCuerpo);
  const paginas = await paginasDeSecciones(prueba, m.secciones);
  const final = htmlManual(m, paginas);
  const cuerpoPdf = await imprimir(final.contenido, ruta(''), opcionesCuerpo);
  const portadaPdf = await imprimir(final.portada, ruta('-portada'), { margin: { top: '12mm', bottom: '12mm', left: '16mm', right: '16mm' } });

  if (m.guia) {
    const guiaPdf = await imprimir(htmlGuia(m), ruta('-guia-rapida'), { margin: { top: '14mm', bottom: '12mm', left: '16mm', right: '16mm' } });
    if ((await PDFDocument.load(guiaPdf)).getPageCount() !== 1) console.warn(`  ⚠ La guía rápida de ${m.rol} pasa de una hoja`);
    writeFileSync(`${SALIDA}/guia-rapida-${m.archivo}.pdf`, guiaPdf);
  }

  const salida = await PDFDocument.create();
  for (const bytes of [portadaPdf, cuerpoPdf]) {
    const d = await PDFDocument.load(bytes);
    for (const p of await salida.copyPages(d, d.getPageIndices())) salida.addPage(p);
  }
  salida.setTitle(`Portal de procesos – Manual de ${m.rol}`);
  salida.setAuthor('Century Mold');
  writeFileSync(`${SALIDA}/manual-${m.archivo}.pdf`, await salida.save());
  const total = (await PDFDocument.load(cuerpoPdf)).getPageCount();
  return { paginasCuerpo: total, paginas };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = new URL('./contenido/', import.meta.url);
  const todos = readdirSync(dir).filter(f => f.endsWith('.mjs')).map(f => f.replace('.mjs', ''));
  const pedidos = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const archivo of (pedidos.length ? pedidos : todos)) {
    const m = (await import(new URL(`./contenido/${archivo}.mjs`, import.meta.url).href)).default;
    const r = await generarManual(m, browser);
    console.log(`Manual de ${m.rol}: ${r.paginasCuerpo + 1} páginas (portada + ${r.paginasCuerpo}) → ${SALIDA}/manual-${m.archivo}.pdf`);
  }
  await browser.close();
}
