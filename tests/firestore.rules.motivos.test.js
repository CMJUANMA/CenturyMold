// Reglas del catálogo de motivos del tiempo extra (motivosTE/{id}): lo lee cualquier usuario activo; solo RH y admin lo escriben; nadie borra.
// Contra el emulador de Firestore (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { MOTIVOS_INICIALES } from '../src/utils/motivosTE.js';

let env;
const ayer = () => Timestamp.fromDate(new Date(Date.now() - 24 * 3600 * 1000));
const N = { admin: '90000', rh: '90001', nomina: '90002', sol: '50532', aut1: '50610', aut2: '11', baja: '50999' };
const asig = (nomina, rol, areaId) => ({
  nomina, nombre: `Usuario ${nomina}`, rol, areaId, desde: ayer(), hasta: null, motivo: '', activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: Timestamp.now(),
});
const campos = (m) => { const { id: _id, ...resto } = m; return resto; };
const nuevo = (extra = {}) => ({ nombre: 'Prueba de molde', orden: 10, activo: true, requiereNumero: null, requiereComentario: false, ...extra });

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol, nomina, activo] of [['admin', 'admin', N.admin, true], ['rh', 'rh', N.rh, true], ['nomina', 'nomina', N.nomina, true], ['sol', 'usuario', N.sol, true],
      ['aut1', 'usuario', N.aut1, true], ['aut2', 'usuario', N.aut2, true], ['baja', 'usuario', N.baja, false]]) {
      await setDoc(doc(db, 'usuarios', uid), { nombre: uid, rol, nomina, activo });
    }
    await setDoc(doc(db, 'asignaciones', `${N.sol}_solicitante_produccion`), asig(N.sol, 'solicitante', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut1}_aut1_produccion`), asig(N.aut1, 'aut1', 'produccion'));
    await setDoc(doc(db, 'asignaciones', `${N.aut2}_aut2_planta`), asig(N.aut2, 'aut2', null));
    for (const m of MOTIVOS_INICIALES) await setDoc(doc(db, 'motivosTE', m.id), campos(m));
  });
}
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const motivo = (db, id) => doc(db, 'motivosTE', id);

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas-motivos', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('motivos del tiempo extra: quién los lee', () => {
  it('cualquier usuario activo, uno por uno y la colección entera', async () => {
    for (const uid of ['admin', 'rh', 'nomina', 'sol', 'aut1', 'aut2']) {
      await assertSucceeds(getDoc(motivo(dbDe(uid), 'cargo-po')));
      await assertSucceeds(getDocs(collection(dbDe(uid), 'motivosTE')));
    }
  });
  it('quien está dado de baja o no tiene sesión, no', async () => {
    await assertFails(getDocs(collection(dbDe('baja'), 'motivosTE')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'motivosTE')));
  });
});

describe('motivos del tiempo extra: quién los escribe', () => {
  it('RH y admin crean y editan', async () => {
    await assertSucceeds(setDoc(motivo(dbDe('rh'), 'prueba-de-molde'), nuevo()));
    await assertSucceeds(setDoc(motivo(dbDe('admin'), 'otro-motivo'), nuevo({ nombre: 'Otro motivo', requiereNumero: 'tb', requiereComentario: true })));
    await assertSucceeds(updateDoc(motivo(dbDe('rh'), 'inventario-fisico'), { nombre: 'Inventario físico anual', orden: 3 }));
    await assertSucceeds(updateDoc(motivo(dbDe('rh'), 'inventario-fisico'), { activo: false }));
  });
  it('Aut. 2, Aut. 1, solicitante, Nóminas y los dados de baja no', async () => {
    for (const uid of ['aut2', 'aut1', 'sol', 'nomina', 'baja']) {
      await assertFails(setDoc(motivo(dbDe(uid), 'x-motivo'), nuevo()));
      await assertFails(updateDoc(motivo(dbDe(uid), 'inventario-fisico'), { nombre: 'Cambiado' }));
      await assertFails(updateDoc(motivo(dbDe(uid), 'inventario-fisico'), { activo: false }));
    }
  });
  it('la carga inicial completa (los nueve en un lote) la puede hacer RH', async () => {
    await env.clearFirestore(); await sembrar();
    await env.withSecurityRulesDisabled(async (ctx) => { for (const m of MOTIVOS_INICIALES) await deleteDoc(doc(ctx.firestore(), 'motivosTE', m.id)); });
    const db = dbDe('rh');
    const lote = writeBatch(db);
    MOTIVOS_INICIALES.forEach(m => lote.set(motivo(db, m.id), campos(m)));
    await assertSucceeds(lote.commit());
    await assertSucceeds(getDocs(collection(db, 'motivosTE')));
  });
  it('nadie borra, ni siquiera el admin: la baja es lógica', async () => {
    for (const uid of ['admin', 'rh']) await assertFails(deleteDoc(motivo(dbDe(uid), 'cargo-po')));
  });
});

describe('motivos del tiempo extra: lo que se puede guardar', () => {
  it('el nombre es texto no vacío de hasta 60 caracteres', async () => {
    const db = dbDe('rh');
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ nombre: '' })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ nombre: '   ' })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ nombre: 'x'.repeat(61) })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ nombre: 5 })));
    await assertSucceeds(setDoc(motivo(db, 'a'), nuevo({ nombre: 'x'.repeat(60) })));
  });
  it('requiereNumero solo puede ser null, "po" o "tb"; requiereComentario y activo son booleanos; el orden es un número', async () => {
    const db = dbDe('rh');
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ requiereNumero: 'ot' })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ requiereNumero: true })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ requiereComentario: 'si' })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ activo: 'si' })));
    await assertFails(setDoc(motivo(db, 'a'), nuevo({ orden: '3' })));
    await assertSucceeds(setDoc(motivo(db, 'a'), nuevo({ requiereNumero: 'po' })));
    await assertSucceeds(setDoc(motivo(db, 'b'), nuevo({ requiereNumero: 'tb', requiereComentario: true })));
  });
  it('no admite campos de más ni le faltan los suyos', async () => {
    const db = dbDe('rh');
    await assertFails(setDoc(motivo(db, 'a'), { ...nuevo(), extra: 'x' }));
    const { requiereComentario: _r, ...incompleto } = nuevo();
    await assertFails(setDoc(motivo(db, 'a'), incompleto));
  });
});
