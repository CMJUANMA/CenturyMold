/**
 * TabPendientes.jsx — Empleados con excepción de área (con su motivo), empleados cuyo puesto no tiene área,
 * empleados con el área desfasada respecto a su puesto y puestos sin un área válida.
 */
import { useMemo, useState } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { esActivo } from '../../../utils/activo';
import { areaEfectiva } from '../../../utils/estructura';
import { opBitacora } from '../../../utils/estructuraDb';
import { btnSecondary, chip, chipWarn, tablaWrap, theadCls, thCls } from './ui';

function Seccion({ titulo, vacio, hijos, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[var(--text-main)]">{titulo} <span className="font-normal text-[var(--text-muted)]">({hijos})</span></h2>
      {hijos === 0 ? <p className="text-xs text-[var(--text-muted)]">{vacio}</p> : children}
    </section>
  );
}

function Tabla({ filas, extra }) {
  return (
    <div className={tablaWrap}>
      <table className="w-full text-left text-xs">
        <thead className={theadCls}><tr><th className={thCls}>Nómina</th><th className={thCls}>Nombre</th><th className={thCls}>Puesto</th>{extra && <th className={thCls}>{extra.titulo}</th>}</tr></thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {filas.slice(0, 300).map(e => (
            <tr key={e.id} className="hover:bg-[var(--bg-surface-secondary)]">
              <td className="px-4 py-2 font-mono font-semibold">{e.nomina ?? e.id}</td>
              <td className="px-4 py-2">{e.nombre}</td>
              <td className="px-4 py-2">{e.puesto || '—'}</td>
              {extra && <td className="px-4 py-2">{extra.celda(e)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {filas.length > 300 && <p className="px-4 py-2 text-center text-xs text-[var(--text-muted)]">Mostrando 300 de {filas.length}.</p>}
    </div>
  );
}

export default function TabPendientes({ areas, puestos, empleados, usuario, guardar }) {
  const [trabajando, setTrabajando] = useState(false);
  const areasPorId = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const puestosPorId = useMemo(() => new Map(puestos.map(p => [p.id, p])), [puestos]);
  const nombreArea = (id) => areasPorId.get(id)?.nombre ?? (id || 'Sin área');
  const activos = empleados.filter(esActivo);

  const conExcepcion = activos.filter(e => e.areaExcepcion);
  const sinArea = activos.filter(e => !e.areaExcepcion && !areasPorId.has(puestosPorId.get(e.puestoId)?.areaId));
  const desfasados = activos.filter(e => (e.puestoId || e.areaExcepcion) && !sinArea.includes(e) && e.areaId !== areaEfectiva(e, puestosPorId));
  const puestosSinArea = puestos.filter(p => p.activo !== false && !areasPorId.get(p.areaId)?.nombre);

  const quitarExcepcion = async (e) => {
    const areaPuesto = puestosPorId.get(e.puestoId)?.areaId ?? '';
    setTrabajando(true);
    await guardar([
      b => b.update(doc(db, 'empleados', String(e.id)), { areaExcepcion: null, areaExcepcionMotivo: '', areaId: areaPuesto }),
      opBitacora({
        accion: 'excepcion_quitada', entidad: `empleados/${e.id}`,
        antes: { areaExcepcion: e.areaExcepcion, motivo: e.areaExcepcionMotivo ?? '' }, despues: { areaId: areaPuesto },
      }, usuario),
    ], 'Excepción quitada.');
    setTrabajando(false);
  };

  const sincronizar = async () => {
    setTrabajando(true);
    await guardar([
      ...desfasados.map(e => (b) => b.update(doc(db, 'empleados', String(e.id)), { areaId: areaEfectiva(e, puestosPorId) })),
      opBitacora({ accion: 'areas_sincronizadas', entidad: 'empleados', despues: { empleados: desfasados.length } }, usuario),
    ], `${desfasados.length} empleados sincronizados.`);
    setTrabajando(false);
  };

  return (
    <div className="space-y-6">
      <Seccion titulo="Excepciones de área" hijos={conExcepcion.length} vacio="Ningún empleado tiene excepción de área.">
        <Tabla filas={conExcepcion} extra={{
          titulo: 'Excepción',
          celda: (e) => (
            <span className="flex flex-wrap items-center gap-2">
              <span className={chip}>{nombreArea(puestosPorId.get(e.puestoId)?.areaId)} → {nombreArea(e.areaExcepcion)}</span>
              <span className="text-[var(--text-secondary)]">{e.areaExcepcionMotivo || '(sin motivo)'}</span>
              <button type="button" className={btnSecondary} disabled={trabajando} onClick={() => quitarExcepcion(e)}>Quitar</button>
            </span>
          ),
        }} />
      </Seccion>

      <Seccion titulo="Empleados cuyo puesto no tiene área" hijos={sinArea.length}
        vacio="Todos los empleados activos tienen un puesto con área.">
        <p className="text-xs text-[var(--text-secondary)]">
          Sin puestoId, o con un puesto sin área válida. Use «Asignar puestos y áreas» en la pestaña Puestos, o corrija el área del puesto.
        </p>
        <Tabla filas={sinArea} extra={{ titulo: 'Situación', celda: (e) => <span className={chipWarn}>{e.puestoId ? 'puesto sin área' : 'sin puestoId'}</span> }} />
      </Seccion>

      <Seccion titulo="Área desactualizada" hijos={desfasados.length} vacio="El área de todos coincide con la de su puesto (o su excepción).">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[var(--text-secondary)]">Su areaId no coincide con el área efectiva (por ejemplo, tras un cambio de área interrumpido).</p>
          <button type="button" className={btnSecondary} disabled={trabajando} onClick={sincronizar}>Sincronizar {desfasados.length}</button>
        </div>
        <Tabla filas={desfasados} extra={{ titulo: 'areaId → efectiva', celda: (e) => `${nombreArea(e.areaId)} → ${nombreArea(areaEfectiva(e, puestosPorId))}` }} />
      </Seccion>

      <Seccion titulo="Puestos activos sin área válida" hijos={puestosSinArea.length} vacio="Todos los puestos activos tienen un área.">
        <ul className="flex flex-wrap gap-1.5">{puestosSinArea.map(p => <li key={p.id} className={chipWarn}>{p.nombre}</li>)}</ul>
      </Seccion>
    </div>
  );
}
