/**
 * ModalUsuario.jsx — Alta y edición de un usuario del sistema (cuenta + perfil usuarios/{uid}).
 * El rol del sistema es solo admin, rh, nomina o usuario; los permisos operativos se dan en Asignaciones.
 * RH, Aut. 2 vigente y admin dan y quitan los roles rh y Nóminas (con confirmación y bitácora; nadie cambia el suyo ni se da Nóminas a sí mismo);
 * el rol admin solo lo da y quita un admin (las reglas lo exigen). A un RH o a Nóminas que no es admin solo se le cambia el rol.
 *
 * Props:
 *   abierto, onClose
 *   usuario       usuario a editar (null = alta)
 *   precarga      { nomina, nombre } para un alta con la persona ya elegida
 *   usuarios      todos los usuarios (para no repetir nómina)
 *   empleados     padrón (para elegir a la persona en un alta)
 *   esAdmin       el usuario actual es admin
 *   asignaciones, nombresArea, ahora   las asignaciones en vivo: al editar, la sección «Rol y asignaciones» las lista y deja agregar o quitar
 *   actor, areas  quien edita ({ uid, nombre, nomina, esAdmin, esRH, esAut2 }) y las áreas, para validar y guardar las asignaciones como en la pantalla Asignaciones
 *   onGuardado    (usuario, { nuevo }) => void
 *
 * Alta: la contraseña temporal CM-XXXX-XXXX se genera sola (igual que en «Restablecer contraseña»); al crear el usuario se muestra UNA sola vez, con
 * botón de copiar y el aviso de entregarla en persona. Nunca se guarda ni se registra: al cerrar la ventana se pierde.
 */
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, AlertTriangle, Copy, Info, Loader2, ShieldAlert, X } from 'lucide-react';
import { db } from '../../../firebase';
import { crearCuentaUsuario, mensajeErrorAlta } from '../../../utils/usuariosDb';
import { generarPassword } from '../../../utils/passwordTemporal';
import { ACCIONES_USUARIO, registrarUsuario } from '../../../utils/bitacoraDb';
import Modal from '../../../components/Modal';
import BuscadorEmpleado from '../../../components/BuscadorEmpleado';
import { ROLES, ROL_LABELS } from '../../../utils/constantes';
import { esVigente } from '../../../utils/asignaciones';
import { sugiereRolRH } from '../../../utils/permisos';
import { useAuth } from '../../../hooks/useAuth';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import Boton from '../../../components/ui/Boton';
import SeccionAsignaciones from './SeccionAsignaciones';
import { inputCls, btnPrimary, btnSecondary, btnIcon, labelCls } from './ui';

const formDe = (usuario, precarga) => ({
  nomina: usuario?.nomina ?? precarga?.nomina ?? '',
  nombre: usuario?.nombre ?? precarga?.nombre ?? '',
  // Un rol viejo (superintendente/autorizador) se corrige a "usuario" al guardar
  rol: [ROLES.ADMIN, ROLES.RH, ROLES.NOMINA].includes(usuario?.rol) ? usuario.rol : ROLES.USUARIO,
});

