/**
 * RhCatalogos.jsx — "Rutas y puntos de reunión" (/transporte/catalogos): rutas, comunidades y puntos con CRUD y carga masiva
 * Acceso: roles rh y admin (esPersonalRH)
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import {
  MapPin, Navigation, Upload, Loader2,
  CheckCircle2, AlertTriangle,
  Plus, Pencil, ToggleLeft, ToggleRight, Search,
} from 'lucide-react';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { slugify } from '../../utils/comparacionImportacion';
import { esActivo } from '../../utils/activo';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';

// Importación masiva (arrastra exceljs): se descarga solo al abrir el modal
const ModalImportacion = lazy(() => import('./ModalImportacion'));
import Modal from '../../components/Modal';
import { ROLES } from '../../utils/constantes';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { id: 'rutas',        label: 'Rutas',            icon: Navigation },
  { id: 'comunidades',  label: 'Comunidades',      icon: MapPin },
  { id: 'puntos',       label: 'Puntos de reunion', icon: MapPin },
];

// ── Componentes compartidos ───────────────────────────────────────────────
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)]';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all disabled:opacity-50 cursor-pointer';
const btnSecondary = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer';
const btnIcon = 'rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';

function ModalBase({ titulo, onClose, children }) {
  return (
    <Modal isOpen={true} onClose={onClose} title={titulo} maxWidth="max-w-lg">
      {children}
    </Modal>
  );
}

function AlertError({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}

function AlertSuccess({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-xs text-[var(--status-success-text)]">
      <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{msg}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-color)]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-xs text-[var(--text-secondary)] text-center">{msg}</p>
    </div>
  );
}

// ── Tab Rutas ─────────────────────────────────────────────────────────────
function TabRutas({ rutas, comunidades, puntos, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null); // null | { modo: 'crear'|'editar', ruta? }
  const [form, setForm] = useState({ nombre: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const filtradas = rutas.filter(r => !busqueda || r.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  const abrirCrear = () => { setForm({ nombre: '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (r) => { setForm({ nombre: r.nombre }); setError(''); setExito(''); setModal({ modo: 'editar', ruta: r }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = slugify(nombre);
        const existe = rutas.find(r => r.id === id);
        if (existe) { setError('Ya existe una ruta con ese nombre.'); return; }
        await setDoc(doc(db, 'rutas', id), { nombre, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'rutas', modal.ruta.id), { nombre });
      }
      setExito(modal.modo === 'crear' ? 'Ruta creada correctamente.' : 'Ruta actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (r) => {
    const comsDep = comunidades.filter(c => c.rutaId === r.id).length;
    const ptosDep = puntos.filter(p => p.rutaId === r.id).length;
    const accion = r.activo !== false ? 'desactivar' : 'activar';
    let msg = `¿Deseas ${accion} la ruta "${r.nombre}"?`;
    if (r.activo !== false && (comsDep || ptosDep)) msg += ` Dependen de ella ${comsDep} comunidad(es) y ${ptosDep} punto(s).`;
    if (!await confirmar({ titulo: `${r.activo !== false ? 'Desactivar' : 'Activar'} ruta`, mensaje: msg, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: r.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'rutas', r.id), { activo: r.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar la ruta: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtradas.length} ruta(s)</span>
          <button type="button" onClick={abrirCrear} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nueva ruta
          </button>
        </div>
      </div>

      {filtradas.length === 0
        ? <EmptyState icon={Navigation} msg="No hay rutas. Use 'Nueva ruta' o 'Importar directorio'." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nombre de la ruta</th>
                  <th className="px-4 py-3 w-24 text-center">Comunidades</th>
                  <th className="px-4 py-3 w-20 text-center">Puntos</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtradas.map(r => {
                  const nComs = comunidades.filter(c => c.rutaId === r.id).length;
                  const nPtos = puntos.filter(p => p.rutaId === r.id).length;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{r.nombre}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nComs}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nPtos}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {r.activo !== false ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(r)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(r)} className={btnIcon} title={r.activo !== false ? 'Desactivar' : 'Activar'}>
                            {r.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nueva ruta' : 'Editar ruta'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre de la ruta</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: RUTA NORTE" />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">El ID no cambia al editar; solo el nombre visible.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear ruta' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Tab Comunidades ───────────────────────────────────────────────────────
function TabComunidades({ comunidades, rutas, puntos, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(esActivo);
  const filtradas = comunidades.filter(c => !busqueda ||
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === c.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirCrear = () => { setForm({ nombre: '', rutaId: rutasActivas[0]?.id ?? '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (c) => { setForm({ nombre: c.nombre, rutaId: c.rutaId }); setError(''); setExito(''); setModal({ modo: 'editar', com: c }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    const rutaId = form.rutaId;
    if (!nombre || !rutaId) { setError('Nombre y ruta son obligatorios.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = `${rutaId}__${slugify(nombre)}`;
        await setDoc(doc(db, 'comunidades', id), { nombre, rutaId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'comunidades', modal.com.id), { nombre, rutaId });
      }
      setExito(modal.modo === 'crear' ? 'Comunidad creada.' : 'Comunidad actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (c) => {
    const accion = c.activo !== false ? 'desactivar' : 'activar';
    const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
    if (!await confirmar({ titulo: `${c.activo !== false ? 'Desactivar' : 'Activar'} comunidad`, mensaje: `¿${accion} la comunidad "${c.nombre}" de ruta "${rutaNombre}"?`, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: c.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'comunidades', c.id), { activo: c.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar la comunidad: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar comunidad o ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtradas.length} comunidad(es)</span>
          <button type="button" onClick={abrirCrear} disabled={rutasActivas.length === 0} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nueva comunidad
          </button>
        </div>
      </div>
      {rutasActivas.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Primero crea al menos una ruta activa antes de agregar comunidades.</span>
        </div>
      )}
      {filtradas.length === 0
        ? <EmptyState icon={MapPin} msg="No hay comunidades. Cree una o importe el directorio." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Comunidad</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3 w-20 text-center">Puntos</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtradas.map(c => {
                  const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
                  const nPtos = puntos.filter(p => p.comunidadId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{c.nombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{rutaNombre}</td>
                      <td className="px-4 py-2.5 text-center text-[var(--text-secondary)]">{nPtos}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {c.activo !== false ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(c)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(c)} className={btnIcon} title={c.activo !== false ? 'Desactivar' : 'Activar'}>
                            {c.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nueva comunidad' : 'Editar comunidad'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ruta</label>
              <select required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))} className={inputCls}>
                <option value="">Seleccionar ruta...</option>
                {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre de la comunidad</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: COLONIA SAN PEDRO" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Tab Puntos ────────────────────────────────────────────────────────────
function TabPuntos({ puntos, comunidades, rutas, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '', comunidadId: '', clave: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(esActivo);
  const comsDeRuta = comunidades.filter(c => c.rutaId === form.rutaId && esActivo(c));

  const filtrados = puntos.filter(p => !busqueda ||
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.clave?.toLowerCase().includes(busqueda.toLowerCase()) ||
    comunidades.find(c => c.id === p.comunidadId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === p.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const generarClave = (rutaId, comunidadId) => {
    const ruta = rutas.find(r => r.id === rutaId);
    const com = comunidades.find(c => c.id === comunidadId);
    if (!ruta || !com) return '';
    const iniciales = ruta.nombre.split(' ').map(w => w[0] ?? '').join('').slice(0, 3).toUpperCase();
    const existentes = puntos.filter(p => p.comunidadId === comunidadId).length;
    return `${iniciales}${String(existentes + 1).padStart(2, '0')}`;
  };

  const abrirCrear = () => {
    const rutaId = rutasActivas[0]?.id ?? '';
    const comsInit = comunidades.filter(c => c.rutaId === rutaId && esActivo(c));
    const comunidadId = comsInit[0]?.id ?? '';
    setForm({ nombre: '', rutaId, comunidadId, clave: '' });
    setError(''); setExito(''); setModal({ modo: 'crear' });
  };
  const abrirEditar = (p) => { setForm({ nombre: p.nombre, rutaId: p.rutaId, comunidadId: p.comunidadId, clave: p.clave }); setError(''); setExito(''); setModal({ modo: 'editar', punto: p }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const { nombre, rutaId, comunidadId, clave } = form;
    if (!nombre.trim() || !rutaId || !comunidadId) { setError('Nombre, ruta y comunidad son obligatorios.'); return; }
    const claveReal = (clave.trim() || generarClave(rutaId, comunidadId)).toUpperCase();
    if (!claveReal) { setError('No se pudo generar la clave. Ingresela manualmente.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const existe = puntos.find(p => p.clave === claveReal);
        if (existe) { setError(`La clave "${claveReal}" ya existe.`); return; }
        await setDoc(doc(db, 'puntosReunion', claveReal), { nombre: nombre.trim().toUpperCase(), clave: claveReal, rutaId, comunidadId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'puntosReunion', modal.punto.id), { nombre: nombre.trim().toUpperCase(), rutaId, comunidadId });
      }
      setExito(modal.modo === 'crear' ? `Punto creado con clave ${claveReal}.` : 'Punto actualizado.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1400);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (p) => {
    const accion = p.activo !== false ? 'desactivar' : 'activar';
    if (!await confirmar({ titulo: `${p.activo !== false ? 'Desactivar' : 'Activar'} punto de reunión`, mensaje: `¿${accion} el punto "${p.nombre}" (clave: ${p.clave})?`, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: p.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'puntosReunion', p.id), { activo: p.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar el punto: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar punto, clave, comunidad o ruta..." className={`${inputCls} pl-8`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">{filtrados.length} punto(s)</span>
          <button type="button" onClick={abrirCrear} disabled={rutasActivas.length === 0} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />Nuevo punto
          </button>
        </div>
      </div>
      {filtrados.length === 0
        ? <EmptyState icon={MapPin} msg="No hay puntos de reunion. Cree uno o importe el directorio." />
        : (
          <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-20">Clave</th>
                  <th className="px-4 py-3">Nombre del punto</th>
                  <th className="px-4 py-3">Comunidad</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3 w-20">Estado</th>
                  <th className="px-4 py-3 w-20 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtrados.map(p => {
                  const comNombre = comunidades.find(c => c.id === p.comunidadId)?.nombre ?? p.comunidadId;
                  const rutaNombre = rutas.find(r => r.id === p.rutaId)?.nombre ?? p.rutaId;
                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-[var(--cm-red)]">{p.clave}</td>
                      <td className="px-4 py-2.5 font-medium text-[var(--text-main)]">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)]">{comNombre}</td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">{rutaNombre}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]  ' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]  '}`}>
                          {p.activo !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => abrirEditar(p)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => toggleActivo(p)} className={btnIcon} title={p.activo !== false ? 'Desactivar' : 'Activar'}>
                            {p.activo !== false ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {modal && (
        <ModalBase titulo={modal.modo === 'crear' ? 'Nuevo punto de reunion' : 'Editar punto de reunion'} onClose={() => setModal(null)}>
          <form onSubmit={handleGuardar} className="space-y-4 px-5 py-4">
            <AlertError msg={error} />
            <AlertSuccess msg={exito} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ruta</label>
                <select required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value, comunidadId: '' }))} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Comunidad</label>
                <select required value={form.comunidadId} onChange={e => setForm(f => ({ ...f, comunidadId: e.target.value }))} className={inputCls} disabled={!form.rutaId}>
                  <option value="">Seleccionar...</option>
                  {comsDeRuta.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nombre del punto</label>
              <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: PARQUE CENTRAL" />
            </div>
            {modal.modo === 'crear' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Clave <span className="text-[var(--text-muted)]">(dejar vacío para generar automáticamente)</span>
                </label>
                <input value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} className={inputCls} placeholder="Ej: SN01" maxLength={10} />
                {form.rutaId && form.comunidadId && !form.clave && (
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Se generará: <strong>{generarClave(form.rutaId, form.comunidadId)}</strong>
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={guardando} className={btnPrimary}>
                {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {modal.modo === 'crear' ? 'Crear punto' : 'Guardar'}
              </button>
            </div>
          </form>
        </ModalBase>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function RhCatalogos() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('rutas');
  const [modalTipo, setModalTipo] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [rev, setRev] = useState(0); // fuerza recarga

  const recargarCompartidos = useRecargarCatalogos();
  // Además de releer esta pantalla, invalida los catálogos compartidos (Nueva/Editar solicitud)
  const reload = () => { setCargando(true); setErrorCarga(''); setRev(v => v + 1); recargarCompartidos(); };

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'rutas')),
      getDocs(collection(db, 'comunidades')),
      getDocs(collection(db, 'puntosReunion')),
    ])
      .then(([rutasSnap, comsSnap, ptsSnap]) => {
        setRutas(rutasSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setComunidades(comsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setPuntos(ptsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.clave ?? '').localeCompare(b.clave ?? '')));
      })
      .catch(err => setErrorCarga('Error al cargar datos: ' + err.message))
      .finally(() => setCargando(false));
  }, [rev]);

  const puedeCargarMasivo = usuario?.rol === ROLES.ADMIN || usuario?.rol === ROLES.RH;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recursos Humanos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Rutas y puntos de reunión</h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Rutas, comunidades y puntos de reunión del transporte</p>
        </div>
        {puedeCargarMasivo && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" id="btn-importar-directorio" onClick={() => setModalTipo('directorio')} className={btnSecondary}>
              <Upload className="h-4 w-4 text-[var(--text-secondary)]" />Importar directorio
            </button>
          </div>
        )}
      </div>

      {errorCarga && <AlertError msg={errorCarga} />}

      {/* Tabs */}
      <div className="border-b border-[var(--border-color)]">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const activa = tabActiva === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setTabActiva(tab.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${activa ? 'border-[var(--cm-red)] text-[var(--cm-red)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--border-color)]'}`}>
                <Icon className="h-3.5 w-3.5" />{tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido */}
      <div className="min-h-[200px]">
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Cargando catalogos...</span>
          </div>
        ) : (
          <>
            {tabActiva === 'rutas' && <TabRutas rutas={rutas} comunidades={comunidades} puntos={puntos} reload={reload} />}
            {tabActiva === 'comunidades' && <TabComunidades comunidades={comunidades} rutas={rutas} puntos={puntos} reload={reload} />}
            {tabActiva === 'puntos' && <TabPuntos puntos={puntos} comunidades={comunidades} rutas={rutas} reload={reload} />}
          </>
        )}
      </div>

      {/* Modal importacion */}
      {modalTipo && (
        <Suspense fallback={null}>
          <ModalImportacion tipo={modalTipo} onClose={() => { setModalTipo(null); reload(); }} onImportado={reload} />
        </Suspense>
      )}
    </div>
  );
}
