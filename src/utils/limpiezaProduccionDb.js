/**
 * limpiezaProduccionDb.js — Escrituras de «Preparar para producción» (solo admin). La lógica pura está en limpiezaProduccion.js.
 *
 * Borrar bitácora, ajustes, contadores y las subcolecciones de tiempo extra solo lo permiten las reglas con limpiezaProduccion/ventana vigente:
 * abrirVentana la crea (90 minutos; las reglas topan en 2 horas) y cerrarVentana la quita. Todo se borra en lotes con progreso.
 */
import { Timestamp, collection, deleteDoc, doc, getCountFromServer, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ejecutarEnLotes, opBitacora } from './estructuraDb';
import { rutasABorrar } from './limpiezaProduccion';

const MINUTOS_VENTANA = 90;
const LOTE_BORRADO = 400;

export async function abrirVentana(actor) {
  await setDoc(doc(db, 'limpiezaProduccion', 'ventana'), {
    hasta: Timestamp.fromMillis(Date.now() + MINUTOS_VENTANA * 60_000), por: actor.uid, porNombre: actor.nombre ?? '', fecha: serverTimestamp(),
  });
}
export const cerrarVentana = () => deleteDoc(doc(db, 'limpiezaProduccion', 'ventana'));

/**
 * Borra lo listado y deja UN renglón en la bitácora («Limpieza para producción»). Orden: subcolecciones, solicitudes y el resto, usuarios marcados;
 * al final se reescribe el único renglón de bitácora (después de borrar la bitácora anterior) y se cierra la ventana.
 * @param {{ colecciones: object, usuariosABorrar: { uid: string, nomina: string }[], inventario: object, cuentasAuth: object[], actor: { uid: string, nombre: string }, onProgreso?: (hechas: number, total: number) => void }} p
 */
export async function ejecutarLimpieza({ colecciones, usuariosABorrar, inventario, cuentasAuth, actor, onProgreso }) {
  const rutas = rutasABorrar(colecciones, usuariosABorrar.map(u => u.uid));
  const ops = rutas.map(ruta => (b) => b.delete(doc(db, ...ruta)));
  await ejecutarEnLotes(ops, onProgreso, LOTE_BORRADO);
  // Comprobación antes de cerrar la ventana: ya no debe quedar ninguna solicitud (borradores incluidos)
  const quedan = (await getCountFromServer(collection(db, 'tiempoExtra'))).data().count + (await getCountFromServer(collection(db, 'solicitudes'))).data().count;
  await ejecutarEnLotes([opBitacora({
    accion: 'limpieza_produccion', entidad: 'sistema', antes: null,
    despues: {
      conteo: inventario.conteo, usuariosBorrados: usuariosABorrar.map(u => u.nomina),
      cuentasAuthPendientes: cuentasAuth.flatMap(c => c.correos), solicitudesRestantes: quedan,
      reinicioFolio: `TE-${new Date().getFullYear()}-0001`,
    },
  }, actor)]);
  await cerrarVentana();
  return { quedan };
}

/** Datos para la lista de verificación final: elegibles por área, usuarios sin asignación, turnos y motivos (las solicitudes restantes las cuenta ejecutarLimpieza con la ventana abierta) */
export async function leerVerificacion() {
  const docs = async (n) => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
  const [empleados, areas, usuarios, asignaciones, turnos, motivos] = await Promise.all(['empleados', 'areas', 'usuarios', 'asignaciones', 'turnosNomina', 'motivosTE'].map(docs));
  return { empleados, areas, usuarios, asignaciones, turnos, motivos };
}
