/**
 * RevisarAreaNomina.jsx — /nomina/semana/:anioSemana/:areaId (Nóminas, RH y admin): la revisión de un área del formato de tiempo extra, a pantalla completa.
 * Una hoja como de cálculo: encabezado y columnas # / Nómina / Nombre fijos, el nombre en un renglón, cada día es un campo numérico que se edita directo
 * (Tab, Enter y flechas). Los cambios se acumulan como borrador y se guardan JUNTOS con «Guardar cambios», que pide UNA sola razón para todo el guardado.
 * Se puede agregar a quien no venía en las solicitudes (solo vive en ajustesNomina: no crea ni modifica solicitudes). Nada de esto toca las solicitudes.
 * «Marcar como firmada» bloquea el área (RH puede reabrirla). Con cambios sin guardar avisa antes de salir.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Download, FileCheck2, Lock, Pencil, Plus, RotateCcw, Save, Search, Tag, Undo2, UserMinus, X } from 'lucide-react';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreasNomina } from '../../hooks/useAreasNomina';
import { useAuth } from '../../hooks/useAuth';
import { useCatalogos } from '../../hooks/useCatalogos';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';
import { RUTAS, rutaReportesNomina } from '../../rutas';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Entrada } from '../../components/ui/Campo';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { Esqueleto } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import { ACCIONES_AJUSTE_NOMINA, guardarAjuste, reabrirAjuste } from '../../utils/ajustesNominaDb';
import { descargarFormatoAreas } from '../../utils/descargarFormatoNomina';
import {
  DIAS_CORTO, ESTADOS_AREA, MAX_MOTIVO_AJUSTE, MIN_MOTIVO_AJUSTE, TIPOS_CAMBIO, agregadosSinHoras, aplicarCambios, conHoras, conRenglonQuitado, conRenglonRestaurado,
  contarSinGuardar, estadoDeArea, etiquetaPeriodo, filasVigentes, fueAjustada, nominasRepetidas, periodoDeClave, problemaMotivo, resumenDeGuardado, sellarCambios, totalesDeFilas,
} from '../../utils/formatoNomina';
import { crearFormateadorNombres } from '../../utils/nombresPersona';
import CeldaHoras from './CeldaHoras';
import { ModalAgregarEmpleado, ModalMotivo, ModalReemplazar } from './DialogosNomina';
import MenuRenglon from './MenuRenglon';

const TONO_ESTADO = { sin_revisar: 'neutro', ajustada: 'info', firmada: 'exito' };
const ddmm = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const sinAcentos = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Columnas fijas a la izquierda: # (2.25 rem) · Nómina (4 rem) · Nombre (14 rem). Con todo lo demás, la hoja cabe en una laptop de 1366 px sin desplazar de lado
const IZQ_NOMINA = 'left-9', IZQ_NOMBRE = 'left-[6.25rem]';
const FIJA = 'sticky bg-[var(--bg-surface)] group-hover:bg-[var(--bg-surface-hover)]';

/** Un renglón de la hoja. memo: al editar una celda solo se vuelven a dibujar los renglones que cambiaron */
const Renglon = memo(function Renglon({ fila, f, numero, periodo, editable, nombreVisible, menu, onCambiar, onInvalida }) {
  const quitado = fila.quitado;
  const nom = nombreVisible;
  return (
    <tr className={`group ${quitado ? 'opacity-60' : ''}`}>
      <td className={`${FIJA} left-0 z-10 w-9 min-w-9 border-b border-[var(--border-subtle)] px-2 text-right font-mono text-xs text-[var(--text-muted)]`}>{numero + 1}</td>
      <td className={`${FIJA} ${IZQ_NOMINA} z-10 w-16 min-w-16 border-b border-[var(--border-subtle)] px-2 font-mono text-xs`}>{fila.nomina}</td>
      <td className={`${FIJA} ${IZQ_NOMBRE} z-10 w-56 min-w-56 max-w-56 border-b border-r border-[var(--border-color)] px-2 text-xs`}>
        <span className="flex items-center gap-1.5" title={`${nom}${fila.reemplazoDe ? ` · Reemplaza a ${fila.reemplazoDe.nombre} (${fila.reemplazoDe.nomina})` : ''}${fila.agregado && !fila.enPadron ? ' · No está en el padrón' : ''}`}>
          <span className={`min-w-0 flex-1 truncate ${quitado ? 'line-through' : ''}`}>{nom}</span>
          {fila.agregado && !quitado && <Insignia tono="info" sinIcono className="shrink-0 !px-1.5 !py-0 text-[11px]">{fila.enPadron ? 'Agregado' : 'Agregado · fuera del padrón'}</Insignia>}
          {quitado && <Insignia tono="error" sinIcono className="shrink-0 !px-1.5 !py-0 text-[11px]">Quitado</Insignia>}
          {fila.reemplazoDe && !quitado && <ArrowLeftRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]" aria-label="Reemplazo" />}
        </span>
      </td>
      {periodo.dias.map((d, c) => {
        if (!d) return <td key={c} className="w-12 min-w-12 border-b border-[var(--border-subtle)] text-center text-[var(--text-muted)]">—</td>;
        const cambiada = fila.editados.includes(d);
        return (
          <td key={c} className="w-12 min-w-12 border-b border-[var(--border-subtle)] p-0">
            <CeldaHoras valor={fila.horas[d]} clave={fila.clave} dia={d} f={f} c={c} deshabilitada={!editable || quitado} cambiada={cambiada}
              etiqueta={`Horas de ${nom} el ${DIAS_CORTO[c]} ${ddmm(d)}`} titulo={cambiada ? `Autorizado: ${fila.original[d] ?? 0} h` : undefined}
              onCambiar={onCambiar} onInvalida={onInvalida} />
          </td>
        );
      })}
      <td className={`w-16 min-w-16 border-b border-[var(--border-subtle)] px-2 text-right font-mono text-xs font-medium tabular-nums ${fila.subtotal !== fila.subtotalOriginal && !fila.agregado ? 'bg-[var(--status-info-bg)]' : ''}`}
        title={fila.subtotal !== fila.subtotalOriginal && !fila.agregado ? `Autorizado: ${fila.subtotalOriginal} h` : undefined}>{fila.subtotal}</td>
      <td className="w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem] border-b border-[var(--border-subtle)] px-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1" title={fila.motivo || undefined}>
          <span className="min-w-0 flex-1 truncate">{fila.motivo || '—'}</span>
          {fila.motivoCorregido && !fila.agregado && !quitado && <Pencil className="h-3 w-3 shrink-0 text-[var(--status-info-text)]" aria-label="Motivo corregido" />}
        </span>
      </td>
      <td className="w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem] border-b border-[var(--border-subtle)] px-2 font-mono text-xs text-[var(--text-secondary)]">
        <span className="block truncate" title={fila.numero || undefined}>{fila.numero || '—'}</span>
      </td>
      {editable && <td className="w-10 min-w-10 border-b border-[var(--border-subtle)] px-1 text-center">{!quitado && menu(fila)}{quitado && menu(fila, true)}</td>}
    </tr>
  );
});

