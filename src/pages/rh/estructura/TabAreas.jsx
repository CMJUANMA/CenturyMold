/**
 * TabAreas.jsx — Áreas: nombre, participa en TE, número de puestos y de empleados; alta, edición y baja lógica.
 */
import { useState } from 'react';
import { doc } from 'firebase/firestore';
import { Pencil, Plus, Power, Sparkles } from 'lucide-react';
import { db } from '../../../firebase';
import Modal from '../../../components/Modal';
import { esActivo } from '../../../utils/activo';
import { puestosActivosDeArea } from '../../../utils/estructura';
import { slugPuesto } from '../../../utils/puestos';
import { opBitacora } from '../../../utils/estructuraDb';
import EstructuraInicial from './EstructuraInicial';
import { btnIcon, btnPrimary, btnSecondary, chip, chipWarn, inputCls, labelCls, tablaWrap, theadCls, thCls } from './ui';

const vacio = { nombre: '', participaTE: true, orden: 1 };

export default function TabAreas({ areas, puestos, empleados, usuario, toast, guardar, recargar, soloLectura = false }) {
  const [modal, setModal] = useState(null); // { modo: 'crear' | 'editar', area? }
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [inicial, setInicial] = useState(false);

  const ordenadas = [...areas].sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  const nPuestos = (id) => puestos.filter(p => p.areaId === id && p.activo !== false).length;
  const nEmpleados = (id) => empleados.filter(e => e.areaId === id && esActivo(e)).length;

  const abrirCrear = () => {
    setForm({ ...vacio, orden: Math.max(0, ...areas.map(a => a.orden ?? 0)) + 1 });
    setError(''); setModal({ modo: 'crear' });
  };
  const abrirEditar = (a) => {
    setForm({ nombre: a.nombre ?? '', participaTE: a.participaTE === true, orden: a.orden ?? 1 });
    setError(''); setModal({ modo: 'editar', area: a });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().replace(/\s+/g, ' ');
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    const orden = Number(form.orden);
    if (!Number.isFinite(orden)) { setError('El orden debe ser un número.'); return; }
    const clave = slugPuesto(nombre);
    if (areas.some(a => a.id !== modal.area?.id && (a.id === clave || slugPuesto(a.nombre ?? '') === clave))) {
      setError('Ya existe un área con ese nombre.'); return;
    }
    setGuardando(true); setError('');
    const datos = { nombre, participaTE: !!form.participaTE, orden };
    const ok = modal.modo === 'crear'
      ? await guardar([
        b => b.set(doc(db, 'areas', clave), { ...datos, activa: true }),
        opBitacora({ accion: 'area_creada', entidad: `areas/${clave}`, despues: datos }, usuario),
      ], 'Área creada.')
      : await guardar([
        b => b.update(doc(db, 'areas', modal.area.id), datos),
        opBitacora({
          accion: 'area_editada', entidad: `areas/${modal.area.id}`,
          antes: { nombre: modal.area.nombre ?? '', participaTE: modal.area.participaTE ?? null, orden: modal.area.orden ?? null }, despues: datos,
        }, usuario),
      ], 'Área actualizada.');
    setGuardando(false);
    if (ok) setModal(null);
  };

  const cambiarEstado = async (a) => {
    const activa = a.activa !== false;
    if (activa) {
      const vivos = puestosActivosDeArea(puestos, a.id);
      if (vivos.length > 0) {
        toast.error(`No se puede desactivar "${a.nombre}": tiene ${vivos.length} puesto(s) activo(s). Muévalos a otra área primero (pestaña Puestos).`, 7000);
        return;
      }
    }
    await guardar([
      b => b.update(doc(db, 'areas', a.id), { activa: !activa }),
      opBitacora({ accion: activa ? 'area_baja' : 'area_reactivada', entidad: `areas/${a.id}`, antes: { activa }, despues: { activa: !activa } }, usuario),
    ], activa ? 'Área desactivada.' : 'Área reactivada.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-secondary)]">
          Cada puesto pertenece a un área y de ahí sale el área de sus empleados. Una baja es lógica y solo se puede si el área no tiene puestos activos.
        </p>
        {!soloLectura && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setInicial(true)} className={btnSecondary}><Sparkles className="h-3.5 w-3.5" />Crear estructura inicial</button>
            <button type="button" onClick={abrirCrear} className={btnPrimary}><Plus className="h-4 w-4" />Nueva área</button>
          </div>
        )}
      </div>

      <div className={tablaWrap}>
        <table className="w-full text-left text-xs">
          <thead className={theadCls}>
            <tr>
              <th className={thCls}>Área</th><th className={thCls}>Participa en TE</th>
              <th className={`${thCls} text-right`}>Puestos</th><th className={`${thCls} text-right`}>Empleados</th>
              <th className={thCls}>Estado</th>{!soloLectura && <th className={`${thCls} text-right`}>Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {ordenadas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                {soloLectura ? 'Aún no hay áreas.' : 'Aún no hay áreas. Use «Crear estructura inicial» para cargar las áreas y el catálogo de puestos.'}
              </td></tr>
            )}
            {ordenadas.map(a => (
              <tr key={a.id} className="hover:bg-[var(--bg-surface-secondary)]">
                <td className="px-4 py-2.5 font-semibold text-[var(--text-main)]">
                  {a.nombre ?? a.id} <span className="font-mono text-xs font-normal text-[var(--text-muted)]">{a.id}</span>
                  {a.participaTE === undefined && <span className={`${chipWarn} ml-2`} title="Área de la colección anterior, sin los campos nuevos">heredada</span>}
                </td>
                <td className="px-4 py-2.5">{a.participaTE === true ? <span className={chip}>Sí</span> : <span className="text-[var(--text-muted)]">No</span>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{nPuestos(a.id)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{nEmpleados(a.id)}</td>
                <td className="px-4 py-2.5">{a.activa === false ? <span className="text-[var(--text-muted)]">Inactiva</span> : 'Activa'}</td>
                {!soloLectura && <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => abrirEditar(a)} className={btnIcon} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => cambiarEstado(a)} className={btnIcon} title={a.activa === false ? 'Reactivar' : 'Dar de baja'}><Power className="h-3.5 w-3.5" /></button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!modal} onClose={() => !guardando && setModal(null)} title={modal?.modo === 'crear' ? 'Nueva área' : 'Editar área'}>
        <form onSubmit={handleGuardar} className="space-y-3">
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} autoFocus />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={form.participaTE} onChange={e => setForm(f => ({ ...f, participaTE: e.target.checked }))} className="accent-[var(--accent)]" />
            Participa en tiempo extra
          </label>
          <div>
            <label className={labelCls}>Orden</label>
            <input type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} className={inputCls} />
          </div>
          {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={btnSecondary} disabled={guardando} onClick={() => setModal(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {inicial && (
        <EstructuraInicial areas={areas} puestos={puestos} usuario={usuario} toast={toast}
          onClose={() => setInicial(false)} onHecho={() => { setInicial(false); recargar(); }} />
      )}
    </div>
  );
}
