// Revisión visual de un PDF: abre cada página en el visor de Chrome y guarda una imagen en .tmp/manuales-vista/<archivo>-<n>.png (solo para revisar, no es parte del manual).
// Uso: node scripts/manuales/vista-previa.mjs docs/manuales/manual-solicitante.pdf [páginas]
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const archivo = process.argv[2];
const total = (await PDFDocument.load(readFileSync(archivo))).getPageCount();
const paginas = process.argv[3] ? process.argv[3].split(',').map(Number) : Array.from({ length: total }, (_, i) => i + 1);
mkdirSync('.tmp/manuales-vista', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1180 } });
await page.goto(`${pathToFileURL(resolve(archivo)).href}#toolbar=0&navpanes=0&zoom=page-fit`);
await page.waitForTimeout(2000);
await page.mouse.click(450, 600);
for (let n = 1; n <= total; n++) {
  if (paginas.includes(n)) await page.screenshot({ path: `.tmp/manuales-vista/${basename(archivo, '.pdf')}-${String(n).padStart(2, '0')}.png` });
  await page.keyboard.press('PageDown'); await page.waitForTimeout(700);
}
await browser.close();
console.log(`${paginas.length} páginas → .tmp/manuales-vista/`);
