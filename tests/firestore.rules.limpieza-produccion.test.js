// «Preparar para producción» contra las reglas, en el emulador: la ventana de limpieza, lo que solo se puede dentro de ella y que el padrón,
// los catálogos, las asignaciones, los accesos y los usuarios no marcados no se tocan. Ejecutar con: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { armarInventario, rutasABorrar } from '../src/utils/limpiezaProduccion.js';
import { SUBCOLECCIONES_RESPALDO } from '../src/utils/respaldoCompleto.js';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const ahora = () => Timestamp.now();
const enMin = (m) => Timestamp.fromMillis(Date.now() + m * 60_000);
const ventana = (m = 90, extra = {}) => ({ hasta: enMin(m), por: 'adm', porNombre: 'adm', fecha: serverTimestamp(), ...extra });
const abrir = () => setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'ventana'), ventana());

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['adm', 'admin', '1'], ['rh', 'rh', '2'], ['real', 'usuario', '100'], ['prueba', 'usuario', '90001'], ['solP', 'usuario', '50532']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'accesos', '90001'), { version: 1, uid: 'prueba' });
    await setDoc(doc(db, 'areas', 'produccion'), { nombre: 'Producción', participaTE: true, activa: true, orden: 1 });
    await setDoc(doc(db, 'puestos', 'op'), { nombre: 'OP', areaId: 'produccion', activo: true, alias: [], creadoPor: 'rh', fechaCreacion: ahora() });
    await setDoc(doc(db, 'empleados', '100'), { nomina: '100', nombre: 'ANA', puestoId: 'op', areaId: 'produccion', activo: true });
    await setDoc(doc(db, 'empleadosContacto', '100'), { telefono: '4421234567' });
    await setDoc(doc(db, 'turnosNomina', 'A'), { entrada: '7:00', salida: '16:00' });
    await setDoc(doc(db, 'motivosTE', 'm1'), { nombre: 'Inventario', orden: 1, activo: true });
    await setDoc(doc(db, 'rutas', 'norte'), { nombre: 'Norte', activo: true });
    await setDoc(doc(db, 'asignaciones', '100_aut1_produccion'), {
      nomina: '100', nombre: 'ANA', rol: 'aut1', areaId: 'produccion', desde: ahora(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'adm', nombre: 'adm' }, fechaAsignacion: ahora(),
    });
    const te = (extra) => ({ areaId: 'produccion', areaNombre: 'Producción', creadoPor: 'solP', creadoPorNomina: '50532', creadoPorNombre: 'solP', fechaTE: '2026-12-01', motivo: 'x', resumen: {}, fechaCreacion: ahora(), fechaActualizacion: ahora(), ...extra });
    await setDoc(doc(db, 'tiempoExtra', 'TE1'), te({ estatus: 'autorizada', folio: 'TE-2026-0001' }));
    await setDoc(doc(db, 'tiempoExtra', 'BR-AJENO'), te({ estatus: 'borrador' }));
    for (const id of ['TE1', 'BR-AJENO']) {
      for (let i = 0; i < 25; i++) await setDoc(doc(db, 'tiempoExtra', id, 'empleados', `e${i}`), { nombre: `E${i}`, horas: 3 });
      await setDoc(doc(db, 'tiempoExtra', id, 'historial', 'h1'), { accion: 'creada', nivel: 0, porUid: 'solP', porNomina: '50532', porNombre: 'solP', comentario: '', fecha: ahora() });
    }
    await setDoc(doc(db, 'solicitudes', 'S1'), { creadoPor: 'solP', estatus: 'aprobada', origen: 'tiempo_extra', folio: 'SOL-1' });
    await setDoc(doc(db, 'solicitudes', 'S1', 'pasajeros', 'p1'), { nombre: 'ANA' });
    await setDoc(doc(db, 'ajustesNomina', '2026-01_produccion'), { semana: '2026-01', areaId: 'produccion', desde: '2026-01-01', hasta: '2026-01-07', cambios: [], renglones: [], firmada: false, actualizadoPor: { uid: 'rh' }, fechaActualizacion: ahora() });
    for (const b of ['b1', 'b2', 'b3']) await setDoc(doc(db, 'bitacora', b), { accion: 'x', entidad: 'puesto', antes: null, despues: null, porUid: 'rh', porNombre: 'rh', fecha: ahora() });
    await setDoc(doc(db, 'contadores', 'te-2026'), { ultimo: 7, solicitudId: 'TE1' });
  });
}

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-limpieza-produccion', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(sembrar);

