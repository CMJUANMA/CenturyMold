/**
 * DescargaTE.jsx — "Descargar tiempo extra" (RH, para nómina y comedor): Excel con TODOS los empleados con tiempo extra autorizado o ya
 * recibido en el periodo y el área elegidos, lleven transporte o no (hojas Detalle, Horas por empleado, Alimentos y Resumen, con el estilo
 * del formato del proveedor). Es aparte del "Formato de rutas" del proveedor, que solo trae a quienes llevan transporte.
 * Periodo: Hoy · Un día (elegir) · Esta semana · Semana anterior · Rango personalizado. Lo usan Recepción y Consulta.
 */
import { useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Download, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import Ayuda from '../../components/Ayuda';
import Modal from '../../components/Modal';
import { formatoFecha } from '../../utils/asignaciones';
import { ESTATUS_DESCARGA, PERIODOS_DESCARGA, rangoDePeriodo } from '../../utils/tiempoExtra';
import { leerSolicitudTE } from '../../utils/tiempoExtraDb';
import { ymd } from '../../utils/fechas';

const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

export default function DescargaTE({ isOpen, onClose, areas, nombresArea, catalogos, nombre }) {
  const toast = useToast();
  const [hoy] = useState(() => ymd());
  const [periodo, setPeriodo] = useState('semana');
  const [dia, setDia] = useState(hoy);
  const [personalizado, setPersonalizado] = useState({ desde: hoy, hasta: hoy });
  const [areaId, setAreaId] = useState('');
  const [progreso, setProgreso] = useState(null); // { hechos, total } | 'buscando'

  const rango = useMemo(() => (periodo === 'rango' ? personalizado : rangoDePeriodo(periodo, hoy, dia)), [periodo, hoy, dia, personalizado]);
  const valido = !!rango?.desde && !!rango?.hasta && rango.desde <= rango.hasta;
  const verFecha = (f) => formatoFecha(`${f}T12:00:00`);

  const descargar = async () => {
    setProgreso('buscando');
    try {
      // estatus + rango de fechas del TE (índice compuesto en firestore.indexes.json); el área se filtra aquí
      const snap = await getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', ESTATUS_DESCARGA), where('fechaTE', '>=', rango.desde), where('fechaTE', '<=', rango.hasta)));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !areaId || t.areaId === areaId);
      if (lista.length === 0) { toast.warning('No hay tiempo extra autorizado en ese periodo.'); return; }
      const completas = [];
      for (let i = 0; i < lista.length; i += 5) {
        const lote = await Promise.all(lista.slice(i, i + 5).map(t => leerSolicitudTE(t.id).then(s => s ?? { ...t, empleados: [] })));
        completas.push(...lote);
        setProgreso({ hechos: completas.length, total: lista.length });
      }
      const ExcelJS = (await import('exceljs')).default;
      const { descargarTiempoExtra } = await import('../../utils/exportarTiempoExtraRH');
      await descargarTiempoExtra({ ExcelJS, solicitudes: completas, nombresArea, catalogos, filtros: { desde: rango.desde, hasta: rango.hasta, areaId }, nombre });
      toast.success(`Excel descargado: ${completas.length} solicitudes.`);
      onClose();
    } catch (err) {
      toast.error(`No se pudo descargar: ${err.message}`, 8000);
    } finally { setProgreso(null); }
  };

  const ocupado = progreso !== null;
  return (
    <Modal isOpen={isOpen} onClose={() => !ocupado && onClose()} title="Descargar tiempo extra" maxWidth="max-w-md" preventCloseOnBackdrop={ocupado}>
      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Para nómina y RH: <b>todos</b> los empleados con tiempo extra autorizado o recibido, lleven transporte o no. Trae detalle por empleado, horas para nómina, alimentos para el comedor y resumen por área y fecha.</p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">El Excel del proveedor (formato de rutas) es otro: solo trae a quienes llevan transporte.</p>
        </div>

        <fieldset>
          <legend className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">Periodo (fecha del tiempo extra)</legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Periodo">
            {PERIODOS_DESCARGA.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${periodo === p.id ? 'border-[var(--cm-red)] bg-[var(--cm-red)] text-white' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>{p.label}</button>
            ))}
          </div>
          <Ayuda clave="descarga.periodo" />
          {periodo === 'dia' && (
            <label className="mt-2 block text-[11px] font-medium text-[var(--text-secondary)]">Día<input type="date" value={dia} onChange={e => setDia(e.target.value)} className={`${campo} mt-0.5 block w-full`} /></label>
          )}
          {periodo === 'rango' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">Desde<input type="date" value={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, desde: e.target.value }))} className={`${campo} mt-0.5 block w-full`} /></label>
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">Hasta<input type="date" value={personalizado.hasta} min={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, hasta: e.target.value }))} className={`${campo} mt-0.5 block w-full`} /></label>
            </div>
          )}
          {valido && <p className="mt-2 text-xs font-semibold text-[var(--text-main)]">{rango.desde === rango.hasta ? verFecha(rango.desde) : `Del ${verFecha(rango.desde)} al ${verFecha(rango.hasta)}`}</p>}
          {!valido && <p className="mt-2 text-xs text-[var(--status-warning-text)]">{periodo === 'rango' ? 'La fecha inicial no puede ser posterior a la final.' : 'Elige el día.'}</p>}
        </fieldset>

        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Área
          <select value={areaId} onChange={e => setAreaId(e.target.value)} className={`${campo} mt-0.5 block w-full`}>
            <option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={ocupado} className="cursor-pointer rounded-md border border-[var(--border-color)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50">Cerrar</button>
          <button type="button" id="btn-descargar-te" onClick={descargar} disabled={!valido || ocupado}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] disabled:opacity-50">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {progreso === 'buscando' ? 'Buscando…' : progreso ? `Leyendo empleados ${progreso.hechos}/${progreso.total}…` : 'Descargar Excel'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
