/**
 * ModalRestablecerPassword.jsx — "Restablecer contraseña" de un usuario (RH, Aut. 2 vigente y admin), sin consola de Firebase:
 *   1. Se explica lo que pasa y se confirma.
 *   2. Se crea la cuenta de la versión siguiente con una contraseña temporal, el perfil pasa al uid nuevo, se actualiza accesos y la bitácora
 *      (utils/restablecerAcceso.js). Si algo falla a medias se revierte y se avisa.
 *   3. La contraseña temporal se muestra UNA sola vez, con botón de copiar. Nunca se guarda ni se registra.
 * Se monta solo mientras está abierto: al cerrar se pierde la contraseña, como debe ser.
 *
 * Props: abierto, usuario ({ uid, nomina, nombre, rol }), actor ({ uid, nombre }), onClose, onRestablecido(uidViejo, perfilNuevo)
 */
import { useState } from 'react';
import { Copy, KeyRound, ShieldAlert } from 'lucide-react';
import Modal from '../../../components/Modal';
import Aviso from '../../../components/ui/Aviso';
import Boton from '../../../components/ui/Boton';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import { mensajeErrorRestablecer } from '../../../utils/restablecerAcceso';
import { restablecerAcceso } from '../../../utils/restablecerAccesoDb';

export default function ModalRestablecerPassword({ abierto, ...resto }) {
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ usuario, actor, onClose, onRestablecido }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [paso, setPaso] = useState('confirmar'); // confirmar | creando | listo
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [copiada, setCopiada] = useState(false);

  const nomina = String(usuario.nomina);

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Contraseña copiada');
      return true;
    } catch {
      toast.error('No se pudo copiar. Selecciónala y cópiala a mano.');
      return false;
    }
  };

  const restablecer = async () => {
    setError('');
    setPaso('creando');
    try {
      const r = await restablecerAcceso({ uidViejo: usuario.uid, actor });
      onRestablecido(usuario.uid, r.perfil);
      setPassword(r.password);
      setPaso('listo');
    } catch (err) {
      setError(mensajeErrorRestablecer(err, nomina, err.version));
      setPaso('confirmar');
    }
  };

  const cerrar = async () => {
    if (paso === 'creando') return;
    if (paso === 'listo' && !copiada) {
      const ok = await confirmar({
        titulo: 'Cerrar sin copiar la contraseña',
        mensaje: 'La contraseña temporal no se puede volver a ver. ¿Ya la anotaste o la entregaste?',
        textoConfirmar: 'Ya la entregué, cerrar', peligroso: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={cerrar} title={`Restablecer contraseña · ${usuario.nombre}`} maxWidth="max-w-lg" preventCloseOnBackdrop={paso !== 'confirmar'}
      cerrarDeshabilitado={paso === 'creando'}>
      {paso === 'confirmar' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Se le da a <b>{usuario.nombre}</b> (nómina <span className="font-mono">{nomina}</span>) una contraseña temporal nueva. Conserva su rol, sus
            preferencias y sus asignaciones, y al entrar el sistema le pedirá crear una contraseña propia. La contraseña anterior deja de servir.
          </p>
          {error && <Aviso tono="error">{error}</Aviso>}
          <Aviso tono="aviso">
            Los borradores y solicitudes de tiempo extra que esta persona creó antes ya no le aparecerán en «Mis solicitudes» (quedan ligados a su
            cuenta anterior). Las firmas y el historial de lo ya enviado no cambian.
          </Aviso>
          <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
            <Boton onClick={cerrar}>Cancelar</Boton>
            <Boton id="btn-restablecer-password" variante="primario" icono={KeyRound} onClick={restablecer}>Restablecer contraseña</Boton>
          </div>
        </div>
      )}

      {paso === 'creando' && (
        <div className="py-6" role="status">
          <p className="text-sm font-semibold text-[var(--text-main)]">Restableciendo la contraseña…</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">No cierres esta ventana.</p>
        </div>
      )}

      {paso === 'listo' && (
        <div className="space-y-4">
          <div role="alert" className="rounded-lg border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
            <p className="flex items-center gap-2 text-base font-semibold"><ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />Contraseña temporal de {usuario.nombre}</p>
            <p className="mt-3 select-all break-all rounded-md bg-[var(--bg-surface)] px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider text-[var(--text-main)]">{password}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Boton id="btn-copiar-password" variante="primario" icono={Copy} onClick={async () => { if (await copiar(password)) setCopiada(true); }}>Copiar contraseña</Boton>
            </div>
            <p className="mt-3 text-sm font-semibold">Se muestra una sola vez. Entrégala en persona; no la mandes por teléfono, correo ni mensaje.</p>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Usuario: <span className="font-mono font-semibold">{nomina}</span>. Al entrar, el sistema le pedirá crear una contraseña nueva.
          </p>
          <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
            <Boton variante="primario" onClick={cerrar}>Cerrar</Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