describe('ventana de limpieza', () => {
  it('solo el admin la abre, con fecha, autor y duración válidos (máximo 2 horas)', async () => {
    await assertSucceeds(abrir());
    await assertFails(setDoc(doc(dbDe('rh'), 'limpiezaProduccion', 'ventana'), ventana(90, { por: 'rh', porNombre: 'rh' })));
    await assertFails(setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'ventana'), ventana(180)));
    await assertFails(setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'ventana'), ventana(-5)));
    await assertFails(setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'ventana'), ventana(90, { por: 'otro' })));
    await assertFails(setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'otra'), ventana()));
    await assertFails(getDoc(doc(dbDe('rh'), 'limpiezaProduccion', 'ventana')));
  });
});

describe('sin la ventana, nada cambia', () => {
  it('ni el admin borra bitácora, ajustes, contadores ni subcolecciones, ni lee borradores ajenos', async () => {
    const db = dbDe('adm');
    await assertFails(deleteDoc(doc(db, 'bitacora', 'b1')));
    await assertFails(deleteDoc(doc(db, 'ajustesNomina', '2026-01_produccion')));
    await assertFails(deleteDoc(doc(db, 'contadores', 'te-2026')));
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'TE1', 'empleados', 'e0')));
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'TE1', 'historial', 'h1')));
    await assertFails(getDoc(doc(db, 'tiempoExtra', 'BR-AJENO')));
    await assertFails(getDocs(collection(db, 'tiempoExtra')));
  });
  it('una ventana vencida tampoco sirve', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'limpiezaProduccion', 'ventana'), { hasta: enMin(-1), por: 'adm', porNombre: 'adm', fecha: ahora() }); });
    await assertFails(deleteDoc(doc(dbDe('adm'), 'bitacora', 'b1')));
    await assertFails(getDoc(doc(dbDe('adm'), 'tiempoExtra', 'BR-AJENO')));
  });
  it('RH, aunque exista una ventana, no borra bitácora ni lee borradores ajenos', async () => {
    await abrir();
    await assertFails(deleteDoc(doc(dbDe('rh'), 'bitacora', 'b1')));
    await assertFails(getDoc(doc(dbDe('rh'), 'tiempoExtra', 'BR-AJENO')));
    await assertFails(deleteDoc(doc(dbDe('rh'), 'contadores', 'te-2026')));
  });
});

