/**
 * motivosDb.js — Escrituras del catálogo de motivos del tiempo extra (colección motivosTE). Solo RH y admin (firestore.rules); nadie borra:
 * la baja es lógica (activo: false) y las solicitudes ya guardan una copia del nombre, así que un motivo dado de baja se sigue viendo bien.
 */
import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { MOTIVOS_INICIALES, MAX_NOMBRE_MOTIVO } from './motivosTE.js';
import { slugify } from './comparacionImportacion.js';

const ref = (id) => doc(db, 'motivosTE', id);

/** Los campos que guardan las reglas (nada más) */
const datos = ({ nombre, orden, activo = true, requiereNumero = null, requiereComentario = false }) => ({
  nombre: String(nombre).trim().slice(0, MAX_NOMBRE_MOTIVO), orden: Number(orden) || 0, activo: !!activo,
  requiereNumero: requiereNumero === 'po' || requiereNumero === 'tb' ? requiereNumero : null, requiereComentario: !!requiereComentario,
});

/** Id nuevo a partir del nombre ("Cargo a P.O." → cargo-a-po); si ya existe, con un sufijo */
export function idNuevoMotivo(nombre, existentes) {
  const base = slugify(nombre) || 'motivo';
  let id = base, n = 2;
  while (existentes.some(m => m.id === id)) id = `${base}-${n++}`;
  return id;
}

export async function crearMotivo(campos, existentes) {
  const orden = Math.max(0, ...existentes.map(m => Number(m.orden) || 0)) + 1;
  await setDoc(ref(idNuevoMotivo(campos.nombre, existentes)), datos({ ...campos, orden, activo: true }));
}

export const guardarMotivo = (id, campos) => updateDoc(ref(id), datos(campos));
export const cambiarActivoMotivo = (id, activo) => updateDoc(ref(id), { activo: !!activo });

/** Intercambia el lugar (orden) de dos motivos contiguos, en un solo lote */
export async function intercambiarOrden(a, b) {
  const lote = writeBatch(db);
  lote.update(ref(a.id), { orden: b.orden });
  lote.update(ref(b.id), { orden: a.orden });
  await lote.commit();
}

/** Carga inicial: los nueve motivos, en orden. Solo para un catálogo vacío (los ids son fijos: repetirla no duplica nada) */
export async function sembrarMotivos() {
  const lote = writeBatch(db);
  MOTIVOS_INICIALES.forEach(({ id, ...campos }) => lote.set(ref(id), datos(campos)));
  await lote.commit();
}
