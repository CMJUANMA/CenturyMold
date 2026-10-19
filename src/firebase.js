import { initializeApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// App Check (opcional): si hay VITE_APPCHECK_SITE_KEY, cada petición a Firestore y Auth lleva una prueba de que viene de esta app y no de un script ajeno.
// Sin la clave no hace nada. Pasos para activarlo (reCAPTCHA v3, CSP y "Aplicar" en la consola): docs/seguridad.md.
const claveAppCheck = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (claveAppCheck && import.meta.env.VITE_USE_EMULATORS !== 'true') {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(claveAppCheck), isTokenAutoRefreshEnabled: true });
}

export const auth = getAuth(app);
export const db = getFirestore(app);

// Solo para capturas y pruebas locales (npm run capturas:build): con VITE_USE_EMULATORS=true usa los emuladores. En producción no existe.
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export default app;
