/**
 * AuthContext.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Provee: usuario (datos Firestore), fireUser (Firebase Auth), cargando.
 * Helpers: login(nomina, password), cerrarSesion(), cambiarPassword(actual, nueva).
 *
 * Conversión de nómina → email: `${nomina}@rutas.app`
 * Al iniciar sesión verifica que usuarios/{uid}.activo === true.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

// ── Constante de dominio ficticio ─────────────────────────────────────────
export const nominaToEmail = (nomina) => `${nomina.trim()}@rutas.app`;

// ── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  /** Perfil completo desde Firestore (+ uid) */
  const [usuario, setUsuario] = useState(null);
  /** Objeto raw de Firebase Auth */
  const [fireUser, setFireUser] = useState(null);
  /** true mientras se resuelve onAuthStateChanged inicial */
  const [cargando, setCargando] = useState(true);

  // ── Escucha cambios de sesión ───────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const perfil = await cargarPerfil(user);
        if (perfil) {
          setFireUser(user);
          setUsuario(perfil);
        } else {
          // Usuario sin perfil o desactivado → forzar cierre
          await signOut(auth);
          setFireUser(null);
          setUsuario(null);
        }
      } else {
        setFireUser(null);
        setUsuario(null);
      }
      setCargando(false);
    });
    return unsub;
  }, []);

  // ── Leer perfil de Firestore ────────────────────────────────────────────
  async function cargarPerfil(user) {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.activo === false) return null;
    return { uid: user.uid, ...data };
  }

  // ── Login con nómina ────────────────────────────────────────────────────
  const login = useCallback(async (nomina, password) => {
    const email = nominaToEmail(nomina);
    // signInWithEmailAndPassword puede lanzar; el componente captura el error
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Verificar perfil (activo, existencia)
    const perfil = await cargarPerfil(cred.user);
    if (!perfil) {
      await signOut(auth);
      const err = new Error('Sin acceso');
      err.code = 'app/sin-acceso';
      throw err;
    }
    setFireUser(cred.user);
    setUsuario(perfil);
    return perfil;
  }, []);

  // ── Cerrar sesión ───────────────────────────────────────────────────────
  const cerrarSesion = useCallback(async () => {
    await signOut(auth);
    setFireUser(null);
    setUsuario(null);
  }, []);

  // ── Cambiar contraseña (requiere reautenticación) ───────────────────────
  const cambiarPassword = useCallback(
    async (passwordActual, passwordNueva) => {
      if (!fireUser) throw new Error('No hay sesión activa.');
      const cred = EmailAuthProvider.credential(fireUser.email, passwordActual);
      await reauthenticateWithCredential(fireUser, cred);
      await updatePassword(fireUser, passwordNueva);
    },
    [fireUser]
  );

  return (
    <AuthContext.Provider
      value={{ usuario, fireUser, cargando, login, cerrarSesion, cambiarPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
