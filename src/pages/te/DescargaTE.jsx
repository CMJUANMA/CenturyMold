/**
 * DescargaTE.jsx — "Descargar resumen de horas extra" (RH, para nómina y comedor): un panel con periodo (botones grandes), área y qué incluir,
 * una vista previa de lo que se va a descargar ANTES de bajar el archivo (si no hay datos lo dice y no descarga un Excel vacío) y una línea
 * por hoja del Excel (Detalle, Horas por empleado, Alimentos y Resumen, con el estilo del formato del proveedor). Es aparte del
 * "Formato de rutas" del proveedor, que solo trae a quienes llevan transporte.
 * Periodo: Hoy · Ayer · Esta semana · Semana anterior · Este mes · Personalizado. Es EL mismo panel en Recepción y en Consulta:
 * ambas usan BotonDescargaResumenTE.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import Ayuda from '../../components/Ayuda';
import Modal from '../../components/Modal';
import { INCLUIR_DESCARGA, PERIODOS_DESCARGA, estatusDeIncluir, rangoDePeriodo } from '../../utils/tiempoExtra';
import { leerSolicitudTE } from '../../utils/tiempoExtraDb';
import { textoRango, ymd } from '../../utils/fechas';

const campo = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

const HOJAS = [
  ['Detalle', 'una fila por empleado y por día: horario, horas, alimentos, transporte, ruta y quién autorizó.'],
  ['Horas por empleado', 'los días con tiempo extra y las horas totales de cada persona (para nómina).'],
  ['Alimentos', 'cuántos alimentos hay por fecha y horario (para el comedor).'],
  ['Resumen', 'solicitudes, empleados y horas por fecha y área.'],
];

/** Solicitudes (sin sus empleados) del periodo: estatus + rango de fechas del TE (índice compuesto); el área se filtra aquí */
async function consultar({ desde, hasta, areaId, incluir }) {
  const snap = await getDocs(query(collection(db, 'tiempoExtra'), where('estatus', 'in', estatusDeIncluir(incluir)), where('fechaTE', '>=', desde), where('fechaTE', '<=', hasta)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !areaId || t.areaId === areaId);
}

const suma = (lista, c) => lista.reduce((a, t) => a + (t.resumen?.[c] ?? 0), 0);
const redondeo = (n) => Math.round(n * 100) / 100;

/** Botón "Descargar resumen de horas extra" con su ayuda y el panel; lo usan Recepción y Consulta */
export function BotonDescargaResumenTE({ areas, nombresArea, catalogos, nombre, id = 'btn-descargar-resumen-te', icono: Icono = Download }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" id={id} onClick={() => setAbierto(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]">
        <Icono className="h-4 w-4" />Descargar resumen de horas extra
      </button>
      <Ayuda clave="descarga.tiempoExtra" />
      {abierto && <DescargaTE isOpen onClose={() => setAbierto(false)} areas={areas} nombresArea={nombresArea} catalogos={catalogos} nombre={nombre} />}
    </>
  );
}

