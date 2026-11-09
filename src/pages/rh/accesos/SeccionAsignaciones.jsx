/**
 * SeccionAsignaciones.jsx — «Asignaciones» de una persona dentro de la edición de su usuario: lista de lo que tiene hoy (vigente o programado)
 * con un botón para quitar cada una, y «+ Agregar asignación» (tipo, área si aplica, desde/hasta opcionales).
 *
 * Es la misma lógica que la pantalla Asignaciones: mismo documento asignaciones/{nomina}_{rol}_{area}, mismas validaciones
 * (validarNuevaAsignacion), mismo control de quién puede dar qué (rolesAsignables; admin todo, RH y Aut. 2 solo Aut. 1 y Solicitante) y
 * cada cambio deja su renglón en la bitácora (asignarRol y revocarAsignacion). Cada acción se guarda al momento, no con «Guardar cambios».
 * La lista es en vivo: las asignaciones llegan por el hook useAsignaciones de la pantalla.
 */
import { useState } from 'react';
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import {
  ROL_OP, ROL_OP_LABELS, ROLES_OP, aIsoLocal, estadoAsignacion, etiquetaAsignacion, formatoFecha, rolesAsignables, validarNuevaAsignacion,
} from '../../../utils/asignaciones';
import { asignarRol, revocarAsignacion } from '../../../utils/asignacionesDb';
import { btnIcon, btnPrimary, btnSecondary, inputCls, labelCls } from './ui';

export default function SeccionAsignaciones({ persona, asignaciones, areas, actor, nombresArea, ahora }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const roles = rolesAsignables(actor);
  const areasTE = areas.filter(a => a.participaTE === true && a.activa !== false);
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState(roles[0] ?? '');
  const [areaId, setAreaId] = useState('');
  const [desde, setDesde] = useState(() => aIsoLocal(new Date()));
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const delaPersona = asignaciones
    .filter(a => String(a.nomina) === String(persona.nomina) && ['vigente', 'programada'].includes(estadoAsignacion(a, ahora)))
    .sort((a, b) => ROLES_OP.indexOf(a.rol) - ROLES_OP.indexOf(b.rol));
  const puedeActuar = (a) => roles.includes(a.rol) && (actor.esAdmin || String(a.nomina) !== String(actor.nomina));
  const usaArea = rol !== ROL_OP.AUT2;

  const cerrarForm = () => { setAbierto(false); setError(''); setAreaId(''); setHasta(''); setMotivo(''); setDesde(aIsoLocal(new Date())); };

  const agregar = async () => {
    setError('');
    const desdeEf = desde || aIsoLocal(new Date()); // «Desde» es opcional: vacío = hoy
    const { error: invalida, previa } = validarNuevaAsignacion({ actor, persona, rol, areaId, desde: desdeEf, hasta, motivo, areas, asignaciones, ahora });
    if (invalida) return setError(invalida);
    setGuardando(true);
    try {
      await asignarRol(actor, {
        nomina: persona.nomina, nombre: persona.nombre, puesto: persona.puesto ?? '', puestoId: persona.puestoId ?? '', rol, areaId: usaArea ? areaId : null,
        desde: desdeEf, hasta, motivo,
      }, previa);
      toast.success(`${persona.nombre}: ${ROL_OP_LABELS[rol]}${usaArea ? ` · ${nombresArea.get(areaId) ?? areaId}` : ''}`);
      cerrarForm();
    } catch (err) {
      setError('No se pudo guardar: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (a) => {
    if (!await confirmar({
      titulo: 'Quitar asignación',
      mensaje: `¿Quitar ${etiquetaAsignacion(a, nombresArea)} a ${persona.nombre}? Deja de tener el permiso de inmediato; el registro se conserva.`,
      textoConfirmar: 'Quitar', peligroso: true,
    })) return;
    try {
      await revocarAsignacion(actor, a);
      toast.success('Asignación quitada.');
    } catch (err) { toast.error('No se pudo quitar: ' + err.message); }
  };

  return (
    <fieldset className="space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3" data-seccion="asignaciones">
      <legend className="px-1 text-xs font-medium text-[var(--text-secondary)]">Asignaciones (Aut. 2, Aut. 1, Solicitante)</legend>
      {delaPersona.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">Sin asignación: por ahora solo ve su Inicio y su cuenta.</p>
      ) : (
        <ul className="space-y-1.5">
          {delaPersona.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs">
              <span className="min-w-0 text-[var(--text-main)]">
                <b className="font-medium">{etiquetaAsignacion(a, nombresArea)}</b>
                {estadoAsignacion(a, ahora) === 'programada' && <span className="ml-1.5 text-[var(--text-muted)]">empieza el {formatoFecha(a.desde)}</span>}
              </span>
              {puedeActuar(a) && (
                <button type="button" onClick={() => quitar(a)} className={btnIcon} title="Quitar esta asignación" aria-label={`Quitar ${etiquetaAsignacion(a, nombresArea)}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {roles.length > 0 && !abierto && (
        <button type="button" id="btn-usr-agregar-asignacion" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">
          <Plus className="h-3.5 w-3.5" />Agregar asignación
        </button>
      )}

      {abierto && (
        <div className="space-y-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{error}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="usr-asig-rol" className={labelCls}>Tipo</label>
              <select id="usr-asig-rol" value={rol} onChange={e => setRol(e.target.value)} className={inputCls}>
                {roles.map(r => <option key={r} value={r}>{ROL_OP_LABELS[r]}</option>)}
              </select>
            </div>
            {usaArea && (
              <div>
                <label htmlFor="usr-asig-area" className={labelCls}>Área</label>
                <select id="usr-asig-area" value={areaId} onChange={e => setAreaId(e.target.value)} className={inputCls}>
                  <option value="">Elige el área…</option>
                  {areasTE.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="usr-asig-desde" className={labelCls}>Desde <span className="text-[var(--text-muted)]">(opcional)</span></label>
              <input id="usr-asig-desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="usr-asig-hasta" className={labelCls}>Hasta <span className="text-[var(--text-muted)]">(vacío = permanente)</span></label>
              <input id="usr-asig-hasta" type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} className={inputCls} />
            </div>
          </div>
          {hasta && (
            <div>
              <label htmlFor="usr-asig-motivo" className={labelCls}>Motivo <span className="text-[var(--status-error-text)]">(obligatorio)</span></label>
              <input id="usr-asig-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={inputCls} placeholder="ej. Cubre vacaciones del titular" />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cerrarForm} disabled={guardando} className={btnSecondary}>Cancelar</button>
            <button type="button" id="btn-usr-confirmar-asignacion" onClick={agregar} disabled={guardando} className={btnPrimary}>
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Agregar
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)]">Se guarda al momento y queda en la bitácora. Aut. 2 solo la da un administrador.</p>
    </fieldset>
  );
}
