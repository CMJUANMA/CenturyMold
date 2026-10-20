/**
 * RhEmpleados.jsx
 */
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, Plus, Pencil, Trash2, Upload, Download, Power } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';
import Modal from '../../components/Modal';
import AyudaPantalla from '../../components/AyudaPantalla';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Casilla, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoTabla } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { useAuth } from '../../hooks/useAuth';
import { ACCIONES_DESCARGA, registrarDescarga } from '../../utils/bitacoraDb';
import { areaEfectiva } from '../../utils/estructura';
import { ejecutarEnLotes, leerColeccion, opBitacora } from '../../utils/estructuraDb';
import { esActivo, opcionesVigentes } from '../../utils/activo';
import { leerTodosLosTelefonos, opTelefono } from '../../utils/contactosDb';
import { estadoTelefono, soloDigitosTelefono } from '../../utils/telefono';

// Importación masiva (arrastra exceljs): se descarga solo al abrir el modal
const ModalImportacion = lazy(() => import('./ModalImportacion'));

/** Nombre para un <option>, marcando si ya está inactivo (se conserva el valor guardado) */
const etiqueta = (x) => (esActivo(x) ? x.nombre : `${x.nombre} (inactivo)`);

const formVacio = {
  nomina: '', nombre: '', puesto: '', puestoId: '', rutaId: '', comunidadId: '', puntoReunionId: '', activo: true,
  areaExcepcion: '', areaExcepcionMotivo: '', telefono: '',
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
  const [telefonos, setTelefonos] = useState(() => new Map()); // nómina → teléfono (empleadosContacto; solo RH lo lee)
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
    Promise.all([...nombres.map(n => leerColeccion(n, toast)), leerTodosLosTelefonos().catch(err => { console.error('Teléfonos:', err.code, err); toast.error(`No se pudieron leer los teléfonos (${err.code ?? err.message}).`, 8000); return new Map(); })])
      .then(([emp, rut, com, pts, are, pue, tels]) => {
      if (!vigente) return;
      setTelefonos(tels);
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
      registrarDescarga(ACCIONES_DESCARGA.padron, { empleados: n });
      toast.success(`Respaldo descargado: ${n} empleados (activos e inactivos).`);
    } catch (err) {
      console.error(err); toast.error(`No se pudo generar el Excel: ${err.message}`, 10000);
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
      areaExcepcion: emp.areaExcepcion ?? '', areaExcepcionMotivo: emp.areaExcepcionMotivo ?? '', telefono: telefonos.get(emp.nomina) ?? '',
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
    if (!nomina) { setFormError('La nómina es obligatoria.'); return; }
    const original = modal.original ?? {};
    // Un empleado sin puestoId (aún sin asignar) puede guardarse sin elegir puesto; uno nuevo, no
    if (!form.puestoId && (modal.modo === 'crear' || original.puestoId)) { setFormError('Elige el puesto del catálogo.'); return; }
    if (form.areaExcepcion && !form.areaExcepcionMotivo.trim()) { setFormError('La excepción de área necesita un motivo.'); return; }
    if (estadoTelefono(form.telefono) === 'incompleto') { setFormError('El teléfono debe tener 10 dígitos (o déjalo vacío).'); return; }
    const telefono = soloDigitosTelefono(form.telefono);
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
        if ((await getDoc(ref)).exists()) throw new Error('Ya existe un empleado con esta nómina.');
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
      // Teléfono (colección aparte: solo RH, admin y el solicitante del área lo ven). Solo se escribe si cambió
      if (telefono !== (telefonos.get(nomina) ?? '')) ops.push(opTelefono(nomina, telefono));
      await ejecutarEnLotes(ops);
      setTelefonos(prev => new Map(prev).set(nomina, telefono));
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
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Recursos Humanos"
        titulo="Padrón de empleados"
        descripcion="Las personas que pueden aparecer en una solicitud. El área de cada una sale de su puesto."
        ayuda={<AyudaPantalla id="padron" />}
        accion={(
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Boton id="btn-exportar-padron" icono={Download} estado={exportando ? 'cargando' : undefined} onClick={exportarPadron}>Exportar padrón (respaldo)</Boton>
            <Boton id="btn-importar-empleados" icono={Upload} onClick={() => setImportando(true)}>Importar empleados</Boton>
            <Boton variante="primario" icono={Plus} onClick={abrirCrear}>Nuevo empleado</Boton>
          </div>
        )}
      />

      {importando && (
        <Suspense fallback={null}>
          <ModalImportacion tipo="empleados" onClose={() => { setImportando(false); recargar(); }} onImportado={recargar} />
        </Suspense>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nómina o nombre" aria-label="Buscar por nómina o nombre" className="pl-9" />
        </div>
        <Selector value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} aria-label="Estado" className="sm:w-44">
          <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
        </Selector>
        <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">{filtrados.length} {filtrados.length === 1 ? 'empleado' : 'empleados'}</span>
      </div>

      {cargando ? <EsqueletoTabla filas={6} columnas={6} /> : filtrados.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio titulo="Sin empleados" texto={busqueda || filtroEstado !== 'todos' ? 'Ningún empleado coincide con la búsqueda.' : 'Aún no hay empleados en el padrón. Agrega uno o impórtalos desde un Excel.'}
            accion={busqueda || filtroEstado !== 'todos' ? { texto: 'Limpiar búsqueda', onClick: () => { setBusqueda(''); setFiltroEstado('todos'); } } : undefined} />
        </div>
      ) : (
        <Tabla etiqueta="Padrón de empleados">
          <thead>
            <tr><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Ruta</Th><Th>Área</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
          </thead>
          <tbody>
            {filtrados.map(emp => (
              <Fila key={emp.nomina}>
                <Td mono>{emp.nomina}</Td>
                <Td>{emp.nombre}</Td>
                <Td className="text-[var(--text-secondary)]">{emp.puesto || '—'}</Td>
                <Td className="text-[var(--text-secondary)]">{nombreRuta(emp.rutaId)}</Td>
                <Td className="text-[var(--text-secondary)]">
                  {emp.areaId ? nombreArea(emp.areaId) : '—'}
                  {emp.areaExcepcion && <span className="ml-1.5" title={emp.areaExcepcionMotivo || 'Excepción de área'}><Insignia tono="aviso">Excepción</Insignia></span>}
                  {!emp.puestoId && <span className="ml-1.5" title="Aún sin puesto del catálogo"><Insignia>Sin asignar</Insignia></span>}
                </Td>
                <Td>{emp.activo !== false ? <Insignia tono="exito">Activo</Insignia> : <Insignia icono={Power}>Inactivo</Insignia>}</Td>
                <Td className="text-right">
                  <div className="inline-flex gap-1">
                    <Boton variante="fantasma" tamano="icono" onClick={() => abrirEditar(emp)} title="Editar" aria-label={`Editar ${emp.nombre}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Boton>
                    <Boton variante="peligro" tamano="icono" onClick={() => setModalEliminar(emp)} title="Eliminar" aria-label={`Eliminar ${emp.nombre}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Boton>
                  </div>
                </Td>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}

      {/* ── Modal Alta / Edición ── */}
      <Modal isOpen={!!modal} onClose={() => setModal(null)}
        title={modal?.modo === 'crear' ? 'Nuevo empleado' : 'Editar empleado'}
        maxWidth="max-w-lg">
        <form onSubmit={handleGuardar} className="space-y-4">
          {formError && <Aviso tono="error">{formError}</Aviso>}

          <div className="grid gap-4 sm:grid-cols-2">
            {modal?.modo === 'crear' && (
              <Campo etiqueta="Nómina" obligatorio>
                <Entrada required value={form.nomina} onChange={e => setForm(f => ({ ...f, nomina: e.target.value }))} placeholder="Ej. 12345" />
              </Campo>
            )}
            <Campo etiqueta="Nombre" obligatorio className={modal?.modo === 'crear' ? '' : 'sm:col-span-2'}>
              <Entrada required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" />
            </Campo>
          </div>

          <Campo etiqueta="Teléfono (opcional)" ayuda="10 dígitos. Es para que el transporte pueda llamar; solo lo ven RH y quien solicita en su área.">
            <Entrada type="tel" inputMode="tel" autoComplete="off" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="Ej. 442 123 4567" />
          </Campo>

          {/* Puesto del catálogo (de él sale el área) */}
          <Campo etiqueta="Puesto" obligatorio
            ayuda={puestoElegido ? `Área por puesto: ${nombreArea(puestoElegido.areaId) || 'sin área'}${form.areaExcepcion ? ` · área efectiva por excepción: ${nombreArea(form.areaExcepcion)}` : ''}${modal?.original?.depto ? ` · Departamento (informativo): ${modal.original.depto}` : ''}` : undefined}>
            <Selector value={form.puestoId} onChange={e => setForm(f => ({ ...f, puestoId: e.target.value }))}>
              <option value="">{form.puesto ? `(sin asignar) texto actual: ${form.puesto}` : 'Elige el puesto…'}</option>
              {puestosElegibles.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo === false ? ' (inactivo)' : ''} · {nombreArea(p.areaId) || 'sin área'}</option>)}
            </Selector>
          </Campo>
          {puestos.length === 0 && <Aviso tono="aviso">No hay puestos en el catálogo: créalos en Estructura &gt; Áreas &gt; Crear estructura inicial.</Aviso>}

          {/* Ruta / Comunidad / Punto — opcionales */}
          <fieldset className="space-y-4 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4">
            <legend className="px-1 text-xs text-[var(--text-secondary)]">{AYUDA_RUTA}.</legend>
            <Campo etiqueta="Ruta asignada (opcional)">
              <Selector value={form.rutaId} onChange={e => handleRutaChange(e.target.value)}>
                <option value="">Sin ruta asignada</option>
                {opcionesVigentes(rutas, form.rutaId).map(r => <option key={r.id} value={r.id}>{etiqueta(r)}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Comunidad o colonia (opcional)" ayuda={!form.rutaId ? 'Primero selecciona una ruta.' : undefined}>
              <Selector disabled={!form.rutaId} value={form.comunidadId} onChange={e => handleComunidadChange(e.target.value)}>
                <option value="">Sin comunidad</option>
                {opcionesVigentes(comunidades.filter(c => c.rutaId === form.rutaId), form.comunidadId).map(c => (
                  <option key={c.id} value={c.id}>{etiqueta(c)}</option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Punto de reunión (opcional)" ayuda={!form.comunidadId ? 'Primero selecciona una comunidad.' : undefined}>
              <Selector disabled={!form.comunidadId} value={form.puntoReunionId} onChange={e => setForm(f => ({ ...f, puntoReunionId: e.target.value }))}>
                <option value="">Sin punto</option>
                {opcionesVigentes(puntos.filter(p => p.comunidadId === form.comunidadId), form.puntoReunionId).map(p => (
                  <option key={p.id} value={p.id}>{etiqueta(p)}</option>
                ))}
              </Selector>
            </Campo>
          </fieldset>

          {/* Excepción de área: solo RH/admin; la importación nunca la sobrescribe */}
          <div className="space-y-4 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4">
            <Campo etiqueta="Excepción de área (p. ej. prestado a otra área)">
              <Selector value={form.areaExcepcion} onChange={e => setForm(f => ({ ...f, areaExcepcion: e.target.value }))}>
                <option value="">Sin excepción (área del puesto)</option>
                {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </Selector>
            </Campo>
            {form.areaExcepcion && (
              <Campo etiqueta="Motivo" obligatorio>
                <Entrada value={form.areaExcepcionMotivo} onChange={e => setForm(f => ({ ...f, areaExcepcionMotivo: e.target.value }))} placeholder="Ej. Prestado a Moldes por proyecto" />
              </Campo>
            )}
          </div>

          {modal?.modo === 'editar' && (
            <Casilla etiqueta="Empleado activo" checked={form.activo !== false} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
            <Boton onClick={() => setModal(null)}>Cancelar</Boton>
            <Boton type="submit" variante="primario" estado={guardando ? 'cargando' : undefined}>Guardar</Boton>
          </div>
        </form>
      </Modal>

      {/* ── Modal Eliminar ── */}
      <Modal isOpen={!!modalEliminar} onClose={() => setModalEliminar(null)} title="Eliminar empleado" maxWidth="max-w-sm">
        {modalEliminar && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              ¿Seguro que quieres eliminar a <strong className="font-medium text-[var(--text-main)]">{modalEliminar.nombre}</strong> (nómina {modalEliminar.nomina})?
              Las solicitudes pasadas conservarán su nombre en los registros, pero ya no podrá seleccionarse.
            </p>
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
              <Boton onClick={() => setModalEliminar(null)} disabled={guardando}>Cancelar</Boton>
              <Boton variante="peligro" icono={Trash2} estado={guardando ? 'cargando' : undefined} onClick={confirmarEliminar}>Sí, eliminar</Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
