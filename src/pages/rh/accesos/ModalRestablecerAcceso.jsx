/**
 * ModalRestablecerAcceso.jsx — Asistente "Restablecer acceso" de un usuario (RH y admin), en tres pasos:
 *   1. Borrar su cuenta en Firebase Console > Authentication (enlace directo y la nómina para copiar). La app no puede hacerlo.
 *   2. Al confirmar que ya se borró: se crea la cuenta nueva con contraseña temporal, el perfil pasa al uid nuevo y se borra el viejo.
 *   3. La contraseña temporal se muestra UNA sola vez, con botón de copiar. Nunca se guarda ni se registra.
 * Se monta solo mientras está abierto: al cerrar se pierde la contraseña, como debe ser.
 *
 * Props: abierto, usuario ({ uid, nomina, nombre, rol }), actor ({ uid, nombre }), onClose, onRestablecido(uidViejo, perfilNuevo)
 */
import { useState } from 'react';
import { Copy, ExternalLink, KeyRound, ShieldAlert } from 'lucide-react';
import Modal from '../../../components/Modal';
import Aviso from '../../../components/ui/Aviso';
import Boton from '../../../components/ui/Boton';
import { Casilla } from '../../../components/ui/Campo';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import { correoDeNomina, mensajeErrorRestablecer, urlConsolaAuth } from '../../../utils/restablecerAcceso';
import { restablecerAcceso } from '../../../utils/restablecerAccesoDb';

export default function ModalRestablecerAcceso({ abierto, ...resto }) {
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ usuario, actor, onClose, onRestablecido }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [paso, setPaso] = useState('borrar'); // borrar | creando | listo
  const [borrada, setBorrada] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [copiada, setCopiada] = useState(false);

  const nomina = String(usuario.nomina);
  const correo = correoDeNomina(nomina);

  const copiar = async (texto, que) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${que} copiada`);
      return true;
    } catch {
      toast.error(`No se pudo copiar. Selecciona ${que.toLowerCase()} y cópiala a mano.`);
      return false;
    }
  };

  const crear = async () => {
    setError('');
    setPaso('creando');
    try {
      const r = await restablecerAcceso({ uidViejo: usuario.uid, actor });
      onRestablecido(usuario.uid, r.perfil);
      setPassword(r.password);
      setPaso('listo');
    } catch (err) {
      setError(mensajeErrorRestablecer(err, nomina));
      setPaso('borrar');
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
    <Modal isOpen onClose={cerrar} title={`Restablecer acceso · ${usuario.nombre}`} maxWidth="max-w-lg" preventCloseOnBackdrop={paso !== 'borrar'}>
      {paso === 'borrar' && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            La app no puede cambiar la contraseña de otra persona. El restablecimiento crea una cuenta nueva: <b>{usuario.nombre}</b> conserva su rol, sus
            preferencias y sus asignaciones, y recibe una contraseña temporal que debe cambiar al entrar.
          </p>
          {error && <Aviso tono="error">{error}</Aviso>}

          <ol className="space-y-3 text-sm text-[var(--text-main)]">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-xs font-semibold" aria-hidden="true">1</span>
              <div className="space-y-2">
                <p><b>Borra su cuenta en Firebase Console</b> › Authentication › Users.</p>
                <a href={urlConsolaAuth(import.meta.env.VITE_FIREBASE_PROJECT_ID)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-[var(--accent-text)] hover:underline md:min-h-9">
                  Abrir Authentication en Firebase Console<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-xs font-semibold" aria-hidden="true">2</span>
              <div className="space-y-2">
                <p>Búscala con la nómina (su correo interno es <span className="font-mono">{correo}</span>).</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 font-mono text-base font-semibold select-all">{nomina}</span>
                  <Boton tamano="sm" icono={Copy} onClick={() => copiar(nomina, 'La nómina')}>Copiar nómina</Boton>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-xs font-semibold" aria-hidden="true">3</span>
              <p>En el menú (⋮) de esa fila elige <b>Delete account</b> (Eliminar cuenta) y confirma. Regresa aquí.</p>
            </li>
          </ol>

          <Aviso tono="aviso">
            Los borradores y solicitudes de tiempo extra que esta persona creó con su cuenta anterior ya no le aparecerán en «Mis solicitudes»
            (quedan ligados a la cuenta vieja). Las firmas y el historial de lo ya enviado no cambian.
          </Aviso>

          <Casilla etiqueta={<>Ya eliminé la cuenta <span className="font-mono">{correo}</span> en Firebase Console</>}
            checked={borrada} onChange={(e) => setBorrada(e.target.checked)} />

          <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
            <Boton onClick={cerrar}>Cancelar</Boton>
            <Boton id="btn-crear-acceso-nuevo" variante="primario" icono={KeyRound} disabled={!borrada} onClick={crear}>Crear acceso nuevo</Boton>
          </div>
        </div>
      )}

      {paso === 'creando' && (
        <div className="py-6" role="status">
          <p className="text-sm font-semibold text-[var(--text-main)]">Creando el acceso nuevo…</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">No cierres esta ventana.</p>
        </div>
      )}

      {paso === 'listo' && (
        <div className="space-y-4">
          <div role="alert" className="rounded-lg border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
            <p className="flex items-center gap-2 text-base font-semibold"><ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />Contraseña temporal de {usuario.nombre}</p>
            <p className="mt-3 select-all rounded-md bg-[var(--bg-surface)] px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider text-[var(--text-main)]">{password}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Boton id="btn-copiar-password" variante="primario" icono={Copy} onClick={async () => { if (await copiar(password, 'La contraseña')) setCopiada(true); }}>Copiar contraseña</Boton>
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
