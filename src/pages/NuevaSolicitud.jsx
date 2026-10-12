/**
 * NuevaSolicitud.jsx
 * Formulario de solicitud de transporte.
 * Cabecera: solo Fecha de Servicio y Solicitante (locked para superintendente).
 * Por pasajero: Área/Puesto, Turno, Entrada, Salida, Alimentos, Ruta, Comunidad, Punto.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  FilePlus, Plus, Trash2, CheckCircle2, AlertCircle,
  Save, Loader2, MapPin,
} from 'lucide-react';
import PuestoCombobox from '../components/PuestoCombobox';
import { derivarPuestos, existePuesto, canonizarPuesto } from '../utils/puestos';
import { esActivo, rutaVigente } from '../utils/activo';
import { useToast } from '../components/Toast';

// Calcula la fecha mínima = hoy en formato YYYY-MM-DD (local, sin desfase TZ)
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

export default function NuevaSolicitud() {
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rutas, setRutas]       = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos]     = useState([]);
  const [empleados, setEmpleados] = useState([]);
  // Lista de puestos unicos derivada del padron — se actualiza al agregar uno nuevo
  const [puestosLista, setPuestosLista] = useState([]);

  const [fechaServicio, setFechaServicio] = useState('');
  const [solicitanteNombre, setSolicitanteNombre] = useState(usuario?.nombre || '');

  const [pasajeros, setPasajeros] = useState([pasViejo()]);

  // Pre-llenar nombre cuando carga el contexto de auth
  useEffect(() => {
    if (usuario?.nombre && !solicitanteNombre) setSolicitanteNombre(usuario.nombre);
  }, [usuario?.nombre]);

  // Carga catálogos
  useEffect(() => {
    async function fetchData() {
      const safe = async (col) => {
        try { return await getDocs(collection(db, col)); }
        catch (err) {
          toast.error(err.code === 'permission-denied' ? `Sin permiso para leer ${col}.` : `Error al leer ${col}: ${err.message}`);
          return { docs: [] };
        }
      };
      const [sRutas, sComs, sPuntos, sEmp] = await Promise.all([
        safe('rutas'), safe('comunidades'), safe('puntosReunion'), safe('empleados'),
      ]);
      const listaEmp = sEmp.docs.map(d => ({ id: d.id, ...d.data() })).filter(esActivo);
      setEmpleados(listaEmp);
      setPuestosLista(derivarPuestos(listaEmp));
      // Solo elementos activos del directorio
      setRutas(sRutas.docs.map(d => ({ id: d.id, ...d.data() })).filter(esActivo));
      setComunidades(sComs.docs.map(d => ({ id: d.id, ...d.data() })).filter(esActivo));
      setPuntos(sPuntos.docs.map(d => ({ id: d.id, ...d.data() })).filter(esActivo));
      setIsLoadingData(false);
    }
    fetchData();
  }, []);

  const addPasajero = () => setPasajeros(prev => [...prev, pasViejo()]);
  const removePasajero = (id) => { if (pasajeros.length > 1) setPasajeros(prev => prev.filter(p => p.id !== id)); };

  const updatePas = (index, fields) =>
    setPasajeros(prev => prev.map((p, i) => i === index ? { ...p, ...fields } : p));

  const handleSearchChange = (index, val) => {
    updatePas(index, {
      searchQuery: val,
      showResults: true,
      empleadoSeleccionado: null,
      needsConfirmation: false,
      isConfirmed: false,
      rutaId: '', comunidadId: '', puntoReunionId: '',
    });
  };

  const handleSelectEmpleado = (index, emp) => {
    if (pasajeros.some((p, i) => i !== index && p.empleadoSeleccionado?.nomina === emp.nomina)) {
      alert('Este empleado ya fue agregado.'); return;
    }
    // Tiene ruta completa pre-asignada => pedir confirmacion
    // Lo que esté inactivo en el directorio no se precarga: se pedirá de nuevo
    const ruta = rutaVigente(emp, { rutas, comunidades, puntos });
    const tieneRutaCompleta = ruta.rutaId && ruta.comunidadId && ruta.puntoReunionId;
    updatePas(index, {
      empleadoSeleccionado: emp,
      searchQuery: `${emp.nomina} - ${emp.nombre}`,
      showResults: false,
      puesto: emp.puesto || '',
      ...ruta,
      needsConfirmation: !!tieneRutaCompleta,
      isConfirmed: false,
    });
  };

  // Agregar un puesto nuevo a la lista global cuando se crea en el combobox
  const handlePuestoChange = (index, nuevoPuesto) => {
    updatePas(index, { puesto: nuevoPuesto });
    if (nuevoPuesto && !existePuesto(nuevoPuesto, puestosLista)) {
      setPuestosLista(prev => [...prev, nuevoPuesto].sort((a, b) => a.localeCompare(b, 'es')));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fechaServicio) return alert('Selecciona la fecha del servicio.');

    const invalido = pasajeros.find(p =>
      !p.empleadoSeleccionado ||
      !p.puesto ||
      !p.turno ||
      !p.horaEntrada ||
      !p.horaSalida ||
      !p.rutaId ||
      !p.comunidadId ||
      !p.puntoReunionId ||
      (p.needsConfirmation && !p.isConfirmed)
    );
    if (invalido) return alert('Completa todos los campos de cada pasajero.');

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      const solId  = doc(collection(db, 'solicitudes')).id;
      const solRef = doc(db, 'solicitudes', solId);

      // Documento padre — mínimo
      const solDoc = {
        fechaSolicitud:   new Date().toISOString(),
        fechaServicio,
        solicitanteNombre: solicitanteNombre || usuario?.nombre || '',
        creadoPor:         usuario?.uid,
        estatus:           'pendiente',
        totalPasajeros:    pasajeros.length,
        historial: [{
          fecha: new Date().toISOString(),
          usuario: usuario?.nombre || '',
          accion: 'creada',
          comentario: 'Solicitud creada.'
        }]
      };
      batch.set(solRef, solDoc);

      for (const p of pasajeros) {
        const pasObj = {
          nomina:         p.empleadoSeleccionado.nomina,
          nombre:         p.empleadoSeleccionado.nombre,
          puesto:         canonizarPuesto(p.puesto, puestosLista),
          turno:          p.turno          || '',
          horaEntrada:    p.horaEntrada    || '',
          horaSalida:     p.horaSalida     || '',
          alimentos:      !!p.alimentos,
          rutaId:         p.rutaId         || '',
          comunidadId:    p.comunidadId    || '',
          puntoReunionId: p.puntoReunionId || '',
          creadoPor:      usuario?.uid,
        };
        const pasRef = doc(db, `solicitudes/${solId}/pasajeros`, p.empleadoSeleccionado.nomina);
        batch.set(pasRef, pasObj);

        // Guardar en el padrón la ruta confirmada, solo si cambió
        const emp = p.empleadoSeleccionado;
        if (emp.rutaId !== p.rutaId || emp.comunidadId !== p.comunidadId || emp.puntoReunionId !== p.puntoReunionId) {
          batch.update(doc(db, 'empleados', emp.id), {
            rutaId:         p.rutaId         || '',
            comunidadId:    p.comunidadId    || '',
            puntoReunionId: p.puntoReunionId || '',
          });
        }
      }

      await batch.commit();
      alert('Solicitud registrada correctamente.');
      navigate('/mis-solicitudes');
    } catch (err) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-[var(--text-secondary)]">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Cargando datos maestros...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Encabezado */}
      <div className="border-b border-[var(--border-color)] pb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Operacion · Solicitudes</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Nueva solicitud de transporte</h1>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Complete los campos para programar el servicio. Solicitante: <span className="font-semibold">{usuario?.nombre}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        {/* ── Cabecera limpia ─────────────────────────────── */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
            <FilePlus className="h-4 w-4 text-[var(--cm-red)]" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Datos Generales</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Solicitante</label>
              <input
                type="text" required
                disabled={usuario?.rol === 'superintendente'}
                value={solicitanteNombre}
                onChange={e => setSolicitanteNombre(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Fecha del Servicio</label>
              <input
                type="date" required
                min={fechaMinima()}
                value={fechaServicio}
                onChange={e => setFechaServicio(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Solo fechas a partir de manana.</p>
            </div>
          </div>
        </div>

        {/* ── Pasajeros ─────────────────────────────────── */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Padron de Pasajeros</h2>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Total: <span className="text-[var(--cm-red)] font-bold text-sm">{pasajeros.length}</span>
            </span>
          </div>

          <div className="space-y-5">
            {pasajeros.map((p, index) => {
              const reqConfirm = p.needsConfirmation && !p.isConfirmed;
              const disableRuta = reqConfirm || !p.empleadoSeleccionado;

              return (
                <div key={p.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4 space-y-3">
                  {/* Fila 1: busqueda + eliminar */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Buscar Empleado (Nomina o Nombre)
                      </label>
                      <input
                        type="text"
                        value={p.searchQuery}
                        onChange={e => handleSearchChange(index, e.target.value)}
                        placeholder="Escriba para buscar..."
                        className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-xs focus:border-[var(--cm-red)] focus:outline-none focus:ring-1 focus:ring-[var(--cm-red)]"
                      />
                      {p.showResults && p.searchQuery.length > 1 && !p.empleadoSeleccionado && (
                        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg">
                          {(() => {
                            const q = p.searchQuery.toLowerCase();
                            const found = empleados.filter(emp =>
                              String(emp.nomina).includes(p.searchQuery) ||
                              (emp.nombreLower || emp.nombre?.toLowerCase() || '').includes(q)
                            ).slice(0, 10);
                            return found.length === 0
                              ? <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">Sin resultados</div>
                              : found.map(emp => (
                                <div key={emp.nomina} onClick={() => handleSelectEmpleado(index, emp)}
                                  className="cursor-pointer border-b border-[var(--border-subtle)] px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)] last:border-0">
                                  <span className="font-bold text-[var(--text-main)]">{emp.nomina}</span>
                                  <span className="text-[var(--text-secondary)] ml-1">— {emp.nombre}</span>
                                </div>
                              ));
                          })()}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => removePasajero(p.id)}
                      disabled={pasajeros.length === 1}
                      className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)] disabled:opacity-40 transition-colors cursor-pointer active:scale-95">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Fila 2: Area/Turno/Horarios/Alimentos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Area / Puesto</label>
                      <PuestoCombobox
                        puestosExistentes={puestosLista}
                        value={p.puesto}
                        onChange={v => handlePuestoChange(index, v)}
                        disabled={!p.empleadoSeleccionado}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Turno</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.turno}
                        onChange={e => updatePas(index, { turno: e.target.value })}
                        className={inputCls}>
                        <option value="">—</option>
                        <option value="1">Turno 1</option>
                        <option value="2">Turno 2</option>
                        <option value="3">Turno 3</option>
                        <option value="TE">Tiempo Extra</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Entrada</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.horaEntrada}
                        onChange={e => updatePas(index, { horaEntrada: e.target.value })}
                        className={inputCls}>
                        <option value="">—</option>
                        {HORAS_ENTRADA.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Salida</label>
                      <select required disabled={!p.empleadoSeleccionado} value={p.horaSalida}
                        onChange={e => updatePas(index, { horaSalida: e.target.value })}
                        className={inputCls}>
                        <option value="">—</option>
                        {HORAS_SALIDA.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-[var(--bg-surface)] transition-colors text-xs font-medium text-[var(--text-main)]">
                        <input type="checkbox" checked={p.alimentos}
                          onChange={e => updatePas(index, { alimentos: e.target.checked })}
                          className="h-3.5 w-3.5 rounded text-[var(--cm-red)] focus:ring-[var(--cm-red)]" />
                        Alimentos
                      </label>
                    </div>
                  </div>

                  {/* Fila 3: Ruta / Comunidad / Punto — obligatorios para enviar */}
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                      <MapPin className="h-3 w-3" />Ruta de transporte <span className="text-[var(--status-error-text)]">(obligatorio)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Ruta</label>
                        <select required disabled={disableRuta} value={p.rutaId}
                          onChange={e => updatePas(index, { rutaId: e.target.value, comunidadId: '', puntoReunionId: '' })}
                          className={inputCls}>
                          <option value="">Seleccione...</option>
                          {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Comunidad / Colonia</label>
                        <select required disabled={disableRuta || !p.rutaId} value={p.comunidadId}
                          onChange={e => updatePas(index, { comunidadId: e.target.value, puntoReunionId: '' })}
                          className={inputCls}>
                          <option value="">Seleccione...</option>
                          {comunidades.filter(c => c.rutaId === p.rutaId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">Punto de Reunion</label>
                        <select required disabled={disableRuta || !p.comunidadId} value={p.puntoReunionId}
                          onChange={e => updatePas(index, { puntoReunionId: e.target.value })}
                          className={inputCls}>
                          <option value="">Seleccione...</option>
                          {puntos.filter(pt => pt.comunidadId === p.comunidadId).map(pt => <option key={pt.id} value={pt.id}>{pt.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Confirmacion de ruta pre-existente */}
                  {reqConfirm && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] px-3 py-2 text-[var(--status-warning-text)]">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="text-[11px] font-medium">El empleado ya tiene datos de ruta asignados. Son correctos?</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => updatePas(index, { needsConfirmation: false })}
                          className="rounded border border-[var(--status-warning-border)] px-2 py-1 text-[10px] font-bold uppercase hover:opacity-80 transition-colors cursor-pointer">
                          Modificar
                        </button>
                        <button type="button" onClick={() => updatePas(index, { isConfirmed: true })}
                          className="flex items-center gap-1 rounded bg-[var(--status-warning-text)] px-2 py-1 text-[10px] font-bold uppercase text-white hover:opacity-90 transition-colors cursor-pointer">
                          <CheckCircle2 className="h-3 w-3" />Confirmar
                        </button>
                      </div>
                    </div>
                  )}
                  {p.isConfirmed && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--status-success-text)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />Datos de ruta confirmados.
                    </div>
                  )}
                  {p.empleadoSeleccionado && !p.needsConfirmation && !p.isConfirmed && (!p.rutaId || !p.comunidadId || !p.puntoReunionId) && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                      <MapPin className="h-3.5 w-3.5" />Asigne ruta, comunidad y punto de reunion; se guardaran en el padron del empleado.
                    </div>
                  )}
                </div>
              );
            })}

            <button type="button" onClick={addPasajero}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--cm-red)] hover:text-[var(--cm-red)] transition-colors w-full justify-center cursor-pointer active:scale-95">
              <Plus className="h-4 w-4" />Agregar otro pasajero
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
          <div className="text-sm text-[var(--text-secondary)]">
            Pasajeros listos: <strong className="text-[var(--text-main)]">{pasajeros.filter(p => p.empleadoSeleccionado).length}</strong>
          </div>
          <button type="submit" disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--cm-red)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--cm-red)] focus:ring-offset-2 transition-all disabled:opacity-50 cursor-pointer">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Registrar Solicitud
          </button>
        </div>
      </form>
    </div>
  );
}
