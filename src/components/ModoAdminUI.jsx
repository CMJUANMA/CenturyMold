/**
 * ModoAdminUI.jsx — Lo visible del MODO ADMIN (utils/modoAdmin.js):
 *   <FranjaModoAdmin />     franja fija arriba mientras el modo está encendido, con el botón para apagarlo (y marca <html> para correr el menú y el contenido)
 *   <InterruptorModoAdmin /> el interruptor del pie del menú (solo el admin lo ve)
 * La franja también registra la confirmación que se pide antes de cada acción en modo admin.
 */
import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAccesos } from '../hooks/useAccesos';
import { useConfirmar } from '../hooks/useConfirmar';
import { registrarConfirmacionAdmin } from '../utils/modoAdmin';

export function FranjaModoAdmin() {
  const { modoAdmin, alternarModoAdmin } = useAccesos();
  const confirmar = useConfirmar();

  useEffect(() => {
    registrarConfirmacionAdmin((accion) => confirmar({
      titulo: 'Acción en modo admin',
      mensaje: `${accion}\n\nQuedará registrada con tu nombre y la marca (admin), en el historial y en la bitácora.`,
      textoConfirmar: 'Hacerlo como admin',
    }));
    return () => registrarConfirmacionAdmin(null);
  }, [confirmar]);

  useEffect(() => {
    document.documentElement.classList.toggle('modo-admin-activo', !!modoAdmin);
    return () => document.documentElement.classList.remove('modo-admin-activo');
  }, [modoAdmin]);

  if (!modoAdmin) return null;
  return (
    <div role="status" id="franja-modo-admin"
      className="fixed inset-x-0 top-0 z-[60] flex h-9 items-center justify-center gap-2 border-b border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 text-xs font-medium text-[var(--status-warning-text)] sm:text-sm">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">Modo admin activo — tus acciones quedan registradas a tu nombre</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={() => alternarModoAdmin(false)}
        className="shrink-0 cursor-pointer rounded font-semibold underline underline-offset-2 hover:no-underline">Apagar</button>
    </div>
  );
}

export function InterruptorModoAdmin({ alCambiar }) {
  const { puedeModoAdmin, modoAdmin, alternarModoAdmin } = useAccesos();
  if (!puedeModoAdmin) return null;
  return (
    <button type="button" role="switch" aria-checked={!!modoAdmin} id="interruptor-modo-admin"
      onClick={() => { alternarModoAdmin(); alCambiar?.(); }}
      title="Encendido, puedes hacer cualquier acción de cualquier rol; queda registrada a tu nombre"
      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150 hover:bg-[var(--bg-surface-hover)] lg:min-h-9">
      <ShieldAlert className={`h-[18px] w-[18px] shrink-0 ${modoAdmin ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-secondary)]'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">Modo admin</span>
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${modoAdmin ? 'bg-[var(--status-warning-text)]' : 'bg-[var(--border-color)]'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${modoAdmin ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
