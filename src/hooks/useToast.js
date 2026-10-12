import { useContext } from 'react';
import { ToastContext } from '../context/toastStore';

/** const toast = useToast(); toast.success('Listo'); toast.error('Falló'); */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return ctx;
}
