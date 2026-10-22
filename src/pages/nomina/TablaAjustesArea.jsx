/**
 * TablaAjustesArea.jsx — «Revisar» un área de Reportes de nómina: la tabla editable (un renglón por empleado, de lunes a domingo, con subtotal y motivo).
 * Nóminas puede quitar a quien no asistió, reemplazarlo por otra persona del padrón y corregir las horas de un día; cada cambio pide un motivo corto.
 * Nada de esto toca las solicitudes de tiempo extra: los cambios se guardan aparte (ajustesNomina) y la tabla muestra lo autorizado y lo ajustado
 * («9 → 5», con un indicador). «Deshacer ajustes» vuelve a lo autorizado; «Marcar como firmada» bloquea el área y RH puede reabrirla.
 */
import { useMemo, useState } from 'react';
import { ArrowLeftRight, Clock, Download, FileCheck2, Lock, Pencil, Undo2, UserMinus } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useConfirmar } from '../../hooks/useConfirmar';
import BuscadorEmpleado from '../../components/BuscadorEmpleado';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { ACCIONES_AJUSTE_NOMINA, guardarAjuste, reabrirAjuste } from '../../utils/ajustesNominaDb';
import {
  DIAS_CORTO, FILAS_POR_PAGINA, MAX_MOTIVO_AJUSTE, MIN_MOTIVO_AJUSTE, aplicarCambios, cambioHoras, cambioQuitar, cambioReemplazar, estadoDeArea, filasVigentes,
  fueAjustada, horasValidas, problemaMotivo, totalesDeFilas, yaEstaEnTabla,
} from '../../utils/formatoNomina';

const ddmm = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '');

/** Una ventana con el campo del cambio (horas o persona) y el motivo corto */
function ModalCambio({ titulo, subtitulo, onClose, onGuardar, children, valido }) {
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [tocado, setTocado] = useState(false);
  const error = problemaMotivo(motivo);
  const guardar = async () => {
    setTocado(true);
    if (error || !valido) return;
    setOcupado(true);
    try { await onGuardar(motivo.trim()); } finally { setOcupado(false); }
  };
  return (
    <Modal isOpen onClose={() => !ocupado && onClose()} title={titulo} subtitulo={subtitulo} maxWidth="max-w-md" preventCloseOnBackdrop={ocupado}
      pie={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton onClick={onClose} disabled={ocupado}>Cancelar</Boton>
          <Boton variante="primario" onClick={guardar} estado={ocupado ? 'cargando' : undefined} disabled={!valido}>Guardar cambio</Boton>
        </div>
      )}>
      <div className="space-y-4">
        {children}
        <Campo etiqueta="Motivo del cambio" ayuda={`Una frase corta (${MIN_MOTIVO_AJUSTE} a ${MAX_MOTIVO_AJUSTE} letras). Queda en la bitácora.`} error={tocado ? error : null} obligatorio>
          <Entrada value={motivo} maxLength={MAX_MOTIVO_AJUSTE} onChange={e => setMotivo(e.target.value)} placeholder="Ej. No asistió, salió antes, cambio de persona" />
        </Campo>
      </div>
    </Modal>
  );
}

