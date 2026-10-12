import { createContext } from 'react';

/** Contexto de notificaciones (el proveedor está en components/Toast.jsx; se consume con hooks/useToast.js) */
export const ToastContext = createContext(null);