export default function DescargaTE({ isOpen, onClose, areas, nombresArea, catalogos, nombre }) {
  const toast = useToast();
  const [hoy] = useState(() => ymd());
  const [periodo, setPeriodo] = useState('semana');
  const [personalizado, setPersonalizado] = useState({ desde: hoy, hasta: hoy });
  const [areaId, setAreaId] = useState('');
  const [incluir, setIncluir] = useState(INCLUIR_DESCARGA[0].id);
  const [progreso, setProgreso] = useState(null); // { hechos, total } | 'buscando'
  const [vista, setVista] = useState({ clave: null, lista: [], error: '' });

  const rango = useMemo(() => (periodo === 'rango' ? personalizado : rangoDePeriodo(periodo, hoy)), [periodo, hoy, personalizado]);
  const valido = !!rango?.desde && !!rango?.hasta && rango.desde <= rango.hasta;
  const clave = valido ? `${rango.desde}|${rango.hasta}|${areaId}|${incluir}` : null;

  // Vista previa: se vuelve a consultar al cambiar periodo, área o "incluir"
  useEffect(() => {
    if (!isOpen || !clave) return;
    let vigente = true;
    consultar({ desde: rango.desde, hasta: rango.hasta, areaId, incluir })
      .then(lista => { if (vigente) setVista({ clave, lista, error: '' }); })
      .catch(err => { if (vigente) setVista({ clave, lista: [], error: err.message }); });
    return () => { vigente = false; };
  }, [isOpen, clave, rango, areaId, incluir]);

  const previa = clave && vista.clave === clave ? vista : null;
  const cargandoPrevia = !!clave && !previa;
  const sinDatos = !!previa && !previa.error && previa.lista.length === 0;
  const ocupado = progreso !== null;

  const descargar = async () => {
    setProgreso('buscando');
    try {
      const lista = await consultar({ desde: rango.desde, hasta: rango.hasta, areaId, incluir });
      if (lista.length === 0) { toast.warning('No hay tiempo extra en ese periodo: no se descargó nada.'); setVista({ clave, lista: [], error: '' }); return; }
      const completas = [];
      for (let i = 0; i < lista.length; i += 5) {
        const lote = await Promise.all(lista.slice(i, i + 5).map(t => leerSolicitudTE(t.id).then(s => s ?? { ...t, empleados: [] })));
        completas.push(...lote);
        setProgreso({ hechos: completas.length, total: lista.length });
      }
      const ExcelJS = (await import('exceljs')).default;
      const { descargarTiempoExtra } = await import('../../utils/exportarTiempoExtraRH');
      await descargarTiempoExtra({
        ExcelJS, solicitudes: completas, nombresArea, catalogos, nombre,
        filtros: { desde: rango.desde, hasta: rango.hasta, areaId, estatus: estatusDeIncluir(incluir) },
      });
      toast.success(`Excel descargado: ${completas.length} ${completas.length === 1 ? 'solicitud' : 'solicitudes'}.`);
      onClose();
    } catch (err) {
      toast.error(`No se pudo descargar: ${err.message}`, 8000);
    } finally { setProgreso(null); }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !ocupado && onClose()} title="Descargar resumen de horas extra" maxWidth="max-w-xl" preventCloseOnBackdrop={ocupado}>
      <div className="space-y-5 text-sm">
        <p className="text-xs text-[var(--text-secondary)]">
          Para nómina y comedor: <b>todos</b> los empleados con tiempo extra, lleven transporte o no. El Excel del proveedor (formato de rutas) es otro: solo trae a quienes llevan transporte.
        </p>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-bold text-[var(--text-main)]">Periodo <span className="font-normal text-[var(--text-muted)]">(fecha del tiempo extra)</span></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Periodo">
            {PERIODOS_DESCARGA.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}
                className={`min-h-12 cursor-pointer rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${periodo === p.id ? 'border-[var(--cm-red)] bg-[var(--cm-red)] text-white' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>{p.label}</button>
            ))}
          </div>
          <Ayuda clave="descarga.periodo" />
          {periodo === 'rango' && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">Fecha de inicio<input type="date" value={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, desde: e.target.value }))} className={`${campo} mt-0.5 block w-full`} /></label>
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">Fecha final<input type="date" value={personalizado.hasta} min={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, hasta: e.target.value }))} className={`${campo} mt-0.5 block w-full`} /></label>
            </div>
          )}
          {valido
            ? <p className="mt-2 text-sm font-semibold text-[var(--text-main)]" aria-live="polite">{textoRango(rango.desde, rango.hasta, hoy)}</p>
            : <p className="mt-2 text-xs text-[var(--status-warning-text)]">{rango?.desde && rango?.hasta ? 'La fecha de inicio no puede ser posterior a la final.' : 'Elige las dos fechas.'}</p>}
        </fieldset>

        <label className="block text-xs font-bold text-[var(--text-main)]">Área
          <select value={areaId} onChange={e => setAreaId(e.target.value)} className={`${campo} mt-1 block w-full font-normal`}>
            <option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>

        <fieldset>
          <legend className="mb-1.5 block text-xs font-bold text-[var(--text-main)]">Incluir</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Incluir">
            {INCLUIR_DESCARGA.map(i => (
              <button key={i.id} type="button" role="radio" aria-checked={incluir === i.id} onClick={() => setIncluir(i.id)}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${incluir === i.id ? 'border-[var(--cm-red)] bg-[var(--bg-surface-secondary)] text-[var(--accent-text)]' : 'border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]'}`}>
                {i.label}
                <span className="mt-0.5 block text-[11px] font-normal text-[var(--text-secondary)]">
                  {i.id === 'confirmadas' ? 'Solo lo que RH ya confirmó y generó su transporte.' : 'Lo autorizado por la Aut. 2, aunque RH aún no lo confirme.'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <section aria-label="Vista previa" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Vista previa</h3>
          {!valido ? <p className="text-xs text-[var(--text-muted)]">Elige un periodo válido para ver cuánto se va a descargar.</p>
            : cargandoPrevia ? <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Calculando…</p>
            : previa.error ? <p role="alert" className="text-xs text-[var(--status-error-text)]">No se pudo calcular: {previa.error}</p>
            : sinDatos ? <p className="text-xs font-semibold text-[var(--status-warning-text)]">No hay tiempo extra con esas opciones. Cambia el periodo, el área o lo que se incluye: no se descargará un archivo vacío.</p>
            : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[['Solicitudes', previa.lista.length], ['Empleados', suma(previa.lista, 'totalEmpleados')], ['Horas totales', redondeo(suma(previa.lista, 'totalHoras'))], ['Alimentos', suma(previa.lista, 'totalAlimentos')]].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{k}</dt>
                      <dd className="text-xl font-bold text-[var(--text-main)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Los empleados se cuentan una vez por cada día en que hacen tiempo extra.</p>
              </>
            )}
        </section>

        <section aria-label="Hojas del Excel">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]"><FileSpreadsheet className="h-3.5 w-3.5" />El Excel trae 4 hojas</h3>
          <ul className="space-y-0.5 text-xs text-[var(--text-secondary)]">
            {HOJAS.map(([n, d]) => <li key={n}><b className="text-[var(--text-main)]">{n}:</b> {d}</li>)}
          </ul>
        </section>

        <div className="flex justify-end gap-2 border-t border-[var(--border-color)] pt-3">
          <button type="button" onClick={onClose} disabled={ocupado} className="cursor-pointer rounded-md border border-[var(--border-color)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50">Cerrar</button>
          <button type="button" id="btn-descargar-te" onClick={descargar} disabled={!valido || ocupado || cargandoPrevia || sinDatos || !!previa?.error}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--cm-red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cm-red-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {progreso === 'buscando' ? 'Buscando…' : progreso ? `Leyendo empleados ${progreso.hechos}/${progreso.total}…` : 'Descargar Excel'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
