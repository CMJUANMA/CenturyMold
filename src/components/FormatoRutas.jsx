/**
 * FormatoRutas.jsx — Botón "Formato de rutas (proveedor)" y su panel: el Excel para el proveedor de transporte con los empleados que
 * llevan transporte, de las solicitudes de transporte de una fecha (Hoy · Mañana · una fecha · un rango). Muestra cuántas encontró ANTES
 * de descargar y no baja un Excel vacío. Lo usan "Por enviar al proveedor" (para confirmar y descargar en la misma pantalla) y
 * "Solicitudes de transporte". Las solicitudes de tiempo extra ya nacen aprobadas; con el transporte suelto encendido (funciones.js)
 * se puede incluir también las pendientes.
 * Un tiempo extra que cruza la medianoche trae su salida al día siguiente: la solicitud de transporte guarda cuántos viajes tiene cada día (conteoFechas), así que
 * se busca desde el día anterior y cada fecha muestra y baja solo los viajes que le tocan.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FileDown } from 'lucide-react';
import { db } from '../firebase';
import { FUNCIONES } from '../funciones';
import { useAreas } from '../hooks/useAreas';
import { useCatalogos } from '../hooks/useCatalogos';
import { useToast } from '../hooks/useToast';
import { ESTATUS_SOLICITUD } from '../utils/constantes';
import { sumarDias } from '../utils/fechas';
import { exportarSolicitudes } from '../utils/exportarSolicitudes';
import { ACCIONES_DESCARGA, registrarDescarga } from '../utils/bitacoraDb';
import Ayuda from './Ayuda';
import Modal from './Modal';
import Aviso from './ui/Aviso';
import Boton from './ui/Boton';
import { Campo, Casilla, Entrada, OpcionRadio } from './ui/Campo';
import { Esqueleto } from './ui/Esqueleto';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Viajes por día de una solicitud de transporte: { fecha: n }. Las anteriores (sin conteoFechas) tienen todo en su fecha de servicio */
const viajesPorDia = (s) => (s.conteoFechas && Object.keys(s.conteoFechas).length ? s.conteoFechas : { [s.fechaServicio]: s.totalPasajeros || 0 });
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
  const [errorDescarga, setErrorDescarga] = useState('');
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
    getDocs(query(collection(db, 'solicitudes'), where('fechaServicio', '>=', sumarDias(rangoDesde, -1)), where('fechaServicio', '<=', rangoHasta)))
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
    if (!Object.keys(viajesPorDia(s)).some(f => f >= rangoDesde && f <= rangoHasta)) return false;
    if (s.estatus === ESTATUS_SOLICITUD.APROBADA) return aprobadas;
    if (s.estatus === ESTATUS_SOLICITUD.PENDIENTE) return conPendientes && pendientes;
    return false;
  });
  const totalPasajeros = paraExportar.reduce((a, s) => a + Object.entries(viajesPorDia(s)).filter(([f]) => f >= rangoDesde && f <= rangoHasta).reduce((n, [, v]) => n + v, 0), 0);

  // Los pasajeros se leen solo al exportar (en tandas para no saturar la red)
  const descargar = async () => {
    const sufijo = esRango && tipoFecha === 'elegir' ? `${desde}_a_${hasta}` : rangoDesde;
    setExportando(true);
    setErrorDescarga('');
    try {
      const conPasajeros = [];
      for (let i = 0; i < paraExportar.length; i += 20) {
        const tanda = await Promise.all(paraExportar.slice(i, i + 20).map(async (sol) => {
          const ps = await getDocs(collection(db, `solicitudes/${sol.id}/pasajeros`));
          return { ...sol, pasajeros: ps.docs.map(d => d.data()) };
        }));
        conPasajeros.push(...tanda);
      }
      await exportarSolicitudes(conPasajeros, catalogos, toast, `Transporte_${sufijo}.xlsx`, { desde: rangoDesde, hasta: rangoHasta });
      registrarDescarga(ACCIONES_DESCARGA.formatoRutas, { archivo: `Transporte_${sufijo}.xlsx`, solicitudes: conPasajeros.length });
      setAbierto(false);
    } catch (err) {
      console.error(err);
      // Se queda en el panel, con el motivo a la vista (un aviso que se va solo se podía no ver)
      setErrorDescarga(`No se pudo generar el Excel: ${err.message}`);
      toast.error(`No se pudo generar el Excel: ${err.message}`, 10000);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="max-w-xs">
      <Boton id={id} icono={FileDown} onClick={() => setAbierto(true)}>Formato de rutas (proveedor)</Boton>
      <Ayuda clave="descarga.formatoRutas" />

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Formato de rutas (proveedor)" maxWidth="max-w-md">
        <div className="space-y-6">
          <p className="text-sm text-[var(--text-secondary)]">Excel para el proveedor de transporte: solo los empleados que llevan transporte.</p>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Fecha de servicio</legend>
            <div className="flex flex-wrap gap-x-6">
              {[['hoy', 'Hoy'], ['manana', 'Mañana'], ['elegir', 'Elegir fecha']].map(([v, texto]) => (
                <OpcionRadio key={v} name="rFechaFormato" etiqueta={texto} checked={tipoFecha === v} onChange={() => setTipoFecha(v)} />
              ))}
            </div>
            {tipoFecha === 'elegir' && (
              <div className="space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3">
                <Casilla etiqueta="Rango de fechas" checked={esRango} onChange={e => setEsRango(e.target.checked)} />
                {!esRango ? (
                  <Campo etiqueta="Fecha"><Entrada type="date" value={elegida} onChange={e => setElegida(e.target.value)} /></Campo>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Desde"><Entrada type="date" value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
                    <Campo etiqueta="Hasta"><Entrada type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></Campo>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {conPendientes && (
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Incluir estatus</legend>
              <div className="flex flex-wrap gap-x-6">
                <Casilla etiqueta="Aprobadas" checked={aprobadas} onChange={e => setAprobadas(e.target.checked)} />
                <Casilla etiqueta="Pendientes" checked={pendientes} onChange={e => setPendientes(e.target.checked)} />
              </div>
            </fieldset>
          )}

          {errorDescarga && <Aviso tono="error" titulo="No se descargó">{errorDescarga} Inténtalo de nuevo; si sigue igual, avisa al área de Sistemas.</Aviso>}

          <div aria-live="polite">
            {!valido ? (
              <Aviso tono="error">Revisa las fechas: la inicial no puede ser posterior a la final.</Aviso>
            ) : cargando ? (
              <div role="status" aria-label="Buscando solicitudes"><Esqueleto className="h-14 w-full" /></div>
            ) : paraExportar.length === 0 ? (
              <Aviso tono="aviso">No hay solicitudes de transporte para esta fecha. ¿Ya confirmaste el tiempo extra?</Aviso>
            ) : (
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-secondary)] p-3 text-sm text-[var(--text-main)]">
                <p className="font-medium">{paraExportar.length} {paraExportar.length === 1 ? 'solicitud encontrada' : 'solicitudes encontradas'}</p>
                <p className="text-[var(--text-secondary)]">{totalPasajeros} pasajeros en total</p>
                {conPendientes && pendientes && paraExportar.some(s => s.estatus === ESTATUS_SOLICITUD.PENDIENTE) && (
                  <p className="mt-1 text-xs text-[var(--status-warning-text)]">Atención: hay pendientes incluidas.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
            <Boton onClick={() => setAbierto(false)}>Cancelar</Boton>
            <Boton variante="primario" icono={FileDown} estado={exportando ? 'cargando' : undefined} onClick={descargar} disabled={paraExportar.length === 0 || cargando || exportando}>
              {exportando ? 'Generando…' : 'Descargar Excel'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
