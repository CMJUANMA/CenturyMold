// "Restablecer acceso": reglas de usuarios/{uid} y bitácora. Ejecutar con npm run test:rules (emulador de Firestore).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';

let env;
const dbDe = (uid) => env.authenticatedContext(uid).firestore();

const perfil = (rol, nomina, extra = {}) => ({ nombre: `Persona ${nomina}`, rol, nomina, activo: true, debeCambiarPassword: false, preferencias: { tema: 'oscuro' }, ...extra });

async function sembrar() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), perfil('admin', '1'));
    await setDoc(doc(db, 'usuarios', 'rh'), perfil('rh', '2'));
    await setDoc(doc(db, 'usuarios', 'rh2'), perfil('rh', '3'));
    await setDoc(doc(db, 'usuarios', 'marco'), perfil('usuario', '5001'));
    await setDoc(doc(db, 'usuarios', 'otro'), perfil('usuario', '5002'));
    // Marco es Aut. 2 (asignación por nómina: no cambia al mover su perfil)
    await setDoc(doc(db, 'asignaciones', '5001_aut2_planta'), {
      nomina: '5001', nombre: 'Marco', rol: 'aut2', areaId: null, desde: new Date(Date.now() - 86400000), hasta: null, motivo: '',
      activo: true, asignadoPor: { uid: 'admin', nombre: 'Admin' }, fechaAsignacion: new Date(),
    });
  });
}

/**
 * Lote de "Restablecer acceso": perfil nuevo + borrar el viejo + bitácora. `cambios` ajusta lo que se prueba que falle.
 * { omitirNuevo, omitirBitacora, nuevo (datos), idBitacora, bitacora (datos), uidNuevo }
 */
async function restablecer(db, uidViejo, nominaViejo, rolViejo, cambios = {}) {
  const uidNuevo = cambios.uidNuevo ?? `nuevo-${uidViejo}`;
  const lote = writeBatch(db);
  if (!cambios.omitirNuevo) {
    lote.set(doc(db, 'usuarios', uidNuevo), cambios.nuevo ?? perfil(rolViejo, nominaViejo, { debeCambiarPassword: true }));
  }
  lote.delete(doc(db, 'usuarios', uidViejo));
  if (!cambios.omitirBitacora) {
    lote.set(doc(db, 'bitacora', cambios.idBitacora ?? `restablecer-${uidViejo}`), {
      accion: 'restablecer_acceso', entidad: `usuarios/${uidNuevo}`, antes: { uid: uidViejo }, despues: { uid: uidNuevo, nomina: nominaViejo, nombre: 'x' },
      porUid: cambios.porUid ?? db._authUid, porNombre: db._nombre, fecha: serverTimestamp(), ...(cambios.bitacora ?? {}),
    });
  }
  return lote.commit();
}
const NOMINA = { admin: '1', rh: '2', rh2: '3', marco: '5001', otro: '5002' };
const comoRH = (uid) => { const db = dbDe(uid); db._authUid = uid; db._nombre = `Persona ${NOMINA[uid]}`; return db; };

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-solicitud-rutas', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await sembrar(); });

describe('RH restablece el acceso de un usuario', () => {
  it('mueve el perfil al uid nuevo, borra el viejo y deja la bitácora', async () => {
    const db = comoRH('rh');
    await assertSucceeds(restablecer(db, 'marco', '5001', 'usuario'));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const c = ctx.firestore();
      const nuevo = await getDoc(doc(c, 'usuarios', 'nuevo-marco'));
      const viejo = await getDoc(doc(c, 'usuarios', 'marco'));
      const bit = await getDoc(doc(c, 'bitacora', 'restablecer-marco'));
      if (!nuevo.exists() || viejo.exists() || !bit.exists()) throw new Error('El lote no dejó el estado esperado');
      if (nuevo.data().debeCambiarPassword !== true || nuevo.data().preferencias?.tema !== 'oscuro') throw new Error('El perfil nuevo perdió datos');
    });
  });

  it('las asignaciones siguen valiendo con el uid nuevo (van por nómina) y el uid viejo ya no entra', async () => {
    await assertSucceeds(restablecer(comoRH('rh'), 'marco', '5001', 'usuario'));
    // Con su perfil nuevo, Marco sigue siendo Aut. 2: puede leer usuarios
    await assertSucceeds(getDocs(collection(dbDe('nuevo-marco'), 'usuarios')));
    // Con el uid viejo (cuenta borrada) ya no hay perfil activo: no lee nada
    await assertFails(getDocs(collection(dbDe('marco'), 'usuarios')));
  });

  it('un admin también puede restablecer a un usuario', async () => {
    await assertSucceeds(restablecer(comoRH('admin'), 'marco', '5001', 'usuario'));
  });
});

