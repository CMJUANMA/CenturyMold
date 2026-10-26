// Reportes de nómina: reglas de ajustesNomina/{semana}_{areaId} y lo que Nóminas puede escribir en la bitácora. Contra el emulador (npm run test:rules).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env;
const ts = serverTimestamp;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();

const ID = '2026-43_moldes';
const ajuste = (uid, extra = {}) => ({
  semana: '2026-43', areaId: 'moldes', desde: '2026-10-19', hasta: '2026-10-25',
  cambios: [{ tipo: 'quitar', clave: '100', nomina: '100', nombre: 'ANA', motivo: 'No asistió', porNombre: uid, fecha: '2026-10-26T12:00:00Z' }],
  renglones: [{ clave: '100', nomina: '100', nombre: 'ANA', horas: {}, quitado: true, subtotal: 0 }],
  firmada: false, actualizadoPor: { uid, nombre: uid }, fechaActualizacion: ts(), ...extra,
});
const firmada = (uid) => ajuste(uid, { firmada: true, firmadaPor: { uid, nombre: uid } });

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const usuarios = [['admin', 'admin', '90000', 'admin'], ['rh', 'rh', '90001', 'rh'], ['nom', 'nomina', '70001', 'nom'], ['usu', 'usuario', '50001', 'usu'], ['aut2', 'usuario', '11', 'aut2']];
    for (const [uid, rol, nomina] of usuarios) await setDoc(doc(db, 'usuarios', uid), { nombre: uid, email: `${nomina}@rutas.app`, rol, nomina, activo: true });
    await setDoc(doc(db, 'asignaciones', '11_aut2_planta'), {
      nomina: '11', nombre: 'aut2', rol: 'aut2', areaId: null, desde: new Date(Date.now() - 86400000), hasta: null, motivo: '', activo: true,
      asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: new Date(),
    });
    await setDoc(doc(db, 'bitacora', 'b1'), { accion: 'x', entidad: 'asignacion', antes: null, despues: null, porUid: 'admin', porNombre: 'admin', fecha: new Date() });
  });
}
const sembrarAjuste = (datos) => env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'ajustesNomina', ID), datos));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('ajustesNomina: quién lee y escribe', () => {
  it('Nóminas, RH y admin guardan y leen los ajustes de un área y semana', async () => {
    for (const uid of ['nom', 'rh', 'admin']) {
      await env.clearFirestore(); await sembrar();
      await assertSucceeds(setDoc(doc(dbDe(uid), 'ajustesNomina', ID), ajuste(uid)));
      await assertSucceeds(getDoc(doc(dbDe(uid), 'ajustesNomina', ID)));
      await assertSucceeds(getDocs(collection(dbDe(uid), 'ajustesNomina')));
    }
  });
  it('un usuario sin rol lee o escribe; la Aut. 2 solo puede LEER un documento por su id (para avisar que la nómina está firmada), nunca listar ni escribir', async () => {
    await sembrarAjuste(ajuste('nom'));
    await assertFails(getDoc(doc(dbDe('usu'), 'ajustesNomina', ID)));
    await assertSucceeds(getDoc(doc(dbDe('aut2'), 'ajustesNomina', ID)));
    for (const uid of ['usu', 'aut2']) {
      await assertFails(getDocs(collection(dbDe(uid), 'ajustesNomina')));
      await assertFails(setDoc(doc(dbDe(uid), 'ajustesNomina', 'otro_moldes'), ajuste(uid, { semana: 'otro' })));
      await assertFails(updateDoc(doc(dbDe(uid), 'ajustesNomina', ID), { cambios: [] }));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ajustesNomina', ID)));
  });
  it('nadie lo borra, ni siquiera el admin', async () => {
    await sembrarAjuste(ajuste('nom'));
    for (const uid of ['nom', 'rh', 'admin']) await assertFails(deleteDoc(doc(dbDe(uid), 'ajustesNomina', ID)));
  });
});

describe('ajustesNomina: lo que se guarda', () => {
  it('el id debe ser {semana}_{areaId} y el que guarda queda con su uid y la hora del servidor', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'ajustesNomina', '2026-43_calidad'), ajuste('nom')));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('rh')));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { fechaActualizacion: new Date() })));
    await assertSucceeds(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom')));
  });
  it('no admite campos de más ni se pasa del tamaño', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { extra: 1 })));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { cambios: Array.from({ length: 1001 }, () => ({ tipo: 'quitar' })) })));
    await assertSucceeds(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { cambios: Array.from({ length: 1000 }, () => ({ tipo: 'horas' })) })));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { renglones: Array.from({ length: 301 }, () => ({ clave: 'x' })) })));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { cambios: 'no es lista' })));
  });
  it('firmar exige quién firma (el mismo usuario)', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { firmada: true })));
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', { firmada: true, firmadaPor: { uid: 'rh', nombre: 'rh' } })));
    await assertSucceeds(setDoc(doc(db, 'ajustesNomina', ID), firmada('nom')));
  });
});