export default function ModalUsuario({ abierto, ...resto }) {
  // El formulario se reinicia al abrir: el contenido se monta solo mientras está abierto
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ onClose, usuario = null, precarga = null, usuarios, empleados, esAdmin, onGuardado, asignaciones = [], nombresArea = new Map(), ahora, actor = null, areas = [] }) {
  const edicion = !!usuario;
  const { usuario: yo } = useAuth();
  const confirmar = useConfirmar();
  const [form, setForm] = useState(() => formDe(usuario, precarga));
  const [manual, setManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [creada, setCreada] = useState(null); // { nomina, nombre, password } tras crear el usuario: se muestra una sola vez
  const [copiada, setCopiada] = useState(false);
  const toast = useToast();

  // Admin: todos. RH y Aut. 2: usuario, RH o Nóminas al editar; solo usuario al crear (las reglas lo exigen). Nadie se da Nóminas a sí mismo.
  const esYo = edicion && usuario.uid === yo?.uid;
  const opcionesRol = (esAdmin ? [ROLES.USUARIO, ROLES.RH, ROLES.NOMINA, ROLES.ADMIN] : edicion ? [ROLES.USUARIO, ROLES.RH, ROLES.NOMINA] : [ROLES.USUARIO])
    .filter(r => !(esYo && r === ROLES.NOMINA && usuario.rol !== ROLES.NOMINA));
  // A un RH o a Nóminas, quien no es admin solo le cambia el rol: el nombre queda fijo
  const soloRol = edicion && !esAdmin && [ROLES.RH, ROLES.NOMINA].includes(usuario.rol);
  const vigentes = edicion ? asignaciones.filter(a => String(a.nomina) === String(usuario.nomina) && esVigente(a, ahora)) : [];
  const avisarRH = edicion && sugiereRolRH({ rol: form.rol, nomina: usuario.nomina }, vigentes);
  // Persona del padrón (puesto y puestoId se copian a la asignación, como al asignar desde la pantalla Asignaciones)
  const persona = edicion ? (() => {
    const e = empleados.find(x => String(x.nomina) === String(usuario.nomina));
    return { nomina: String(usuario.nomina), nombre: e?.nombre ?? usuario.nombre, puesto: e?.puesto ?? '', puestoId: e?.puestoId ?? '' };
  })() : null;

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setExito('');
    if (!edicion) {
      if (!form.nomina.trim() || !form.nombre.trim()) {
        setError(form.nomina.trim() ? 'Todos los campos son obligatorios.' : 'Elige a la persona del padrón (o captura la nómina a mano).'); return;
      }
    } else if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }

    setGuardando(true);
    try {
      if (edicion) {
        const daRH = form.rol === ROLES.RH && usuario.rol !== ROLES.RH;
        const quitaRH = usuario.rol === ROLES.RH && form.rol !== ROLES.RH;
        const daNomina = form.rol === ROLES.NOMINA && usuario.rol !== ROLES.NOMINA;
        const quitaNomina = usuario.rol === ROLES.NOMINA && form.rol !== ROLES.NOMINA;
        if (daRH || quitaRH || daNomina || quitaNomina) {
          const acepta = await confirmar(daNomina ? {
            titulo: 'Dar acceso de Nóminas',
            mensaje: `¿Dar acceso de Nóminas a ${usuario.nombre}? Podrá ver todo el tiempo extra de la planta, las solicitudes de transporte, el Formato de rutas y el personal (con teléfono), confirmar lo que va al proveedor y descargar los Excel. No podrá autorizar, devolver, editar ni cancelar nada, ni administrar usuarios.`,
            textoConfirmar: 'Dar acceso',
          } : quitaNomina ? {
            titulo: 'Quitar acceso de Nóminas',
            mensaje: `¿Quitar el acceso de Nóminas a ${usuario.nombre}? Dejará de ver el tiempo extra de toda la planta y de confirmar lo que va al proveedor.`,
            textoConfirmar: 'Quitar acceso', peligroso: true,
          } : {
            titulo: daRH ? 'Dar acceso de Recursos Humanos' : 'Quitar acceso de Recursos Humanos',
            mensaje: daRH ? `¿Dar acceso de Recursos Humanos a ${usuario.nombre}? Podrá ver y administrar lo de RH.` : `¿Quitar el acceso de Recursos Humanos a ${usuario.nombre}?`,
            textoConfirmar: daRH ? 'Dar acceso' : 'Quitar acceso', peligroso: quitaRH,
          });
          if (!acepta) { setGuardando(false); return; }
        }
        await updateDoc(doc(db, 'usuarios', usuario.uid), soloRol ? { rol: form.rol } : { nombre: form.nombre.trim(), rol: form.rol });
        const despues = { ...usuario, nombre: soloRol ? usuario.nombre : form.nombre.trim(), rol: form.rol };
        const antes = { nombre: usuario.nombre, rol: usuario.rol };
        const cambiosDeRol = [daRH && ACCIONES_USUARIO.darRH, quitaRH && ACCIONES_USUARIO.quitarRH, daNomina && ACCIONES_USUARIO.darNomina, quitaNomina && ACCIONES_USUARIO.quitarNomina].filter(Boolean);
        for (const accion of cambiosDeRol.length ? cambiosDeRol : [ACCIONES_USUARIO.editar]) registrarUsuario(accion, despues, antes);
        onGuardado({ ...usuario, nombre: soloRol ? usuario.nombre : form.nombre.trim(), rol: form.rol }, { nuevo: false });
        setExito('Usuario actualizado correctamente.');
      } else {
        const password = generarPassword();
        const { uid, perfil } = await crearCuentaUsuario({ nomina: form.nomina, nombre: form.nombre, rol: form.rol, password });
        registrarUsuario(ACCIONES_USUARIO.crear, { uid, ...perfil });
        onGuardado({ uid, ...perfil }, { nuevo: true });
        toast.success(`Usuario ${perfil.nombre} creado (nómina ${perfil.nomina}).`);
        setCreada({ nomina: String(perfil.nomina), nombre: perfil.nombre, password });
        return;
      }
      toast.success('Usuario actualizado correctamente.');
      setExito('Usuario actualizado correctamente.');
      setTimeout(onClose, 900);
    } catch (err) {
      setError(mensajeErrorAlta(err, form.nomina, usuarios));
    } finally {
      setGuardando(false);
    }
  };

  const cerrarCreada = async () => {
    if (!copiada) {
      const ok = await confirmar({
        titulo: 'Cerrar sin copiar la contraseña',
        mensaje: 'La contraseña temporal no se volverá a mostrar. ¿Ya la copiaste o la anotaste?',
        textoConfirmar: 'Ya la copié o la anoté, cerrar', peligroso: true,
      });
      if (!ok) return;
    }
    onClose();
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(creada.password); setCopiada(true); toast.success('Contraseña copiada'); }
    catch { toast.error('No se pudo copiar. Selecciónala y cópiala a mano.'); }
  };

  if (creada) {
    return (
      <Modal isOpen onClose={cerrarCreada} title={`Usuario creado · ${creada.nombre}`} maxWidth="max-w-lg" preventCloseOnBackdrop>
        <div className="space-y-4">
          <div role="alert" className="rounded-lg border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
            <p className="flex items-center gap-2 text-base font-semibold"><ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />Contraseña temporal de {creada.nombre}</p>
            <p className="mt-3 select-all break-all rounded-md bg-[var(--bg-surface)] px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider text-[var(--text-main)]">{creada.password}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Boton id="btn-copiar-password" variante="primario" icono={Copy} onClick={copiar}>Copiar contraseña</Boton>
            </div>
            <p className="mt-3 text-sm font-semibold">No se volverá a mostrar. Entrégala en persona; no la mandes por teléfono, correo ni mensaje.</p>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Usuario: <span className="font-mono font-semibold">{creada.nomina}</span>. Al entrar por primera vez, el sistema le pedirá crear una contraseña propia.
            Si va a autorizar o solicitar tiempo extra, dale su asignación con el lápiz de editar (Aut. 1, Aut. 2 o solicitante).
          </p>
          <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
            <Boton id="btn-cerrar-usuario-creado" variante="primario" onClick={onClose}>Ya la copié o la anoté, cerrar</Boton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title={edicion ? 'Editar usuario' : 'Nuevo usuario'} maxWidth={edicion && actor ? 'max-w-lg' : 'max-w-md'}>
      <form onSubmit={guardar} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {exito && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{exito}</span>
          </div>
        )}
        {edicion ? (
          <div>
            <label className={labelCls}>Nombre completo</label>
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} readOnly={soloRol} />
          </div>
        ) : manual ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nómina</label>
              <input required value={form.nomina} onChange={e => setForm(f => ({ ...f, nomina: e.target.value }))} className={inputCls} placeholder="ej. 51109" />
            </div>
            <button type="button" onClick={() => setManual(false)} className="col-span-2 text-left text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">
              Elegir del padrón
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className={labelCls}>Persona del padrón (por nómina o nombre)</label>
            {form.nomina ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-mono font-semibold text-[var(--text-main)]">{form.nomina}</span>{' '}
                  <span className="text-[var(--text-main)]">{form.nombre}</span>
                </span>
                <button type="button" onClick={() => setForm(f => ({ ...f, nomina: '', nombre: '' }))} className={btnIcon} title="Cambiar"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <BuscadorEmpleado empleados={empleados} excluir={usuarios.map(u => String(u.nomina))}
                onSelect={emp => setForm(f => ({ ...f, nomina: String(emp.nomina), nombre: emp.nombre ?? '' }))} />
            )}
            {form.nomina && (
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              Solo aparecen empleados activos que aún no tienen usuario.{' '}
              <button type="button" onClick={() => setManual(true)} className="font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">Capturar a mano</button>
            </p>
          </div>
        )}
        {!edicion && (
          <p className="rounded-md bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            La contraseña temporal se genera sola al crear el usuario y se muestra una sola vez para que se la entregues en persona.
          </p>
        )}
        <h3 className="border-t border-[var(--border-color)] pt-4 text-sm font-semibold text-[var(--text-main)]">Rol y asignaciones</h3>
        <div className="flex items-start gap-2 rounded-md border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-xs text-[var(--status-info-text)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <b>Rol del sistema</b> = acceso a pantallas de administración/RH. <b>Asignaciones</b> (Aut. 2, Aut. 1, Solicitante) = capturar y autorizar.
            {edicion ? '' : ' Primero se crea el usuario; después, con el lápiz de editar, se le dan sus asignaciones.'}
          </p>
        </div>
        <div>
          <label className={labelCls}>Rol del sistema</label>
          <select required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className={inputCls} disabled={opcionesRol.length === 1}>
            {opcionesRol.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
          </select>
          {opcionesRol.length === 1 && (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {edicion ? 'No hay otro rol que puedas darle desde aquí.' : 'Un usuario nuevo se crea con el rol «Usuario». Recursos Humanos o Nóminas se dan después, al editarlo.'}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {esAdmin
              ? 'Tú das y quitas Recursos Humanos, Nóminas y Administrador.'
              : 'Puedes dar o quitar Recursos Humanos y Nóminas (no el tuyo). Administrador solo lo da y quita un administrador.'}
            {' '}Aut. 1, Aut. 2 y solicitante se dan abajo, en Asignaciones.
          </p>
        </div>
        {edicion && actor && (
          <p className="-mb-2 text-xs text-[var(--text-muted)]">Las asignaciones se guardan al instante, cada una por separado; «Guardar nombre y rol» solo guarda el nombre y el rol del sistema.</p>
        )}
        {edicion && actor && (
          <SeccionAsignaciones persona={persona} asignaciones={asignaciones} areas={areas} actor={actor} nombresArea={nombresArea} ahora={ahora} />
        )}
        {avisarRH && (
          <div role="status" className="flex items-start gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              ¿Esta persona también es de RH? Si sí, cámbiale el rol a RH.
            </span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {edicion ? 'Guardar nombre y rol' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
