// Carga inicial del catálogo de motivos del tiempo extra (colección motivosTE) en el proyecto de Firebase, sin la pantalla.
// Solo CREA los que faltan (los existentes no se tocan). Usa la sesión de `firebase login` (token de firebase-tools) y el proyecto de .firebaserc.
// Uso: node scripts/cargar-motivos.mjs [--proyecto=solicitud-rutas]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { MOTIVOS_INICIALES } from '../src/utils/motivosTE.js';

const proyecto = (process.argv.find(a => a.startsWith('--proyecto=')) ?? '').slice(11) || JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default;
const { tokens } = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'));
const base = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents/motivosTE`;
const campos = ({ nombre, orden, activo, requiereNumero, requiereComentario }) => ({
  nombre: { stringValue: nombre }, orden: { integerValue: String(orden) }, activo: { booleanValue: activo },
  requiereNumero: requiereNumero ? { stringValue: requiereNumero } : { nullValue: null }, requiereComentario: { booleanValue: requiereComentario },
});
for (const { id, ...m } of MOTIVOS_INICIALES) {
  const r = await fetch(`${base}?documentId=${id}`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: campos(m) }) });
  console.log(`${id}: ${r.ok ? 'creado' : r.status === 409 ? 'ya existía' : `error ${r.status} ${(await r.text()).slice(0, 200)}`}`);
}
