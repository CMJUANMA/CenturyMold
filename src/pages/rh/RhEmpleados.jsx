/**
 * RhEmpleados.jsx
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, Plus, Filter, Pencil, Loader2, Trash2, Upload, Download } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';
import Modal from '../../components/Modal';
import { useAuth } from '../../hooks/useAuth';
import { areaEfectiva } from '../../utils/estructura';
import { ejecutarEnLotes, leerColeccion, opBitacora } from '../../utils/estructuraDb';
import { esActivo, opcionesVigentes } from '../../utils/activo';

// Importación masiva (arrastra exceljs): se descarga solo al abrir el modal
const ModalImportacion = lazy(() => import('./ModalImportacion'));

/** Nombre para un <option>, marcando si ya está inactivo (se conserva el valor guardado) */
const etiqueta = (x) => (esActivo(x) ? x.nombre : `${x.nombre} (inactivo)`);

const btnIcon = 'rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-secondary)] hover:text-[var(--text-main)] active:scale-95 transition-all cursor-pointer';
const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)] disabled:bg-[var(--bg-surface-secondary)] disabled:opacity-60';
const labelCls = 'block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1';
const formVacio = {
  nomina: '', nombre: '', puesto: '', puestoId: '', rutaId: '', comunidadId: '', puntoReunionId: '', activo: true,
  areaExcepcion: '', areaExcepcionMotivo: '',
};
const AYUDA_RUTA = 'Si no la asigna, se pedirá al solicitar transporte';