describe('con la ventana abierta: la limpieza completa', () => {
  /** Lee como lo hace la herramienta (todo, borradores incluidos), arma las rutas y las borra en lotes de 400 */
  async function leer(db) {
    const colecciones = {};
    for (const n of ['usuarios', 'accesos', 'asignaciones', 'areas', 'puestos', 'empleados', 'empleadosContacto', 'rutas', 'turnosNomina', 'motivosTE', 'contadores', 'bitacora', 'ajustesNomina', 'tiempoExtra', 'solicitudes']) {
      if (n === 'accesos') { colecciones[n] = [{ id: '90001', data: (await getDoc(doc(db, 'accesos', '90001'))).data(), sub: null }]; continue; }
      const docs = (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, data: d.data(), sub: null }));
      for (const d of docs) {
        const subs = SUBCOLECCIONES_RESPALDO[n];
        if (subs) { d.sub = {}; for (const s of subs) d.sub[s] = (await getDocs(collection(db, n, d.id, s))).docs.map(x => ({ id: x.id, data: x.data() })); }
      }
      colecciones[n] = docs;
    }
    return colecciones;
  }

  it('lee los borradores ajenos y borra subcolecciones, solicitudes, bitácora, ajustes, contadores y el usuario marcado; todo lo demás queda', async () => {
    await abrir();
    const db = dbDe('adm');
    const colecciones = await leer(db);
    expect(colecciones.tiempoExtra.map(d => d.id).sort()).toEqual(['BR-AJENO', 'TE1']); // el borrador ajeno se ve
    const inv = armarInventario(colecciones, { uid: 'adm', nomina: '1' });
    expect(inv.conteo).toMatchObject({ tiempoExtra: 2, borradores: 1, tiempoExtraEmpleados: 50, bitacora: 3 });
    expect(inv.usuarios.find(u => u.nomina === '90001').parecePrueba).toBe(true);
    expect(inv.usuarios.find(u => u.nomina === '50532').parecePrueba).toBe(true);

    const rutas = rutasABorrar(colecciones, ['prueba']);
    for (let i = 0; i < rutas.length; i += 400) {
      const b = writeBatch(db);
      rutas.slice(i, i + 400).forEach(r => b.delete(doc(db, ...r)));
      await assertSucceeds(b.commit()); // 50 subdocumentos + historial + el resto en un lote: no se pasa del tope de lecturas de las reglas
    }
    expect((await getCountFromServer(collection(db, 'tiempoExtra'))).data().count).toBe(0);
    expect((await getCountFromServer(collection(db, 'solicitudes'))).data().count).toBe(0);
    expect((await getCountFromServer(collection(db, 'bitacora'))).data().count).toBe(0);
    expect((await getDocs(collection(db, 'ajustesNomina'))).size).toBe(0);
    expect((await getDocs(collection(db, 'contadores'))).size).toBe(0); // el siguiente folio vuelve a nacer en 0001

    // Lo que NO se toca
    for (const r of [['empleados', '100'], ['empleadosContacto', '100'], ['areas', 'produccion'], ['puestos', 'op'], ['turnosNomina', 'A'], ['motivosTE', 'm1'], ['rutas', 'norte'],
      ['asignaciones', '100_aut1_produccion'], ['accesos', '90001'], ['usuarios', 'real'], ['usuarios', 'adm'], ['usuarios', 'solP']]) {
      expect((await getDoc(doc(db, ...r))).exists(), r.join('/')).toBe(true);
    }
    expect((await getDoc(doc(db, 'usuarios', 'prueba'))).exists()).toBe(false);
  });

  it('el renglón de resumen se escribe después y el admin cierra la ventana; sin ella vuelve la inmutabilidad', async () => {
    await abrir();
    const db = dbDe('adm');
    await assertSucceeds(deleteDoc(doc(db, 'bitacora', 'b1')));
    await assertSucceeds(setDoc(doc(collection(db, 'bitacora')), { accion: 'limpieza_produccion', entidad: 'sistema', antes: null, despues: { conteo: {} }, porUid: 'adm', porNombre: 'adm', fecha: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db, 'limpiezaProduccion', 'ventana')));
    await assertFails(deleteDoc(doc(db, 'bitacora', 'b2')));
    await assertFails(updateDoc(doc(db, 'bitacora', 'b2'), { accion: 'otra' }));
  });

  it('aun con la ventana, el admin no puede borrar asignaciones, áreas, puestos, turnos ni motivos (la herramienta tampoco lo intenta)', async () => {
    await abrir();
    const db = dbDe('adm');
    for (const r of [['asignaciones', '100_aut1_produccion'], ['areas', 'produccion'], ['puestos', 'op'], ['turnosNomina', 'A'], ['motivosTE', 'm1'], ['accesos', '90001']]) {
      await assertFails(deleteDoc(doc(db, ...r)));
    }
  });
});
