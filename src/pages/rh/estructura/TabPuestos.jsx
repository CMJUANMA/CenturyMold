/**
 * TabPuestos.jsx — Puestos: puesto, área, número de empleados y alias; filtro por área y buscador;
 * alta, edición, cambio de área (con la lista de empleados que se mueven), baja lógica y alias.
 */
import { useMemo, useState } from 'react';
import { arrayRemove, deleteField, doc, serverTimestamp } from 'firebase/firestore';
import { ArrowDown, ArrowRightLeft, ArrowUp, ListChecks, Pencil, Plus, Power, Search, Tag } from 'lucide-react';
import { db } from '../../../firebase';
import Modal from '../../../components/Modal';
import { esActivo } from '../../../utils/activo';
import { idPuestoLibre, impactoCambioArea } from '../../../utils/estructura';
import { nivelJerarquicoValido } from '../../../utils/asignaciones';
import { clavePuesto, normalizarPuesto, resolverPuesto } from '../../../utils/puestos';
import { opBitacora, opsCambioAreaPuesto } from '../../../utils/estructuraDb';
import AsignarPuestos from './AsignarPuestos';
import { btnIcon, btnPrimary, btnSecondary, chip, chipWarn, inputCls, labelCls, tablaWrap, theadCls, thCls } from './ui';

const sinTildes = (t) => clavePuesto(t);

