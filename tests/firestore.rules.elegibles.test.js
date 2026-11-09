// «Cargar elegibles TE»: lo que escribe un solo lote (altas, puesto nuevo, bajas, actualizaciones y el resumen) contra las reglas, en el emulador.
// Ejecutar con: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { construirAltas, planElegiblesTE } from '../src/utils/elegibles.js';
import { AREAS_INICIALES, PUESTOS_INICIALES } from '../src/utils/estructura.js';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();
const empleado = (nomina, o = {}) => ({
  nomina, nombre: `EMPLEADO ${nomina}`, puesto: 'FORKLIFT OPERATOR', puestoId: 'forklift-operator', areaId: 'almacen', areaExcepcion: null, areaExcepcionMotivo: '',
  rutaId: '', comunidadId: '', puntoReunionId: '', activo: true, ...o,
});

beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-elegibles', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rol] of [['rh', 'rh'], ['sol', 'usuario']]) await setDoc(doc(db, 'usuarios', uid), { nombre: uid, rol, nomina: `n-${uid}`, activo: true });
    for (const a of AREAS_INICIALES) await setDoc(doc(db, 'areas', a.id), { nombre: a.nombre, participaTE: a.participaTE, activa: true, orden: a.orden });
    for (const p of PUESTOS_INICIALES) await setDoc(doc(db, 'puestos', p.id), { nombre: p.nombre, areaId: p.areaId, activo: true, alias: [], creadoPor: 'x', fechaCreacion: new Date() });
    await setDoc(doc(db, 'empleados', '1'), empleado('1'));
    await setDoc(doc(db, 'empleados', '2'), empleado('2'));
    await setDoc(doc(db, 'empleados', '3'), empleado('3', { activo: false }));
    await setDoc(doc(db, 'usuarios', 'u-51328'), { nombre: 'VILLARREAL', rol: 'usuario', nomina: '51328', activo: true }); // cuenta sin empleado en el padrón
  });
});

const fila = (nomina, o = {}) => ({ filaExcel: 2, nomina, nombre: `NUEVO ${nomina}`, puesto: 'FORKLIFT OPERATOR', depto: '', areaTE: 'Almacén', elegible: true, ...o });
const empleados = () => [
  { id: '1', ...empleado('1') }, { id: '2', ...empleado('2') }, { id: '3', ...empleado('3', { activo: false }) },
];

/** Arma el lote igual que ModalElegiblesTE.aplicar */
function lote(db, { filas, elecciones = {}, bajas = [] }) {
  const puestos = PUESTOS_INICIALES;
  const plan = planElegiblesTE({ filas, empleados: empleados(), areas: AREAS_INICIALES, puestos });
  const altas = construirAltas({ nuevos: plan.noEnPadron, elecciones, puestos, areas: AREAS_INICIALES });
  const b = writeBatch(db);
  for (const p of altas.puestosNuevos) b.set(doc(db, 'puestos', p.id), { nombre: p.nombre, areaId: p.areaId, activo: true, alias: [], creadoPor: 'rh', fechaCreacion: serverTimestamp() });
  for (const a of altas.altas) b.set(doc(db, 'empleados', a.id), a.datos);
  for (const c of plan.cambios.filter(x => x.cambia && !bajas.includes(x.id))) b.update(doc(db, 'empleados', c.id), c.datos);
  for (const id of bajas) {
    b.update(doc(db, 'empleados', id), { elegibleTE: false, activo: false, fechaBaja: serverTimestamp(), bajaPor: { uid: 'rh', nombre: 'rh' }, motivoBaja: 'No viene en la nómina semana 45' });
  }
  b.set(doc(collection(db, 'bitacora')), {
    accion: 'elegibles_te_cargados', entidad: 'empleados', antes: null,
    despues: { altas: altas.altas.length, bajas: bajas.length, actualizados: plan.cambios.length }, porUid: 'rh', porNombre: 'rh', fecha: serverTimestamp(),
  });
  return { b, altas, plan };
}

describe('Cargar elegibles TE: el lote completo lo escribe RH', () => {
  it('da de alta a quien no está en el padrón (activo, con elegibleTE del archivo), actualiza y registra el resumen', async () => {
    const { b } = lote(dbDe('rh'), { filas: [fila('1'), fila('2', { elegible: false, areaTE: '' }), fila('51323'), fila('51324', { elegible: false, areaTE: '', depto: 'Quality' })] });
    await assertSucceeds(b.commit());
    const nuevo = (await getDoc(doc(dbDe('rh'), 'empleados', '51323'))).data();
    expect(nuevo).toMatchObject({ activo: true, elegibleTE: true, areaId: 'almacen', puestoId: 'forklift-operator' });
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '51324'))).data()).toMatchObject({ elegibleTE: false, areaId: 'calidad', areaExcepcion: 'calidad' });
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '2'))).data().elegibleTE).toBe(false);
  });

  it('vincula con un usuario que ya existe: el alta no toca su perfil ni sus asignaciones', async () => {
    const { b } = lote(dbDe('rh'), { filas: [fila('51328', { nombre: 'VILLARREAL JUAN' })] });
    await assertSucceeds(b.commit());
    expect((await getDoc(doc(dbDe('rh'), 'usuarios', 'u-51328'))).data()).toMatchObject({ nomina: '51328', rol: 'usuario' });
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '51328'))).data()).toMatchObject({ nomina: '51328', activo: true });
  });

  it('puesto inexistente: crea el puesto en el área y da de alta con él', async () => {
    const { b, altas } = lote(dbDe('rh'), { filas: [fila('51325', { puesto: 'ROBOT TAMER' })] });
    expect(altas.puestosNuevos).toHaveLength(1);
    await assertSucceeds(b.commit());
    expect((await getDoc(doc(dbDe('rh'), 'puestos', 'robot-tamer'))).data()).toMatchObject({ nombre: 'ROBOT TAMER', areaId: 'almacen', activo: true });
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '51325'))).data().puestoId).toBe('robot-tamer');
  });

  it('bajas: solo se desactivan los marcados; los no marcados quedan activos y no elegibles', async () => {
    const { b } = lote(dbDe('rh'), { filas: [fila('1')], bajas: ['2'] }); // el 2 no viene en el archivo y se marca; el 3 ya estaba inactivo
    await assertSucceeds(b.commit());
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '2'))).data()).toMatchObject({ activo: false, elegibleTE: false, motivoBaja: 'No viene en la nómina semana 45' });
    const { b: b2 } = lote(dbDe('rh'), { filas: [fila('2')], bajas: [] }); // sin marcar: el 1 queda activo y no elegible
    await assertSucceeds(b2.commit());
    expect((await getDoc(doc(dbDe('rh'), 'empleados', '1'))).data()).toMatchObject({ activo: true, elegibleTE: false });
  });

  it('quien no es RH no escribe nada de esto', async () => {
    const { b } = lote(dbDe('sol'), { filas: [fila('51323')] });
    await assertFails(b.commit());
  });
});
