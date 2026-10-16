/**
 * ConfirmarContext.jsx — Modal de confirmación reutilizable (reemplaza confirm() y prompt()).
 * Se usa mediante el hook useConfirmar(); aquí viven el contexto y el proveedor que dibuja el modal.
 */
import { useCallback, useRef, useState } from 'react';
import Modal from '../components/Modal';

import { ConfirmarContext } from './confirmarStore';

const btnBase = 'rounded-md px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function ConfirmarProvider({ children }) {
  const [estado, setEstado] = useState(null); // { opciones }
  const [texto, setTexto] = useState('');
  const resolverRef = useRef(null);

  // Devuelve una promesa: true/false, o el texto escrito / null si hay `campo`
  const confirmar = useCallback((opciones) => new Promise((resolve) => {
    // Si ya había una confirmación abierta, se cancela
    if (resolverRef.current) resolverRef.current(null);
    resolverRef.current = resolve;
    setTexto(opciones.campo?.valorInicial ?? '');
    setEstado({ opciones });
  }), []);

  const cerrar = (aceptado) => {
    const resolve = resolverRef.current;
    const { campo } = estado?.opciones ?? {};
    resolverRef.current = null;
    setEstado(null);
    if (!resolve) return;
    if (campo) resolve(aceptado ? texto.trim() : null);
    else resolve(!!aceptado);
  };

  const o = estado?.opciones;
  const campo = o?.campo;
  const minLength = campo ? (campo.minLength ?? 1) : 0;
  const valido = !campo || texto.trim().length >= minLength;

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <Modal isOpen={!!estado} onClose={() => cerrar(false)} title={o?.titulo ?? 'Confirmar'} maxWidth="max-w-sm" preventCloseOnBackdrop>
        {o && (
          <form onSubmit={(e) => { e.preventDefault(); if (valido) cerrar(true); }} className="space-y-4">
            {o.mensaje && <p className="whitespace-pre-line text-sm text-[var(--text-secondary)]">{o.mensaje}</p>}
            {campo && (
              <div>
                {campo.etiqueta && <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">{campo.etiqueta}</label>}
                {campo.multilinea ? (
                  <textarea autoFocus rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder={campo.placeholder}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]" />
                ) : (
                  <input autoFocus type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder={campo.placeholder}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]" />
                )}
                {minLength > 1 && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo {minLength} caracteres ({texto.trim().length}/{minLength}).</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
              <button type="button" onClick={() => cerrar(false)}
                className={`${btnBase} border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]`}>
                {o.textoCancelar ?? 'Cancelar'}
              </button>
              <button type="submit" disabled={!valido}
                className={`${btnBase} text-white ${o.peligroso ? 'bg-[var(--status-error-text)] hover:opacity-90' : 'bg-[var(--cm-red)] hover:bg-[var(--cm-red-hover)]'}`}>
                {o.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </ConfirmarContext.Provider>
  );
}
