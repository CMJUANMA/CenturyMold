// «Preparar para producción» contra las reglas: borrar usuarios con su accesos/{nómina}, volver a crearlos en la versión 1 y vaciar los catálogos de
// transporte sin tocar el resto del empleado. Ejecutar con: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const abrir = () => setDoc(doc(dbDe('adm'), 'limpiezaProduccion', 'ventana'), { hasta: Timestamp.fromMillis(Date.now() + 90 * 60_000), por: 'adm', porNombre: 'adm', fecha: serverTimestamp() });
const ahora = () => Timestamp.now();

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-limpieza-usuarios', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['adm', 'admin', '1'], ['rh', 'rh', '2'], ['real', 'usuario', '100'], ['prueba', 'usuario', '90001']]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'accesos', '90001'), { version: 3, uid: 'prueba' });
    await setDoc(doc(db, 'asignaciones', '90001_solicitante_produccion'), {
      nomina: '90001', nombre: 'PRUEBA', rol: 'solicitante', areaId: 'produccion', desde: ahora(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'adm', nombre: 'adm' }, fechaAsignacion: ahora(),
    });
    await setDoc(doc(db, 'rutas', 'norte'), { nombre: 'Norte', activo: true });
    await setDoc(doc(db, 'comunidades', 'c1'), { nombre: 'C1', rutaId: 'norte', activo: true });
    await setDoc(doc(db, 'puntosReunion', 'p1'), { nombre: 'P1', comunidadId: 'c1', rutaId: 'norte', activo: true });
    await setDoc(doc(db, 'empleados', '90001'), { nomina: '90001', nombre: 'ANA', puestoId: 'op', areaId: 'produccion', activo: true, elegibleTE: true, rutaId: 'norte', comunidadId: 'c1', puntoReunionId: 'p1' });
  });
});

describe('accesos y usuarios en la limpieza', () => {
  it('el accesos/{nómina} solo se borra con la ventana abierta y solo el admin', async () => {
    await assertFails(deleteDoc(doc(dbDe('adm'), 'accesos', '90001')));
    await abrir();
    await assertFails(deleteDoc(doc(dbDe('rh'), 'accesos', '90001')));
    await assertSucceeds(deleteDoc(doc(dbDe('adm'), 'accesos', '90001')));
  });

  it('borra perfil y acceso, deja las asignaciones y el usuario se vuelve a crear en la versión 1 con cambio de contraseña obligatorio', async () => {
    await abrir();
    const db = dbDe('adm');
    const b = writeBatch(db);
    for (const uid of ['real', 'prueba', 'rh']) b.delete(doc(db, 'usuarios', uid));
    b.delete(doc(db, 'accesos', '90001'));
    await assertSucceeds(b.commit());
    expect((await getDoc(doc(db, 'usuarios', 'adm'))).exists()).toBe(true);
    expect((await getDoc(doc(db, 'asignaciones', '90001_solicitante_produccion'))).exists()).toBe(true);
    const alta = writeBatch(db);
    alta.set(doc(db, 'usuarios', 'nuevoUid'), { nomina: '90001', nombre: 'ANA', rol: 'usuario', activo: true, debeCambiarPassword: true });
    alta.set(doc(db, 'accesos', '90001'), { version: 1, uid: 'nuevoUid' });
    await assertSucceeds(alta.commit());
    expect((await getDoc(doc(db, 'accesos', '90001'))).data()).toEqual({ version: 1, uid: 'nuevoUid' });
  });
});

describe('catálogos de transporte en la limpieza', () => {
  it('borra rutas, comunidades y puntos y deja en blanco ruta, comunidad y punto sin tocar nada más del empleado', async () => {
    await abrir();
    const db = dbDe('adm');
    const b = writeBatch(db);
    b.update(doc(db, 'empleados', '90001'), { rutaId: '', comunidadId: '', puntoReunionId: '' });
    for (const r of [['puntosReunion', 'p1'], ['comunidades', 'c1'], ['rutas', 'norte']]) b.delete(doc(db, ...r));
    await assertSucceeds(b.commit());
    expect((await getDoc(doc(db, 'empleados', '90001'))).data()).toEqual({
      nomina: '90001', nombre: 'ANA', puestoId: 'op', areaId: 'produccion', activo: true, elegibleTE: true, rutaId: '', comunidadId: '', puntoReunionId: '',
    });
    expect((await getDoc(doc(db, 'rutas', 'norte'))).exists()).toBe(false);
  });
});
