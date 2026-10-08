/**
 * Toast.jsx — Sistema de notificaciones tipo toast
 * Uso: const { toast, ToastContainer } = useToast();
 *      toast.success('Mensaje'); toast.error('Error');
 */
import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, tipo = 'info', duracion = 3500) => {
    const id = ++uid;
    setToasts(prev => [...prev, { id, msg, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracion);
  }, []);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => <ToastItem key={t.id} {...t} onClose={() => remove(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

const STYLES = {
  success: { bg: 'bg-emerald-600', icon: CheckCircle2 },
  error:   { bg: 'bg-[var(--cm-red)]',   icon: AlertTriangle },
  warning: { bg: 'bg-[var(--status-warning-bg)]0',   icon: AlertTriangle },
  info:    { bg: 'bg-[#374151]',   icon: Info },
};

function ToastItem({ msg, tipo, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const { bg, icon: Icon } = STYLES[tipo] ?? STYLES.info;

  return (
    <div
      onClick={onClose}
      className={`pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-xl cursor-pointer select-none transition-all duration-300 ${bg} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ minWidth: 240, maxWidth: 380 }}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-xs font-medium">{msg}</span>
      <X className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
    </div>
  );
}
