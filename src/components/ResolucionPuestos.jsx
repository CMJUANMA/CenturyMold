/**
 * ResolucionPuestos.jsx — Panel para resolver los puestos de un archivo (o del padrón) contra el catálogo.
 *   a. Corregidos automáticamente (solo se muestran)
 *   b. Corrección propuesta: "Usar este" / "Es otro puesto"
 *   c. Puesto no reconocido: "Es igual a…", "Agregar como puesto nuevo" (con área) u "Omitir estas filas"
 * Todo lo que RH confirma se guarda como alias al confirmar la importación.
 */
import { useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Undo2, Wand2 } from 'lucide-react';

const btn = 'inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const btnRojo = 'inline-flex items-center gap-1 rounded-md bg-[var(--cm-red)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--cm-red-hover)] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

const quienes = (g) => {
  const [primero, ...resto] = g.empleados;
  return `${primero.nombre}${resto.length ? ` y ${resto.length} más` : ''}`;
};

/** "Es igual a…": campo con lista de puestos existentes; al elegir uno exacto se confirma la equivalencia */
function EsIgualA({ catalogo, onElegir }) {
  const [texto, setTexto] = useState('');
  const elegido = catalogo.find(p => p.nombre === texto.trim().toUpperCase());
  const listaId = useId();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input list={listaId} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Es igual a… (busque un puesto)"
        className={`${campo} w-64`} />
      <datalist id={listaId}>{catalogo.map(p => <option key={p.id} value={p.nombre} />)}</datalist>
      <button type="button" className={btn} disabled={!elegido} onClick={() => onElegir(elegido.id)}>Usar equivalencia</button>
    </span>
  );
}

function AgregarNuevo({ areas, onAgregar }) {
  const [areaId, setAreaId] = useState('');
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select value={areaId} onChange={e => setAreaId(e.target.value)} className={campo}>
        <option value="">Área del puesto nuevo…</option>
        {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
      <button type="button" className={btn} disabled={!areaId} onClick={() => onAgregar(areaId)}>Agregar como puesto nuevo</button>
    </span>
  );
}

export default function ResolucionPuestos({ resolucion, catalogo, areas, decisiones, onDecidir }) {
  const { grupos, porClave, pendientes } = resolucion;
  const nombreArea = (id) => areas.find(a => a.id === id)?.nombre ?? id;
  const corregidos = grupos.filter(g => porClave.get(g.clave).estado === 'corregido');
  // Los de nivel b/c se muestran todos (resueltos o no) para poder cambiar la decisión
  const aResolver = grupos.filter(g => g.resultado.nivel !== 'a');
  const areasActivas = areas.filter(a => a.activa !== false);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-color)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-[var(--text-main)]">Puestos del archivo</p>
        {pendientes.length > 0
          ? <span className="inline-flex items-center gap-1 rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--status-warning-text)]">
            <AlertTriangle className="h-3 w-3" />{pendientes.length} sin resolver
          </span>
          : <span className="inline-flex items-center gap-1 rounded border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--status-success-text)]">
            <CheckCircle2 className="h-3 w-3" />Todos resueltos
          </span>}
        <span className="text-[11px] text-[var(--text-muted)]">
          {grupos.length - aResolver.length} coinciden con el catálogo · {aResolver.length} requieren revisión
        </span>
      </div>

      {corregidos.length > 0 && (
        <details className="text-[11px] text-[var(--text-secondary)]">
          <summary className="cursor-pointer font-semibold"><Wand2 className="mr-1 inline h-3 w-3" />Corregidos automáticamente ({corregidos.length})</summary>
          <ul className="mt-1 max-h-36 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded border border-[var(--border-subtle)]">
            {corregidos.map(g => (
              <li key={g.clave} className="px-2 py-1">
                <span className="text-[var(--text-muted)] line-through">{[...g.crudos].filter(c => c !== porClave.get(g.clave).nombre).join(' | ')}</span>
                {' → '}<span className="font-semibold text-[var(--text-main)]">{porClave.get(g.clave).nombre}</span>
                <span className="text-[var(--text-muted)]"> · {g.empleados.length}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {aResolver.length > 0 && (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {aResolver.map(g => {
            const res = porClave.get(g.clave);
            const d = decisiones.get(g.clave);
            const r = g.resultado;
            const resuelto = res.estado !== 'pendiente';
            const esB = r.nivel === 'b' && d?.tipo !== 'otro';
            return (
              <li key={g.clave}
                className={`rounded-md border px-3 py-2 text-xs ${resuelto ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)]' : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'}`}>
                {resuelto ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success-text)]" />
                    <span className="font-mono font-bold">{g.texto}</span>
                    <span className="text-[var(--text-muted)]">→</span>
                    {res.estado === 'omitir'
                      ? <span className="font-semibold">se omiten {g.empleados.length} fila(s)</span>
                      : <span className="font-semibold">
                        {res.nombre} <span className="font-normal text-[var(--text-muted)]">· {nombreArea(res.areaId)}
                          {res.estado === 'nuevo' && ' · puesto nuevo'}{res.estado === 'alias' && ' · se guardará como alias'}</span>
                      </span>}
                    <button type="button" className={`${btn} ml-auto`} onClick={() => onDecidir(g.clave, null)}><Undo2 className="h-3 w-3" />Cambiar</button>
                  </div>
                ) : esB ? (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-[var(--text-main)]">
                      ¿<span className="font-mono">{g.texto}</span> → <span className="font-mono">{r.puesto.nombre}</span>?
                      <span className="ml-1 font-normal text-[var(--text-muted)]">({quienes(g)} · {g.empleados.length} fila(s))</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={btnRojo} onClick={() => onDecidir(g.clave, { tipo: 'usar' })}>Usar este</button>
                      <button type="button" className={btn} onClick={() => onDecidir(g.clave, { tipo: 'otro' })}>Es otro puesto</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-[var(--text-main)]">
                      El puesto <span className="font-mono">{g.texto}</span> (de {quienes(g)}) no existe.
                    </p>
                    {r.ambiguo && (
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Se parece a varios por igual ({r.candidatos.map(c => c.nombre).join(', ')}): no se propone ninguno.
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <EsIgualA catalogo={catalogo} onElegir={(puestoId) => onDecidir(g.clave, { tipo: 'alias', puestoId })} />
                      <AgregarNuevo areas={areasActivas} onAgregar={(areaId) => onDecidir(g.clave, { tipo: 'nuevo', areaId })} />
                      <button type="button" className={btn} onClick={() => onDecidir(g.clave, { tipo: 'omitir' })}>Omitir estas filas</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
