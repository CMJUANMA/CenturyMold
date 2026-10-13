/**
 * usuariosDb.js — Alta de una cuenta de usuario (Auth + perfil usuarios/{uid}). La usan "Nuevo usuario" y "Crear usuarios en lote".
 * La cuenta se crea con la app secundaria (para no cerrar la sesión de quien la crea) y el perfil con la sesión principal.
 * La contraseña temporal NUNCA se guarda en Firestore: solo viaja a Firebase Auth.
 */
import { doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { authSecundaria } from '../firebaseSecundario';

/**
 * Crea la cuenta `${nomina}@rutas.app` y su perfil (rol de sistema, activo, debeCambiarPassword: true).
 * Si el perfil no se puede guardar, borra la cuenta recién creada; siempre cierra la sesión de la app secundaria.
 * @returns {Promise<{uid: string, perfil: object}>}
 */
export async function crearCuentaUsuario({ nomina, nombre, rol = 'usuario', password }) {
  const n = String(nomina).trim();
  const cred = await createUserWithEmailAndPassword(authSecundaria, `${n}@rutas.app`, password);
  const { uid } = cred.user;
  const perfil = { nomina: n, nombre: String(nombre).trim(), rol, activo: true, debeCambiarPassword: true };
  try {
    await setDoc(doc(db, 'usuarios', uid), perfil);
  } catch (errPerfil) {
    try {
      await deleteUser(cred.user);
    } catch (errBorrar) {
      console.error('No se pudo borrar la cuenta huérfana:', errBorrar);
      errPerfil.cuentaHuerfana = true;
    }
    throw errPerfil;
  } finally {
    await signOut(authSecundaria).catch(() => {});
  }
  return { uid, perfil };
}

/** Texto para mostrar de un error de alta (nomina para indicar qué cuenta buscar en Firebase Console) */
export function mensajeErrorAlta(err, nomina, usuarios = []) {
  const n = String(nomina).trim();
  if (err.code === 'auth/email-already-in-use') {
    return usuarios.some(u => String(u.nomina) === n)
      ? 'Ya existe un usuario con esa nómina.'
      : `Esa nómina tiene una cuenta de acceso sin perfil (cuenta huérfana, normalmente de un alta que falló). Bórrala en Firebase Console > Authentication (busca ${n}@rutas.app) y vuelve a crear el usuario.`;
  }
  if (err.code === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
  if (err.cuentaHuerfana) {
    return `No se pudo guardar el perfil (${err.message}) y tampoco se pudo borrar la cuenta creada. Bórrala en Firebase Console > Authentication (${n}@rutas.app) antes de reintentar.`;
  }
  return `Error: ${err.message}`;
}
