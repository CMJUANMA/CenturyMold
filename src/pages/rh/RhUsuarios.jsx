/**
 * RhUsuarios.jsx — Gestion de usuarios del sistema
 * Acceso: rh y admin (esPersonalRH)
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { db } from '../../firebase';
import { authSecundaria } from '../../firebaseSecundario';
import {
  ShieldCheck, UserPlus, Search, Loader2, Pencil,
  ToggleLeft, ToggleRight, CheckCircle2, Info, AlertTriangle, X,
} from 'lucide-react';
import Modal from '../../components/Modal';
import BuscadorEmpleado from '../../components/BuscadorEmpleado';
import { ROLES } from '../../utils/constantes';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';

const OPCIONES_ROL = [
  { value: ROLES.SUPERINTENDENTE, label: 'Solicitante' },
  { value: ROLES.AUTORIZADOR, label: 'Autorizador (solo tiempo extra)' },
  { value: ROLES.RH, label: 'Recursos Humanos' },
  { value: ROLES.ADMIN, label: 'Administrador' },
];
const rolLabel = r => OPCIONES_ROL.find(x => x.value === r)?.label ?? r;
const formVacio = { nomina: '', nombre: '', password: '', rol: ROLES.SUPERINTENDENTE, areaIds: [] };

const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)]';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer';
const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';

export default function RhUsuarios() {
  const confirmar = useConfirmar();
  const toast = useToast();
  // Desde Niveles de autorización llega { nuevo: { nomina, nombre } } para abrir el alta ya llenada
  const precarga = useLocation().state?.nuevo ?? null;
  const [usuarios, setUsuarios] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [manual, setManual] = useState(false); // alta de alguien fuera del padrón
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [modalAbierto, setModalAbierto] = useState(!!precarga);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [uidEdicion, setUidEdicion] = useState(null);
  const [form, setForm] = useState(precarga ? { ...formVacio, nomina: precarga.nomina, nombre: precarga.nombre } : formVacio);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');
  const [formExito, setFormExito] = useState('');

  useEffect(() => {
    async function cargar() {
      setErrorCarga('');
      try {
        const [snapU, snapA, snapE] = await Promise.all([
          getDocs(collection(db, 'usuarios')),
          getDocs(collection(db, 'areas')),
          getDocs(collection(db, 'empleados')),
        ]);
        setEmpleados(snapE.docs.map(d => ({ nomina: d.id, ...d.data() })));
        setUsuarios(snapU.docs.map(d => ({ uid: d.id, ...d.data() })));
        setAreas(snapA.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setErrorCarga('Error al cargar usuarios: ' + err.message);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const abrirCrear = () => {
    setModoEdicion(false); setUidEdicion(null); setForm(formVacio); setManual(false);
    setFormError(''); setFormExito(''); setModalAbierto(true);
  };
  const abrirEditar = (u) => {
    setModoEdicion(true); setUidEdicion(u.uid); setManual(false);
    setForm({ nomina: u.nomina, nombre: u.nombre, password: '', rol: u.rol, areaIds: u.areaIds ?? [] });
    setFormError(''); setFormExito(''); setModalAbierto(true);
  };
  const cerrarModal = () => setModalAbierto(false);
  const toggleArea = (id) => setForm(f => ({
    ...f, areaIds: f.areaIds.includes(id) ? f.areaIds.filter(x => x !== id) : [...f.areaIds, id]
  }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setFormError(''); setFormExito('');
    if (!modoEdicion) {
      if (!form.nomina.trim() || !form.nombre.trim() || !form.password || !form.rol) {
        setFormError(form.nomina.trim() ? 'Todos los campos son obligatorios.' : 'Elige a la persona del padron (o captura la nomina a mano).'); return;
      }
      if (form.password.length < 6) { setFormError('La contrasena temporal debe tener al menos 6 caracteres.'); return; }
    } else {
      if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return; }
    }
    setGuardando(true);
    try {
      if (modoEdicion) {
        await updateDoc(doc(db, 'usuarios', uidEdicion), { nombre: form.nombre.trim(), rol: form.rol, areaIds: form.areaIds });
        setUsuarios(prev => prev.map(u => u.uid === uidEdicion ? { ...u, nombre: form.nombre.trim(), rol: form.rol, areaIds: form.areaIds } : u));
        setFormExito('Usuario actualizado correctamente.');
        setTimeout(() => { cerrarModal(); setFormExito(''); }, 1000);
      } else {
        const email = `${form.nomina.trim()}@rutas.app`;
        const cred = await createUserWithEmailAndPassword(authSecundaria, email, form.password);
        const { uid } = cred.user;
        const perfilData = { nomina: form.nomina.trim(), nombre: form.nombre.trim(), rol: form.rol, areaIds: form.areaIds, activo: true, debeCambiarPassword: true };
        try {
          // setDoc con el db principal (sesión de RH); la app secundaria solo crea la cuenta de Auth
          await setDoc(doc(db, 'usuarios', uid), perfilData);
        } catch (errPerfil) {
          // El perfil no se pudo guardar: borrar la cuenta recién creada (la sesión sigue en la app secundaria)
          try {
            await deleteUser(cred.user);
          } catch (errBorrar) {
            console.error('No se pudo borrar la cuenta huérfana:', errBorrar);
            errPerfil.cuentaHuerfana = true;
          }
          throw errPerfil;
        } finally {
          await signOut(authSecundaria).catch(() => {});
        }
        setUsuarios(prev => [...prev, { uid, ...perfilData }]);
        setFormExito('Usuario creado correctamente.');
        setTimeout(() => { cerrarModal(); setFormExito(''); }, 1000);
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const tienePerfil = usuarios.some(u => String(u.nomina) === form.nomina.trim());
        setFormError(tienePerfil
          ? 'Ya existe un usuario con esa nómina.'
          : 'Esa nómina tiene una cuenta de acceso sin perfil (cuenta huérfana, normalmente de un alta que falló). ' +
            'Bórrala en Firebase Console > Authentication (busca ' + form.nomina.trim() + '@rutas.app) y vuelve a crear el usuario.');
      } else if (err.code === 'auth/weak-password') {
        setFormError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.cuentaHuerfana) {
        setFormError(`No se pudo guardar el perfil (${err.message}) y tampoco se pudo borrar la cuenta creada. ` +
          'Bórrala en Firebase Console > Authentication (' + form.nomina.trim() + '@rutas.app) antes de reintentar.');
      } else {
        setFormError(`Error: ${err.message}`);
      }
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (u) => {
    const desactivar = u.activo !== false;
    if (!await confirmar({ titulo: desactivar ? 'Desactivar usuario' : 'Activar usuario', mensaje: `¿Deseas ${desactivar ? 'desactivar' : 'activar'} a ${u.nombre}?`, textoConfirmar: desactivar ? 'Desactivar' : 'Activar', peligroso: desactivar })) return;
    try {
      await updateDoc(doc(db, 'usuarios', u.uid), { activo: u.activo === false });
      setUsuarios(prev => prev.map(x => x.uid === u.uid ? { ...x, activo: x.activo === false } : x));
    } catch (err) {
      toast.error('No se pudo actualizar el usuario: ' + err.message);
    }
  };

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase();
    const ok1 = !q || String(u.nomina).toLowerCase().includes(q) || String(u.nombre).toLowerCase().includes(q);
    const ok2 = !filtroRol || u.rol === filtroRol;
    const ok3 = !filtroEstado || (filtroEstado === 'activo' && u.activo !== false) || (filtroEstado === 'inactivo' && u.activo === false);
    return ok1 && ok2 && ok3;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Administracion · Seguridad y Accesos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Usuarios del sistema</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Control de cuentas autorizadas, perfiles y permisos por area</p>
        </div>
        <button type="button" onClick={abrirCrear} className={btnPrimary}>
          <UserPlus className="h-4 w-4" />Nuevo usuario
        </button>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
        <span>El cambio de contrasena de otra persona no esta disponible desde la app; cada usuario puede cambiar la suya en su Perfil.</span>
      </div>

      {errorCarga && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{errorCarga}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nomina o nombre..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--cm-red)]" />
        </div>
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]">
          <option value="">Todos los roles</option>
          {OPCIONES_ROL.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]">
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <div className="text-xs text-[var(--text-muted)]">{filtrados.length} de {usuarios.length}</div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nomina</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Areas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {cargando ? (
                <tr><td colSpan={6} className="py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /><span>Cargando...</span>
                  </div>
                </td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                    <ShieldCheck className="h-8 w-8" />
                    <p className="text-xs font-medium text-[var(--text-secondary)]">No se encontraron usuarios</p>
                  </div>
                </td></tr>
              ) : filtrados.map(u => (
                <tr key={u.uid} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-bold text-[var(--text-main)]">{u.nomina}</td>
                  <td className="px-4 py-2.5 text-[var(--text-main)]">{u.nombre}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                      {rolLabel(u.rol)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    {(u.areaIds ?? []).length === 0 ? <span className="italic text-[var(--text-muted)]">Todas</span> : (u.areaIds ?? []).length}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${u.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                      {u.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => abrirEditar(u)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => toggleActivo(u)} className={btnIcon} title={u.activo !== false ? 'Desactivar' : 'Activar'}>
                        {u.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalAbierto} onClose={cerrarModal} title={modoEdicion ? 'Editar usuario' : 'Nuevo usuario'} maxWidth="max-w-md">
        <form onSubmit={handleGuardar} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{formError}</span>
            </div>
          )}
          {formExito && (
            <div className="flex items-start gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{formExito}</span>
            </div>
          )}
          {modoEdicion ? (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre completo</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Nombre del usuario" />
            </div>
          ) : manual ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre completo</label>
                <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Nombre del usuario" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nomina</label>
                <input required value={form.nomina} onChange={e => setForm(f => ({ ...f, nomina: e.target.value }))} className={inputCls} placeholder="ej. 51109" />
              </div>
              <button type="button" onClick={() => setManual(false)} className="col-span-2 text-left text-[11px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">
                Elegir del padron
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">Persona del padron (por nomina o nombre)</label>
              {form.nomina ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="font-mono font-bold text-[var(--text-main)]">{form.nomina}</span>{' '}
                    <span className="text-[var(--text-main)]">{form.nombre}</span>
                  </span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, nomina: '', nombre: '' }))} className={btnIcon} title="Cambiar"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <BuscadorEmpleado empleados={empleados} excluir={usuarios.map(u => String(u.nomina))}
                  onSelect={e => setForm(f => ({ ...f, nomina: String(e.nomina), nombre: e.nombre ?? '' }))} />
              )}
              {form.nomina && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre completo</label>
                  <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
                </div>
              )}
              <p className="text-[10px] text-[var(--text-muted)]">
                Solo aparecen empleados activos que aun no tienen usuario.{' '}
                <button type="button" onClick={() => setManual(true)} className="font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">Capturar a mano</button>
              </p>
            </div>
          )}
          {!modoEdicion && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Contrasena temporal</label>
              <input required type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputCls} placeholder="Minimo 6 caracteres" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Rol</label>
            <select required value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} className={inputCls}>
              {OPCIONES_ROL.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {areas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Areas asignadas <span className="text-[var(--text-muted)]">(vacio = todas)</span></label>
              <div className="max-h-36 overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-2 space-y-1">
                {areas.map(a => (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-[var(--bg-surface)] transition-colors text-xs">
                    <input type="checkbox" checked={form.areaIds.includes(a.id)} onChange={() => toggleArea(a.id)} className="h-3.5 w-3.5 rounded text-[var(--cm-red)] focus:ring-[var(--cm-red)]" />
                    {a.nombre}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)] mt-2">
            <button type="button" onClick={cerrarModal} className={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={guardando} className={btnPrimary}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {modoEdicion ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
