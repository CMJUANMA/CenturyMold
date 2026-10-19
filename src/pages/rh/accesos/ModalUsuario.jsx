/**
 * ModalUsuario.jsx — Alta y edición de un usuario del sistema (cuenta + perfil usuarios/{uid}).
 * El rol del sistema es solo admin, rh o usuario; los permisos operativos se dan en Asignaciones.
 * Solo un admin puede dar o quitar rh y admin (las reglas lo exigen).
 *
 * Props:
 *   abierto, onClose
 *   usuario       usuario a editar (null = alta)
 *   precarga      { nomina, nombre } para un alta con la persona ya elegida
 *   usuarios      todos los usuarios (para no repetir nómina)
 *   empleados     padrón (para elegir a la persona en un alta)
 *   esAdmin       el usuario actual es admin
 *   asignaciones, nombresArea, ahora   para mostrar los roles operativos vigentes de quien se edita y avisar si tiene Aut. 2 sin ser de RH
 *   onGuardado    (usuario, { nuevo }) => void
 */
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { db } from '../../../firebase';
import { crearCuentaUsuario, mensajeErrorAlta } from '../../../utils/usuariosDb';
import { ACCIONES_USUARIO, registrarUsuario } from '../../../utils/bitacoraDb';
import Modal from '../../../components/Modal';
import BuscadorEmpleado from '../../../components/BuscadorEmpleado';
import { ROLES, ROL_LABELS } from '../../../utils/constantes';
import { esVigente, etiquetaAsignacion } from '../../../utils/asignaciones';
import { sugiereRolRH } from '../../../utils/permisos';
import { inputCls, btnPrimary, btnSecondary, btnIcon, labelCls } from './ui';

const formDe = (usuario, precarga) => ({
  nomina: usuario?.nomina ?? precarga?.nomina ?? '',
  nombre: usuario?.nombre ?? precarga?.nombre ?? '',
  password: '',
  // Un rol viejo (superintendente/autorizador) se corrige a "usuario" al guardar
  rol: [ROLES.ADMIN, ROLES.RH].includes(usuario?.rol) ? usuario.rol : ROLES.USUARIO,
});

export default function ModalUsuario({ abierto, ...resto }) {
  // El formulario se reinicia al abrir: el contenido se monta solo mientras está abierto
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ onClose, usuario = null, precarga = null, usuarios, empleados, esAdmin, onGuardado, asignaciones = [], nombresArea = new Map(), ahora }) {
  const edicion = !!usuario;
  const [form, setForm] = useState(() => formDe(usuario, precarga));
  const [manual, setManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const opcionesRol = esAdmin ? [ROLES.USUARIO, ROLES.RH, ROLES.ADMIN] : [ROLES.USUARIO];
  const vigentes = edicion ? asignaciones.filter(a => String(a.nomina) === String(usuario.nomina) && esVigente(a, ahora)) : [];
  const avisarRH = edicion && sugiereRolRH({ rol: form.rol, nomina: usuario.nomina }, vigentes);

  const guardar = async (e) => {
    e.preventDefault();
    setError(''); setExito('');
    if (!edicion) {
      if (!form.nomina.trim() || !form.nombre.trim() || !form.password) {
        setError(form.nomina.trim() ? 'Todos los campos son obligatorios.' : 'Elige a la persona del padrón (o captura la nómina a mano).'); return;
      }
      if (form.password.length < 8) { setError('La contraseña temporal debe tener al menos 8 caracteres.'); return; }
    } else if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }

    setGuardando(true);
    try {
      if (edicion) {
        await updateDoc(doc(db, 'usuarios', usuario.uid), { nombre: form.nombre.trim(), rol: form.rol });
        registrarUsuario(ACCIONES_USUARIO.editar, { ...usuario, nombre: form.nombre.trim(), rol: form.rol }, { nombre: usuario.nombre, rol: usuario.rol });
        onGuardado({ ...usuario, nombre: form.nombre.trim(), rol: form.rol }, { nuevo: false });
        setExito('Usuario actualizado correctamente.');
      } else {
        const { uid, perfil } = await crearCuentaUsuario({ nomina: form.nomina, nombre: form.nombre, rol: form.rol, password: form.password });
        registrarUsuario(ACCIONES_USUARIO.crear, { uid, ...perfil });
        onGuardado({ uid, ...perfil }, { nuevo: true });
        setExito('Usuario creado correctamente.');
      }
      setTimeout(onClose, 900);
    } catch (err) {
      setError(mensajeErrorAlta(err, form.nomina, usuarios));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={edicion ? 'Editar usuario' : 'Nuevo usuario'} maxWidth="max-w-md">
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
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
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
          <div>
            <label className={labelCls}>Contraseña temporal</label>
            <input required type="password" minLength={8} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Mínimo 8 caracteres" />
          </div>
        )}
        {edicion && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-2 text-xs text-[var(--status-info-text)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <b>Rol del sistema</b> = acceso a pantallas de administración/RH. <b>Roles operativos</b> (Aut. 2, Aut. 1, Solicitante) = capturar y autorizar;
              se dan en Asignaciones.
            </p>
          </div>
        )}
        <div>
          <label className={labelCls}>Rol del sistema</label>
          <select required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className={inputCls} disabled={opcionesRol.length === 1}>
            {opcionesRol.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {esAdmin
              ? 'Solo tú puedes dar o quitar Recursos Humanos y Administrador.'
              : 'Solo un administrador puede dar o quitar Recursos Humanos y Administrador.'}
            {' '}Aut. 1, Aut. 2 y solicitante se asignan en la pestaña Asignaciones.
          </p>
        </div>
        {edicion && (
          <div>
            <span className={labelCls}>Roles operativos vigentes</span>
            <p className="text-xs text-[var(--text-secondary)]">
              {vigentes.length ? vigentes.map(a => etiquetaAsignacion(a, nombresArea)).join(' · ') : 'Ninguno por ahora.'}
            </p>
          </div>
        )}
        {avisarRH && (
          <div role="status" className="flex items-start gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              ¿Esta persona también es de RH? Si sí, cámbiale el rol a RH.
              {!esAdmin && ' Solo un administrador puede hacerlo: avísale.'}
            </span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {edicion ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
