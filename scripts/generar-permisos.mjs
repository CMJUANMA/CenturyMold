// npm run docs:permisos — regenera la tabla de docs/permisos.md desde la matriz (src/utils/permisos.js)
import { readFileSync, writeFileSync } from 'node:fs';
import { matrizEnMarkdown } from '../src/utils/permisos.js';

const ruta = new URL('../docs/permisos.md', import.meta.url);
const doc = readFileSync(ruta, 'utf8');
const nuevo = doc.replace(/<!-- MATRIZ:INICIO -->\n[\s\S]*?\n<!-- MATRIZ:FIN -->/, `<!-- MATRIZ:INICIO -->\n${matrizEnMarkdown()}\n<!-- MATRIZ:FIN -->`);
if (nuevo === doc) console.log('docs/permisos.md ya estaba al día.');
else { writeFileSync(ruta, nuevo); console.log('docs/permisos.md actualizado.'); }
