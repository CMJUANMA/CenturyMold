/**
 * TabOrganigrama.jsx — Organigrama de autorización, generado SOLO con las asignaciones vigentes.
 * Árbol de arriba a abajo: Nivel 2 · Planta (Aut. 2 lado a lado) → una rama por área con participaTE → su Aut. 1 (la tarjeta
 * más grande) → lista compacta de solicitantes. La jerarquía se ve por posición, tamaño y líneas; los colores son solo un acento.
 * Escritorio: árbol completo con riel de niveles; pantallas medianas: scroll horizontal; celular: lista vertical plegable.
 * Clic en una persona abre su panel lateral; quien puede asignar ve los botones "+" y, en el panel, Revocar y Extender.
 * Privacidad: las personas de un nivel SUPERIOR al de quien mira no se abren (solo nombre, puesto y nivel); las de su nivel o inferiores
 * abren un panel básico, y el completo (quién asignó, cuándo, motivo, historial) es de RH, admin y, hacia abajo, de la Aut. 2.
 * Orden: dentro de cada nivel, por nivelJerarquico del puesto (1 = el más alto; sin nivel, al final) y, si empatan, por nombre.
 * Aut. 2: uno debajo de otro; el de puesto más alto, arriba y con la tarjeta un poco más grande.
 */
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, Search, ShieldCheck, User } from 'lucide-react';
import {
  VISTA_PERSONA, construirOrganigrama, nivelDePersona, rolesAsignables, vistaDePersona, ROL_OP,
} from '../../../utils/asignaciones';
import { crearFormateadorNombres } from '../../../utils/nombresPersona';
import { BotonAgregar, FilaSolicitante, SinAut1, TarjetaPersona } from './NodosOrganigrama';
import { COLOR_LINEA, NIVELES, textoConteo } from './nivelesOrganigrama';
import PanelPersona from './PanelPersona';

const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const linea = { background: COLOR_LINEA };

function Leyenda() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]" aria-label="Leyenda">
      {[['aut2', 'Nivel 2'], ['aut1', 'Nivel 1'], ['solicitante', 'Solicitante']].map(([rol, texto]) => {
        const n = NIVELES[rol];
        return <li key={rol} className="inline-flex items-center gap-1"><n.Icono className="h-3 w-3" style={{ color: n.acento }} />{texto}</li>;
      })}
      <li className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--status-warning-text)]" />Sin usuario</li>
    </ul>
  );
}

/** Etiqueta del riel lateral, alineada con su fila del árbol */
function Riel({ rol, texto }) {
  const n = NIVELES[rol];
  return (
    <div className="self-start pt-1 pr-3">
      <span className="inline-flex items-center gap-1.5 rounded-md border-l-[3px] bg-[var(--bg-surface-secondary)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]"
        style={{ borderLeftColor: n.acento }}>
        <n.Icono className="h-3 w-3" style={{ color: n.acento }} />{texto}
      </span>
    </div>
  );
}

