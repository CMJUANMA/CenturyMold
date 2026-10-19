import { createContext } from 'react';

/** Contexto de los recordatorios en pantalla (el proveedor está en context/RecordatoriosContext.jsx; se consume con hooks/useRecordatorios.js) */
export const RecordatoriosContext = createContext(null);