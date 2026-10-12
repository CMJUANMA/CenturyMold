/**
 * RhEmpleados.jsx
 */
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, Plus, Filter, Pencil, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import PuestoCombobox from '../../components/PuestoCombobox';
import { derivarPuestos, canonizarPuesto } from '../../utils/puestos';
import { esActivo, opcionesVigentes } from '../../utils/activo';

/** Nombre para un <option>, marcando si ya está inactivo (se conserva el valor guardado) */
const etiqueta = (x) => (esActivo(x) ? x.nombre : `${x.nombre} (inactivo)`);

const btnIcon = 'rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)] disabled:bg-[var(--bg-surface-secondary)] disabled:opacity-60';
const labelCls = 'block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1';
const formVacio = { nomina: '', nombre: '', puesto: '', rutaId: '', comunidadId: '', puntoReunionId: '', activo: true };
const AYUDA_RUTA = 'Si no la asigna, se pedirá al solicitar transporte';

export default function RhEmpleados() {
  const toast = useToast();
  const [empleados, setEmpleados] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState('');

  const [modal, setModal] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);

  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');

  // Puestos unicos derivados del padron, ordenados alfabeticamente
  const puestosExistentes = useMemo(() => derivarPuestos(empleados), [empleados]);

  const cargar = async () => {
    setCargando(true);
    try {
      const [empS, rutS, comS, ptS] = await Promise.all([
        getDocs(collection(db, 'empleados')),
        getDocs(collection(db, 'rutas')),
        getDocs(collection(db, 'comunidades')),
        getDocs(collection(db, 'puntosReunion')),
      ]);
      setEmpleados(empS.docs.map(d => ({ nomina: d.id, ...d.data() })));
      setRutas(rutS.docs.map(d => ({ id: d.id, ...d.data() })));
      setComunidades(comS.docs.map(d => ({ id: d.id, ...d.data() })));
      setPuntos(ptS.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const filtrados = empleados.filter(e => {
    const q = busqueda.toLowerCase();
    return !q || e.nomina.toLowerCase().includes(q) || (e.nombre || '').toLowerCase().includes(q);
  });

  const abrirCrear = () => {
    setForm(formVacio);
    setFormError('');
    setModal({ modo: 'crear' });
  };
  const abrirEditar = (emp) => {
    setForm({ ...formVacio, ...emp });
    setFormError('');
    setModal({ modo: 'editar', original: emp });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.puesto) { setFormError('El puesto es obligatorio.'); return; }
    const nomina = String(form.nomina).trim();
    if (!nomina) { setFormError('La nomina es obligatoria.'); return; }
    setGuardando(true); setFormError('');
    try {
      const ref = doc(db, 'empleados', nomina);
      const nombre = form.nombre.trim().replace(/\s+/g, ' ');
      const data = {
        nomina,
        nombre,
        nombreLower: nombre.toLowerCase(),
        puesto: canonizarPuesto(form.puesto, puestosExistentes),
        // Ruta/comunidad/punto son opcionales — guardar vacío si no se asigna
        rutaId: form.rutaId || '',
        comunidadId: form.comunidadId || '',
        puntoReunionId: form.puntoReunionId || '',
        activo: form.activo !== false,
      };

      if (modal.modo === 'crear') {
        if ((await getDoc(ref)).exists()) {
          throw new Error('Ya existe un empleado con esta nomina.');
        }
        await setDoc(ref, data);
        setEmpleados(prev => [...prev, data]);
        toast.success('Empleado creado.');
      } else {
        await updateDoc(ref, data);
        setEmpleados(prev => prev.map(emp => emp.nomina === nomina ? { ...emp, ...data } : emp));
        toast.success('Empleado actualizado.');
      }
      setModal(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!modalEliminar) return;
    setGuardando(true);
    try {
      await deleteDoc(doc(db, 'empleados', modalEliminar.nomina));
      setEmpleados(prev => prev.filter(e => e.nomina !== modalEliminar.nomina));
      toast.success('Empleado eliminado permanentemente.');
      setModalEliminar(null);
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const nombreRuta = (id) => rutas.find(r => r.id === id)?.nombre || '—';

  // Cascada: limpiar comunidad y punto al cambiar ruta
  const handleRutaChange = (rutaId) => {
    setForm(f => ({ ...f, rutaId, comunidadId: '', puntoReunionId: '' }));
  };
  const handleComunidadChange = (comunidadId) => {
    setForm(f => ({ ...f, comunidadId, puntoReunionId: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recursos Humanos</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Padron de Empleados</h1>
        </div>
        <button type="button" onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all">
          <Plus className="h-4 w-4" />Nuevo Empleado
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-xs">
        <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar nomina o nombre..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[var(--cm-red)]" />
        </div>
        <span className="text-[var(--text-muted)] font-medium">{filtrados.length} empleados</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Nomina</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Puesto</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cargando
              ? <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
              : filtrados.map(emp => (
                <tr key={emp.nomina} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-bold">{emp.nomina}</td>
                  <td className="px-4 py-2.5 text-[var(--text-main)]">{emp.nombre}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{emp.puesto || '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{nombreRuta(emp.rutaId)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${emp.activo !== false ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]' : 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]'}`}>
                      {emp.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => abrirEditar(emp)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => setModalEliminar(emp)} className={btnIcon + ' hover:text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]'} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Modal Alta / Edicion ── */}
      <Modal isOpen={!!modal} onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo empleado' : 'Editar empleado'}
        maxWidth="max-w-lg">
        <form onSubmit={handleGuardar} className="space-y-4">
          {formError && (
            <div className="p-2 text-xs text-[var(--status-error-text)] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {modal?.modo === 'crear' && (
              <div>
                <label className={labelCls}>Nomina <span className="text-[var(--status-error-text)]">*</span></label>
                <input required value={form.nomina}
                  onChange={e => setForm(f => ({ ...f, nomina: e.target.value }))}
                  className={inputCls} placeholder="Ej. 12345" />
              </div>
            )}
            <div className={modal?.modo === 'crear' ? '' : 'col-span-2'}>
              <label className={labelCls}>Nombre <span className="text-[var(--status-error-text)]">*</span></label>
              <input required value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className={inputCls} placeholder="Nombre completo" />
            </div>
          </div>

          {/* Puesto con combobox */}
          <div>
            <label className={labelCls}>
              Puesto <span className="text-[var(--status-error-text)]">*</span>
            </label>
            <PuestoCombobox
              puestosExistentes={puestosExistentes}
              value={form.puesto}
              onChange={v => setForm(f => ({ ...f, puesto: v }))}
              required
            />
          </div>

          {/* Ruta / Comunidad / Punto — opcionales */}
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3 space-y-3">
            <p className="text-[10px] text-[var(--text-muted)] italic">{AYUDA_RUTA}.</p>

            <div>
              <label className={labelCls}>
                Ruta asignada <span className="text-[var(--text-muted)] font-normal normal-case">(opcional)</span>
              </label>
              <select value={form.rutaId} onChange={e => handleRutaChange(e.target.value)} className={inputCls}>
                <option value="">Sin ruta asignada</option>
                {opcionesVigentes(rutas, form.rutaId).map(r => <option key={r.id} value={r.id}>{etiqueta(r)}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>
                Comunidad / Colonia <span className="text-[var(--text-muted)] font-normal normal-case">(opcional)</span>
              </label>
              <select
                disabled={!form.rutaId}
                value={form.comunidadId}
                onChange={e => handleComunidadChange(e.target.value)}
                className={inputCls}>
                <option value="">Sin comunidad</option>
                {opcionesVigentes(comunidades.filter(c => c.rutaId === form.rutaId), form.comunidadId).map(c => (
                  <option key={c.id} value={c.id}>{etiqueta(c)}</option>
                ))}
              </select>
              {!form.rutaId && (
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">Primero selecciona una ruta.</p>
              )}
            </div>

            <div>
              <label className={labelCls}>
                Punto de reunion <span className="text-[var(--text-muted)] font-normal normal-case">(opcional)</span>
              </label>
              <select
                disabled={!form.comunidadId}
                value={form.puntoReunionId}
                onChange={e => setForm(f => ({ ...f, puntoReunionId: e.target.value }))}
                className={inputCls}>
                <option value="">Sin punto</option>
                {opcionesVigentes(puntos.filter(p => p.comunidadId === form.comunidadId), form.puntoReunionId).map(p => (
                  <option key={p.id} value={p.id}>{etiqueta(p)}</option>
                ))}
              </select>
              {!form.comunidadId && (
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">Primero selecciona una comunidad.</p>
              )}
            </div>
          </div>

          {modal?.modo === 'editar' && (
            <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-semibold">
              <input type="checkbox" checked={form.activo !== false}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4 text-[var(--cm-red)]" />
              Empleado activo
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button type="button" onClick={() => setModal(null)}
              className="px-4 py-2 text-xs border border-[var(--border-color)] text-[var(--text-main)] rounded-md font-semibold hover:bg-[var(--bg-surface-hover)]">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="px-4 py-2 text-xs bg-[var(--cm-red)] text-white hover:bg-[var(--cm-red-hover)] rounded-md font-semibold flex items-center gap-2">
              {guardando && <Loader2 className="h-3 w-3 animate-spin" />}Guardar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal Eliminar ── */}
      <Modal isOpen={!!modalEliminar} onClose={() => setModalEliminar(null)} title="Eliminar Empleado" maxWidth="max-w-sm">
        {modalEliminar && (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Seguro que deseas eliminar a <strong>{modalEliminar.nombre}</strong> (Nomina: {modalEliminar.nomina})?
              Las solicitudes pasadas conservaran su nombre en los registros, pero no podra volver a seleccionarse.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setModalEliminar(null)} disabled={guardando}
                className="px-4 py-2 text-xs border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] rounded-md font-semibold">
                Cancelar
              </button>
              <button onClick={confirmarEliminar} disabled={guardando}
                className="px-4 py-2 text-xs bg-[var(--status-error-text)] hover:bg-red-700 text-white rounded-md font-semibold flex items-center gap-2">
                {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Si, eliminar'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
