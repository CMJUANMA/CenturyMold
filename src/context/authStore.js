import { createContext } from 'react';

/** Contexto de autenticación (el proveedor está en AuthContext.jsx; se consume con hooks/useAuth.js) */
export const AuthContext = createContext(null);
