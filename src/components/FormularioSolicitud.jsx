/**
 * FormularioSolicitud.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Formulario compartido de solicitud de transporte (alta y edición).
 * Cabecera: fecha de servicio y solicitante (bloqueado salvo RH); en edición, comentario del cambio.
 * Por pasajero: empleado, puesto, turno, entrada, salida, alimentos, ruta, comunidad y punto.
 *
 * Solo maneja el formulario: valida y entrega los datos a `onSubmit`; guardar en Firestore
 * es cosa de quien lo usa (NuevaSolicitud / EditarSolicitud).
 *
 * Props:
 *   modo                  'nueva' | 'editar'
 *   esRH                  true si el usuario es RH/admin
 *   catalogos             { rutas, comunidades, puntos, empleados }
 *   inicial               { fechaServicio, solicitanteNombre, pasajeros? } (solo se lee al montar)
 *   comentarioObligatorio (editar) exige el comentario del cambio
 *   enviando              deshabilita el botón mientras se guarda
 *   onSubmit({ fechaServicio, solicitanteNombre, comentario, pasajeros, puestos })
 */
import { useMemo, useState } from 'react';
import {
  FilePlus, FileEdit, Plus, Trash2, CheckCircle2, AlertCircle, Save, MapPin,
} from 'lucide-react';
import PuestoCombobox from './PuestoCombobox';
import { useToast } from '../hooks/useToast';
import { derivarPuestos, existePuesto } from '../utils/puestos';
import { esActivo, opcionesVigentes, rutaVigente } from '../utils/activo';
import {
  MAX_PASAJEROS, MSG_MAX_PASAJEROS, HORAS_ENTRADA, HORAS_SALIDA, TURNOS,
  fechaMinima, pasajeroVacio, validarSolicitud,
} from '../utils/solicitudes';
import { formatoHora12 } from '../utils/horas';
import Boton from './ui/Boton';
import { CASILLA, CONTROL, CONTROL_OK } from './ui/estilos';

const inputCls = `${CONTROL} ${CONTROL_OK} py-2`;
const labelCls = 'mb-1 block text-xs font-medium text-[var(--text-secondary)]';