export default function TablaAjustesArea({ abierto, onClose, area, periodo, base, ajuste, usuario, esRH, empleados, nombre, onDescargar, descargando }) {
  const toast = useToast();
  const confirmar = useConfirmar();
  const [dialogo, setDialogo] = useState(null); // { tipo: 'horas'|'reemplazar', fila, dia? }
  const [horas, setHoras] = useState('');
  const [elegido, setElegido] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cambios = useMemo(() => ajuste?.cambios ?? [], [ajuste]);
  const firmada = ajuste?.firmada === true;
  const filas = useMemo(() => aplicarCambios(base, cambios, periodo), [base, cambios, periodo]);
  const totales = totalesDeFilas(filas, periodo);
  const estado = estadoDeArea(ajuste);
  const sinAutorizado = base.length === 0;

  const guardar = (nuevos, accion, antes, despues) => guardarAjuste({
    periodo, areaId: area.areaId, cambios: nuevos, filas: aplicarCambios(base, nuevos, periodo), usuario, accion, antes, despues,
  });
  const intentar = async (tarea, ok) => {
    setTrabajando(true);
    try { await tarea(); if (ok) toast.success(ok); return true; } catch (err) {
      console.error(err);
      toast.error(`No se pudo guardar: ${err.code === 'permission-denied' ? 'el área ya está firmada o no tienes permiso.' : err.message}`, 9000);
      return false;
    } finally { setTrabajando(false); }
  };

  const quitar = async (fila) => {
    const motivo = await confirmar({
      titulo: 'Quitar a este empleado', mensaje: `${nombre(fila.nombre)} (${fila.nomina}) ya no saldrá en el formato de ${area.nombre}. Lo autorizado en la solicitud no cambia.`,
      textoConfirmar: 'Quitar', peligroso: true, campo: { etiqueta: 'Motivo (por ejemplo: no asistió)', minLength: MIN_MOTIVO_AJUSTE, valorInicial: '' },
    });
    if (!motivo) return;
    const c = cambioQuitar(fila, motivo);
    await intentar(() => guardar([...cambios, c], ACCIONES_AJUSTE_NOMINA.ajustar, { cambios: cambios.length }, { tipo: 'quitar', nomina: fila.nomina, nombre: fila.nombre, motivo: c.motivo }), 'Empleado quitado del formato.');
  };

  const abrirHoras = (fila, dia) => { setHoras(String(fila.horas[dia] ?? '')); setDialogo({ tipo: 'horas', fila, dia }); };
  const abrirReemplazo = (fila) => { setElegido(null); setDialogo({ tipo: 'reemplazar', fila }); };

  const guardarDialogo = async (motivo) => {
    const { tipo, fila, dia } = dialogo;
    const c = tipo === 'horas' ? cambioHoras(fila, dia, Number(horas), motivo) : cambioReemplazar(fila, elegido, motivo);
    const despues = tipo === 'horas'
      ? { tipo, nomina: fila.nomina, dia, antes: c.antes, horas: c.horas, motivo }
      : { tipo, de: c.de.nomina, por: c.por.nomina, nombre: c.por.nombre, motivo };
    const hecho = await intentar(() => guardar([...cambios, c], ACCIONES_AJUSTE_NOMINA.ajustar, { cambios: cambios.length }, despues), tipo === 'horas' ? 'Horas corregidas.' : 'Empleado reemplazado.');
    if (hecho) setDialogo(null);
  };

  const deshacer = async () => {
    const ok = await confirmar({
      titulo: 'Deshacer ajustes', mensaje: `Se borran los ${cambios.length} cambios de ${area.nombre} y el formato vuelve a lo autorizado en las solicitudes.`,
      textoConfirmar: 'Deshacer ajustes', peligroso: true,
    });
    if (!ok) return;
    await intentar(() => guardar([], ACCIONES_AJUSTE_NOMINA.deshacer, { cambios: cambios.length }, { cambios: 0 }), 'Ajustes deshechos.');
  };

  const firmar = async () => {
    const ok = await confirmar({
      titulo: 'Marcar como firmada', textoConfirmar: 'Marcar como firmada',
      mensaje: `Con las firmas ya recogidas, ${area.nombre} (${totales.empleados} empleados, ${totales.horas} h) queda bloqueada: ya no se podrán hacer ajustes. Solo Recursos Humanos puede reabrirla.`,
    });
    if (!ok) return;
    await intentar(() => guardarAjuste({
      periodo, areaId: area.areaId, cambios, filas, firmada: true, usuario, accion: ACCIONES_AJUSTE_NOMINA.firmar,
      antes: { firmada: false }, despues: { firmada: true, empleados: totales.empleados, horas: totales.horas },
    }), 'Área marcada como firmada.');
  };

  const reabrir = async () => {
    const ok = await confirmar({ titulo: 'Reabrir área firmada', mensaje: `${area.nombre} vuelve a poder ajustarse. Queda en la bitácora.`, textoConfirmar: 'Reabrir' });
    if (!ok) return;
    await intentar(() => reabrirAjuste({ periodo, areaId: area.areaId, usuario }), 'Área reabierta.');
  };

  const horasOk = dialogo?.tipo === 'horas' && horasValidas(horas);
  const yaEsta = dialogo?.tipo === 'reemplazar' && !!elegido && yaEstaEnTabla(filas, elegido.nomina);
  const reemplazoOk = dialogo?.tipo === 'reemplazar' && !!elegido && !yaEsta;

  return (
    <Modal isOpen={abierto} onClose={() => !trabajando && onClose()} title={`Revisar · ${area.nombre}`} maxWidth="max-w-6xl"
      subtitulo="Lo autorizado por Aut. 2. Tus cambios se guardan aparte: las solicitudes de tiempo extra no se modifican."
      pie={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            <Insignia tono={estado === 'firmada' ? 'exito' : estado === 'ajustada' ? 'info' : 'neutro'} icono={estado === 'firmada' ? Lock : undefined} sinIcono={estado === 'sin_revisar'}>
              {estado === 'firmada' ? 'Firmada' : estado === 'ajustada' ? 'Ajustada' : 'Sin revisar'}
            </Insignia>
            <span className="text-[var(--text-secondary)]"><b className="font-medium text-[var(--text-main)]">{totales.empleados}</b> empleados · <b className="font-medium text-[var(--text-main)]">{totales.horas}</b> h</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {!firmada && cambios.length > 0 && <Boton icono={Undo2} onClick={deshacer} disabled={trabajando} id="btn-deshacer-ajustes">Deshacer ajustes</Boton>}
            {firmada && esRH && <Boton onClick={reabrir} disabled={trabajando} id="btn-reabrir-area">Reabrir</Boton>}
            {!firmada && <Boton icono={FileCheck2} onClick={firmar} disabled={trabajando || sinAutorizado || totales.empleados === 0} id="btn-firmar-area">Marcar como firmada</Boton>}
            <Boton variante="primario" icono={Download} estado={descargando ? 'cargando' : undefined} onClick={onDescargar} disabled={sinAutorizado || totales.empleados === 0} id="btn-descargar-area-modal">Descargar esta área</Boton>
          </div>
        </div>
      )}>
      <div className="space-y-4">
        {firmada && (
          <Aviso tono="exito" titulo="Esta área ya está firmada" icon={Lock}>
            Quedó bloqueada{ajuste.firmadaPor?.nombre ? ` por ${nombre(ajuste.firmadaPor.nombre)}` : ''}. {esRH ? 'Puedes reabrirla si hay que corregir algo.' : 'Si hay que corregir algo, pide a Recursos Humanos que la reabra.'}
          </Aviso>
        )}
        {ajuste?.reabiertaPor && !firmada && <Aviso tono="info">Esta área fue reabierta por {nombre(ajuste.reabiertaPor.nombre ?? '')}.</Aviso>}
        {sinAutorizado ? <Aviso tono="aviso">No hay tiempo extra autorizado de esta área en el periodo.</Aviso> : (
          <Tabla etiqueta={`Tiempo extra de ${area.nombre} por día`}>
            <thead>
              <tr>
                <Th>#</Th><Th>Nómina</Th><Th>Nombre</Th>
                {DIAS_CORTO.map((d, i) => <Th key={d} derecha>{d}<span className="block font-normal text-[var(--text-muted)]">{ddmm(periodo.dias[i])}</span></Th>)}
                <Th derecha>Subtotal</Th><Th>Motivo</Th>{!firmada && <Th><span className="sr-only">Acciones</span></Th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <Fila key={f.clave} className={f.quitado ? 'opacity-60' : ''}>
                  <Td mono>{i + 1}</Td>
                  <Td mono>{f.nomina}</Td>
                  <Td>
                    <span className={f.quitado ? 'line-through' : ''}>{nombre(f.nombre)}</span>
                    {f.quitado && <Insignia tono="error" className="ml-2">Quitado</Insignia>}
                    {f.reemplazoDe && !f.quitado && <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><ArrowLeftRight className="h-3 w-3" aria-hidden="true" />Reemplaza a {nombre(f.reemplazoDe.nombre)} ({f.reemplazoDe.nomina})</span>}
                  </Td>
                  {periodo.dias.map((d, k) => {
                    const orig = d ? f.original[d] : undefined;
                    const act = d ? f.horas[d] : undefined;
                    const editado = !!d && f.editados.includes(d);
                    return (
                      <Td key={k} derecha mono className={editado ? 'bg-[var(--status-info-bg)]' : ''}>
                        {!d ? <span className="text-[var(--text-muted)]">—</span> : (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {editado
                              ? <><span className="text-[var(--text-muted)] line-through" aria-label={`autorizado ${orig ?? 0} horas`}>{orig ?? 0}</span><span aria-hidden="true">→</span><b className="font-medium">{act ?? 0}</b><Pencil className="h-3 w-3 text-[var(--status-info-text)]" aria-label="Hora corregida" /></>
                              : (act ?? '')}
                            {!firmada && !f.quitado && (
                              <button type="button" onClick={() => abrirHoras(f, d)} title={`Corregir las horas del ${DIAS_CORTO[k]} ${ddmm(d)}`} aria-label={`Corregir las horas de ${nombre(f.nombre)} el ${DIAS_CORTO[k]} ${ddmm(d)}`}
                                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)]"><Clock className="h-3 w-3" aria-hidden="true" /></button>
                            )}
                          </span>
                        )}
                      </Td>
                    );
                  })}
                  <Td derecha mono className="font-medium">
                    {f.subtotalOriginal !== f.subtotal && !f.quitado ? <><span className="text-[var(--text-muted)] line-through">{f.subtotalOriginal}</span> → {f.subtotal}</> : f.subtotal}
                  </Td>
                  <Td className="min-w-48 max-w-64 whitespace-normal text-[var(--text-secondary)]">{f.motivo || '—'}</Td>
                  {!firmada && (
                    <Td>
                      {!f.quitado && (
                        <span className="flex gap-1">
                          <Boton tamano="sm" variante="fantasma" icono={ArrowLeftRight} onClick={() => abrirReemplazo(f)} disabled={trabajando} aria-label={`Reemplazar a ${nombre(f.nombre)}`} title="Reemplazar por otra persona">Reemplazar</Boton>
                          <Boton tamano="sm" variante="peligro" icono={UserMinus} onClick={() => quitar(f)} disabled={trabajando} aria-label={`Quitar a ${nombre(f.nombre)}`}>Quitar</Boton>
                        </span>
                      )}
                    </Td>
                  )}
                </Fila>
              ))}
              <Fila>
                <Td /><Td /><Td className="font-medium">Total Hrs.</Td>
                {totales.porDia.map((h, k) => <Td key={k} derecha mono className="font-medium">{h > 0 ? h : ''}</Td>)}
                <Td derecha mono className="font-medium">{totales.horas}</Td><Td />{!firmada && <Td />}
              </Fila>
            </tbody>
          </Tabla>
        )}
        {filas.some(fueAjustada) && !sinAutorizado && <p className="text-xs text-[var(--text-muted)]">Las celdas con <Pencil className="inline h-3 w-3" aria-hidden="true" /> muestran lo autorizado tachado y lo ajustado a su derecha.</p>}
        {filasVigentes(filas).length > FILAS_POR_PAGINA && <p className="text-xs text-[var(--text-muted)]">Con más de {FILAS_POR_PAGINA} empleados el formato impreso continúa en otra página.</p>}
      </div>

      {dialogo?.tipo === 'horas' && (
        <ModalCambio key={`h-${dialogo.fila.clave}-${dialogo.dia}`} titulo="Corregir las horas de un día"
          subtitulo={`${nombre(dialogo.fila.nombre)} · ${DIAS_CORTO[periodo.dias.indexOf(dialogo.dia)]} ${ddmm(dialogo.dia)} · autorizado: ${dialogo.fila.original[dialogo.dia] ?? 0} h`}
          onClose={() => setDialogo(null)} onGuardar={guardarDialogo} valido={horasOk}>
          <Campo etiqueta="Horas de ese día" ayuda="De 0 a 24, con a lo más dos decimales. Con 0 el día queda vacío." error={horas !== '' && !horasOk ? 'Escribe un número de horas de 0 a 24.' : null} obligatorio>
            <Entrada type="number" inputMode="decimal" min="0" max="24" step="0.25" value={horas} onChange={e => setHoras(e.target.value)} autoFocus />
          </Campo>
        </ModalCambio>
      )}

      {dialogo?.tipo === 'reemplazar' && (
        <ModalCambio key={`r-${dialogo.fila.clave}`} titulo="Reemplazar por otra persona"
          subtitulo={`Sale ${nombre(dialogo.fila.nombre)} (${dialogo.fila.nomina}); sus horas pasan a quien elijas.`}
          onClose={() => setDialogo(null)} onGuardar={guardarDialogo} valido={reemplazoOk}>
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">Empleado que lo reemplaza</span>
            {elegido ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-sm">
                <span>{nombre(elegido.nombre)} <span className="font-mono text-xs text-[var(--text-muted)]">{elegido.nomina}</span></span>
                <Boton tamano="sm" variante="fantasma" onClick={() => setElegido(null)}>Cambiar</Boton>
              </div>
            ) : <BuscadorEmpleado empleados={empleados} onSelect={setElegido} autoFocus placeholder="Buscar por nombre o nómina…" />}
            {yaEsta && <p className="text-xs text-[var(--status-error-text)]" role="alert">Esa persona ya está en la tabla.</p>}
          </div>
        </ModalCambio>
      )}
    </Modal>
  );
}
