/**
 * DescargaTE.jsx — "Descargar tiempo extra" (RH): Excel con el tiempo extra AUTORIZADO y ya recibido de un rango de fechas y un área
 * (hojas Detalle, Horas por empleado, Alimentos y Resumen, con el estilo del formato del proveedor). Va aparte del Excel del proveedor.
 * Lo usan Recepción y Consulta.
 */
import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Download, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import Modal from '../../components/Modal';
import { ESTATUS_DESCARGA } from '../../utils/tiempoExtra';
import { leerSolicitudTE } from '../../utils/tiempoExtraDb';
import { ymd } from '../../utils/fechas';

const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

/** Primer y último día del mes de hoy ('AAAA-MM-DD') */
function mesActual() {
  const hoy = new Date();
  return [ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), ymd(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))];
}

export default function DescargaTE({ isOpen, onClose, areas, nombresArea, catalogos, nombre }) {
  const toast = useToast();
  const [[mesDesde, mesHasta]] = useState(mesActual);
  const [desde, setDesde] = useState(mesDesde);
  const [hasta, setHasta] = useState(mesHasta);
  const [areaId, setAreaId] = useState('');
  const [progreso, setProgreso] = useState(null); // { hechos, total } | 'buscando'

  const valido = !!desde && !!hasta && desde <= hasta;

  const descargar = async () => {
    setProgreso('buscando');
    try {
      // estatus + rango de fechas del TE (índice compuesto en firestore.indexes.json); el área se filtra aquí
      const snap = await getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', ESTATUS_DESCARGA), where('fechaTE', '>=', desde), where('fechaTE', '<=', hasta)));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !areaId || t.areaId === areaId);
      if (lista.length === 0) { toast.warning('No hay tiempo extra autorizado en ese rango.'); return; }
      const completas = [];
      for (let i = 0; i < lista.length; i += 5) {
        const lote = await Promise.all(lista.slice(i, i + 5).map(t => leerSolicitudTE(t.id).then(s => s ?? { ...t, empleados: [] })));
        completas.push(...lote);
        setProgreso({ hechos: completas.length, total: lista.length });
      }
      const ExcelJS = (await import('exceljs')).default;
      const { descargarTiempoExtra } = await import('../../utils/exportarTiempoExtraRH');
      await descargarTiempoExtra({ ExcelJS, solicitudes: completas, nombresArea, catalogos, filtros: { desde, hasta, areaId }, nombre });
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
        <p className="text-xs text-[var(--text-secondary)]">Tiempo extra autorizado y ya recibido: detalle por empleado, horas para nómina, alimentos para el comedor y resumen por área y fecha.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-medium text-[var(--text-secondary)]">Fecha del TE desde<input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={`${campo} mt-0.5 block w-full`} /></label>
          <label className="text-[11px] font-medium text-[var(--text-secondary)]">hasta<input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={`${campo} mt-0.5 block w-full`} /></label>
        </div>
        <label className="block text-[11px] font-medium text-[var(--text-secondary)]">Área
          <select value={areaId} onChange={e => setAreaId(e.target.value)} className={`${campo} mt-0.5 block w-full`}>
            <option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        {!valido && <p className="text-xs text-[var(--status-warning-text)]">La fecha inicial no puede ser posterior a la final.</p>}
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
