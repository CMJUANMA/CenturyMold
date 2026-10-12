/**
 * AuthContext.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Provee: usuario (perfil de Firestore en vivo), fireUser (Firebase Auth), cargando,
 *         errorPerfil, mensajeSesion.
 * Helpers: login(nomina, password), cerrarSesion(), cambiarPassword(actual, nueva),
 *          cambiarPasswordInicial(nueva, temporal?), reintentarPerfil().
 *
 * Conversión de nómina → email: `${nomina}@rutas.app`
 * El perfil usuarios/{uid} se escucha con onSnapshot mientras haya sesión: si el usuario
 * se desactiva o se borra su documento se cierra la sesión; si cambia el rol, la interfaz
 * se actualiza sin recargar.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export const MSG_DESACTIVADO = 'Tu usuario fue desactivado. Contacta a RH.';

// ── Constante de dominio ficticio ─────────────────────────────────────────
export const nominaToEmail = (nomina) => `${nomina.trim()}@rutas.app`;

// ── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  /** Perfil completo desde Firestore (+ uid) */
  const [usuario, setUsuario] = useState(null);
  /** Objeto raw de Firebase Auth */
  const [fireUser, setFireUser] = useState(null);
  /** true mientras se resuelve la sesión inicial y el primer perfil */
  const [cargando, setCargando] = useState(true);
  /** Error al leer el perfil (red, permisos…); la UI ofrece reintentar o cerrar sesión */
  const [errorPerfil, setErrorPerfil] = useState(null);
  /** Aviso mostrado en el login tras un cierre de sesión forzado */
  const [mensajeSesion, setMensajeSesion] = useState('');
  const [reintento, setReintento] = useState(0);

  /** El perfil ya se cargó bien alguna vez en esta sesión (para avisar solo de desactivaciones en vivo) */
  const tuvoPerfil = useRef(false);
  /** Última contraseña usada en login (solo memoria): sirve para exigir una distinta en el primer acceso */
  const ultimoPassword = useRef('');

  // ── Sesión de Firebase Auth ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFireUser(user);
      if (user) {
        setCargando(true);
      } else {
        tuvoPerfil.current = false;
        setUsuario(null);
        setErrorPerfil(null);
        setCargando(false);
      }
    });
    return unsub;
  }, []);

  // ── Perfil en vivo: se cancela al cerrar sesión o cambiar de usuario ────
  const uid = fireUser?.uid;
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'usuarios', uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.activo === false) {
          if (tuvoPerfil.current) setMensajeSesion(MSG_DESACTIVADO);
          tuvoPerfil.current = false;
          setUsuario(null);
          setCargando(false);
          signOut(auth).catch(() => {});
          return;
        }
        tuvoPerfil.current = true;
        setUsuario({ uid, ...data });
        setErrorPerfil(null);
        setCargando(false);
      },
      (err) => {
        console.error('Error leyendo el perfil:', err);
        setErrorPerfil(err);
        setCargando(false);
      }
    );
    return unsub;
  }, [uid, reintento]);

  const reintentarPerfil = useCallback(() => {
    setErrorPerfil(null);
    setCargando(true);
    setReintento(n => n + 1);
  }, []);

  // ── Login con nómina ────────────────────────────────────────────────────
  const login = useCallback(async (nomina, password) => {
    setMensajeSesion('');
    const email = nominaToEmail(nomina);
    // signInWithEmailAndPassword puede lanzar; el componente captura el error
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Verificar perfil (existencia y activo) antes de dar acceso
    let snap;
    try {
      snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
    } catch (e) {
      await signOut(auth);
      throw e;
    }
    const data = snap.exists() ? snap.data() : null;
    if (!data || data.activo === false) {
      await signOut(auth);
      const err = new Error(data ? 'Usuario desactivado' : 'Sin acceso');
      err.code = data ? 'app/inactivo' : 'app/sin-acceso';
      throw err;
    }
    ultimoPassword.current = password;
    return { uid: cred.user.uid, ...data };
  }, []);

  // ── Cerrar sesión ───────────────────────────────────────────────────────
  const cerrarSesion = useCallback(async () => {
    ultimoPassword.current = '';
    await signOut(auth);
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

  // ── Primer acceso: contraseña nueva y baja de la bandera debeCambiarPassword ──
  // `temporal` solo hace falta si se recargó la página (ya no está en memoria).
  const cambiarPasswordInicial = useCallback(
    async (passwordNueva, temporal = '') => {
      if (!fireUser) throw new Error('No hay sesión activa.');
      const actual = temporal || ultimoPassword.current;
      if (actual && passwordNueva === actual) {
        const err = new Error('Debe ser distinta a la temporal.');
        err.code = 'app/password-igual';
        throw err;
      }
      if (temporal) {
        await cambiarPassword(temporal, passwordNueva);
      } else {
        await updatePassword(fireUser, passwordNueva);
      }
      await updateDoc(doc(db, 'usuarios', fireUser.uid), { debeCambiarPassword: false });
      ultimoPassword.current = passwordNueva;
    },
    [fireUser, cambiarPassword]
  );

  /** true si falta la contraseña temporal (p. ej. tras recargar) */
  const requiereTemporal = () => !ultimoPassword.current;

  return (
    <AuthContext.Provider
      value={{
        usuario, fireUser, cargando, errorPerfil, mensajeSesion,
        login, cerrarSesion, cambiarPassword, cambiarPasswordInicial,
        requiereTemporal, reintentarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