describe('quién no puede restablecer', () => {
  it('RH no restablece a otro RH ni a un admin; el admin sí restablece a un RH', async () => {
    await assertFails(restablecer(comoRH('rh'), 'rh2', '3', 'rh'));
    await assertFails(restablecer(comoRH('rh'), 'admin', '1', 'admin'));
    await assertSucceeds(restablecer(comoRH('admin'), 'rh2', '3', 'rh'));
  });
  it('RH no restablece su propia cuenta (y ya no puede con un rol rh de todas formas)', async () => {
    await assertFails(restablecer(comoRH('rh'), 'rh', '2', 'rh'));
  });
  it('un usuario común no puede; una Aut. 2 vigente sí (a un usuario, nunca a sí misma ni a un RH)', async () => {
    await assertFails(restablecer(comoRH('otro'), 'marco', '5001', 'usuario'));
    await assertSucceeds(restablecer(comoRH('marco'), 'otro', '5002', 'usuario'));
  });
  it('la Aut. 2 no restablece a un RH ni a sí misma', async () => {
    await assertFails(restablecer(comoRH('marco'), 'rh2', '3', 'rh'));
    await assertFails(restablecer(comoRH('marco'), 'marco', '5001', 'usuario'));
  });
});

describe('el lote tiene que ser exactamente un restablecimiento', () => {
  it('RH no puede borrar un perfil suelto', async () => {
    await assertFails(deleteDoc(doc(dbDe('rh'), 'usuarios', 'marco')));
  });
  it('sin el perfil nuevo en el mismo lote', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { omitirNuevo: true }));
  });
  it('sin el renglón de bitácora', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { omitirBitacora: true }));
  });
  it('bitácora con otro id', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { idBitacora: 'cualquier-cosa' }));
  });
  it('bitácora con otra acción o que apunta a otro uid viejo', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { bitacora: { accion: 'otra' } }));
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { bitacora: { antes: { uid: 'otro' } } }));
  });
  it('perfil nuevo con otra nómina, sin cambio obligatorio de contraseña o con otro rol', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { nuevo: perfil('usuario', '9999', { debeCambiarPassword: true }) }));
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { nuevo: perfil('usuario', '5001', { debeCambiarPassword: false }) }));
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { nuevo: perfil('rh', '5001', { debeCambiarPassword: true }) }));
  });
  it('no se puede "mover" el perfil a un uid que ya existe', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { uidNuevo: 'otro' }));
  });
  it('la bitácora debe decir quién lo hizo', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { porUid: 'alguien-mas' }));
  });
  it('RH no puede crear el perfil nuevo con rol rh', async () => {
    await assertFails(restablecer(comoRH('rh'), 'marco', '5001', 'usuario', { nuevo: perfil('rh', '5001', { debeCambiarPassword: true }) }));
  });
  it('la bitácora de un restablecimiento no se puede editar ni borrar', async () => {
    await assertSucceeds(restablecer(comoRH('rh'), 'marco', '5001', 'usuario'));
    await assertFails(setDoc(doc(dbDe('rh'), 'bitacora', 'restablecer-marco'), { accion: 'x' }));
    await assertFails(deleteDoc(doc(dbDe('rh'), 'bitacora', 'restablecer-marco')));
  });
});
