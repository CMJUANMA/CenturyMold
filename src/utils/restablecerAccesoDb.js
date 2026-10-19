/**
 * restablecerAccesoDb.js — La parte de "Restablecer acceso" que habla con Firebase (ver restablecerAcceso.js para el flujo completo).
 */
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { authSecundaria } from '../firebaseSecundario';
import { generarPassword } from './passwordTemporal';
import { correoDeNomina, idBitacoraRestablecer, perfilRestablecido, registroRestablecimiento } from './restablecerAcceso';

/**
 * Crea la cuenta nueva, mueve el perfil al uid nuevo y borra el viejo (un solo lote, con su bitácora).
 * Si el lote falla se borra la cuenta recién creada y el perfil viejo queda intacto: se puede reintentar.
 * @returns {Promise<{ uid: string, perfil: object, password: string }>}
 */
export async function restablecerAcceso({ uidViejo, actor }) {
  const refViejo = doc(db, 'usuarios', uidViejo);
  const snap = await getDoc(refViejo);
  if (!snap.exists()) throw Object.assign(new Error('El perfil ya no existe.'), { code: 'app/sin-perfil' });
  const viejo = snap.data();
  const nomina = String(viejo.nomina ?? '').trim();
  const password = generarPassword();

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(authSecundaria, correoDeNomina(nomina), password);
  } catch (err) {
    await signOut(authSecundaria).catch(() => {});
    throw err;
  }
  const uidNuevo = cred.user.uid;
  const perfil = perfilRestablecido(viejo);
  try {
    const lote = writeBatch(db);
    lote.set(doc(db, 'usuarios', uidNuevo), perfil);
    lote.delete(refViejo);
    lote.set(doc(db, 'bitacora', idBitacoraRestablecer(uidViejo)), {
      ...registroRestablecimiento({ uidViejo, uidNuevo, perfil }, actor), fecha: serverTimestamp(),
    });
    await lote.commit();
  } catch (err) {
    try {
      await deleteUser(cred.user);
    } catch (errBorrar) {
      console.error('No se pudo borrar la cuenta nueva:', errBorrar);
      err.cuentaHuerfana = true;
    }
    throw err;
  } finally {
    await signOut(authSecundaria).catch(() => {});
  }
  return { uid: uidNuevo, perfil: { uid: uidNuevo, ...perfil }, password };
}
