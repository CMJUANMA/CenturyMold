/**
 * firebaseSecundario.js
 * Instancia separada de Firebase Auth exclusivamente para crear usuarios
 * sin cerrar la sesión del administrador.
 */
import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const APP_NAME = 'secundaria';

const appSecundaria =
  getApps().find(a => a.name === APP_NAME) ??
  initializeApp(firebaseConfig, APP_NAME);

export const authSecundaria = getAuth(appSecundaria);
if (import.meta.env.VITE_USE_EMULATORS === 'true' && !authSecundaria.emulatorConfig) {
  connectAuthEmulator(authSecundaria, 'http://127.0.0.1:9099', { disableWarnings: true });
}
