/**
 * EditarSolicitud.jsx
 * Permite editar una solicitud existente.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, getDoc, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { FileEdit, Plus, Trash2, CheckCircle2, AlertCircle, Save, Loader2, Info } from 'lucide-react';
import { ROLES_RH } from '../utils/roles';
import PuestoCombobox from '../components/PuestoCombobox';
import { derivarPuestos, existePuesto, canonizarPuesto } from '../utils/puestos';
import { esActivo, opcionesVigentes, rutaVigente } from '../utils/activo';
import { useToast } from '../components/Toast';
import { useCatalogos } from '../context/CatalogosContext';
import { MAX_PASAJEROS, MSG_MAX_PASAJEROS, resumenPasajeros } from '../utils/solicitudes';

// Error de negocio detectado dentro de la transacción: aborta sin guardar nada
const conflicto = (msg) => Object.assign(new Error(msg), { code: 'app/conflicto' });

/** Nombre para un <option>, marcando si ya está inactivo */
const etiqueta = (x) => (esActivo(x) ? x.nombre : `${x.nombre} (inactivo)`);

// Calcula la fecha mínima = hoy
function fechaMinima() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const HORAS_ENTRADA = ['7:00AM', '4:00PM', '7:00PM', '12:00AM'];
const HORAS_SALIDA  = ['4:00PM', '7:00PM', '12:00AM', '7:00AM'];

const inputCls = 'w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)] disabled:bg-[var(--bg-surface-secondary)] disabled:opacity-60';

const pasViejo = () => ({
  id: Date.now() + Math.random(),
  searchQuery: '',
  showResults: false,
  empleadoSeleccionado: null,
  puesto: '',
  turno: '',
  horaEntrada: '',
  horaSalida: '',
  alimentos: false,
  rutaId: '',
  comunidadId: '',
  puntoReunionId: '',
  needsConfirmation: false,
  isConfirmed: false,
});

