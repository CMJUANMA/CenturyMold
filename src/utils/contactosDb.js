/**
 * contactosDb.js — Teléfono de los empleados (empleadosContacto/{nómina} = { telefono }).
 * Va aparte del padrón a propósito: el padrón lo leen también Aut. 1 y Aut. 2, y el teléfono solo RH, admin y quien solicita en esa área
 * (ver firestore.rules y docs/seguridad.md). Quien no puede leerlo recibe "sin teléfono": nunca rompe la pantalla.
 */
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { trozos } from './tiempoExtra';
import { telefonoValido } from './telefono';

const COLECCION = 'empleadosContacto';
/** Cada escritura cuesta una lectura del padrón en las reglas (el tope por lote es 20) */
const LOTE_TELEFONOS = 10;

/** Teléfonos de varias nóminas (lecturas una por una: las reglas comprueban el área de cada empleado). @returns Map nómina → teléfono ('' si no hay o no se puede leer) */
export async function leerTelefonos(nominas) {
  const mapa = new Map();
  for (const lote of trozos([...new Set(nominas.map(String))], 20)) {
    await Promise.all(lote.map(async (n) => {
      try {
        const snap = await getDoc(doc(db, COLECCION, n));
        mapa.set(n, snap.exists() ? String(snap.data().telefono ?? '') : '');
      } catch (err) {
        console.warn('Teléfono de', n, err.code ?? err);
        mapa.set(n, '');
      }
    }));
  }
  return mapa;
}

/** Todos los teléfonos (solo RH y admin). @returns Map nómina → teléfono */
export async function leerTodosLosTelefonos() {
  const snap = await getDocs(collection(db, COLECCION));
  return new Map(snap.docs.map(d => [d.id, String(d.data().telefono ?? '')]));
}

/** Operación para un lote: guarda (o, con '', deja vacío) el teléfono de un empleado */
export const opTelefono = (nomina, telefono) => (batch) => batch.set(doc(db, COLECCION, String(nomina)), { telefono: telefono || '' });

/** Guarda los teléfonos confirmados de una captura: { nómina: '4421234567' } (solo válidos; quien llama ya filtró) */
export async function guardarTelefonosEnPadron(telefonos) {
  const validos = Object.entries(telefonos).filter(([, t]) => telefonoValido(t));
  for (const lote of trozos(validos, LOTE_TELEFONOS)) {
    const b = writeBatch(db);
    lote.forEach(([nomina, t]) => opTelefono(nomina, t)(b));
    await b.commit();
  }
}
