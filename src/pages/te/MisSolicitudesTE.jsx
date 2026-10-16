/**
 * MisSolicitudesTE.jsx — /tiempo-extra/mis-solicitudes: mis solicitudes de tiempo extra con pestañas por estatus y contadores,
 * detalle (línea de tiempo, empleados, motivo de devolución) y las acciones que corresponden a cada estatus:
 *   borrador → Continuar o Eliminar · devuelta → Corregir y reenviar · pendiente → Cancelar (con motivo) · autorizada → solo consulta.
 * La acción principal de la pantalla es "Solicitar tiempo extra"; las demás van en contorno y las destructivas con texto de error.
 * En celular la tabla se vuelve una lista de tarjetas.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, FilePlus, Pencil, Trash2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useResumenTE } from '../../hooks/useResumenTE';
import { useAreas } from '../../hooks/useAreas';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import AyudaPantalla from '../../components/AyudaPantalla';
import BadgeEstatus from '../../components/BadgeEstatus';
import InsigniasTE from '../../components/InsigniasTE';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoPagina, EsqueletoTabla } from '../../components/ui/Esqueleto';
import Pestanas from '../../components/ui/Pestanas';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { formatoFecha } from '../../utils/asignaciones';
import { PESTANAS_TE, nivelEnTexto, textoRecibida } from '../../utils/tiempoExtra';
import { useCatalogos } from '../../hooks/useCatalogos';
import DetalleTE from './DetalleTE';
import { cancelarSolicitud, eliminarBorrador, leerHistorialTE, leerSolicitudTE } from '../../utils/tiempoExtraDb';

const cuando = (t) => t.fechaActualizacion?.toMillis?.() ?? t.fechaCreacion?.toMillis?.() ?? 0;

export default function MisSolicitudesTE() {
  const { usuario } = useAuth();
  const { propias, cargando, error } = useResumenTE();
  const { nombres } = useAreas();
  const { rutas, comunidades, puntos } = useCatalogos({ empleados: false });
  const navigate = useNavigate();
  const confirmar = useConfirmar();
  const toast = useToast();
  const [params] = useSearchParams();
  // ?pestana=... llega desde las tarjetas del Inicio
  const [pestana, setPestana] = useState(() => (PESTANAS_TE.some(p => p.id === params.get('pestana')) ? params.get('pestana') : 'borrador'));
  const [detalle, setDetalle] = useState(null); // { solicitud, historial, cargando }
  const [ocupadoId, setOcupadoId] = useState(null);

  const porPestana = useMemo(() => Object.fromEntries(PESTANAS_TE.map(p => [p.id, propias.filter(t => p.estatus.includes(t.estatus)).sort((a, b) => cuando(b) - cuando(a))])), [propias]);
  // Si la pestaña elegida está vacía y hay otra con datos (p. ej. recién enviada), se muestra la primera con datos
  const activa = PESTANAS_TE.find(p => p.id === pestana) ?? PESTANAS_TE[0];
  const lista = porPestana[activa.id] ?? [];

  const abrirDetalle = async (t) => {
    setDetalle({ solicitud: { ...t, empleados: [] }, historial: [], cargando: true });
    try {
      const [s, h] = await Promise.all([leerSolicitudTE(t.id), leerHistorialTE(t.id).catch(() => [])]);
      setDetalle({ solicitud: s ?? t, historial: h, cargando: false });
    } catch (err) { toast.error('No se pudo abrir el detalle: ' + err.message); setDetalle(null); }
  };

  const eliminar = async (t) => {
    if (!await confirmar({ titulo: 'Eliminar borrador', mensaje: 'Se borrará el borrador y sus empleados. No se puede deshacer.', textoConfirmar: 'Eliminar', peligroso: true })) return;
    setOcupadoId(t.id);
    try { await eliminarBorrador(t.id); toast.success('Borrador eliminado.'); } catch (err) { toast.error('No se pudo eliminar: ' + err.message); } finally { setOcupadoId(null); }
  };
  const cancelar = async (t) => {
    const motivo = await confirmar({
      titulo: 'Cancelar solicitud', mensaje: `¿Cancelar ${t.folio ?? 'la solicitud'}? Ya no seguirá en autorización.`, textoConfirmar: 'Cancelar solicitud', peligroso: true,
      campo: { etiqueta: 'Motivo de la cancelación', minLength: 3, multilinea: true },
    });
    if (!motivo) return;
    setOcupadoId(t.id);
    try { await cancelarSolicitud({ id: t.id, usuario, motivo }); toast.success('Solicitud cancelada.'); setDetalle(null); } catch (err) { toast.error('No se pudo cancelar: ' + err.message); } finally { setOcupadoId(null); }
  };

  const acciones = (t) => {
    const cargandoFila = ocupadoId === t.id;
    if (t.estatus === 'borrador') return (
      <>
        <Boton tamano="sm" icono={Pencil} disabled={cargandoFila} onClick={() => navigate(`/tiempo-extra/${t.id}/editar`)}>Continuar</Boton>
        <Boton tamano="sm" variante="peligro" icono={Trash2} disabled={cargandoFila} onClick={() => eliminar(t)}>Eliminar</Boton>
      </>
    );
    if (t.estatus === 'devuelta') return (
      <>
        <Boton tamano="sm" icono={Pencil} disabled={cargandoFila} onClick={() => navigate(`/tiempo-extra/${t.id}/editar`)}>Corregir y reenviar</Boton>
        <Boton tamano="sm" variante="peligro" icono={XCircle} disabled={cargandoFila} onClick={() => cancelar(t)}>Cancelar</Boton>
      </>
    );
    if (['pendiente_aut1', 'pendiente_aut2'].includes(t.estatus)) return (
      <Boton tamano="sm" variante="peligro" icono={XCircle} disabled={cargandoFila} onClick={() => cancelar(t)}>Cancelar</Boton>
    );
    return null; // autorizada, procesada, cancelada: solo consulta
  };

  const textoVacio = {
    borrador: 'No tienes borradores. Cuando guardes una solicitud sin enviarla, la encontrarás aquí.',
    autorizacion: 'No tienes solicitudes esperando autorización.',
    devuelta: 'No tienes solicitudes devueltas. Qué bien: nada que corregir.',
    autorizada: 'Todavía no tienes solicitudes autorizadas.',
    cancelada: 'No tienes solicitudes canceladas.',
  }[activa.id];

  if (cargando) return <div className="space-y-8"><EsqueletoPagina bloques={0} /><EsqueletoTabla filas={4} columnas={7} /></div>;
  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Tiempo extra"
        titulo="Mis solicitudes"
        descripcion="Aquí ves en qué paso va cada solicitud y qué puedes hacer con ella."
        ayuda={<AyudaPantalla id="misSolicitudes" />}
        accion={<Boton to="/tiempo-extra/nueva" variante="primario" icono={FilePlus}>Solicitar tiempo extra</Boton>}
      />

      {error && <Aviso tono="error" titulo="No se pudieron leer tus solicitudes">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      <div className="space-y-4">
        <Pestanas etiqueta="Estatus" activa={activa.id} onCambio={setPestana}
          items={PESTANAS_TE.map(p => ({ id: p.id, etiqueta: p.label, contador: porPestana[p.id].length }))} />

        {lista.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <EstadoVacio texto={textoVacio} accion={activa.id === 'borrador' || activa.id === 'autorizacion' ? { texto: 'Solicitar tiempo extra', to: '/tiempo-extra/nueva' } : undefined} />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Tabla etiqueta={`Solicitudes: ${activa.label}`}>
                <thead>
                  <tr>
                    <Th>Folio</Th><Th>Fecha</Th><Th>Área</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th derecha>Transporte</Th><Th>Estatus</Th><Th>Nivel</Th><Th derecha>Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(t => (
                    <Fila key={t.id}>
                      <Td mono={!!t.folio}>{t.folio ?? <span className="italic text-[var(--text-muted)]">Borrador</span>}<InsigniasTE t={t} className="mt-1 !flex font-sans" /></Td>
                      <Td className="whitespace-nowrap">{t.fechaTE ? formatoFecha(`${t.fechaTE}T12:00:00`) : '—'}</Td>
                      <Td>{nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId}</Td>
                      <Td derecha>{t.resumen?.totalEmpleados ?? 0}</Td>
                      <Td derecha mono>{t.resumen?.totalHoras ?? 0}</Td>
                      <Td derecha>{t.resumen?.totalTransporte ?? 0}</Td>
                      <Td><BadgeEstatus estatus={t.estatus} modulo="te" />{t.estatus === 'procesada' && <p className="mt-1 text-xs text-[var(--text-secondary)]">{textoRecibida(t)}</p>}</Td>
                      <Td className="text-[var(--text-secondary)]">{nivelEnTexto(t.estatus)}</Td>
                      <Td>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Boton tamano="sm" icono={Eye} onClick={() => abrirDetalle(t)} aria-label={`Ver detalle ${t.folio ?? 'del borrador'}`}>Ver</Boton>
                          {acciones(t)}
                        </div>
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            </div>

            <ul className="space-y-3 md:hidden">
              {lista.map(t => (
                <li key={t.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm font-medium text-[var(--text-main)] ${t.folio ? 'font-mono' : 'italic'}`}>{t.folio ?? 'Borrador'}</p>
                    <BadgeEstatus estatus={t.estatus} modulo="te" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{nombres.get(t.areaId) ?? t.areaNombre ?? t.areaId} · {t.fechaTE ? formatoFecha(`${t.fechaTE}T12:00:00`) : '—'}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t.resumen?.totalEmpleados ?? 0} empleados · {t.resumen?.totalHoras ?? 0} h · {t.resumen?.totalTransporte ?? 0} con transporte · {nivelEnTexto(t.estatus)}</p>
                  <InsigniasTE t={t} className="mt-2" />
                  {t.estatus === 'procesada' && <p className="mt-2 text-xs text-[var(--text-secondary)]">{textoRecibida(t)}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Boton icono={Eye} onClick={() => abrirDetalle(t)} aria-label={`Ver detalle ${t.folio ?? 'del borrador'}`}>Ver</Boton>
                    {acciones(t)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {detalle && (
        <Modal isOpen onClose={() => setDetalle(null)} title={detalle.solicitud.folio ?? 'Borrador'} maxWidth="max-w-4xl">
          {detalle.cargando ? <EsqueletoTabla filas={3} columnas={4} /> : (
            <DetalleTE t={detalle.solicitud} historial={detalle.historial} area={nombres.get(detalle.solicitud.areaId) ?? detalle.solicitud.areaId}
              catalogos={{ rutas, comunidades, puntos }} acciones={acciones(detalle.solicitud)} avisoTransporte />
          )}
        </Modal>
      )}
    </div>
  );
}
