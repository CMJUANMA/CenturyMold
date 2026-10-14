/**
 * turnosNominaDb.js — Turnos de nómina A, B y C (turnosNomina/{A|B|C}: { turno, entrada, salida }): el horario normal de cada turno,
 * en los bloques 7:00, 16:00, 19:00 y 0:00. Los captura RH; las extensiones de turno empiezan cuando termina el turno normal.
 * Un horario vacío ('') significa "sin configurar": la extensión pide el fin de turno a mano.
 */
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export const TURNOS_NOMINA_IDS = ['A', 'B', 'C'];

/** { A: { entrada: '', salida: '' }, B: …, C: … } con lo guardado (lo que falte, vacío) */
export async function leerTurnosNomina() {
  const snap = await getDocs(collection(db, 'turnosNomina'));
  const turnos = Object.fromEntries(TURNOS_NOMINA_IDS.map(t => [t, { entrada: '', salida: '' }]));
  for (const d of snap.docs) {
    if (turnos[d.id]) turnos[d.id] = { entrada: d.data().entrada ?? '', salida: d.data().salida ?? '' };
  }
  return turnos;
}

/** Guarda los tres turnos en un solo lote */
export async function guardarTurnosNomina(usuario, turnos) {
  const b = writeBatch(db);
  for (const t of TURNOS_NOMINA_IDS) {
    b.set(doc(db, 'turnosNomina', t), {
      turno: t, entrada: turnos[t]?.entrada ?? '', salida: turnos[t]?.salida ?? '',
      actualizadoPor: { uid: usuario.uid, nombre: usuario.nombre ?? '' }, fechaActualizacion: serverTimestamp(),
    });
  }
  await b.commit();
}