export default function FormularioSolicitud({
  modo = 'nueva', esRH = false, catalogos, inicial, comentarioObligatorio = false, enviando = false, onSubmit,
}) {
  const toast = useToast();
  const { rutas, comunidades, puntos, empleados } = catalogos;
  const esEdicion = modo === 'editar';

  const [fechaServicio, setFechaServicio] = useState(inicial.fechaServicio ?? '');
  const [solicitanteNombre, setSolicitanteNombre] = useState(inicial.solicitanteNombre ?? '');
  const [comentario, setComentario] = useState('');
  const [pasajeros, setPasajeros] = useState(() => (inicial.pasajeros?.length ? inicial.pasajeros : [pasajeroVacio()]));

  // Puestos únicos derivados del padrón, más los nuevos que se creen en el combobox
  const [puestosNuevos, setPuestosNuevos] = useState([]);
  const puestos = useMemo(
    () => [...derivarPuestos(empleados), ...puestosNuevos].sort((a, b) => a.localeCompare(b, 'es')),
    [empleados, puestosNuevos]
  );

  const addPasajero = () => {
    if (pasajeros.length >= MAX_PASAJEROS) return toast.error(MSG_MAX_PASAJEROS);
    setPasajeros(prev => [...prev, pasajeroVacio()]);
  };
  const removePasajero = (id) => { if (pasajeros.length > 1) setPasajeros(prev => prev.filter(p => p.id !== id)); };

  const updatePas = (index, fields) =>
    setPasajeros(prev => prev.map((p, i) => (i === index ? { ...p, ...fields } : p)));

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
      toast.warning('Este empleado ya fue agregado.');
      return;
    }
    // Lo que esté inactivo en el directorio no se precarga: se pedirá de nuevo.
    // Si tiene ruta completa pre-asignada se pide confirmación.
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

  // Agregar un puesto nuevo a la lista cuando se crea en el combobox
  const handlePuestoChange = (index, nuevoPuesto) => {
    updatePas(index, { puesto: nuevoPuesto });
    if (nuevoPuesto && !existePuesto(nuevoPuesto, puestos)) {
      setPuestosNuevos(prev => [...prev, nuevoPuesto]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validarSolicitud({ fechaServicio, pasajeros, comentario, comentarioObligatorio });
    if (error) return toast.warning(error);
    onSubmit({ fechaServicio, solicitanteNombre, comentario, pasajeros, puestos });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      {/* ── Cabecera ─────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          {esEdicion ? <FileEdit className="h-4 w-4 text-[var(--accent-text)]" /> : <FilePlus className="h-4 w-4 text-[var(--accent-text)]" />}
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Datos Generales</h2>
        </div>
        <div className="grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Solicitante</label>
            <input type="text" required disabled={!esRH} value={solicitanteNombre}
              onChange={e => setSolicitanteNombre(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Fecha del Servicio</label>
            {/* En edición, RH puede dejar fechas pasadas; el resto no */}
            <input type="date" required min={esEdicion && esRH ? undefined : fechaMinima()} value={fechaServicio}
              onChange={e => setFechaServicio(e.target.value)} className={inputCls} />
            {!esEdicion && <p className="mt-1 text-xs text-[var(--text-muted)]">Solo fechas a partir de manana.</p>}
          </div>
        </div>
        {esEdicion && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Comentario de la edición <span className="text-[var(--status-error-text)]">*</span>
            </label>
            <input type="text" required={comentarioObligatorio} value={comentario}
              onChange={e => setComentario(e.target.value)} placeholder="Motivo o detalle del cambio..." className={inputCls} />
          </div>
        )}
      </div>

      {/* ── Pasajeros ─────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <h2 className="text-sm font-semibold text-[var(--text-main)]">Padron de Pasajeros</h2>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Total: <span className="text-sm font-semibold text-[var(--accent-text)]">{pasajeros.length}</span>
          </span>
        </div>

        <div className="space-y-5">
          {pasajeros.map((p, index) => {
            const reqConfirm = p.needsConfirmation && !p.isConfirmed;
            const disableRuta = reqConfirm || !p.empleadoSeleccionado;

            return (
              <div key={p.id} className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-4">
                {/* Fila 1: búsqueda + eliminar */}
                <div className="flex items-end gap-3">
                  <div className="relative flex-1">
                    <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                      Buscar Empleado (Nomina o Nombre)
                    </label>
                    <input
                      type="text"
                      value={p.searchQuery}
                      onChange={e => handleSearchChange(index, e.target.value)}
                      placeholder="Escriba para buscar..."
                      className={inputCls}
                    />
                    {p.showResults && p.searchQuery.length > 1 && !p.empleadoSeleccionado && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
                        {(() => {
                          const q = p.searchQuery.toLowerCase();
                          const found = empleados.filter(emp =>
                            esActivo(emp) && (
                              String(emp.nomina).includes(p.searchQuery) ||
                              (emp.nombreLower || emp.nombre?.toLowerCase() || '').includes(q)
                            )
                          ).slice(0, 10);
                          return found.length === 0
                            ? <div className="px-3 py-2 text-xs italic text-[var(--text-muted)]">Sin resultados</div>
                            : found.map(emp => (
                              <div key={emp.nomina} onClick={() => handleSelectEmpleado(index, emp)}
                                className="cursor-pointer border-b border-[var(--border-subtle)] px-3 py-2 text-xs last:border-0 hover:bg-[var(--bg-surface-secondary)]">
                                <span className="font-semibold text-[var(--text-main)]">{emp.nomina}</span>
                                <span className="ml-1 text-[var(--text-secondary)]">— {emp.nombre}</span>
                              </div>
                            ));
                        })()}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => removePasajero(p.id)}
                    disabled={pasajeros.length === 1}
                    aria-label="Quitar pasajero"
                    className="cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 text-[var(--status-error-text)] transition-colors hover:bg-[var(--status-error-bg)] active:scale-95 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Fila 2: puesto / turno / horarios / alimentos */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  <div>
                    <label className={labelCls}>Area / Puesto</label>
                    <PuestoCombobox
                      puestosExistentes={puestos}
                      value={p.puesto}
                      onChange={v => handlePuestoChange(index, v)}
                      disabled={!p.empleadoSeleccionado}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Turno</label>
                    <select required disabled={!p.empleadoSeleccionado} value={p.turno}
                      onChange={e => updatePas(index, { turno: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Entrada</label>
                    <select required disabled={!p.empleadoSeleccionado} value={p.horaEntrada}
                      onChange={e => updatePas(index, { horaEntrada: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {HORAS_ENTRADA.map(h => <option key={h} value={h}>{formatoHora12(h)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Salida</label>
                    <select required disabled={!p.empleadoSeleccionado} value={p.horaSalida}
                      onChange={e => updatePas(index, { horaSalida: e.target.value })} className={inputCls}>
                      <option value="">—</option>
                      {HORAS_SALIDA.map(h => <option key={h} value={h}>{formatoHora12(h)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface)]">
                      <input type="checkbox" checked={p.alimentos}
                        onChange={e => updatePas(index, { alimentos: e.target.checked })}
                        className={CASILLA} />
                      Alimentos
                    </label>
                  </div>
                </div>

                {/* Fila 3: ruta / comunidad / punto — obligatorios para enviar */}
                <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    <MapPin className="h-3 w-3" />Ruta de transporte <span className="text-[var(--status-error-text)]">(obligatorio)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelCls}>Ruta</label>
                      <select required disabled={disableRuta} value={p.rutaId}
                        onChange={e => updatePas(index, { rutaId: e.target.value, comunidadId: '', puntoReunionId: '' })}
                        className={inputCls}>
                        <option value="">Seleccione...</option>
                        {opcionesVigentes(rutas, p.rutaId).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Comunidad / Colonia</label>
                      <select required disabled={disableRuta || !p.rutaId} value={p.comunidadId}
                        onChange={e => updatePas(index, { comunidadId: e.target.value, puntoReunionId: '' })}
                        className={inputCls}>
                        <option value="">Seleccione...</option>
                        {opcionesVigentes(comunidades.filter(c => c.rutaId === p.rutaId), p.comunidadId)
                          .map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Punto de Reunion</label>
                      <select required disabled={disableRuta || !p.comunidadId} value={p.puntoReunionId}
                        onChange={e => updatePas(index, { puntoReunionId: e.target.value })}
                        className={inputCls}>
                        <option value="">Seleccione...</option>
                        {opcionesVigentes(puntos.filter(pt => pt.comunidadId === p.comunidadId), p.puntoReunionId)
                          .map(pt => <option key={pt.id} value={pt.id}>{pt.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Confirmación de ruta pre-existente */}
                {reqConfirm && (
                  <div className="flex flex-col justify-between gap-3 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[var(--status-warning-text)] sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium">El empleado ya tiene datos de ruta asignados. Son correctos?</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => updatePas(index, { needsConfirmation: false })}
                        className="cursor-pointer rounded border border-[var(--status-warning-border)] px-2 py-1 text-xs font-semibold transition-colors hover:opacity-80">
                        Modificar
                      </button>
                      <button type="button" onClick={() => updatePas(index, { isConfirmed: true })}
                        className="flex cursor-pointer items-center gap-1 rounded bg-[var(--status-warning-text)] px-2 py-1 text-xs font-semibold text-white transition-colors hover:opacity-90">
                        <CheckCircle2 className="h-3 w-3" />Confirmar
                      </button>
                    </div>
                  </div>
                )}
                {p.isConfirmed && (
                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--status-success-text)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />Datos de ruta confirmados.
                  </div>
                )}
                {p.empleadoSeleccionado && !p.needsConfirmation && !p.isConfirmed && (!p.rutaId || !p.comunidadId || !p.puntoReunionId) && (
                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)]">
                    <MapPin className="h-3.5 w-3.5" />Asigne ruta, comunidad y punto de reunion; se guardaran en el padron del empleado.
                  </div>
                )}
              </div>
            );
          })}

          <Boton className="w-full border-dashed" icono={Plus} onClick={addPasajero}>Agregar otro pasajero</Boton>
        </div>
      </div>

      {/* Pie */}
      <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-4">
        <div className="text-sm text-[var(--text-secondary)]">
          Pasajeros listos: <strong className="text-[var(--text-main)]">{pasajeros.filter(p => p.empleadoSeleccionado).length}</strong>
        </div>
        <Boton type="submit" variante="primario" icono={Save} estado={enviando ? 'cargando' : undefined}>{esEdicion ? 'Actualizar solicitud' : 'Registrar solicitud'}</Boton>
      </div>
    </form>
  );
}