export default function RevisarAreaNomina() {
  const { anioSemana, areaId } = useParams();
  const navegar = useNavigate();
  const toast = useToast();
  const confirmar = useConfirmar();
  const { usuario } = useAuth();
  const { esRH } = useAccesos();
  const { empleadosActivos, motivos } = useCatalogos();
  // En la hoja el nombre va como en el padrón (APELLIDOS NOMBRES, mayúsculas); el Excel usa el nombre formateado, como siempre
  const formato = useMemo(() => crearFormateadorNombres([]), []);
  const nombre = useCallback((x) => String(x ?? ''), []);

  const periodo = useMemo(() => periodoDeClave(anioSemana), [anioSemana]);
  const { areas, cargando, cargandoDetalle, error, nombres } = useAreasNomina(periodo);
  const area = areas.find(a => a.areaId === areaId) ?? null;
  const volver = () => navegar(rutaReportesNomina(periodo?.clave));

  const base = area?.base;
  const ajusteArea = area?.ajuste;
  const filasArea = area?.filas;
  const guardados = useMemo(() => ajusteArea?.cambios ?? [], [ajusteArea]);
  const firmada = ajusteArea?.firmada === true;
  const [trabajo, setTrabajo] = useState(null); // el borrador completo (null = sin tocar)
  const efectivos = trabajo ?? guardados;
  const filas = useMemo(() => (firmada ? (filasArea ?? []) : (base ? aplicarCambios(base, efectivos, periodo) : [])), [firmada, filasArea, base, efectivos, periodo]);
  const totales = useMemo(() => totalesDeFilas(filas, periodo), [filas, periodo]);
  const sinGuardar = contarSinGuardar(trabajo, guardados);
  const estado = estadoDeArea(area?.ajuste);
  const editable = !!area && !firmada;

  const [busqueda, setBusqueda] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo: 'agregar' | 'reemplazar' | 'motivo', fila? }
  const [trabajando, setTrabajando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const visibles = useMemo(() => {
    const q = sinAcentos(busqueda).trim();
    const nums = filas.map((fila, i) => ({ fila, i }));
    return q ? nums.filter(({ fila }) => String(fila.nomina).includes(q) || sinAcentos(nombre(fila.nombre)).includes(q) || sinAcentos(fila.nombre).includes(q)) : nums;
  }, [filas, busqueda, nombre]);

  // ── El borrador ──
  const cambiarHoras = useCallback((clave, dia, valor) => {
    setTrabajo(prev => conHoras(base, prev ?? guardados, periodo, clave, dia, valor));
  }, [base, guardados, periodo]);
  const avisoInvalida = useCallback(() => toast.warning('Horas de 0 a 24, con a lo más dos decimales (por ejemplo 8 o 0.5).', 4000), [toast]);
  const agregarCambio = (c) => setTrabajo(prev => [...(prev ?? guardados), c]);

  const quitar = (fila) => setTrabajo(prev => conRenglonQuitado(prev ?? guardados, fila));
  const restaurar = (fila) => {
    const nuevo = conRenglonRestaurado(trabajo ?? guardados, fila.clave);
    const sinRepetir = nominasRepetidas(aplicarCambios(base, nuevo, periodo));
    if (sinRepetir.length) { toast.error(`No se puede restaurar: ${nombre(fila.nombre)} (${sinRepetir.join(', ')}) ya está en la tabla en otro renglón.`, 8000); return; }
    setTrabajo(nuevo);
  };
  const descartar = async () => {
    if (!(await confirmar({ titulo: 'Descartar cambios', mensaje: `Se descartan los ${sinGuardar} cambios sin guardar. Lo ya guardado no se toca.`, textoConfirmar: 'Descartar', peligroso: true }))) return;
    setTrabajo(null);
  };

  // ── Guardar: una sola razón para todo el guardado ──
  const intentar = async (tarea, ok) => {
    setTrabajando(true);
    try { await tarea(); if (ok) toast.success(ok); return true; } catch (err) {
      console.error(err);
      toast.error(`No se pudo guardar: ${err.code === 'permission-denied' ? 'el área ya está firmada o no tienes permiso.' : err.message}`, 9000);
      return false;
    } finally { setTrabajando(false); }
  };
  const guardar = async () => {
    const repetidas = nominasRepetidas(filas);
    if (repetidas.length) { toast.error(`El mismo empleado no puede estar dos veces en el área (nómina ${repetidas.join(', ')}).`, 8000); return; }
    const vacios = agregadosSinHoras(filas);
    if (vacios.length) { toast.error(`Captura las horas de ${vacios.map(f => nombre(f.nombre)).join(', ')} o quítalo antes de guardar.`, 9000); return; }
    const resumen = resumenDeGuardado(trabajo, guardados);
    const cuenta = (t) => resumen.cambios.filter(x => x.tipo === t).length;
    const partes = [
      cuenta(TIPOS_CAMBIO.HORAS) && `${cuenta(TIPOS_CAMBIO.HORAS)} de horas`,
      cuenta(TIPOS_CAMBIO.AGREGAR) && plural(cuenta(TIPOS_CAMBIO.AGREGAR), 'empleado agregado', 'empleados agregados'),
      cuenta(TIPOS_CAMBIO.QUITAR) && plural(cuenta(TIPOS_CAMBIO.QUITAR), 'empleado quitado', 'empleados quitados'),
      cuenta(TIPOS_CAMBIO.REEMPLAZAR) && plural(cuenta(TIPOS_CAMBIO.REEMPLAZAR), 'reemplazo', 'reemplazos'),
      cuenta(TIPOS_CAMBIO.MOTIVO) && `${cuenta(TIPOS_CAMBIO.MOTIVO)} de motivo`,
      cuenta('restaurar') && plural(cuenta('restaurar'), 'renglón restaurado', 'renglones restaurados'),
    ].filter(Boolean);
    let valorInicial = '';
    for (;;) {
      const razon = await confirmar({
        titulo: 'Guardar cambios', textoConfirmar: 'Guardar cambios',
        mensaje: `Se guardan ${plural(resumen.total, 'cambio', 'cambios')} en ${area.nombre} (${partes.join(', ')}). Escribe el motivo del ajuste: se aplica a todos y queda en la bitácora.`,
        campo: { etiqueta: `Motivo del ajuste (${MIN_MOTIVO_AJUSTE} a ${MAX_MOTIVO_AJUSTE} letras)`, minLength: MIN_MOTIVO_AJUSTE, valorInicial, placeholder: 'Ej. Corrección de asistencia de la semana' },
      });
      if (!razon) return;
      const problema = problemaMotivo(razon);
      if (!problema) {
        const sellados = sellarCambios(trabajo, razon);
        const hecho = await intentar(() => guardarAjuste({
          periodo, areaId: area.areaId, cambios: sellados, filas: aplicarCambios(base, sellados, periodo), usuario, accion: ACCIONES_AJUSTE_NOMINA.ajustar,
          antes: { cambios: guardados.length }, despues: { motivo: razon.trim(), total: resumen.total, cambios: resumen.cambios },
        }), `Cambios guardados (${resumen.total}).`);
        if (hecho) setTrabajo(null);
        return;
      }
      toast.error(problema, 6000);
      valorInicial = razon;
    }
  };

  const deshacer = async () => {
    if (!(await confirmar({
      titulo: 'Deshacer ajustes', mensaje: `Se borran los ${guardados.length} cambios guardados de ${area.nombre} y el formato vuelve a lo autorizado en las solicitudes.`,
      textoConfirmar: 'Deshacer ajustes', peligroso: true,
    }))) return;
    if (await intentar(() => guardarAjuste({
      periodo, areaId: area.areaId, cambios: [], filas: aplicarCambios(base, [], periodo), usuario, accion: ACCIONES_AJUSTE_NOMINA.deshacer,
      antes: { cambios: guardados.length }, despues: { cambios: 0 },
    }), 'Ajustes deshechos.')) setTrabajo(null);
  };
  const firmar = async () => {
    if (!(await confirmar({
      titulo: 'Marcar como firmada', textoConfirmar: 'Marcar como firmada',
      mensaje: `Con las firmas ya recogidas, ${area.nombre} (${totales.empleados} empleados, ${totales.horas} h) queda bloqueada: ya no se podrán hacer ajustes. Solo Recursos Humanos puede reabrirla.`,
    }))) return;
    await intentar(() => guardarAjuste({
      periodo, areaId: area.areaId, cambios: guardados, filas, firmada: true, usuario, accion: ACCIONES_AJUSTE_NOMINA.firmar,
      antes: { firmada: false }, despues: { firmada: true, empleados: totales.empleados, horas: totales.horas },
    }), 'Área marcada como firmada.');
  };
  const reabrir = async () => {
    if (!(await confirmar({ titulo: 'Reabrir área firmada', mensaje: `${area.nombre} vuelve a poder ajustarse. Queda en la bitácora.`, textoConfirmar: 'Reabrir' }))) return;
    await intentar(() => reabrirAjuste({ periodo, areaId: area.areaId, usuario }), 'Área reabierta.');
  };
  const descargar = async () => {
    setDescargando(true);
    try {
      await descargarFormatoAreas({ periodo, areas: [{ ...area, filas }], nombre: (x) => formato.nombre(x) });
      toast.success(`Excel descargado: ${area.nombre}.`);
    } catch (err) {
      console.error(err);
      toast.error(`No se pudo generar el Excel: ${err.message}`, 10000);
    } finally { setDescargando(false); }
  };

  // ── Salir con cambios sin guardar ──
  const blocker = useBlocker(({ currentLocation, nextLocation }) => sinGuardar > 0 && currentLocation.pathname !== nextLocation.pathname);
  const preguntando = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || preguntando.current) return;
    preguntando.current = true;
    confirmar({
      titulo: 'Hay cambios sin guardar', mensaje: `Tienes ${sinGuardar} cambios sin guardar en ${area?.nombre ?? 'esta área'}. Si sales ahora se pierden.`,
      textoConfirmar: 'Salir sin guardar', textoCancelar: 'Seguir editando', peligroso: true,
    }).then(ok => { if (ok) blocker.proceed(); else blocker.reset(); }).finally(() => { preguntando.current = false; });
  }, [blocker, confirmar, sinGuardar, area?.nombre]);
  useEffect(() => {
    if (sinGuardar === 0) return undefined;
    const antes = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sinGuardar]);

  // ── El menú «⋯» de cada renglón ──
  // Estable (para que memo funcione): las acciones leen siempre lo último
  const ultimo = useRef({});
  useEffect(() => { ultimo.current = { restaurar, quitar }; });
  const menu = useCallback((fila, quitado = false) => {
    const tocado = fueAjustada(fila) && !fila.agregado;
    const acciones = quitado ? [{ texto: 'Restaurar lo autorizado', icono: RotateCcw, onClick: () => ultimo.current.restaurar(fila) }] : [
      ...(fila.agregado ? [] : [{ texto: 'Reemplazar por otro empleado', icono: ArrowLeftRight, onClick: () => setDialogo({ tipo: 'reemplazar', fila }) }]),
      { texto: 'Cambiar motivo y P.O./TB', icono: Tag, onClick: () => setDialogo({ tipo: 'motivo', fila }) },
      ...(fila.agregado ? [] : [{ texto: 'Restaurar lo autorizado', icono: RotateCcw, deshabilitada: !tocado, onClick: () => ultimo.current.restaurar(fila) }]),
      { texto: fila.agregado ? 'Quitar del formato' : 'Quitar (no asistió)', icono: UserMinus, peligro: true, onClick: () => ultimo.current.quitar(fila) },
    ];
    return <MenuRenglon etiqueta={`Acciones de ${nombre(fila.nombre)}`} acciones={acciones} />;
  }, [nombre]);

  const nominasEnTabla = useMemo(() => filasVigentes(filas).map(f => String(f.nomina)), [filas]);

  if (!periodo) return <Aviso tono="error" titulo="Esa semana no existe" accion={<Boton tamano="sm" to={RUTAS.nominaReportes}>Ir a Reportes de nómina</Boton>}>La dirección no corresponde a ninguna semana.</Aviso>;

  const esperando = cargando || cargandoDetalle;
  return (
    <section aria-label={`Revisar ${area?.nombre ?? 'área'}`} className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-[var(--bg-app)] lg:left-72 lg:top-0">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 sm:px-6">
        <Boton tamano="sm" variante="fantasma" icono={ArrowLeft} onClick={volver} id="btn-volver-semana">Volver a la semana</Boton>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--text-main)]">Revisar · {area?.nombre ?? nombres.get(areaId) ?? areaId}</h1>
          <p className="text-xs text-[var(--text-muted)]">{etiquetaPeriodo(periodo)}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o nómina…" aria-label="Buscar por nombre o nómina" className="!w-56 !pl-8" id="buscar-nomina" />
          </div>
          {editable && <Boton variante="contorno" icono={Plus} onClick={() => setDialogo({ tipo: 'agregar' })} id="btn-agregar-empleado-nomina">Agregar empleado</Boton>}
        </div>
      </header>

      {error && <div className="px-4 pt-3 sm:px-6"><Aviso tono="error" titulo="No se pudo leer la información">{error.message}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso></div>}
      {firmada && (
        <div className="px-4 pt-3 sm:px-6">
          <Aviso tono="exito" titulo="Esta área ya está firmada" icon={Lock}>
            Quedó bloqueada{area.ajuste.firmadaPor?.nombre ? ` por ${nombre(area.ajuste.firmadaPor.nombre)}` : ''}. {esRH ? 'Puedes reabrirla si hay que corregir algo.' : 'Si hay que corregir algo, pide a Recursos Humanos que la reabra.'}
          </Aviso>
        </div>
      )}
      {area?.ajuste?.reabiertaPor && !firmada && <div className="px-4 pt-3 sm:px-6"><Aviso tono="info">Esta área fue reabierta por {nombre(area.ajuste.reabiertaPor.nombre ?? '')}.</Aviso></div>}

      <div className="min-h-0 flex-1 p-3 sm:px-6">
        {esperando ? <Esqueleto className="h-64" />
          : !area ? <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio texto="No hay tiempo extra autorizado de esta área en el periodo." accion={{ texto: 'Volver a la semana', to: rutaReportesNomina(periodo.clave) }} /></div>
            : (
              <div className="h-full overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]" data-hoja data-filas={visibles.length}>
                <table className="w-max min-w-full border-separate border-spacing-0 text-left" aria-label={`Tiempo extra de ${area.nombre} por día`}>
                  <thead>
                    <tr className="text-xs font-medium text-[var(--text-secondary)]">
                      <th scope="col" className="sticky left-0 top-0 z-30 w-9 min-w-9 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2 text-right">#</th>
                      <th scope="col" className={`sticky ${IZQ_NOMINA} top-0 z-30 w-16 min-w-16 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2`}>Nómina</th>
                      <th scope="col" className={`sticky ${IZQ_NOMBRE} top-0 z-30 w-56 min-w-56 border-b border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2`}>Nombre</th>
                      {DIAS_CORTO.map((d, i) => (
                        <th key={d} scope="col" className="sticky top-0 z-20 w-12 min-w-12 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-1 py-2 text-right">
                          {d}<span className="block font-normal text-[var(--text-muted)]">{ddmm(periodo.dias[i])}</span>
                        </th>
                      ))}
                      <th scope="col" className="sticky top-0 z-20 w-16 min-w-16 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2 text-right">Subtotal</th>
                      <th scope="col" className="sticky top-0 z-20 w-[9.5rem] min-w-[9.5rem] border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2">Motivo</th>
                      <th scope="col" className="sticky top-0 z-20 w-[6.5rem] min-w-[6.5rem] border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2">P.O./TB</th>
                      {editable && <th scope="col" className="sticky top-0 z-20 w-10 min-w-10 border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)]"><span className="sr-only">Acciones</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(({ fila, i }, f) => (
                      <Renglon key={fila.clave} fila={fila} f={f} numero={i} periodo={periodo} editable={editable} nombreVisible={nombre(fila.nombre)} menu={menu}
                        onCambiar={cambiarHoras} onInvalida={avisoInvalida} />
                    ))}
                    {visibles.length === 0 && <tr><td colSpan={13} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">Nadie coincide con «{busqueda}».</td></tr>}
                  </tbody>
                  <tfoot>
                    <tr className="text-xs font-medium">
                      <td className="sticky bottom-0 left-0 z-30 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)]" />
                      <td className={`sticky bottom-0 ${IZQ_NOMINA} z-30 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)]`} />
                      <td className={`sticky bottom-0 ${IZQ_NOMBRE} z-30 border-t border-r border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2`}>Total Hrs.</td>
                      {totales.porDia.map((h, k) => <td key={k} className="sticky bottom-0 z-20 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2 text-right font-mono tabular-nums">{h > 0 ? h : ''}</td>)}
                      <td className="sticky bottom-0 z-20 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-2 py-2 text-right font-mono tabular-nums">{totales.horas}</td>
                      <td className="sticky bottom-0 z-20 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)]" />
                      <td className="sticky bottom-0 z-20 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)]" />
                      {editable && <td className="sticky bottom-0 z-20 border-t border-[var(--border-color)] bg-[var(--bg-surface-secondary)]" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 sm:px-6" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Insignia tono={TONO_ESTADO[estado]} icono={estado === 'firmada' ? Lock : undefined} sinIcono={estado === 'sin_revisar'}>{ESTADOS_AREA[estado]}</Insignia>
          <span className="text-[var(--text-secondary)]"><b className="font-medium text-[var(--text-main)]">{totales.empleados}</b> empleados</span>
          <span className="text-[var(--text-secondary)]"><b className="font-medium text-[var(--text-main)]">{totales.horas}</b> h en total</span>
          {busqueda && <span className="text-xs text-[var(--text-muted)]">Mostrando {visibles.length} de {filas.length}</span>}
          {sinGuardar > 0 && <span className="font-medium text-[var(--status-info-text)]" id="texto-sin-guardar">{sinGuardar} {sinGuardar === 1 ? 'cambio' : 'cambios'} sin guardar</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {sinGuardar > 0 && <Boton icono={X} onClick={descartar} disabled={trabajando} id="btn-descartar-cambios">Descartar</Boton>}
          {editable && sinGuardar === 0 && guardados.length > 0 && <Boton icono={Undo2} onClick={deshacer} disabled={trabajando} id="btn-deshacer-ajustes">Deshacer ajustes</Boton>}
          {firmada && esRH && <Boton onClick={reabrir} disabled={trabajando} id="btn-reabrir-area">Reabrir</Boton>}
          {editable && sinGuardar > 0 && <Boton variante="primario" icono={Save} onClick={guardar} estado={trabajando ? 'cargando' : undefined} id="btn-guardar-cambios">Guardar cambios</Boton>}
          {editable && <Boton icono={FileCheck2} onClick={firmar} disabled={trabajando || sinGuardar > 0 || !area || totales.empleados === 0} title={sinGuardar > 0 ? 'Guarda los cambios primero' : undefined} id="btn-firmar-area">Marcar como firmada</Boton>}
          <Boton variante={sinGuardar > 0 ? 'contorno' : 'primario'} icono={Download} estado={descargando ? 'cargando' : undefined} onClick={descargar}
            disabled={!area || sinGuardar > 0 || totales.empleados === 0} title={sinGuardar > 0 ? 'Guarda los cambios para incluirlos en el Excel' : undefined} id="btn-descargar-area">Descargar</Boton>
        </div>
      </footer>

      {dialogo?.tipo === 'agregar' && (
        <ModalAgregarEmpleado area={area} nombresAreas={nombres} empleados={empleadosActivos} motivos={motivos} nominasEnTabla={nominasEnTabla} nombre={nombre}
          onClose={() => setDialogo(null)} onAgregar={(c) => { agregarCambio(c); setDialogo(null); toast.info('Empleado agregado. Captura sus horas en la tabla.'); }} />
      )}
      {dialogo?.tipo === 'reemplazar' && (
        <ModalReemplazar fila={dialogo.fila} nombresAreas={nombres} empleados={empleadosActivos} nominasEnTabla={nominasEnTabla} nombre={nombre}
          onClose={() => setDialogo(null)} onReemplazar={(c) => { agregarCambio(c); setDialogo(null); }} />
      )}
      {dialogo?.tipo === 'motivo' && (
        <ModalMotivo fila={dialogo.fila} motivos={motivos} nombre={nombre} onClose={() => setDialogo(null)} onCambiar={(c) => { agregarCambio(c); setDialogo(null); }} />
      )}
    </section>
  );
}