describe('ajustesNomina: empleados agregados que no venían en las solicitudes', () => {
  const agregado = (uid) => ({
    cambios: [
      { tipo: 'agregar', clave: '+300', nomina: '300', nombre: 'PEREZ LOPEZ JUAN', puesto: '', enPadron: false, areaOrigen: '', motivoNuevo: { nombre: 'Producción', numero: '', tipoNumero: '', comentario: '', detalle: '' }, motivo: 'Faltó personal' },
      { tipo: 'horas', clave: '+300', nomina: '300', nombre: 'PEREZ LOPEZ JUAN', dia: '2026-10-21', antes: 0, horas: 4, motivo: 'Faltó personal' },
    ],
    renglones: [{ clave: '+300', nomina: '300', nombre: 'PEREZ LOPEZ JUAN', horas: { '2026-10-21': 4 }, original: {}, agregado: true, enPadron: false, quitado: false, subtotal: 4 }],
    actualizadoPor: { uid, nombre: uid },
  });
  const solicitud = { estatus: 'autorizada', areaId: 'moldes', fechaTE: '2099-10-21', empleados: [] };

  it('Nóminas, RH y admin guardan un renglón agregado (dentro de ajustesNomina)', async () => {
    for (const uid of ['nom', 'rh', 'admin']) {
      await env.clearFirestore(); await sembrar();
      await assertSucceeds(setDoc(doc(dbDe(uid), 'ajustesNomina', ID), ajuste(uid, agregado(uid))));
    }
  });
  it('agregar a alguien no crea ni cambia solicitudes de tiempo extra: Nóminas no las puede escribir', async () => {
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'tiempoExtra', 'te1'), solicitud));
    const db = dbDe('nom');
    await assertSucceeds(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom', agregado('nom'))));
    await assertFails(setDoc(doc(db, 'tiempoExtra', 'te2'), solicitud));
    await assertFails(updateDoc(doc(db, 'tiempoExtra', 'te1'), { empleados: [{ nomina: '300' }] }));
    await assertFails(deleteDoc(doc(db, 'tiempoExtra', 'te1')));
  });
  it('quien no es de Nóminas, RH o admin no guarda renglones agregados', async () => {
    for (const uid of ['usu', 'aut2']) await assertFails(setDoc(doc(dbDe(uid), 'ajustesNomina', ID), ajuste(uid, agregado(uid))));
  });
  it('en un área firmada ya no se puede agregar a nadie (solo RH la reabre)', async () => {
    await sembrarAjuste({ ...ajuste('nom'), firmada: true, firmadaPor: { uid: 'nom', nombre: 'nom' } });
    await assertFails(setDoc(doc(dbDe('nom'), 'ajustesNomina', ID), ajuste('nom', agregado('nom'))));
    await assertFails(setDoc(doc(dbDe('rh'), 'ajustesNomina', ID), ajuste('rh', agregado('rh'))));
  });
  it('la bitácora de un guardado con agregados es la de ajustar_nomina, con su uid y la hora del servidor', async () => {
    const fila = { accion: 'ajustar_nomina', entidad: `ajustesNomina/${ID}`, antes: { cambios: 0 }, despues: { motivo: 'Faltó personal', total: 2, cambios: [{ tipo: 'agregar', nomina: '300' }] }, porUid: 'nom', porNombre: 'nom', fecha: ts() };
    await assertSucceeds(setDoc(doc(collection(dbDe('nom'), 'bitacora')), fila));
    await assertFails(setDoc(doc(collection(dbDe('nom'), 'bitacora')), { ...fila, porUid: 'rh' }));
  });
});