export default function RhEmpleados() {
  const toast = useToast();
  const { usuario } = useAuth();
  const recargarCompartidos = useRecargarCatalogos();
  const [empleados, setEmpleados] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [rev, setRev] = useState(0); // fuerza recarga (tras importar)
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const [busqueda, setBusqueda] = useState('');

  const [modal, setModal] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);

  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState('');

  // Carga inicial: cada colección por separado. Si una falla se avisa (toast + código en consola) y las demás se muestran.
  useEffect(() => {
    let vigente = true;
    const nombres = ['empleados', 'rutas', 'comunidades', 'puntosReunion', 'areas', 'puestos'];
    Promise.all(nombres.map(n => leerColeccion(n, toast))).then(([emp, rut, com, pts, are, pue]) => {
      if (!vigente) return;
      setEmpleados(emp.datos.map(d => ({ ...d, nomina: String(d.nomina ?? d.id) })));
      setRutas(rut.datos); setComunidades(com.datos); setPuntos(pts.datos); setAreas(are.datos); setPuestos(pue.datos);
      setCargando(false);
    });
    return () => { vigente = false; };
  }, [toast, rev]);

  const recargar = () => { setCargando(true); setRev(v => v + 1); recargarCompartidos(); };

  // Respaldo del padrón completo (activos e inactivos): exceljs se descarga solo al pulsar el botón
  const exportarPadron = async () => {
    setExportando(true);
    try {
      const nombres = ['empleados', 'areas', 'rutas', 'comunidades', 'puntosReunion'];
      const lecturas = await Promise.all(nombres.map(n => leerColeccion(n, toast)));
      const fallida = lecturas.findIndex(l => l.error);
      if (fallida >= 0) { toast.error(`No se pudo leer "${nombres[fallida]}"; el respaldo no se generó.`, 8000); return; }
      const [emps, ares, ruts, coms, pts] = lecturas.map(l => l.datos);
      const { descargarRespaldoPadron } = await import('../../utils/respaldoPadron');
      const n = await descargarRespaldoPadron({ empleados: emps, areas: ares, rutas: ruts, comunidades: coms, puntos: pts });
      toast.success(`Respaldo descargado: ${n} empleados (activos e inactivos).`);
    } catch (err) {
      toast.error('No se pudo generar el respaldo: ' + err.message, 8000);
    } finally { setExportando(false); }
  };

  const filtrados = empleados.filter(e => {
    const q = busqueda.toLowerCase();
    if (filtroEstado === 'activos' && e.activo === false) return false;
    if (filtroEstado === 'inactivos' && e.activo !== false) return false;
    return !q || e.nomina.toLowerCase().includes(q) || (e.nombre || '').toLowerCase().includes(q);
  });

  const abrirCrear = () => {
    setForm(formVacio);
    setFormError('');
    setModal({ modo: 'crear' });
  };
  const abrirEditar = (emp) => {
    setForm({
      ...formVacio, ...emp, puestoId: emp.puestoId ?? '',
      areaExcepcion: emp.areaExcepcion ?? '', areaExcepcionMotivo: emp.areaExcepcionMotivo ?? '',
    });
    setFormError('');
    setModal({ modo: 'editar', original: emp });
  };

  const puestosPorId = useMemo(() => new Map(puestos.map(p => [p.id, p])), [puestos]);
  const areasPorId = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const areasActivas = areas.filter(a => a.activa !== false).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
  // Puestos que se pueden elegir: los activos más el que ya tiene el empleado (aunque esté inactivo)
  const puestosElegibles = puestos.filter(p => p.activo !== false || p.id === form.puestoId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const puestoElegido = puestosPorId.get(form.puestoId);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nomina = String(form.nomina).trim();
    if (!nomina) { setFormError('La nomina es obligatoria.'); return; }
    const original = modal.original ?? {};
    // Un empleado sin puestoId (aún sin asignar) puede guardarse sin elegir puesto; uno nuevo, no
    if (!form.puestoId && (modal.modo === 'crear' || original.puestoId)) { setFormError('Elija el puesto del catálogo.'); return; }
    if (form.areaExcepcion && !form.areaExcepcionMotivo.trim()) { setFormError('La excepción de área necesita un motivo.'); return; }
    setGuardando(true); setFormError('');
    try {
      const ref = doc(db, 'empleados', nomina);
      const nombre = form.nombre.trim().replace(/\s+/g, ' ');
      const data = {
        nomina,
        nombre,
        nombreLower: nombre.toLowerCase(),
        // Ruta/comunidad/punto son opcionales — guardar vacío si no se asigna
        rutaId: form.rutaId || '',
        comunidadId: form.comunidadId || '',
        puntoReunionId: form.puntoReunionId || '',
        activo: form.activo !== false,
      };
      const excepcion = form.areaExcepcion || null;
      const motivo = excepcion ? form.areaExcepcionMotivo.trim() : '';
      if (puestoElegido) {
        // El área sale del puesto, salvo que RH ponga una excepción
        Object.assign(data, {
          puesto: puestoElegido.nombre, puestoId: puestoElegido.id, areaExcepcion: excepcion, areaExcepcionMotivo: motivo,
          areaId: areaEfectiva({ puestoId: puestoElegido.id, areaExcepcion: excepcion }, puestosPorId),
        });
      }
      const ops = [];
      if (modal.modo === 'crear') {
        if ((await getDoc(ref)).exists()) throw new Error('Ya existe un empleado con esta nomina.');
        ops.push(b => b.set(ref, data));
      } else {
        ops.push(b => b.update(ref, data));
      }
      // Bitácora: cambios de puesto/área y de excepción
      if (puestoElegido && (original.puestoId ?? '') !== puestoElegido.id) {
        ops.push(opBitacora({ accion: 'empleado_puesto', entidad: `empleados/${nomina}`, antes: { puestoId: original.puestoId ?? null, areaId: original.areaId ?? null }, despues: { puestoId: puestoElegido.id, areaId: data.areaId } }, usuario));
      }
      if (puestoElegido && (original.areaExcepcion ?? null) !== excepcion) {
        ops.push(opBitacora({
          accion: excepcion ? (original.areaExcepcion ? 'excepcion_modificada' : 'excepcion_asignada') : 'excepcion_quitada',
          entidad: `empleados/${nomina}`,
          antes: { areaExcepcion: original.areaExcepcion ?? null, motivo: original.areaExcepcionMotivo ?? '' },
          despues: { areaExcepcion: excepcion, motivo, areaId: data.areaId },
        }, usuario));
      }
      await ejecutarEnLotes(ops);
      setEmpleados(prev => (modal.modo === 'crear' ? [...prev, data] : prev.map(emp => emp.nomina === nomina ? { ...emp, ...data } : emp)));
      recargarCompartidos();
      toast.success(modal.modo === 'crear' ? 'Empleado creado.' : 'Empleado actualizado.');
      setModal(null);
    } catch (err) {
      console.error('Guardar empleado:', err.code, err);
      setFormError(err.message);
      toast.error(`No se pudo guardar (${err.code ?? err.message}).`, 7000);
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
      recargarCompartidos();
      toast.success('Empleado eliminado permanentemente.');
      setModalEliminar(null);
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const nombreArea = (id) => areasPorId.get(id)?.nombre ?? id;
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Padrón de empleados</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" id="btn-exportar-padron" onClick={exportarPadron} disabled={exportando}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[var(--text-secondary)]" />}Exportar padrón (respaldo)
          </button>
          <button type="button" id="btn-importar-empleados" onClick={() => setImportando(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all">
            <Upload className="h-4 w-4 text-[var(--text-secondary)]" />Importar empleados
          </button>
        <button type="button" onClick={abrirCrear}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all">
          <Plus className="h-4 w-4" />Nuevo Empleado
        </button>
        </div>
      </div>

      {importando && (
        <Suspense fallback={null}>
          <ModalImportacion tipo="empleados" onClose={() => { setImportando(false); recargar(); }} onImportado={recargar} />
        </Suspense>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-xs">
        <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar nomina o nombre..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[var(--cm-red)]" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={inputCls + ' !w-auto'}>
          <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
        </select>
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
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {cargando
              ? <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-[var(--text-muted)]" /></td></tr>
              : filtrados.map(emp => (
                <tr key={emp.nomina} className="hover:bg-[var(--bg-surface-secondary)] transition-colors">
                  <td className="px-4 py-2.5 font-mono font-bold">{emp.nomina}</td>
                  <td className="px-4 py-2.5 text-[var(--text-main)]">{emp.nombre}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{emp.puesto || '—'}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{nombreRuta(emp.rutaId)}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    {emp.areaId ? nombreArea(emp.areaId) : '—'}
                    {emp.areaExcepcion && <span className="ml-1 text-[9px] font-bold uppercase text-[var(--status-warning-text)]" title={emp.areaExcepcionMotivo || 'Excepción de área'}>excepción</span>}
                    {!emp.puestoId && <span className="ml-1 text-[9px] font-bold uppercase text-[var(--text-muted)]" title="Aún sin puesto del catálogo">sin asignar</span>}
                  </td>
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

          {/* Puesto del catálogo (de él sale el área) */}
          <div>
            <label className={labelCls}>
              Puesto <span className="text-[var(--status-error-text)]">*</span>
            </label>
            <select value={form.puestoId} onChange={e => setForm(f => ({ ...f, puestoId: e.target.value }))} className={inputCls}>
              <option value="">{form.puesto ? `(sin asignar) texto actual: ${form.puesto}` : 'Elija el puesto…'}</option>
              {puestosElegibles.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo === false ? ' (inactivo)' : ''} · {nombreArea(p.areaId) || 'sin área'}</option>)}
            </select>
            {puestos.length === 0 && (
              <p className="mt-1 text-[10px] text-[var(--status-warning-text)]">No hay puestos en el catálogo: créelos en Estructura &gt; Áreas &gt; Crear estructura inicial.</p>
            )}
            {puestoElegido && (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Área por puesto: <strong>{nombreArea(puestoElegido.areaId) || 'sin área'}</strong>
                {form.areaExcepcion && <> · área efectiva por excepción: <strong>{nombreArea(form.areaExcepcion)}</strong></>}
                {modal?.original?.depto && <> · Departamento (informativo): {modal.original.depto}</>}
              </p>
            )}
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

          {/* Excepción de área: solo RH/admin; la importación nunca la sobrescribe */}
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3 space-y-2">
            <div>
              <label className={labelCls}>Excepción de área <span className="font-normal normal-case text-[var(--text-muted)]">(p. ej. prestado a otra área)</span></label>
              <select value={form.areaExcepcion} onChange={e => setForm(f => ({ ...f, areaExcepcion: e.target.value }))} className={inputCls}>
                <option value="">Sin excepción (área del puesto)</option>
                {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            {form.areaExcepcion && (
              <div>
                <label className={labelCls}>Motivo <span className="text-[var(--status-error-text)]">*</span></label>
                <input value={form.areaExcepcionMotivo} onChange={e => setForm(f => ({ ...f, areaExcepcionMotivo: e.target.value }))}
                  className={inputCls} placeholder="Ej. Prestado a Moldes por proyecto" />
              </div>
            )}
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
