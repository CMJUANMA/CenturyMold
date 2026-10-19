/**
 * ConfirmarAreas.jsx — Paso "Confirmar áreas" de la importación del padrón (después de resolver los puestos,
 * antes de guardar). Lista los empleados del archivo agrupados por área; RH revisa, ajusta y confirma cada grupo.
 *
 * El componente no guarda nada: avisa al modal (onAjustePersona / onAjustePuesto / onQuitarExcepcion / onConfirmar)
 * y el modal recalcula el plan. Una confirmación solo vale mientras el grupo no cambie (ver `firma`).
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import {
  FILTROS_AREA, GRUPO_SIN_AREA, impactoPuesto, motivoExcepcionPorDefecto, resumenLista,
} from '../../utils/areasImportacion';
import { inputCls } from './estructura/ui';
import { claseBoton } from '../../components/ui/Boton';
import Modal from '../../components/Modal';

const btn = 'inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnRojo = claseBoton('primario', 'sm');
const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent-text)]';
const insignia = 'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap';
const TONO = {
  nuevo: 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  cambia: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  sinCambio: 'border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)]',
};
const ETIQUETA = { nuevo: 'Nuevo', cambia: 'Cambia de área', sinCambio: 'Sin cambio' };
const FILTROS = [['todos', 'Todos'], ['nuevos', 'Nuevos'], ['cambian', 'Cambian de área'], ['sinArea', 'Sin área']];

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const textoFila = (i) => sinAcentos([i.clave, i.nombre, i.puestoNombre, i.areaNombre, i.areaAnteriorNombre, i.excepcion?.motivo].join(' '));
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Diálogo al cambiar el área de una fila: solo esta persona, o todo el puesto */
function DialogoCambio({ plan, dialogo, areas, empleadosBase, onCancelar, onAplicar }) {
  const { item, areaId } = dialogo;
  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? id ?? '';
  const puedePuesto = !item.excepcion; // con excepción solo se cambia la persona: el puesto no la mueve
  const [modo, setModo] = useState('persona');
  const [motivo, setMotivo] = useState(item.excepcion?.motivo && item.excepcion.areaId === areaId ? item.excepcion.motivo : motivoExcepcionPorDefecto());
  const impacto = useMemo(() => impactoPuesto(plan, item, areaId, empleadosBase), [plan, item, areaId, empleadosBase]);
  const vuelveAlPuesto = areaId === item.areaPuestoId;

  return (
    <Modal isOpen onClose={onCancelar} title={`Cambiar área de ${item.nombre}`} maxWidth="max-w-lg">
      <div className="space-y-3 text-xs">
        <p className="text-[var(--text-secondary)]">
          {item.puestoNombre} · <span className="font-semibold">{nombreArea(item.areaId) || 'Sin área'}</span> → <span className="font-semibold text-[var(--text-main)]">{nombreArea(areaId)}</span>
        </p>

        <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${modo === 'persona' ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)]' : 'border-[var(--border-color)]'}`}>
          <input type="radio" name="modo-cambio" checked={modo === 'persona'} onChange={() => setModo('persona')} className="mt-0.5 accent-[var(--accent)]" />
          <span className="space-y-1.5">
            <span className="block font-semibold text-[var(--text-main)]">Solo esta persona</span>
            {vuelveAlPuesto
              ? <span className="block text-[var(--text-secondary)]">Es el área de su puesto: se quita la excepción y vuelve al área del puesto.</span>
              : (
                <>
                  <span className="block text-[var(--text-secondary)]">Se crea una excepción: la importación ya no moverá a esta persona.</span>
                  <label className="block">
                    <span className="text-[var(--text-secondary)]">Motivo</span>
                    <input value={motivo} onChange={e => setMotivo(e.target.value)} disabled={modo !== 'persona'} className={`${campo} mt-0.5 block w-full`} />
                  </label>
                </>
              )}
          </span>
        </label>

        {puedePuesto && (
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${modo === 'puesto' ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)]' : 'border-[var(--border-color)]'}`}>
            <input type="radio" name="modo-cambio" checked={modo === 'puesto'} onChange={() => setModo('puesto')} className="mt-0.5 accent-[var(--accent)]" />
            <span className="space-y-1">
              <span className="block font-semibold text-[var(--text-main)]">Todo el puesto {item.puestoNombre}</span>
              <span className="block text-[var(--text-secondary)]">
                Cambia el área del puesto en el catálogo a <strong>{nombreArea(areaId)}</strong> y mueve a {plural(impacto.enArchivo, 'empleado del archivo', 'empleados del archivo')}
                {impacto.fueraArchivo > 0 && <> y a {plural(impacto.fueraArchivo, 'empleado del padrón que no viene en el archivo', 'empleados del padrón que no vienen en el archivo')}</>}.
              </span>
              {impacto.conExcepcion > 0 && (
                <span className="block text-[var(--status-warning-text)]">{plural(impacto.conExcepcion, 'persona tiene', 'personas tienen')} excepción y no se mueve{impacto.conExcepcion === 1 ? '' : 'n'}.</span>
              )}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn} onClick={onCancelar}>Cancelar</button>
          <button type="button" className={btnRojo} disabled={modo === 'persona' && !vuelveAlPuesto && !motivo.trim()}
            onClick={() => onAplicar(modo, motivo.trim())}>
            {modo === 'puesto' ? `Cambiar el puesto (${impacto.enArchivo + impacto.fueraArchivo})` : 'Aplicar a esta persona'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FilaEmpleado({ it, areas, onCambiar, onQuitarExcepcion, bloqueado }) {
  const opciones = areas.some(a => a.id === it.areaId) || !it.areaId ? areas : [...areas, { id: it.areaId, nombre: it.areaNombre }];
  return (
    <li className="space-y-1 px-3 py-2 text-xs hover:bg-[var(--bg-surface-secondary)]">
      <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_11rem_9rem]">
        <span className="font-mono font-semibold text-[var(--text-main)]">{it.clave}</span>
        <span className="truncate font-semibold text-[var(--text-main)]" title={it.nombre}>{it.nombre}</span>
        <span className="hidden truncate text-[var(--text-secondary)] sm:block" title={it.puestoNombre}>
          {it.puestoNombre}{it.puestoNuevo && <span className="ml-1 text-[var(--status-warning-text)]">(nuevo)</span>}
        </span>
        <select value={it.areaId} disabled={bloqueado} aria-label={`Área de ${it.nombre}`}
          onChange={e => e.target.value && e.target.value !== it.areaId && onCambiar(it, e.target.value)} className={`${campo} w-full`}>
          {!it.areaId && <option value="">Sin área</option>}
          {opciones.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <span className={`${insignia} hidden justify-center sm:inline-flex ${TONO[it.areaEstado]}`}>{ETIQUETA[it.areaEstado]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[5.5rem] text-xs sm:pl-[5.5rem]">
        <span className="text-[var(--text-secondary)] sm:hidden">{it.puestoNombre}</span>
        <span className={`${insignia} sm:hidden ${TONO[it.areaEstado]}`}>{ETIQUETA[it.areaEstado]}</span>
        {it.areaEstado === 'cambia' && (
          <span className="text-[var(--status-warning-text)]">
            <span className="line-through">{it.areaAnteriorNombre || 'Sin área'}</span> → <span className="font-semibold">{it.areaNombre || 'Sin área'}</span>
          </span>
        )}
        {it.excepcion && (
          <span className="inline-flex flex-wrap items-center gap-1.5 text-[var(--text-secondary)]">
            <ShieldCheck className="h-3 w-3" />
            <span>Excepción: área {it.areaNombre}{it.excepcion.motivo && ` (${it.excepcion.motivo})`}{it.excepcionNueva && ' · nueva'}</span>
            <button type="button" disabled={bloqueado} onClick={() => onQuitarExcepcion(it)} className="font-semibold underline cursor-pointer disabled:opacity-50">Quitar excepción</button>
          </span>
        )}
      </div>
    </li>
  );
}

export default function ConfirmarAreas({
  plan, grupos, areas, confirmadas, empleadosBase, bloqueado = false, puestosPendientes = 0,
  onConfirmar, onAjustePersona, onAjustePuesto, onQuitarExcepcion,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [dialogo, setDialogo] = useState(null);

  const q = sinAcentos(busqueda.trim());
  const filtrando = !!q || filtro !== 'todos';
  const resumen = useMemo(() => resumenLista(plan.items, grupos), [plan.items, grupos]);
  const vigente = (g) => confirmadas.get(g.id) === g.firma;
  const confirmados = grupos.filter(vigente).length;

  const filtrados = useMemo(() => grupos.map(g => ({
    ...g, visibles: g.items.filter(i => FILTROS_AREA[filtro](i) && (!q || textoFila(i).includes(q))),
  })), [grupos, filtro, q]);

  const abierto = (g) => abiertos.has(g.id) || (filtrando && g.visibles.length > 0);
  const alternar = (id) => setAbiertos(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const aplicar = (modo, motivo) => {
    const { item, areaId } = dialogo;
    if (modo === 'puesto') onAjustePuesto(item, areaId); else onAjustePersona(item, areaId, motivo);
    setDialogo(null);
  };

  if (puestosPendientes > 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span><strong>Confirmar áreas:</strong> resuelva primero {plural(puestosPendientes, 'puesto pendiente', 'puestos pendientes')} (arriba). Después aparecerá la lista de empleados por área.</span>
      </div>
    );
  }
  if (plan.items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-color)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-[var(--text-main)]">Confirmar áreas</p>
        <span className={`${insignia} ${confirmados === grupos.length ? TONO.nuevo : TONO.cambia}`}>{confirmados} de {grupos.length} grupos confirmados</span>
        <button type="button" className={`${btnRojo} ml-auto`} disabled={bloqueado || confirmados === grupos.length}
          onClick={() => onConfirmar(grupos.map(g => ({ id: g.id, firma: g.firma })))}>
          <CheckCircle2 className="h-3.5 w-3.5" />Confirmo todas las áreas
        </button>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        {plural(resumen.total, 'empleado', 'empleados')} en {plural(resumen.areas, 'área', 'áreas')}, {resumen.cambian} cambian de área, {resumen.sinArea} sin área.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nómina, nombre o puesto..."
            className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer ${filtro === id ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)] text-[var(--text-main)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-secondary)]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtrados.map(g => {
          const ok = vigente(g);
          const sinArea = g.id === GRUPO_SIN_AREA;
          const abre = abierto(g);
          if (filtrando && g.visibles.length === 0) return null;
          return (
            <div key={g.id} className={`rounded-lg border ${sinArea ? 'border-[var(--status-warning-border)]' : 'border-[var(--border-color)]'}`}>
              <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-surface-secondary)] px-3 py-2">
                <button type="button" onClick={() => alternar(g.id)} aria-expanded={abre} className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-[var(--text-main)] cursor-pointer">
                  {abre ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {g.nombre}
                  <span className="font-normal text-[var(--text-muted)]">
                    · {filtrando ? `${g.visibles.length} de ${g.items.length}` : g.items.length}
                  </span>
                  {ok && <span className={`${insignia} ${TONO.nuevo}`}>Confirmada</span>}
                </button>
                <button type="button" className={btn} disabled={bloqueado || ok} onClick={() => onConfirmar([{ id: g.id, firma: g.firma }])}>
                  <CheckCircle2 className="h-3.5 w-3.5" />{ok ? 'Confirmada' : sinArea ? 'Dejarlos sin área y confirmar' : 'Confirmo las áreas'}
                </button>
              </div>
              {abre && (
                <ul className="max-h-96 divide-y divide-[var(--border-subtle)] overflow-y-auto">
                  {g.visibles.length === 0 && <li className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Sin coincidencias.</li>}
                  {g.visibles.map(it => (
                    <FilaEmpleado key={it.key} it={it} areas={areas} bloqueado={bloqueado}
                      onCambiar={(item, areaId) => setDialogo({ item, areaId })} onQuitarExcepcion={onQuitarExcepcion} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {dialogo && (
        <DialogoCambio plan={plan} dialogo={dialogo} areas={areas} empleadosBase={empleadosBase}
          onCancelar={() => setDialogo(null)} onAplicar={aplicar} />
      )}
    </div>
  );
}