export default function TabPuestos({ areas, puestos, empleados, usuario, toast, guardar, recargar }) {
  const [filtroArea, setFiltroArea] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('activos');
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null); // { tipo: 'nuevo'|'editar'|'area'|'alias', puesto? }
  const [form, setForm] = useState({ nombre: '', areaId: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [asignar, setAsignar] = useState(false);
  const [ordenNivel, setOrdenNivel] = useState(null); // null (por nombre) | 'asc' | 'desc'; sin nivel, siempre al final

  const areasPorId = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const nombreArea = (id) => areasPorId.get(id)?.nombre ?? (id ? `${id} (no existe)` : 'Sin área');
  const areasActivas = areas.filter(a => a.activa !== false).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
  const nEmpleados = (id) => empleados.filter(e => e.puestoId === id && esActivo(e)).length;
  const sinPuesto = empleados.filter(e => !e.puestoId && String(e.puesto ?? '').trim() && esActivo(e)).length;

  const filtrados = puestos.filter(p => {
    if (filtroArea === 'sin' ? !!p.areaId && areasPorId.has(p.areaId) : filtroArea !== 'todas' && p.areaId !== filtroArea) return false;
    if (filtroEstado === 'activos' && p.activo === false) return false;
    if (filtroEstado === 'inactivos' && p.activo !== false) return false;
    const q = sinTildes(busqueda);
    return !q || sinTildes(p.nombre).includes(q) || (p.alias ?? []).some(a => sinTildes(a).includes(q));
  }).sort((a, b) => {
    if (ordenNivel) {
      const na = nivelJerarquicoValido(a.nivelJerarquico), nb = nivelJerarquicoValido(b.nivelJerarquico);
      if (na !== nb) return na == null ? 1 : nb == null ? -1 : ordenNivel === 'asc' ? na - nb : nb - na;
    }
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const cerrar = () => !guardando && setModal(null);
  const abrir = (tipo, puesto = null) => {
    setForm({ nombre: puesto?.nombre ?? '', areaId: puesto?.areaId ?? '' });
    setError(''); setModal({ tipo, puesto });
  };

  const correr = async (ops, mensaje) => {
    setGuardando(true); setError('');
    const ok = await guardar(ops, mensaje);
    setGuardando(false);
    if (ok) setModal(null);
  };

  // ── alta ──
  const similar = modal?.tipo === 'nuevo' || modal?.tipo === 'editar'
    ? resolverPuesto(form.nombre, puestos.filter(p => p.id !== modal.puesto?.id)) : null;
  const guardarNuevo = (e) => {
    e.preventDefault();
    const nombre = normalizarPuesto(form.nombre);
    if (!nombre) return setError('El nombre es obligatorio.');
    if (!form.areaId) return setError('Elija el área del puesto.');
    if (similar?.nivel === 'a') return setError(`Ya existe: «${similar.puesto.nombre}».`);
    const id = idPuestoLibre(nombre, new Set(puestos.map(p => p.id)));
    correr([
      b => b.set(doc(db, 'puestos', id), { nombre, areaId: form.areaId, activo: true, alias: [], creadoPor: usuario.uid, fechaCreacion: serverTimestamp() }),
      opBitacora({ accion: 'puesto_creado', entidad: `puestos/${id}`, despues: { nombre, areaId: form.areaId, origen: 'manual' } }, usuario),
    ], 'Puesto creado.');
  };

  // ── edición (renombrar): los empleados con ese puesto conservan el vínculo y se actualiza su texto ──
  const guardarEdicion = (e) => {
    e.preventDefault();
    const p = modal.puesto;
    const nombre = normalizarPuesto(form.nombre);
    if (!nombre) return setError('El nombre es obligatorio.');
    if (nombre === p.nombre) return setModal(null);
    if (similar?.nivel === 'a') return setError(`Ya existe: «${similar.puesto.nombre}».`);
    const suyos = empleados.filter(x => x.puestoId === p.id);
    const alias = [...new Set([...(p.alias ?? []), p.nombre])]; // el nombre anterior sigue reconociéndose
    correr([
      b => b.update(doc(db, 'puestos', p.id), { nombre, alias }),
      opBitacora({ accion: 'puesto_renombrado', entidad: `puestos/${p.id}`, antes: { nombre: p.nombre }, despues: { nombre, empleadosActualizados: suyos.length } }, usuario),
      ...suyos.map(x => (b) => b.update(doc(db, 'empleados', String(x.id)), { puesto: nombre })),
    ], `Puesto renombrado${suyos.length ? ` (${suyos.length} empleados actualizados)` : ''}.`);
  };

  // ── baja lógica ──
  const cambiarEstado = async (p) => {
    const activo = p.activo !== false;
    if (activo && nEmpleados(p.id) > 0) {
      toast.error(`«${p.nombre}» tiene ${nEmpleados(p.id)} empleado(s) activo(s). Cámbielos de puesto antes de desactivarlo.`, 7000);
      return;
    }
    await guardar([
      b => b.update(doc(db, 'puestos', p.id), { activo: !activo }),
      opBitacora({ accion: activo ? 'puesto_baja' : 'puesto_reactivado', entidad: `puestos/${p.id}`, antes: { activo }, despues: { activo: !activo } }, usuario),
    ], activo ? 'Puesto desactivado.' : 'Puesto reactivado.');
  };

  // ── cambio de área ──
  const impacto = modal?.tipo === 'area' && form.areaId && form.areaId !== modal.puesto.areaId
    ? impactoCambioArea(empleados, modal.puesto.id, form.areaId) : null;
  const confirmarArea = () => {
    if (!impacto) return setError('Elija un área distinta.');
    correr(opsCambioAreaPuesto(modal.puesto, form.areaId, impacto.mover, impacto.conExcepcion.length, usuario),
      `Puesto movido a ${nombreArea(form.areaId)}${impacto.mover.length ? ` (${impacto.mover.length} empleados actualizados)` : ''}.`);
  };

  // ── nivel jerárquico (1 = el puesto más alto; vacío = sin nivel) ──
  const guardarNivel = async (p, texto) => {
    const t = String(texto).trim();
    const nivel = t === '' ? null : Number(t);
    if (nivel !== null && nivelJerarquicoValido(nivel) == null) return toast.error('El nivel debe ser un número entero de 1 en adelante.');
    if (nivel === (nivelJerarquicoValido(p.nivelJerarquico))) return;
    await guardar([
      b => b.update(doc(db, 'puestos', p.id), { nivelJerarquico: nivel === null ? deleteField() : nivel }),
      opBitacora({ accion: 'puesto_nivel', entidad: `puestos/${p.id}`, antes: { nivelJerarquico: p.nivelJerarquico ?? null }, despues: { nivelJerarquico: nivel } }, usuario),
    ], nivel === null ? 'Nivel quitado.' : `Nivel ${nivel} guardado.`);
  };

  // ── alias ──
  const quitarAlias = async (p, alias) => {
    const ok = await guardar([
      b => b.update(doc(db, 'puestos', p.id), { alias: arrayRemove(alias) }),
      opBitacora({ accion: 'alias_quitado', entidad: `puestos/${p.id}`, antes: { alias }, despues: null }, usuario),
    ], 'Alias quitado.');
    if (ok) setModal(m => (m ? { ...m, puesto: { ...m.puesto, alias: (m.puesto.alias ?? []).filter(x => x !== alias) } } : m));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 text-xs">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar puesto o alias..."
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--cm-red)]" />
        </div>
        <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className={`${inputCls} !w-auto`}>
          <option value="todas">Todas las áreas</option>
          <option value="sin">Sin área</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className={`${inputCls} !w-auto`}>
          <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
        </select>
        <span className="font-medium text-[var(--text-muted)]">{filtrados.length} puestos</span>
        <button type="button" onClick={() => setAsignar(true)} className={btnSecondary} title="Simula y asigna puestoId y areaId a los empleados">
          <ListChecks className="h-3.5 w-3.5" />Asignar puestos y áreas{sinPuesto > 0 && <span className={chipWarn}>{sinPuesto} sin asignar</span>}
        </button>
        <button type="button" onClick={() => abrir('nuevo')} className={btnPrimary}><Plus className="h-4 w-4" />Nuevo puesto</button>
      </div>

      <div className={tablaWrap}>
        <table className="w-full text-left text-xs">
          <thead className={theadCls}>
            <tr>
              <th className={thCls}>Puesto</th><th className={thCls}>Área</th>
              <th className={`${thCls} text-right`}>Empleados</th>
              <th className={thCls} aria-sort={ordenNivel === 'asc' ? 'ascending' : ordenNivel === 'desc' ? 'descending' : 'none'}>
                <button type="button" onClick={() => setOrdenNivel(o => (o === null ? 'asc' : o === 'asc' ? 'desc' : null))}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold" title="Ordenar por nivel">
                  Nivel{ordenNivel === 'asc' ? <ArrowUp className="h-3 w-3" /> : ordenNivel === 'desc' ? <ArrowDown className="h-3 w-3" /> : null}
                </button>
                <span className="block text-xs font-normal normal-case tracking-normal text-[var(--text-muted)]">1 es el puesto más alto. Sirve para ordenar el organigrama</span>
              </th>
              <th className={thCls}>Alias</th>
              <th className={`${thCls} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                {puestos.length === 0 ? 'Aún no hay puestos. Use «Crear estructura inicial» en la pestaña Áreas.' : 'Sin resultados.'}
              </td></tr>
            )}
            {filtrados.map(p => (
              <tr key={p.id} className={`hover:bg-[var(--bg-surface-secondary)] ${p.activo === false ? 'opacity-60' : ''}`}>
                <td className="px-4 py-2.5 font-semibold text-[var(--text-main)]">{p.nombre}{p.activo === false && <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(inactivo)</span>}</td>
                <td className="px-4 py-2.5">{areasPorId.has(p.areaId) ? nombreArea(p.areaId) : <span className={chipWarn}>{nombreArea(p.areaId)}</span>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{nEmpleados(p.id)}</td>
                <td className="px-4 py-2.5">
                  <input type="number" min={1} step={1} inputMode="numeric" defaultValue={nivelJerarquicoValido(p.nivelJerarquico) ?? ''}
                    key={`${p.id}-${p.nivelJerarquico ?? ''}`} aria-label={`Nivel de ${p.nombre}`} placeholder="—"
                    onBlur={e => guardarNivel(p, e.target.value)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-16 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-xs tabular-nums outline-none focus:border-[var(--cm-red)]" />
                </td>
                <td className="px-4 py-2.5">
                  {(p.alias ?? []).length === 0 ? <span className="text-[var(--text-muted)]">—</span> : (
                    <button type="button" onClick={() => abrir('alias', p)} className={`${chip} cursor-pointer hover:bg-[var(--bg-surface-hover)]`}>
                      {p.alias.length} alias
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button type="button" onClick={() => abrir('editar', p)} className={btnIcon} title="Editar nombre"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => abrir('area', p)} className={btnIcon} title="Cambiar de área"><ArrowRightLeft className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => abrir('alias', p)} className={btnIcon} title="Ver o quitar alias"><Tag className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => cambiarEstado(p)} className={btnIcon} title={p.activo === false ? 'Reactivar' : 'Dar de baja'}><Power className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alta y edición */}
      <Modal isOpen={modal?.tipo === 'nuevo' || modal?.tipo === 'editar'} onClose={cerrar} title={modal?.tipo === 'nuevo' ? 'Nuevo puesto' : 'Editar puesto'}>
        <form onSubmit={modal?.tipo === 'nuevo' ? guardarNuevo : guardarEdicion} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre (se guarda en mayúsculas)</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} autoFocus />
            {similar?.nivel === 'a' && <p className="mt-1 text-xs text-[var(--status-error-text)]">Ya existe «{similar.puesto.nombre}».</p>}
            {similar?.nivel === 'b' && <p className="mt-1 text-xs text-[var(--status-warning-text)]">Se parece a «{similar.puesto.nombre}»; verifique que no sea el mismo.</p>}
            {modal?.tipo === 'editar' && <p className="mt-1 text-xs text-[var(--text-muted)]">El nombre anterior queda como alias y se actualiza el puesto de sus empleados.</p>}
          </div>
          {modal?.tipo === 'nuevo' && (
            <div>
              <label className={labelCls}>Área</label>
              <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} className={inputCls}>
                <option value="">Elija el área…</option>
                {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnSecondary} disabled={guardando} onClick={cerrar}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* Cambio de área */}
      <Modal isOpen={modal?.tipo === 'area'} onClose={cerrar} title={`Cambiar de área: ${modal?.puesto?.nombre ?? ''}`} maxWidth="max-w-xl">
        <div className="space-y-3 text-xs">
          <p>Área actual: <strong>{nombreArea(modal?.puesto?.areaId)}</strong></p>
          <div>
            <label className={labelCls}>Nueva área</label>
            <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} className={inputCls}>
              <option value="">Elija el área…</option>
              {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          {impacto && (
            <div className="space-y-1.5">
              <p className="font-semibold text-[var(--text-main)]">
                Se moverán {impacto.mover.length} empleado(s) de «{nombreArea(modal.puesto.areaId)}» a «{nombreArea(form.areaId)}».
              </p>
              {impacto.mover.length > 0 && (
                <ul className="max-h-40 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded border border-[var(--border-subtle)]">
                  {impacto.mover.map(e => <li key={e.id} className="px-2 py-1"><span className="font-mono font-semibold">{e.nomina ?? e.id}</span> {e.nombre}</li>)}
                </ul>
              )}
              {impacto.conExcepcion.length > 0 && (
                <p className="text-[var(--status-warning-text)]">
                  No se tocan {impacto.conExcepcion.length} con excepción de área: {impacto.conExcepcion.map(e => e.nombre).join(', ')}.
                </p>
              )}
            </div>
          )}
          {error && <p className="text-[var(--status-error-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnSecondary} disabled={guardando} onClick={cerrar}>Cancelar</button>
            <button type="button" className={btnPrimary} disabled={guardando || !impacto} onClick={confirmarArea}>
              {guardando ? 'Guardando...' : 'Confirmar cambio'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Alias */}
      <Modal isOpen={modal?.tipo === 'alias'} onClose={cerrar} title={`Alias de ${modal?.puesto?.nombre ?? ''}`}>
        <div className="space-y-2 text-xs">
          <p className="text-[var(--text-secondary)]">Variantes confirmadas que la importación reconoce sola. Quitar un alias hará que vuelva a preguntar.</p>
          {(modal?.puesto?.alias ?? []).length === 0 ? <p className="text-[var(--text-muted)]">No tiene alias.</p> : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded border border-[var(--border-subtle)]">
              {modal.puesto.alias.map(a => (
                <li key={a} className="flex items-center justify-between px-2 py-1.5">
                  <span className="font-mono">{a}</span>
                  <button type="button" className={btnSecondary} disabled={guardando} onClick={() => quitarAlias(modal.puesto, a)}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-1"><button type="button" className={btnSecondary} onClick={cerrar}>Cerrar</button></div>
        </div>
      </Modal>

      {asignar && (
        <AsignarPuestos areas={areas} puestos={puestos} empleados={empleados} usuario={usuario}
          onClose={() => setAsignar(false)} onHecho={() => { setAsignar(false); recargar(); }} />
      )}
    </div>
  );
}
