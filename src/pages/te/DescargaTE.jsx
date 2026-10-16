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
import { Download, FileSpreadsheet } from 'lucide-react';
import { db } from '../../firebase';
import { useToast } from '../../hooks/useToast';
import Ayuda from '../../components/Ayuda';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada, Selector } from '../../components/ui/Campo';
import { Esqueleto } from '../../components/ui/Esqueleto';
import { INCLUIR_DESCARGA, PERIODOS_DESCARGA, estatusDeIncluir, rangoDePeriodo } from '../../utils/tiempoExtra';
import { leerSolicitudTE } from '../../utils/tiempoExtraDb';
import { textoRango, ymd } from '../../utils/fechas';

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
      <Boton id={id} icono={Icono} onClick={() => setAbierto(true)}>Descargar resumen de horas extra</Boton>
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
      <div className="space-y-6 text-sm">
        <p className="text-sm text-[var(--text-secondary)]">
          Para nómina y comedor: <b className="font-medium text-[var(--text-main)]">todos</b> los empleados con tiempo extra, lleven transporte o no. El Excel del proveedor (formato de rutas) es otro: solo trae a quienes llevan transporte.
        </p>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Periodo <span className="font-normal text-[var(--text-muted)]">(fecha del tiempo extra)</span></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Periodo">
            {PERIODOS_DESCARGA.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => setPeriodo(p.id)}
                className={`min-h-11 cursor-pointer rounded-md border px-3 text-sm font-medium transition-colors duration-150 ${periodo === p.id
                  ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)] text-[var(--text-main)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'}`}>{p.label}</button>
            ))}
          </div>
          <Ayuda clave="descarga.periodo" />
          {periodo === 'rango' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha de inicio"><Entrada type="date" value={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, desde: e.target.value }))} /></Campo>
              <Campo etiqueta="Fecha final"><Entrada type="date" value={personalizado.hasta} min={personalizado.desde} onChange={e => setPersonalizado(r => ({ ...r, hasta: e.target.value }))} /></Campo>
            </div>
          )}
          {valido
            ? <p className="mt-3 text-sm font-medium text-[var(--text-main)]" aria-live="polite">{textoRango(rango.desde, rango.hasta, hoy)}</p>
            : <p className="mt-3 text-xs text-[var(--status-warning-text)]">{rango?.desde && rango?.hasta ? 'La fecha de inicio no puede ser posterior a la final.' : 'Elige las dos fechas.'}</p>}
        </fieldset>

        <Campo etiqueta="Área">
          <Selector value={areaId} onChange={e => setAreaId(e.target.value)}>
            <option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Selector>
        </Campo>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Incluir</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Incluir">
            {INCLUIR_DESCARGA.map(i => (
              <button key={i.id} type="button" role="radio" aria-checked={incluir === i.id} onClick={() => setIncluir(i.id)}
                className={`min-h-11 cursor-pointer rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 ${incluir === i.id
                  ? 'border-[var(--text-main)] bg-[var(--bg-surface-hover)] text-[var(--text-main)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]'}`}>
                {i.label}
                <span className="mt-0.5 block text-xs font-normal text-[var(--text-secondary)]">
                  {i.id === 'confirmadas' ? 'Solo lo que RH ya confirmó y generó su transporte.' : 'Lo autorizado por la Aut. 2, aunque RH aún no lo confirme.'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <section aria-label="Vista previa" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-main)]">Vista previa</h3>
          {!valido ? <p className="text-xs text-[var(--text-muted)]">Elige un periodo válido para ver cuánto se va a descargar.</p>
            : cargandoPrevia ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="status" aria-label="Calculando">{[0, 1, 2, 3].map(i => <Esqueleto key={i} className="h-14" />)}</div>
            : previa.error ? <Aviso tono="error">No se pudo calcular: {previa.error}. Vuelve a intentarlo.</Aviso>
            : sinDatos ? <Aviso tono="aviso">No hay tiempo extra con esas opciones. Cambia el periodo, el área o lo que se incluye: no se descargará un archivo vacío.</Aviso>
            : (
              <>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[['Solicitudes', previa.lista.length], ['Empleados', suma(previa.lista, 'totalEmpleados')], ['Horas totales', redondeo(suma(previa.lista, 'totalHoras'))], ['Alimentos', suma(previa.lista, 'totalAlimentos')]].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                      <dt className="text-xs text-[var(--text-muted)]">{k}</dt>
                      <dd className="text-xl font-medium tabular-nums text-[var(--text-main)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Los empleados se cuentan una vez por cada día en que hacen tiempo extra.</p>
              </>
            )}
        </section>

        <section aria-label="Hojas del Excel">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />El Excel trae 4 hojas</h3>
          <ul className="space-y-0.5 text-xs text-[var(--text-secondary)]">
            {HOJAS.map(([n, d]) => <li key={n}><b className="font-medium text-[var(--text-main)]">{n}:</b> {d}</li>)}
          </ul>
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
          <Boton onClick={onClose} disabled={ocupado}>Cerrar</Boton>
          <Boton id="btn-descargar-te" variante="primario" icono={Download} estado={ocupado ? 'cargando' : undefined} onClick={descargar} disabled={!valido || ocupado || cargandoPrevia || sinDatos || !!previa?.error}>
            {progreso === 'buscando' ? 'Buscando…' : progreso ? `Leyendo empleados ${progreso.hechos}/${progreso.total}…` : 'Descargar Excel'}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