export default function EditarSolicitud() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const esRH = ROLES_RH.includes(usuario?.rol);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Catálogos compartidos (completos: los selects muestran activos más el valor ya guardado)
  const { rutas, comunidades, puntos, empleados, cargando: cargandoCat, error: errorCat, parchearEmpleados } = useCatalogos();
  const [puestosNuevos, setPuestosNuevos] = useState([]);
  const puestos = useMemo(
    () => [...derivarPuestos(empleados), ...puestosNuevos].sort((a, b) => a.localeCompare(b, 'es')),
    [empleados, puestosNuevos]
  );

  const [solicitud, setSolicitud] = useState(null);
  const [fechaServicio, setFechaServicio] = useState('');
  const [solicitanteNombre, setSolicitanteNombre] = useState('');
  const [comentario, setComentario] = useState('');

  const [pasajeros, setPasajeros] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        // Cargar Solicitud
        const docSnap = await getDoc(doc(db, 'solicitudes', id));
        if (!docSnap.exists()) {
          alert('Solicitud no encontrada');
          navigate(-1);
          return;
        }
        const data = docSnap.data();
        
        // Reglas de edición en cliente
        const todayStr = fechaMinima();
        const estatus = data.estatus || 'pendiente';
        
        if (!esRH) {
           if (data.creadoPor !== usuario.uid) {
             alert('No tienes permiso para editar esta solicitud.');
             navigate(-1); return;
           }
           if (estatus === 'enviada al proveedor' || estatus === 'cancelada' || estatus === 'rechazada') {
             alert(`No puedes editar una solicitud que está ${estatus}.`);
             navigate(-1); return;
           }
           if (data.fechaServicio < todayStr) {
             alert('No puedes editar solicitudes pasadas.');
             navigate(-1); return;
           }
        }

        setSolicitud(data);
        setFechaServicio(data.fechaServicio);
        setSolicitanteNombre(data.solicitanteNombre);

        // Cargar pasajeros
        const pasSnap = await getDocs(collection(db, `solicitudes/${id}/pasajeros`));
        const pasData = pasSnap.docs.map(d => {
          const pd = d.data();
          const emp = empleados.find(e => e.nomina === pd.nomina) || { nomina: pd.nomina, nombre: pd.nombre };
          return {
            id: pd.nomina,
            searchQuery: `${pd.nomina} - ${pd.nombre}`,
            showResults: false,
            empleadoSeleccionado: emp,
            puesto: pd.puesto || '',
            turno: pd.turno || '',
            horaEntrada: pd.horaEntrada || '',
            horaSalida: pd.horaSalida || '',
            alimentos: pd.alimentos || false,
            rutaId: pd.rutaId || '',
            comunidadId: pd.comunidadId || '',
            puntoReunionId: pd.puntoReunionId || '',
            needsConfirmation: false,
            isConfirmed: true,
            _originalNomina: pd.nomina
          };
        });

        if (pasData.length === 0) pasData.push(pasViejo());
        setPasajeros(pasData);

      } catch (err) {
        console.error(err);
        alert('Error al cargar datos');
      } finally {
        setIsLoadingData(false);
      }
    }
    // Espera a que los catálogos compartidos estén listos; no se vuelve a ejecutar si cambian después
    // (eso borraría lo que el usuario ya editó en el formulario)
    if (usuario?.uid && !cargandoCat) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, usuario?.uid, navigate, esRH, cargandoCat]);

  useEffect(() => {
    if (errorCat) toast.error('Error al leer catálogos: ' + errorCat.message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCat]);

  const addPasajero = () => {
    if (pasajeros.length >= MAX_PASAJEROS) return toast.error(MSG_MAX_PASAJEROS);
    setPasajeros(prev => [...prev, pasViejo()]);
  };
  const removePasajero = (pId) => { if (pasajeros.length > 1) setPasajeros(prev => prev.filter(p => p.id !== pId)); };

  const updatePas = (index, fields) => setPasajeros(prev => prev.map((p, i) => i === index ? { ...p, ...fields } : p));

  const handleSearchChange = (index, val) => {
    updatePas(index, {
      searchQuery: val, showResults: true, empleadoSeleccionado: null,
      needsConfirmation: false, isConfirmed: false, rutaId: '', comunidadId: '', puntoReunionId: '',
    });
  };

  const handleSelectEmpleado = (index, emp) => {
    if (pasajeros.some((p, i) => i !== index && p.empleadoSeleccionado?.nomina === emp.nomina)) {
      alert('Este empleado ya fue agregado.'); return;
    }
    // Lo que esté inactivo en el directorio no se precarga: se pedirá de nuevo
    const ruta = rutaVigente(emp, { rutas, comunidades, puntos });
    const tieneRuta = ruta.rutaId && ruta.comunidadId && ruta.puntoReunionId;
    updatePas(index, {
      empleadoSeleccionado: emp,
      searchQuery: `${emp.nomina} - ${emp.nombre}`,
      showResults: false,
      puesto: emp.puesto || '',
      ...ruta,
      needsConfirmation: !!tieneRuta,
      isConfirmed: false,
    });
  };

  // Agregar un puesto nuevo a la lista cuando se crea en el combobox
  const handlePuestoChange = (index, nuevoPuesto) => {
    updatePas(index, { puesto: nuevoPuesto });
    if (nuevoPuesto && !existePuesto(nuevoPuesto, puestos)) {
      setPuestosNuevos(prev => [...prev, nuevoPuesto]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fechaServicio) return alert('Selecciona la fecha del servicio.');

    if (!comentario.trim() && (solicitud.estatus === 'aprobada' || esRH)) {
      return alert('Debes ingresar un comentario sobre la edición.');
    }

    const invalido = pasajeros.find(p => !p.empleadoSeleccionado || !p.puesto || !p.turno || !p.horaEntrada || !p.horaSalida || !p.rutaId || !p.comunidadId || !p.puntoReunionId || (p.needsConfirmation && !p.isConfirmed));
    if (invalido) return alert('Completa todos los campos de cada pasajero.');

    if (pasajeros.length > MAX_PASAJEROS) return alert(MSG_MAX_PASAJEROS);

    const estatusAlAbrir = (solicitud.estatus || 'pendiente').toLowerCase();

    try {
      setIsSubmitting(true);
      const solRef = doc(db, 'solicitudes', id);

      // Los ids de pasajero son la nómina. Se juntan los ids que hay ahora en Firestore (lectura fuera
      // de la transacción: el SDK web no permite consultas dentro) para borrar los que ya no estén.
      const pasSnapActual = await getDocs(collection(db, `solicitudes/${id}/pasajeros`));
      const idsNuevos = new Set(pasajeros.map(p => p.empleadoSeleccionado.nomina));
      const idsABorrar = pasSnapActual.docs.map(d => d.id).filter(pid => !idsNuevos.has(pid));

      // Empleados cuya ruta confirmada cambió respecto al padrón
      const cambiosEmp = {};
      for (const p of pasajeros) {
        const emp = p.empleadoSeleccionado;
        if (emp.id && (emp.rutaId !== p.rutaId || emp.comunidadId !== p.comunidadId || emp.puntoReunionId !== p.puntoReunionId)) {
          cambiosEmp[emp.id] = { rutaId: p.rutaId || '', comunidadId: p.comunidadId || '', puntoReunionId: p.puntoReunionId || '' };
        }
      }
      const resumen = resumenPasajeros(pasajeros.map(p => ({ turno: p.turno, puesto: canonizarPuesto(p.puesto, puestos), alimentos: p.alimentos })));

      // 1 (solicitud) + borrados + pasajeros + empleados
      if (1 + idsABorrar.length + pasajeros.length + Object.keys(cambiosEmp).length > 500) {
        throw new Error('La edición supera el límite de operaciones de Firestore. Divide la solicitud en dos.');
      }

      await runTransaction(db, async (t) => {
        // ── Lecturas (todas antes de cualquier escritura) ──────────────────
        const solSnap = await t.get(solRef);
        if (!solSnap.exists()) throw conflicto('La solicitud ya no existe.');
        const actual = solSnap.data();
        const estatusActual = (actual.estatus || 'pendiente').toLowerCase();

        // Regla de negocio sobre el estatus leído AQUÍ, no el de cuando se abrió la página
        if (estatusActual !== estatusAlAbrir) {
          const respondidoRH = ['aprobada', 'rechazada', 'enviada al proveedor'].includes(estatusActual);
          throw conflicto(respondidoRH
            ? 'RH ya respondió esta solicitud mientras la editabas. Recarga para ver el estado actual.'
            : `La solicitud cambió a "${estatusActual}" mientras la editabas. Recarga para ver el estado actual.`);
        }
        if (!esRH) {
          if (actual.creadoPor !== usuario.uid) throw conflicto('No tienes permiso para editar esta solicitud.');
          if (!['pendiente', 'aprobada'].includes(estatusActual)) {
            throw conflicto(`No puedes editar una solicitud que está ${estatusActual}.`);
          }
        }

        let nuevoEstatus = estatusActual;
        if (estatusActual === 'aprobada') nuevoEstatus = 'pendiente';
        if (esRH && estatusActual === 'enviada al proveedor') nuevoEstatus = 'pendiente'; // Pide reenvío

        // ── Escrituras ─────────────────────────────────────────────────────
        t.update(solRef, {
          fechaServicio,
          solicitanteNombre: solicitanteNombre || usuario?.nombre || '',
          ...resumen,
          estatus: nuevoEstatus,
          modificada: true,
          historial: arrayUnion({
            fecha: new Date().toISOString(),
            usuario: usuario?.nombre || '',
            accion: 'editada',
            comentario: comentario.trim() || 'Modificación general'
          })
        });

        for (const pid of idsABorrar) {
          t.delete(doc(db, `solicitudes/${id}/pasajeros`, pid));
        }

        for (const p of pasajeros) {
          const pasObj = {
            nomina:         p.empleadoSeleccionado.nomina,
            nombre:         p.empleadoSeleccionado.nombre,
            puesto:         canonizarPuesto(p.puesto, puestos),
            turno:          p.turno          || '',
            horaEntrada:    p.horaEntrada    || '',
            horaSalida:     p.horaSalida     || '',
            alimentos:      !!p.alimentos,
            rutaId:         p.rutaId         || '',
            comunidadId:    p.comunidadId    || '',
            puntoReunionId: p.puntoReunionId || '',
            actualizadoPor: usuario?.uid,
          };
          t.set(doc(db, `solicitudes/${id}/pasajeros`, p.empleadoSeleccionado.nomina), pasObj);
        }

        // Guardar en el padrón la ruta confirmada (si el empleado sigue existiendo y cambió)
        for (const [empId, cambios] of Object.entries(cambiosEmp)) {
          t.update(doc(db, 'empleados', empId), cambios);
        }
      });

      parchearEmpleados(cambiosEmp);

      alert('Solicitud actualizada correctamente.');
      navigate(-1);
    } catch (err) {
      console.error(err);
      if (err.code === 'app/conflicto') toast.error(err.message, 8000);
      else alert('Error al guardar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) return <div className="flex h-64 items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin" /><span>Cargando...</span></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Operacion · Solicitudes</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Editar solicitud de transporte</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Folio: {id.slice(0,8)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b pb-2">
            <FileEdit className="h-4 w-4 text-[var(--cm-red)]" />
            <h2 className="text-sm font-semibold">Datos Generales</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mb-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Solicitante</label>
              <input type="text" required disabled={!esRH} value={solicitanteNombre} onChange={e => setSolicitanteNombre(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Fecha del Servicio</label>
              <input type="date" required min={esRH ? undefined : fechaMinima()} value={fechaServicio} onChange={e => setFechaServicio(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Comentario de la edición <span className="text-[var(--status-error-text)]">*</span></label>
            <input type="text" required={solicitud.estatus === 'aprobada' || esRH} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Motivo o detalle del cambio..." className={inputCls} />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-semibold">Padron de Pasajeros</h2>
            <span className="text-xs font-medium text-[var(--text-secondary)]">Total: <span className="text-[var(--cm-red)] font-bold text-sm">{pasajeros.length}</span></span>
          </div>
          <div className="space-y-5">
            {pasajeros.map((p, index) => {
              const reqConfirm = p.needsConfirmation && !p.isConfirmed;
              const disableRuta = reqConfirm || !p.empleadoSeleccionado;
              return (
                <div key={p.id} className="rounded-lg border bg-[var(--bg-surface-secondary)] p-4 space-y-3">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Buscar Empleado</label>
                      <input type="text" value={p.searchQuery} onChange={e => handleSearchChange(index, e.target.value)} placeholder="Escriba para buscar..." className="w-full rounded-md border px-3 py-2 text-xs" />
                      {p.showResults && p.searchQuery.length > 1 && !p.empleadoSeleccionado && (
                        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-[var(--bg-surface)] shadow-lg">
                          {(() => {
                            const q = p.searchQuery.toLowerCase();
                            const found = empleados.filter(emp => esActivo(emp) && (String(emp.nomina).includes(p.searchQuery) || (emp.nombreLower || emp.nombre?.toLowerCase() || '').includes(q))).slice(0, 10);
                            return found.length === 0 ? <div className="px-3 py-2 text-xs italic">Sin resultados</div> : found.map(emp => (
                              <div key={emp.nomina} onClick={() => handleSelectEmpleado(index, emp)} className="cursor-pointer border-b px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)]"><span className="font-bold">{emp.nomina}</span><span className="ml-1">— {emp.nombre}</span></div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => removePasajero(p.id)} disabled={pasajeros.length === 1} className="rounded-md border bg-[var(--bg-surface)] p-2 text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] disabled:opacity-40 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Puesto</label>
                      <PuestoCombobox
                        puestosExistentes={puestos}
                        value={p.puesto}
                        onChange={v => handlePuestoChange(index, v)}
                        disabled={!p.empleadoSeleccionado}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Turno</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.turno} onChange={e => updatePas(index, { turno: e.target.value })} className={inputCls}><option value="">—</option><option value="1">Turno 1</option><option value="2">Turno 2</option><option value="3">Turno 3</option><option value="TE">Tiempo Extra</option></select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Entrada</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.horaEntrada} onChange={e => updatePas(index, { horaEntrada: e.target.value })} className={inputCls}><option value="">—</option>{HORAS_ENTRADA.map(h => <option key={h} value={h}>{h}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Salida</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.horaSalida} onChange={e => updatePas(index, { horaSalida: e.target.value })} className={inputCls}><option value="">—</option>{HORAS_SALIDA.map(h => <option key={h} value={h}>{h}</option>)}</select>
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex items-center gap-2 cursor-pointer p-2 text-xs"><input type="checkbox" checked={p.alimentos} onChange={e => updatePas(index, { alimentos: e.target.checked })} className="h-3.5 w-3.5 text-[var(--cm-red)]" />Alimentos</label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Ruta</label>
                      <select required disabled={disableRuta} value={p.rutaId} onChange={e => updatePas(index, { rutaId: e.target.value, comunidadId: '', puntoReunionId: '' })} className={inputCls}><option value="">Seleccione...</option>{opcionesVigentes(rutas, p.rutaId).map(r => <option key={r.id} value={r.id}>{etiqueta(r)}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Comunidad</label>
                      <select required disabled={disableRuta || !p.rutaId} value={p.comunidadId} onChange={e => updatePas(index, { comunidadId: e.target.value, puntoReunionId: '' })} className={inputCls}><option value="">Seleccione...</option>{opcionesVigentes(comunidades.filter(c => c.rutaId === p.rutaId), p.comunidadId).map(c => <option key={c.id} value={c.id}>{etiqueta(c)}</option>)}</select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Punto</label>
                      <select required disabled={disableRuta || !p.comunidadId} value={p.puntoReunionId} onChange={e => updatePas(index, { puntoReunionId: e.target.value })} className={inputCls}><option value="">Seleccione...</option>{opcionesVigentes(puntos.filter(pt => pt.comunidadId === p.comunidadId), p.puntoReunionId).map(pt => <option key={pt.id} value={pt.id}>{etiqueta(pt)}</option>)}</select>
                    </div>
                  </div>
                  {reqConfirm && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md bg-[var(--status-warning-bg)] px-3 py-2 text-amber-800">
                      <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /><span className="text-[11px] font-medium">El empleado ya tiene datos de ruta. ¿Son correctos?</span></div>
                      <div className="flex gap-2"><button type="button" onClick={() => updatePas(index, { needsConfirmation: false })} className="border px-2 py-1 text-[10px] font-bold">Modificar</button><button type="button" onClick={() => updatePas(index, { isConfirmed: true })} className="bg-amber-600 text-white px-2 py-1 text-[10px] font-bold">Confirmar</button></div>
                    </div>
                  )}
                  {p.isConfirmed && <div className="text-[11px] text-[var(--status-success-text)] flex gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Ruta confirmada.</div>}
                  {p.empleadoSeleccionado && !p.needsConfirmation && !p.isConfirmed && (!p.rutaId || !p.comunidadId || !p.puntoReunionId) && <div className="text-[11px] flex gap-1"><Info className="h-3.5 w-3.5"/>Asigne ruta, comunidad y punto de reunion; se guardaran en el padron del empleado.</div>}
                </div>
              );
            })}
            <button type="button" onClick={addPasajero} className="border border-dashed w-full py-2 text-xs font-semibold hover:text-[var(--cm-red)] flex justify-center items-center gap-1"><Plus className="h-4 w-4" />Agregar otro pasajero</button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-[var(--text-secondary)]">Pasajeros listos: <strong>{pasajeros.filter(p => p.empleadoSeleccionado).length}</strong></div>
          <button type="submit" disabled={isSubmitting} className="bg-[var(--cm-red)] text-white px-6 py-2.5 text-sm font-semibold rounded-md flex items-center gap-2 hover:bg-[var(--cm-red-hover)] disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Actualizar Solicitud
          </button>
        </div>
      </form>
    </div>
  );
}
