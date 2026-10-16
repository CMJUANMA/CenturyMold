/**
 * FormatoRutas.jsx — Botón "Formato de rutas (proveedor)" y su panel: el Excel para el proveedor de transporte con los empleados que
 * llevan transporte, de las solicitudes de transporte de una fecha (Hoy · Mañana · una fecha · un rango). Muestra cuántas encontró ANTES
 * de descargar y no baja un Excel vacío. Lo usan "Por enviar al proveedor" (para confirmar y descargar en la misma pantalla) y
 * "Solicitudes de transporte". Las solicitudes de tiempo extra ya nacen aprobadas; con el transporte suelto encendido (funciones.js)
 * se puede incluir también las pendientes.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FileDown, Loader2, XCircle } from 'lucide-react';
import { db } from '../firebase';
import { FUNCIONES } from '../funciones';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useToast } from '../hooks/useToast';
import { ESTATUS_SOLICITUD } from '../utils/constantes';
import { exportarSolicitudes } from '../utils/exportarSolicitudes';
import Ayuda from './Ayuda';
import Modal from './Modal';

const inputCls = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--cm-red)]';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function fechasLocales() {
  const d = new Date();
  const hoy = iso(d);
  d.setDate(d.getDate() + 1);
  return { hoy, manana: iso(d) };
}

export default function BotonFormatoRutas({ id = 'btn-formato-rutas' }) {
  const toast = useToast();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const { areas } = useAreas();
  const catalogos = useMemo(() => ({ rutas, comunidades, puntos, areas }), [rutas, comunidades, puntos, areas]);
  const conPendientes = FUNCIONES.transporteSuelto;

  const [abierto, setAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);
  const { hoy, manana } = useMemo(fechasLocales, []);
  const [tipoFecha, setTipoFecha] = useState('manana');
  const [esRango, setEsRango] = useState(false);
  const [elegida, setElegida] = useState(manana);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [aprobadas, setAprobadas] = useState(true);
  const [pendientes, setPendientes] = useState(false);
  const [candidatas, setCandidatas] = useState({ clave: '', lista: [] });

  const rangoDesde = tipoFecha === 'hoy' ? hoy : tipoFecha === 'manana' ? manana : (esRango ? desde : elegida);
  const rangoHasta = tipoFecha === 'hoy' ? hoy : tipoFecha === 'manana' ? manana : (esRango ? hasta : elegida);
  const valido = !!rangoDesde && !!rangoHasta && rangoDesde <= rangoHasta;
  const clave = `${rangoDesde}|${rangoHasta}`;

  // Solo se consulta con el panel abierto y para el rango elegido; una respuesta de un rango anterior se ignora
  useEffect(() => {
    if (!abierto || !valido) return;
    let vigente = true;
    getDocs(query(collection(db, 'solicitudes'), where('fechaServicio', '>=', rangoDesde), where('fechaServicio', '<=', rangoHasta)))
      .then(snap => { if (vigente) setCandidatas({ clave, lista: snap.docs.map(d => ({ id: d.id, ...d.data(), estatus: d.data().estatus?.toLowerCase() || ESTATUS_SOLICITUD.PENDIENTE })) }); })
      .catch(err => {
        if (!vigente) return;
        toast.error('No se pudieron consultar las solicitudes a exportar: ' + err.message);
        setCandidatas({ clave, lista: [] });
      });
    return () => { vigente = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, valido, clave]);

  const cargando = abierto && valido && candidatas.clave !== clave;
  const paraExportar = (candidatas.clave === clave ? candidatas.lista : []).filter(s => {
    if (s.estatus === ESTATUS_SOLICITUD.APROBADA) return aprobadas;
    if (s.estatus === ESTATUS_SOLICITUD.PENDIENTE) return conPendientes && pendientes;
    return false;
  });
  const totalPasajeros = paraExportar.reduce((a, s) => a + (s.totalPasajeros || 0), 0);

  // Los pasajeros se leen solo al exportar (en tandas para no saturar la red)
  const descargar = async () => {
    const sufijo = esRango && tipoFecha === 'elegir' ? `${desde}_a_${hasta}` : rangoDesde;
    setExportando(true);
    try {
      const conPasajeros = [];
      for (let i = 0; i < paraExportar.length; i += 20) {
        const tanda = await Promise.all(paraExportar.slice(i, i + 20).map(async (sol) => {
          const ps = await getDocs(collection(db, `solicitudes/${sol.id}/pasajeros`));
          return { ...sol, pasajeros: ps.docs.map(d => d.data()) };
        }));
        conPasajeros.push(...tanda);
      }
      await exportarSolicitudes(conPasajeros, catalogos, toast, `Transporte_${sufijo}.xlsx`);
      setAbierto(false);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo exportar: ' + err.message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="max-w-[15rem]">
      <button type="button" id={id} onClick={() => setAbierto(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--status-success-text)] px-3 py-1.5 text-xs text-white hover:opacity-90 active:scale-95 transition-all">
        <FileDown className="h-3.5 w-3.5" /> Formato de rutas (proveedor)
      </button>
      <Ayuda clave="descarga.formatoRutas" />

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="" maxWidth="max-w-md">
        <div className="-mt-2 space-y-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text-main)]"><FileDown className="h-5 w-5" /> Formato de rutas (proveedor)</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Excel para el proveedor de transporte: solo los empleados que llevan transporte.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Fecha de servicio</label>
              <div className="flex gap-4 text-sm text-[var(--text-main)]">
                {[['hoy', 'Hoy'], ['manana', 'Mañana'], ['elegir', 'Elegir fecha']].map(([v, texto]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" name="rFechaFormato" checked={tipoFecha === v} onChange={() => setTipoFecha(v)} className="accent-[var(--cm-red)]" /> {texto}
                  </label>
                ))}
              </div>
              {tipoFecha === 'elegir' && (
                <div className="mt-2 space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-main)]">
                    <input type="checkbox" checked={esRango} onChange={e => setEsRango(e.target.checked)} className="accent-[var(--cm-red)]" /> Rango de fechas
                  </label>
                  {!esRango ? (
                    <input type="date" value={elegida} onChange={e => setElegida(e.target.value)} className={`${inputCls} w-full`} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><span className="block text-xs text-[var(--text-muted)]">Desde:</span><input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={`${inputCls} w-full`} /></div>
                      <div className="flex-1"><span className="block text-xs text-[var(--text-muted)]">Hasta:</span><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={`${inputCls} w-full`} /></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {conPendientes && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Incluir estatus</label>
                <div className="flex gap-4 text-sm text-[var(--text-main)]">
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={aprobadas} onChange={e => setAprobadas(e.target.checked)} className="accent-[var(--cm-red)]" /> Aprobadas</label>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={pendientes} onChange={e => setPendientes(e.target.checked)} className="accent-[var(--cm-red)]" /> Pendientes</label>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3 text-sm text-[var(--text-main)]">
              {!valido ? (
                <div className="flex items-center gap-1.5 font-semibold text-[var(--status-error-text)]"><XCircle className="h-4 w-4" /> Revisa las fechas.</div>
              ) : cargando ? (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" /> Buscando solicitudes...</div>
              ) : paraExportar.length === 0 ? (
                <div className="flex items-center gap-1.5 font-semibold text-[var(--status-error-text)]"><XCircle className="h-4 w-4" /> No hay solicitudes de transporte para esta fecha. ¿Ya confirmaste el tiempo extra?</div>
              ) : (
                <ul className="space-y-1">
                  <li className="font-semibold">{paraExportar.length} {paraExportar.length === 1 ? 'solicitud encontrada' : 'solicitudes encontradas'}</li>
                  <li>{totalPasajeros} pasajeros en total</li>
                  {conPendientes && pendientes && paraExportar.some(s => s.estatus === ESTATUS_SOLICITUD.PENDIENTE) && (
                    <li className="mt-1 text-xs font-semibold text-[var(--status-warning-text)]">Atención: hay pendientes incluidas.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border-color)] pt-4">
            <button type="button" onClick={() => setAbierto(false)} className="rounded-md border border-[var(--border-color)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)]">Cancelar</button>
            <button type="button" onClick={descargar} disabled={paraExportar.length === 0 || cargando || exportando}
              className="flex items-center gap-1.5 rounded-md bg-[var(--status-success-text)] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} {exportando ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
