/**
 * limpiezaEstructura.js — "Limpiar estructura vieja" (RH > Catálogos > Diagnóstico, solo admin).
 * Quita del padrón los campos que ya nada usa: areaTE y areaTEManual. Antes descarga un respaldo JSON de esos valores.
 * Las colecciones anteriores (areasTE, config/areasTE, config/tiempoExtra, accesosTE) ya no tienen reglas de Firestore:
 * si aún existieran, se borran desde la consola de Firebase.
 */
import { collection, deleteField, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ejecutarEnLotes, opBitacora } from './estructuraDb';

const tieneCamposViejos = (e) => e.areaTE !== undefined || e.areaTEManual !== undefined;

/** Empleados que todavía traen areaTE o areaTEManual */
export async function leerCamposViejos() {
  const snap = await getDocs(collection(db, 'empleados'));
  return snap.docs.map(d => ({ nomina: d.id, ...d.data() })).filter(tieneCamposViejos)
    .map(e => ({ nomina: e.nomina, nombre: e.nombre ?? '', areaTE: e.areaTE ?? null, areaTEManual: e.areaTEManual ?? null }));
}

export const respaldoCamposViejosJson = (empleados) =>
  JSON.stringify({ generado: new Date().toISOString(), empleadosConCamposViejos: empleados }, null, 2);

const dos = (n) => String(n).padStart(2, '0');
export const nombreRespaldoLimpieza = (f = new Date()) =>
  `Respaldo_Antes_Limpieza_${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}_${dos(f.getHours())}${dos(f.getMinutes())}.json`;

export function descargarJson(texto, nombre) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Borra areaTE y areaTEManual de esos empleados (con su renglón de bitácora) */
export async function limpiarCamposViejos(empleados, actor) {
  const ops = empleados.map(e => (b) => b.update(doc(db, 'empleados', e.nomina), { areaTE: deleteField(), areaTEManual: deleteField() }));
  ops.push(opBitacora({ accion: 'limpiar_estructura_vieja', entidad: 'migracion', despues: { empleados: empleados.length } }, actor));
  return ejecutarEnLotes(ops);
}
