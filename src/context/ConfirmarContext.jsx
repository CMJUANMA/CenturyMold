/**
 * ConfirmarContext.jsx — Modal de confirmación reutilizable (reemplaza confirm() y prompt()).
 * Se usa mediante el hook useConfirmar(); aquí viven el contexto y el proveedor que dibuja el modal.
 */
import { useCallback, useRef, useState } from 'react';
import Modal from '../components/Modal';
import Boton from '../components/ui/Boton';
import { AreaTexto, Campo, Entrada } from '../components/ui/Campo';

import { ConfirmarContext } from './confirmarStore';

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
              <Campo etiqueta={campo.etiqueta} ayuda={minLength > 1 ? `Mínimo ${minLength} caracteres (${texto.trim().length}/${minLength}).` : undefined}>
                {campo.multilinea
                  ? <AreaTexto autoFocus rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder={campo.placeholder} />
                  : <Entrada autoFocus type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder={campo.placeholder} />}
              </Campo>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
              <Boton onClick={() => cerrar(false)}>{o.textoCancelar ?? 'Cancelar'}</Boton>
              {/* Una acción destructiva se confirma en contorno de error; solo lo demás usa el botón principal */}
              <Boton type="submit" variante={o.peligroso ? 'peligro' : 'primario'} disabled={!valido}>{o.textoConfirmar ?? 'Confirmar'}</Boton>
            </div>
          </form>
        )}
      </Modal>
    </ConfirmarContext.Provider>
  );
}