describe('ajustesNomina: firmada = bloqueada', () => {
  beforeEach(async () => { await sembrarAjuste({ ...ajuste('nom'), firmada: true, firmadaPor: { uid: 'nom', nombre: 'nom' } }); });

  it('Nóminas ya no cambia nada de un área firmada (ni los ajustes ni la firma)', async () => {
    const db = dbDe('nom');
    await assertFails(setDoc(doc(db, 'ajustesNomina', ID), ajuste('nom')));
    await assertFails(updateDoc(doc(db, 'ajustesNomina', ID), { cambios: [], actualizadoPor: { uid: 'nom', nombre: 'nom' }, fechaActualizacion: ts() }));
    await assertFails(updateDoc(doc(db, 'ajustesNomina', ID), { firmada: false, actualizadoPor: { uid: 'nom', nombre: 'nom' }, fechaActualizacion: ts() }));
  });
  it('RH la puede reabrir, y solo reabrir (sin tocar los cambios)', async () => {
    const reabrir = (extra = {}) => ({ firmada: false, firmadaPor: null, reabiertaPor: { uid: 'rh', nombre: 'rh' }, actualizadoPor: { uid: 'rh', nombre: 'rh' }, fechaActualizacion: ts(), ...extra });
    await assertFails(updateDoc(doc(dbDe('rh'), 'ajustesNomina', ID), reabrir({ cambios: [] })));
    await assertFails(updateDoc(doc(dbDe('rh'), 'ajustesNomina', ID), reabrir({ actualizadoPor: { uid: 'nom', nombre: 'nom' } })));
    await assertFails(updateDoc(doc(dbDe('rh'), 'ajustesNomina', ID), { cambios: [], actualizadoPor: { uid: 'rh', nombre: 'rh' }, fechaActualizacion: ts() }));
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'ajustesNomina', ID), reabrir()));
  });
  it('ya reabierta, Nóminas vuelve a ajustar', async () => {
    await assertSucceeds(updateDoc(doc(dbDe('rh'), 'ajustesNomina', ID), { firmada: false, firmadaPor: null, reabiertaPor: { uid: 'rh', nombre: 'rh' }, actualizadoPor: { uid: 'rh', nombre: 'rh' }, fechaActualizacion: ts() }));
    await assertSucceeds(setDoc(doc(dbDe('nom'), 'ajustesNomina', ID), ajuste('nom', { cambios: [] })));
  });
});

describe('bitácora: Nóminas solo escribe los tipos que corresponden a sus acciones', () => {
  const fila = (extra = {}) => ({ accion: 'descargar_resumen_te', entidad: 'descarga', antes: null, despues: { filas: 3 }, porUid: 'nom', porNombre: 'nom', fecha: ts(), ...extra });
  const escribe = (datos) => setDoc(doc(collection(dbDe('nom'), 'bitacora')), datos);

  it('sí: sus descargas (padrón, resumen, consulta, formato de rutas y formato de nómina)', async () => {
    for (const accion of ['descargar_padron', 'descargar_resumen_te', 'descargar_consulta_te', 'descargar_formato_rutas', 'descargar_formato_te_nomina']) {
      await assertSucceeds(escribe(fila({ accion })));
    }
  });
  it('sí: confirmar el envío al proveedor y los ajustes y el firmado de su formato', async () => {
    await assertSucceeds(escribe(fila({ accion: 'recibir', entidad: 'tiempoExtra' })));
    for (const accion of ['ajustar_nomina', 'deshacer_ajustes_nomina', 'firmar_nomina']) {
      await assertSucceeds(escribe(fila({ accion, entidad: `ajustesNomina/${ID}` })));
    }
  });
  it('no: el respaldo completo, una descarga inventada ni acciones sueltas de otras entidades', async () => {
    await assertFails(escribe(fila({ accion: 'descargar_respaldo_completo' })));
    await assertFails(escribe(fila({ accion: 'cualquier_cosa' })));
    await assertFails(escribe(fila({ accion: 'cancelar_autorizada', entidad: 'tiempoExtra' })));
    await assertFails(escribe(fila({ accion: 'devolver', entidad: 'tiempoExtra' })));
    await assertFails(escribe(fila({ accion: 'dar_rol_rh', entidad: 'usuarios/x' })));
    await assertFails(escribe(fila({ accion: 'asignar', entidad: 'asignacion' })));
    await assertFails(escribe(fila({ accion: 'reabrir_nomina', entidad: `ajustesNomina/${ID}` })));
    await assertFails(escribe(fila({ accion: 'ajustar_nomina', entidad: 'descarga' })));
    await assertFails(escribe(fila({ accion: 'recibir', entidad: `ajustesNomina/${ID}` })));
  });
  it('siempre con su propio uid, su nombre y la hora del servidor', async () => {
    await assertFails(escribe(fila({ porUid: 'rh' })));
    await assertFails(escribe(fila({ porNombre: 'OTRA PERSONA' })));
    await assertFails(escribe(fila({ fecha: new Date() })));
    await assertFails(escribe(fila({ extra: 1 })));
  });
  it('no lee, edita ni borra la bitácora', async () => {
    await assertFails(getDocs(collection(dbDe('nom'), 'bitacora')));
    await assertFails(updateDoc(doc(dbDe('nom'), 'bitacora', 'b1'), { accion: 'x2' }));
    await assertFails(deleteDoc(doc(dbDe('nom'), 'bitacora', 'b1')));
  });
  it('RH escribe la reapertura de un área firmada', async () => {
    await assertSucceeds(setDoc(doc(collection(dbDe('rh'), 'bitacora')), fila({ accion: 'reabrir_nomina', entidad: `ajustesNomina/${ID}`, porUid: 'rh', porNombre: 'rh' })));
  });
});
