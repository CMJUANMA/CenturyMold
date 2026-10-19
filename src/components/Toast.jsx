/**
 * Toast.jsx — Sistema de notificaciones tipo toast
 * Uso: const { toast, ToastContainer } = useToast();
 *      toast.success('Mensaje'); toast.error('Error');
 */
import { useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { TONOS } from './ui/estilos';

import { ToastContext } from '../context/toastStore';

let uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, tipo = 'info', duracion = 6000) => {
    const id = ++uid;
    setToasts(prev => [...prev, { id, msg, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracion);
  }, []);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = useMemo(() => ({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Container */}
      <div className="fixed inset-x-4 bottom-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none sm:left-auto" aria-live="polite">
        {toasts.map(t => <ToastItem key={t.id} {...t} onClose={() => remove(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

// Tonos apagados con ícono y texto (nunca solo color); el error no usa el rojo de la marca
const TONO_DE = { success: 'exito', error: 'error', warning: 'aviso', info: 'info' };

function ToastItem({ msg, tipo, onClose }) {
  const t = TONOS[TONO_DE[tipo] ?? 'info'];
  const Icon = t.Icono;

  return (
    <div
      onClick={onClose}
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`anim-toast pointer-events-auto flex cursor-pointer select-none items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${t.caja}`}
      style={{ minWidth: 260, maxWidth: 400 }}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm font-medium">{msg}</span>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar aviso" className="-m-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-black/5">
        <X className="h-4 w-4 opacity-70" aria-hidden="true" />
      </button>
    </div>
  );
}
