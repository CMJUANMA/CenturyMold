/**
 * NodosOrganigrama.jsx — Piezas visuales del organigrama: la jerarquía se ve por posición, tamaño y líneas, no solo por color.
 * Fondos neutros (superficie del tema) con un acento por nivel: borde de color e ícono.
 *   Aut. 2: tarjeta mediana · Aut. 1: la más grande del área · Solicitante: fila compacta.
 */
import { BadgeCheck, Clock, Plus } from 'lucide-react';
import { formatoCorto } from '../../../utils/asignaciones';
import { COLOR_LINEA, NIVELES } from './nivelesOrganigrama';



export function Avatar({ iniciales, rol, tamano = 36 }) {
  const n = NIVELES[rol];
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-[var(--org-text)]"
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.36), background: n.fondo, border: `1px solid ${n.acento}` }}>
      {iniciales}
    </span>
  );
}

/** Punto ámbar de "sin usuario" (o la insignia completa si se pidió resaltar) y la insignia de temporal */
function Indicadores({ t, resaltarSin }) {
  return (
    <>
      {t.sinUsuario && !resaltarSin && (
        <span role="img" aria-label="Sin usuario" title="Sin usuario: todavía no tiene cuenta, no podrá usar este rol"
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" />
      )}
      {t.sinUsuario && resaltarSin && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-warning-text)]">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Sin usuario
        </span>
      )}
      {t.temporalHasta && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
          title={`Temporal: vence el ${formatoCorto(t.temporalHasta)}`}>
          <Clock className="h-2.5 w-2.5" />hasta {formatoCorto(t.temporalHasta)}
        </span>
      )}
    </>
  );
}

const claseEstado = ({ resaltado, atenuado, resaltarSin, t }) => [
  resaltado ? 'ring-2 ring-[var(--cm-red)] ring-offset-1 ring-offset-[var(--bg-app)]' : '',
  resaltarSin && t.sinUsuario ? 'outline outline-2 outline-[var(--status-warning-text)]' : '',
  atenuado ? 'opacity-40' : '',
].join(' ');

/** Tarjeta de Aut. 2 (mediana) o de Aut. 1 (la más grande del área) */
export function TarjetaPersona({ t, formato, grande = false, estado, onAbrir }) {
  const n = NIVELES[t.rol];
  return (
    <button type="button" data-org={t.id} onClick={() => onAbrir(t)} aria-label={`${formato.nombre(t.nombre)}, ${n.etiqueta}. Ver detalle`}
      className={`group relative w-full cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-left shadow-sm transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cm-red)] ${grande ? 'p-4' : 'p-3'} ${claseEstado({ ...estado, t })}`}
      style={{ borderTop: `3px solid ${n.acento}` }}>
      <span className="flex items-start gap-3">
        <Avatar iniciales={formato.iniciales(t.nombre)} rol={t.rol} tamano={grande ? 48 : 40} />
        <span className="min-w-0 flex-1">
          <span className={`block font-bold leading-tight text-[var(--text-main)] ${grande ? 'text-sm' : 'text-xs'}`}>{formato.nombre(t.nombre)}</span>
          {t.puesto && <span className="mt-0.5 block text-[11px] leading-tight text-[var(--text-secondary)]">{t.puesto}</span>}
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--text-muted)]">{t.nomina}</span>
        </span>
        <span className="flex items-center gap-1"><Indicadores t={t} resaltarSin={estado.resaltarSin} /></span>
      </span>
      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        <n.Icono className="h-3 w-3" style={{ color: n.acento }} />{n.etiqueta}
      </span>
    </button>
  );
}

/** Fila compacta de un solicitante */
export function FilaSolicitante({ t, formato, estado, onAbrir, conTick = true }) {
  const n = NIVELES.solicitante;
  return (
    <button type="button" data-org={t.id} onClick={() => onAbrir(t)} aria-label={`${formato.nombre(t.nombre)}, solicitante. Ver detalle`}
      className={`relative flex w-full cursor-pointer items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-left hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cm-red)] ${claseEstado({ ...estado, t })}`}
      style={{ borderLeft: `3px solid ${n.acento}` }}>
      {conTick && <span aria-hidden="true" className="absolute -left-3 top-1/2 h-px w-3" style={{ background: COLOR_LINEA }} />}
      <Avatar iniciales={formato.iniciales(t.nombre)} rol="solicitante" tamano={22} />
      <span className="min-w-0 flex-1 truncate text-[11px]">
        <span className="font-semibold text-[var(--text-main)]">{formato.nombre(t.nombre)}</span>
        {t.puesto && <span className="text-[var(--text-secondary)]"> · {t.puesto}</span>}
        <span className="ml-1 font-mono text-[9px] text-[var(--text-muted)]">{t.nomina}</span>
      </span>
      <span className="flex items-center gap-1"><Indicadores t={t} resaltarSin={estado.resaltarSin} /></span>
    </button>
  );
}

/** Lugar del Aut. 1 cuando el área no tiene: tarjeta punteada con "+ Asignar" para quien puede */
export function SinAut1({ puedeAsignar, onAsignar }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[var(--status-error-border)] bg-[var(--bg-surface)] p-4 text-center">
      <BadgeCheck className="h-6 w-6 text-[var(--status-error-text)] opacity-70" />
      <p className="text-sm font-bold text-[var(--status-error-text)]">Sin Autorización 1</p>
      <p className="text-[11px] text-[var(--text-secondary)]">Las solicitudes de esta área no podrán avanzar.</p>
      {puedeAsignar && <BotonAgregar onClick={onAsignar}>Asignar</BotonAgregar>}
    </div>
  );
}

/** Botón discreto "+ Algo" */
export function BotonAgregar({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-[var(--border-color)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--cm-red)] hover:text-[var(--cm-red)]">
      <Plus className="h-3 w-3" />{children}
    </button>
  );
}
