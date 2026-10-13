import { createContext } from 'react';

/** Contexto de accesos (asignaciones vigentes del usuario). El proveedor está en AccesosContext.jsx; se consume con hooks/useAccesos.js */
export const AccesosContext = createContext(null);
