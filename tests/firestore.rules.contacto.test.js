// Reglas del teléfono de los empleados (empleadosContacto/{nómina}): lo ven solo RH, admin y el solicitante vigente del área del empleado.
// Aut. 1, Aut. 2 y cualquier otro usuario no lo leen ni lo escriben. Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore';

let env;
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const N = { admin: '90000', rh: '90001', sol: '50532', solA: '50700', aut1: '50610', aut2: '11', otro: '50999' };
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId, desde: ayer(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: Timestamp.now(),
});

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina] of [['admin', 'admin', N.admin], ['rh', 'rh', N.rh], ['sol', 'usuario', N.sol], ['solA', 'usuario', N.solA], ['aut1', 'usuario', N.aut1], ['aut2', 'usuario', N.aut2], ['otro', 'usuario', N.otro]]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, rol, nomina, activo: true });
    }
    await setDoc(doc(db, 'asignaciones', `${N.sol}_solicitante_produccion`), asig(N.sol, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.solA}_solicitante_almacen`), asig(N.solA, 'solicitante', 'almacen'));
    await setDoc(doc(db, 'asignaciones', `${N.aut1}_aut1_produccion`), asig(N.aut1, 'aut1', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut2}_aut2_planta`), asig(N.aut2, 'aut2', null));
    await setDoc(doc(db, 'empleados', '600'), { nombre: 'Operador 600', nomina: '600', areaId: 'produccion' });
    await setDoc(doc(db, 'empleados', '601'), { nombre: 'Operador 601', nomina: '601', areaId: 'almacen' });
    await setDoc(doc(db, 'empleadosContacto', '600'), { telefono: '4421234567' });
    await setDoc(doc(db, 'empleadosContacto', '601'), { telefono: '4427654321' });
  });
}
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const contacto = (db, n) => doc(db, 'empleadosContacto', n);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-contacto', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('teléfono del empleado: quién lo lee', () => {
  it('RH y admin leen cualquiera, uno por uno y la colección entera', async () => {
    for (const uid of ['rh', 'admin']) {
      await assertSucceeds(getDoc(contacto(dbDe(uid), '600')));
      await assertSucceeds(getDoc(contacto(dbDe(uid), '601')));
    }
    await assertSucceeds(getDocs(collection(dbDe('rh'), 'empleadosContacto')));
  });
  it('el solicitante lee solo el de empleados de su área (y un empleado sin teléfono guardado responde vacío, no error)', async () => {
    await assertSucceeds(getDoc(contacto(dbDe('sol'), '600')));
    await assertFails(getDoc(contacto(dbDe('sol'), '601')));
    await assertSucceeds(getDoc(contacto(dbDe('solA'), '601')));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'empleados', '602'), { nombre: 'X', nomina: '602', areaId: 'produccion' }); });
    await assertSucceeds(getDoc(contacto(dbDe('sol'), '602')));
  });
  it('Aut. 1, Aut. 2 y otros usuarios no lo leen, ni uno por uno ni en lista', async () => {
    for (const uid of ['aut1', 'aut2', 'otro']) {
      await assertFails(getDoc(contacto(dbDe(uid), '600')));
      await assertFails(getDocs(collection(dbDe(uid), 'empleadosContacto')));
    }
  });
  it('el solicitante no puede listar la colección', async () => {
    await assertFails(getDocs(collection(dbDe('sol'), 'empleadosContacto')));
  });
  it('sin sesión no se lee', async () => {
    await assertFails(getDoc(contacto(env.unauthenticatedContext().firestore(), '600')));
  });
  it('si el empleado cambia de área en el padrón, el teléfono pasa al solicitante de la nueva área', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'empleados', '600'), { nombre: 'Operador 600', nomina: '600', areaId: 'almacen' }); });
    await assertFails(getDoc(contacto(dbDe('sol'), '600')));
    await assertSucceeds(getDoc(contacto(dbDe('solA'), '600')));
  });
});

describe('teléfono del empleado: quién lo escribe', () => {
  it('RH lo crea, lo corrige y lo vacía', async () => {
    await assertSucceeds(setDoc(contacto(dbDe('rh'), '600'), { telefono: '4429990000' }));
    await assertSucceeds(setDoc(contacto(dbDe('rh'), '600'), { telefono: '' }));
    await assertSucceeds(setDoc(contacto(dbDe('rh'), '603'), { telefono: '4421112233' }));
  });
  it('el solicitante lo guarda solo de empleados de su área, también en lote', async () => {
    await assertSucceeds(setDoc(contacto(dbDe('sol'), '600'), { telefono: '4429990000' }));
    await assertFails(setDoc(contacto(dbDe('sol'), '601'), { telefono: '4429990000' }));
    const db = dbDe('sol');
    const b = writeBatch(db);
    b.set(contacto(db, '600'), { telefono: '4421110000' });
    await assertSucceeds(b.commit());
  });
  it('Aut. 1, Aut. 2 y otros usuarios no lo escriben', async () => {
    for (const uid of ['aut1', 'aut2', 'otro']) await assertFails(setDoc(contacto(dbDe(uid), '600'), { telefono: '4429990000' }));
  });
  it('solo 10 dígitos o vacío, y ningún campo más', async () => {
    const db = dbDe('rh');
    for (const malo of ['442123456', '44212345678', '442-123-4567', '44212345AB', ' 4421234567', 4421234567, null]) {
      await assertFails(setDoc(contacto(db, '600'), { telefono: malo }));
    }
    await assertFails(setDoc(contacto(db, '600'), { telefono: '4421234567', areaId: 'produccion' }));
    await assertFails(setDoc(contacto(db, '600'), { nombre: 'X' }));
  });
  it('solo RH lo borra', async () => {
    await assertFails(deleteDoc(contacto(dbDe('sol'), '600')));
    await assertSucceeds(deleteDoc(contacto(dbDe('rh'), '600')));
  });
});
