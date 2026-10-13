/**
 * FormAsignacion.jsx — "Asignar rol": empleado (buscador del padrón), rol, área, vigencia y motivo.
 *
 * Solo ofrece los roles que quien asigna puede dar (admin: todos; RH y Aut. 2: aut1 y solicitante). Al elegir rol y área,
 * el buscador sugiere primero a los empleados de esa área (por areaId del padrón), ordenados por puesto, pero deja elegir a cualquiera.
 * Si la persona no tiene usuario, lo avisa y (RH/admin) ofrece crearlo.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, UserPlus, X } from 'lucide-react';
import Modal from '../../../components/Modal';
import BuscadorEmpleado from '../../../components/BuscadorEmpleado';
import {
  ROL_OP, ROL_OP_LABELS, aIsoLocal, estadoAsignacion, idAsignacion, inicioDelDia, finDelDia, motivoNoPuedeAsignar, rolesAsignables,
} from '../../../utils/asignaciones';
import { asignarRol } from '../../../utils/asignacionesDb';
import { inputCls, btnPrimary, btnSecondary, btnIcon, labelCls, etiquetaCls } from './ui';

export default function FormAsignacion({ inicial, ...resto }) {
  // Se monta solo mientras está abierto: el formulario arranca limpio cada vez
  return inicial ? <Contenido inicial={inicial} {...resto} /> : null;
}

function Contenido({ inicial, actor, areas, empleados, usuarios, asignaciones, onClose, onGuardado, onCrearUsuario }) {
  const roles = rolesAsignables(actor);
  const areasTE = areas.filter(a => a.participaTE === true && a.activa !== false);
  const [rol, setRol] = useState(roles.includes(inicial.rol) ? inicial.rol : roles[0] ?? '');
  const [areaId, setAreaId] = useState(inicial.areaId ?? '');
  const [empleado, setEmpleado] = useState(inicial.empleado ?? null);
  const [desde, setDesde] = useState(() => aIsoLocal(new Date()));
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const usaArea = rol !== ROL_OP.AUT2;
  const sugerir = usaArea && areaId ? (e => e.areaId === areaId) : null;
  const usuario = empleado && usuarios ? usuarios.find(u => String(u.nomina) === String(empleado.nomina)) : undefined;
  const sinUsuario = !!empleado && !!usuarios && !usuario;
  const nombreArea = areas.find(a => a.id === areaId)?.nombre ?? areaId;

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (!empleado) return setError('Elige a la persona.');
    const impedimento = motivoNoPuedeAsignar(actor, { rol, areaId: usaArea ? areaId : null, nominaObjetivo: empleado.nomina }, areas);
    if (impedimento) return setError(impedimento);
    if (!desde) return setError('Indica desde cuándo.');
    if (hasta && finDelDia(hasta) < inicioDelDia(desde)) return setError('"Hasta" no puede ser anterior a "Desde".');
    if (hasta && !motivo.trim()) return setError('El motivo es obligatorio cuando la asignación es temporal (tiene fecha final).');

    const id = idAsignacion(empleado.nomina, rol, usaArea ? areaId : null);
    const previa = asignaciones.find(a => a.id === id) ?? null;
    if (previa && ['vigente', 'programada'].includes(estadoAsignacion(previa))) {
      return setError('Esa persona ya tiene este rol en esa área. Usa "Extender" o "Revocar" desde la tabla.');
    }
    setGuardando(true);
    try {
      await asignarRol(actor, {
        nomina: empleado.nomina, nombre: empleado.nombre, rol, areaId: usaArea ? areaId : null, desde, hasta, motivo,
      }, previa);
      onGuardado(`${empleado.nombre}: ${ROL_OP_LABELS[rol]}${usaArea ? ` · ${nombreArea}` : ''}`);
      onClose();
    } catch (err) {
      setError('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Asignar rol" maxWidth="max-w-lg">
      <form onSubmit={guardar} className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="asig-rol" className={labelCls}>Rol</label>
            <select id="asig-rol" value={rol} onChange={e => setRol(e.target.value)} className={inputCls}>
              {roles.map(r => <option key={r} value={r}>{ROL_OP_LABELS[r]}</option>)}
            </select>
          </div>
          {usaArea && (
            <div>
              <label htmlFor="asig-area" className={labelCls}>Área</label>
              <select id="asig-area" value={areaId} onChange={e => setAreaId(e.target.value)} className={inputCls}>
                <option value="">Elige el área…</option>
                {areasTE.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className={labelCls}>Empleado</label>
          {empleado ? (
            <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-mono font-bold text-[var(--text-main)]">{empleado.nomina}</span>{' '}
                  <span className="text-[var(--text-main)]">{empleado.nombre}</span>
                  {empleado.puesto && <span className="ml-2 text-[10px] text-[var(--text-muted)]">{empleado.puesto}</span>}
                </span>
                <button type="button" onClick={() => setEmpleado(null)} className={btnIcon} title="Cambiar"><X className="h-3.5 w-3.5" /></button>
              </div>
              {usaArea && areaId && empleado.areaId && empleado.areaId !== areaId && (
                <p className="mt-1 text-[10px] text-[var(--status-warning-text)]">Esta persona es de otra área en el padrón; se puede asignar igual.</p>
              )}
              {(sinUsuario || usuario?.activo === false) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`${etiquetaCls} border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]`}>
                    {sinUsuario ? 'Sin usuario' : 'Usuario inactivo'}
                  </span>
                  {sinUsuario && onCrearUsuario && (
                    <button type="button" onClick={() => onCrearUsuario(empleado)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--cm-red)] hover:underline cursor-pointer">
                      <UserPlus className="h-3 w-3" />Crear usuario
                    </button>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)]">Sin usuario activo no podrá usar el rol.</span>
                </div>
              )}
            </div>
          ) : (
            <BuscadorEmpleado empleados={empleados} onSelect={setEmpleado} sugeridos={sugerir}
              etiquetaSugeridos={`Del área ${nombreArea}, por puesto`}
              placeholder={sugerir ? 'Sugeridos del área, o busca a cualquiera…' : 'Buscar por nombre o nómina...'} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="asig-desde" className={labelCls}>Desde</label>
            <input id="asig-desde" type="date" required value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="asig-hasta" className={labelCls}>Hasta <span className="text-[var(--text-muted)]">(vacío = permanente)</span></label>
            <input id="asig-hasta" type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="asig-motivo" className={labelCls}>Motivo {hasta ? <span className="text-[var(--status-error-text)]">(obligatorio)</span> : <span className="text-[var(--text-muted)]">(opcional)</span>}</label>
          <input id="asig-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} placeholder="ej. Cubre vacaciones del titular" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={guardando} className={btnPrimary}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Asignar
          </button>
        </div>
      </form>
    </Modal>
  );
}
