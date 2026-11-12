/**
 * Toast.jsx — Sistema de notificaciones tipo toast
 * Uso: const { toast, ToastContainer } = useToast();
 *      toast.success('Mensaje'); toast.error('Error');
 *      toast.error('No se pudo enviar. Tu borrador está guardado.', 8000, err.message);   // 3.er argumento: detalle técnico, oculto bajo «Ver detalle»
 *      toast.success('Borrador guardado.', 8000, { accion: { texto: 'Ver mis solicitudes', onClick: () => navigate('/…') } });   // o un objeto { detalle, accion }
 * Un mensaje muy largo (p. ej. un error técnico pegado al texto) nunca ocupa media pantalla: se recorta y el resto queda en «Ver detalle».
 */
import { useState, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { TONOS } from './ui/estilos';

import { ToastContext } from '../context/toastStore';
import { partirAviso } from '../utils/partirAviso';

let uid = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((mensaje, tipo = 'info', duracion = 6000, extra = '') => {
    const id = ++uid;
    const { detalle: detalleDado = '', accion = null } = typeof extra === 'string' ? { detalle: extra } : (extra ?? {});
    const { msg, detalle } = partirAviso(mensaje, detalleDado);
    setToasts(prev => [...prev, { id, msg, tipo, detalle, accion }]);
    // Con detalle da tiempo de abrirlo y leerlo
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), detalle ? Math.max(duracion, 20000) : duracion);
  }, []);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = useMemo(() => ({
    success: (msg, dur, extra) => addToast(msg, 'success', dur, extra),
    error:   (msg, dur, extra) => addToast(msg, 'error', dur, extra),
    info:    (msg, dur, extra) => addToast(msg, 'info', dur, extra),
    warning: (msg, dur, extra) => addToast(msg, 'warning', dur, extra),
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

function ToastItem({ msg, tipo, detalle, accion, onClose }) {
  const t = TONOS[TONO_DE[tipo] ?? 'info'];
  const Icon = t.Icono;
  const [verDetalle, setVerDetalle] = useState(false);

  return (
    <div
      onClick={detalle ? undefined : onClose}
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`anim-toast pointer-events-auto flex ${detalle ? '' : 'cursor-pointer select-none'} items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${t.caja}`}
      style={{ minWidth: 260, maxWidth: 400 }}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{msg}</span>
        {accion && (
          <button type="button" onClick={(e) => { e.stopPropagation(); accion.onClick(); onClose(); }}
            className="mt-1 mr-3 cursor-pointer text-xs font-semibold underline underline-offset-2 hover:opacity-80">
            {accion.texto}
          </button>
        )}
        {detalle && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); setVerDetalle(v => !v); }} aria-expanded={verDetalle}
              className="mt-1 cursor-pointer text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100">
              {verDetalle ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
            {verDetalle && <p className="mt-1 max-h-40 select-text overflow-auto whitespace-pre-wrap break-words rounded border border-current/20 bg-black/5 p-2 text-xs font-normal opacity-90">{detalle}</p>}
          </>
        )}
      </div>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar aviso" className="-m-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-black/5">
        <X className="h-4 w-4 opacity-70" aria-hidden="true" />
      </button>
    </div>
  );
}