export default function TabOrganigrama({ asignaciones, areas, empleados, puestos = [], usuarios, actor, ahora, nombresArea, onAsignar }) {
  const [busqueda, setBusqueda] = useState('');
  const [resaltarSin, setResaltarSin] = useState(false);
  const [abierta, setAbierta] = useState(null); // nómina de la persona del panel

  const asignables = rolesAsignables(actor);
  const empleadosPorNomina = useMemo(() => new Map(empleados.map(e => [String(e.nomina), e])), [empleados]);
  const formato = useMemo(() => crearFormateadorNombres(empleados.map(e => e.nombre)), [empleados]);
  // "Sin usuario" solo se puede saber si quien ve puede leer usuarios (RH, admin, Aut. 2)
  const nominasConUsuario = useMemo(() => (usuarios ? new Set(usuarios.map(u => String(u.nomina))) : null), [usuarios]);
  const org = useMemo(
    () => construirOrganigrama({ asignaciones, areas, empleados: empleadosPorNomina, puestos, nominasConUsuario, ahora }),
    [asignaciones, areas, empleadosPorNomina, puestos, nominasConUsuario, ahora],
  );

  const q = sinAcentos(busqueda).trim();
  // Qué ve quien mira de cada persona: según el nivel más alto que ella tiene (una persona con dos roles se trata por el mayor)
  const vistaDe = (t) => vistaDePersona(actor, nivelDePersona(t.nomina, asignaciones, ahora));
  const bloqueada = (t) => vistaDe(t) === VISTA_PERSONA.BLOQUEADA;
  // De una persona bloqueada no se busca por nómina: esa nómina no se muestra
  const coincide = (t) => !q || [formato.nombre(t.nombre), t.nombre, t.puesto, bloqueada(t) ? '' : t.nomina].some(x => sinAcentos(x).includes(q));
  const estadoDe = (t) => ({ resaltado: !!q && coincide(t), atenuado: !!q && !coincide(t), resaltarSin });
  const primero = !q ? null
    : [...org.aut2, ...org.columnas.flatMap(c => [...c.aut1, ...c.solicitantes])].find(coincide)?.id ?? null;

  // Lleva a la vista a la primera persona que coincide (el nodo visible: hay una versión de escritorio y otra de celular)
  useEffect(() => {
    if (!primero) return;
    const nodo = [...document.querySelectorAll(`[data-org="${primero}"]`)].find(n => n.offsetParent !== null);
    nodo?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [primero]);

  const abrir = (t) => { if (!bloqueada(t)) setAbierta(t.nomina); };
  const asignar = (rol, areaId) => onAsignar(areaId ? { rol, areaId } : { rol });
  const columnas = Math.max(org.columnas.length, 1);

  const puedeAsignarAut2 = asignables.includes(ROL_OP.AUT2);
  const nodoPlanta = (
    <section aria-label="Nivel 2 · Planta" className="mx-auto w-fit max-w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
      <h3 className="mb-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[var(--text-secondary)]">
        <ShieldCheck className="h-3.5 w-3.5" style={{ color: NIVELES.aut2.acento }} />Nivel 2 · Planta
      </h3>
      {org.aut2.length === 0 ? (
        <p className="px-4 py-2 text-center text-xs text-[var(--text-secondary)]">Nadie tiene Autorización 2 vigente (solo RH puede firmar este nivel).</p>
      ) : (
        <div className="mx-auto flex w-80 max-w-full flex-col gap-3">
          {org.aut2.map((t, i) => (
            <TarjetaPersona key={t.id} t={t} formato={formato} tamano={i === 0 ? 'grande' : 'normal'} estado={estadoDe(t)} onAbrir={abrir} bloqueada={bloqueada(t)} />
          ))}
        </div>
      )}
      {puedeAsignarAut2 && <div className="mt-2 flex justify-center"><BotonAgregar onClick={() => asignar(ROL_OP.AUT2)}>Aut. 2</BotonAgregar></div>}
    </section>
  );

  const cabeceraArea = (col) => (
    <h3 className="mb-2 text-center text-xs font-semibold text-[var(--text-main)]">
      {col.area.nombre} <span className="font-normal normal-case tracking-normal text-[var(--text-secondary)]">· {textoConteo(col.solicitantes.length)}</span>
    </h3>
  );
  const bloqueAut1 = (col, grande) => (col.sinAut1
    ? <SinAut1 puedeAsignar={asignables.includes(ROL_OP.AUT1)} onAsignar={() => asignar(ROL_OP.AUT1, col.area.id)} />
    : <div className="space-y-2">{col.aut1.map(t => <TarjetaPersona key={t.id} t={t} formato={formato} tamano={grande ? 'grande' : 'normal'} estado={estadoDe(t)} onAbrir={abrir} bloqueada={bloqueada(t)} />)}</div>);
  const listaSolicitantes = (col) => (
    <div className="space-y-1">
      {col.solicitantes.map(t => <FilaSolicitante key={t.id} t={t} formato={formato} conTick={false} estado={estadoDe(t)} onAbrir={abrir} />)}
      {col.solicitantes.length === 0 && <p className="px-1 py-0.5 text-center text-xs text-[var(--text-muted)]">Sin solicitantes</p>}
      {asignables.includes(ROL_OP.SOLICITANTE) && <div className="pt-0.5"><BotonAgregar onClick={() => asignar(ROL_OP.SOLICITANTE, col.area.id)}>Solicitante</BotonAgregar></div>}
    </div>
  );

  return (
    <div className="space-y-4" id="organigrama">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar persona en el árbol…" aria-label="Buscar persona en el árbol"
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]" />
        </div>
        {nominasConUsuario && <button type="button" role="switch" aria-checked={resaltarSin} onClick={() => setResaltarSin(v => !v)}
          title="Marca claramente a quien aún no tiene cuenta"
          className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className={`relative h-4 w-7 rounded-full transition-colors ${resaltarSin ? 'bg-[var(--status-warning-text)]' : 'bg-[var(--border-color)]'}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${resaltarSin ? 'left-3.5' : 'left-0.5'}`} />
          </span>
          Resaltar sin usuario
        </button>}
        <div className="ml-auto"><Leyenda /></div>
      </div>

      {/* Escritorio y pantallas medianas: árbol con riel de niveles; en medianas se desplaza con suavidad conservando las líneas */}
      <div className="hidden overflow-x-auto scroll-smooth pb-3 md:block" tabIndex={0} aria-label="Árbol del organigrama">
        {/* El ancho sigue la cantidad de áreas: cada columna mide a lo sumo 320 px y todo el árbol (riel incluido) se centra */}
        <div className="mx-auto grid" style={{ gridTemplateColumns: `6.5rem repeat(${columnas}, minmax(200px, 320px))`, justifyContent: 'center', minWidth: `calc(6.5rem + ${columnas * 200}px)` }}>
          <Riel rol="aut2" texto="Nivel 2" />
          <div style={{ gridColumn: `2 / span ${columnas}` }}>
            {nodoPlanta}
            <div className="mx-auto h-5 w-px" style={linea} />
          </div>

          <div />
          {org.columnas.map((col, i) => (
            <div key={col.area.id} className="relative h-5" aria-hidden="true">
              {columnas > 1 && <div className="absolute top-0 h-px" style={{ ...linea, left: i === 0 ? '50%' : 0, right: i === columnas - 1 ? '50%' : 0 }} />}
              <div className="absolute bottom-0 left-1/2 top-0 w-px" style={linea} />
            </div>
          ))}

          <Riel rol="aut1" texto="Nivel 1" />
          {org.columnas.map(col => (
            <div key={col.area.id} className="px-2">{cabeceraArea(col)}{bloqueAut1(col, true)}</div>
          ))}

          <div />
          {org.columnas.map(col => <div key={col.area.id} className="flex justify-center" aria-hidden="true"><div className="h-5 w-px" style={linea} /></div>)}

          <Riel rol="solicitante" texto="Solicitantes" />
          {org.columnas.map(col => (
            <div key={col.area.id} className="px-2"><div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-1.5">{listaSolicitantes(col)}</div></div>
          ))}
        </div>
        {org.columnas.length === 0 && <p className="text-xs text-[var(--text-muted)]">No hay áreas que participen en tiempo extra. Márcalas en Estructura.</p>}
      </div>

      {/* Celular: lista vertical, Aut. 2 arriba y cada área como bloque plegable */}
      <div className="space-y-3 md:hidden">
        {nodoPlanta}
        {org.columnas.map(col => (
          <details key={col.area.id} open className="group rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {col.area.nombre} <span className="font-normal normal-case tracking-normal text-[var(--text-secondary)]">· {textoConteo(col.solicitantes.length)}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-[var(--border-subtle)] p-3">
              <p className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]"><BadgeCheck className="h-3 w-3" />Nivel 1</p>
              {bloqueAut1(col, false)}
              <p className="flex items-center gap-1 pt-1 text-xs font-semibold text-[var(--text-muted)]"><User className="h-3 w-3" />Solicitantes</p>
              <div className="ml-4 border-l-2 pl-3" style={{ borderColor: COLOR_LINEA }}>{listaSolicitantes(col)}</div>
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Solo muestra asignaciones vigentes hoy. Las temporales dejan de aparecer solas al llegar su fecha final. Clic en una persona para ver su detalle (las de un nivel superior al tuyo no se abren).
      </p>

      {abierta && (
        <PanelPersona nomina={abierta} asignaciones={asignaciones} empleado={empleadosPorNomina.get(String(abierta))}
          conUsuario={nominasConUsuario ? nominasConUsuario.has(String(abierta)) : undefined} actor={actor} ahora={ahora}
          vista={vistaDePersona(actor, nivelDePersona(abierta, asignaciones, ahora))}
          nombresArea={nombresArea} formato={formato} onClose={() => setAbierta(null)} />
      )}
    </div>
  );
}
