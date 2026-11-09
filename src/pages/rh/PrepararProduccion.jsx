/**
 * PrepararProduccion.jsx — Herramientas (solo admin): «Preparar para producción». Borra los datos de prueba antes de arrancar.
 *
 * FASE 1 (no borra nada): abre la ventana de limpieza, descarga el respaldo JSON COMPLETO (borradores incluidos) y muestra lo que se borraría, con
 * conteos y folios, más los usuarios que parecen de prueba para que el admin marque cuáles borrar y la lista exacta de cuentas de Authentication
 * que tendrá que borrar en la consola de Firebase (sin Cloud Functions no se puede desde la app).
 * FASE 2: solo tras escribir BORRAR. Borra en lotes con progreso, reinicia el folio (TE-<año>-0001), deja un solo renglón en la bitácora y muestra
 * una lista de verificación. Nunca toca padrón, áreas, puestos, turnos, motivos, catálogos, usuarios no marcados, asignaciones ni accesos.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Copy, DatabaseBackup, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import Insignia from '../../components/ui/Insignia';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { Tarjeta } from '../../components/ui/Tarjeta';
import { rutaAccesos } from '../../rutas';
import { ACCIONES_DESCARGA, registrarDescarga } from '../../utils/bitacoraDb';
import { esVigente } from '../../utils/asignaciones';
import { esElegibleActivo } from '../../utils/elegibles';
import { construirRespaldo, nombreRespaldoCompleto } from '../../utils/respaldoCompleto';
import { descargarArchivoJson, leerColeccionesParaRespaldo } from '../../utils/respaldoDb';
import { PALABRA_BORRAR, armarInventario, cuentasAuthABorrar, puedeMarcarse } from '../../utils/limpiezaProduccion';
import { abrirVentana, cerrarVentana, ejecutarLimpieza, leerVerificacion } from '../../utils/limpiezaProduccionDb';

const ETIQUETAS = [
  ['tiempoExtra', 'Solicitudes de tiempo extra (incluye borradores)'], ['tiempoExtraEmpleados', '   · sus empleados'], ['tiempoExtraHistorial', '   · su historial'],
  ['solicitudes', 'Solicitudes de transporte'], ['pasajeros', '   · sus pasajeros'], ['ajustesNomina', 'Ajustes de nómina'], ['bitacora', 'Bitácora'], ['contadores', 'Contadores del folio'],
];
const PROTEGIDAS = [
  ['empleados', 'Empleados (padrón)'], ['areas', 'Áreas'], ['puestos', 'Puestos'], ['turnosNomina', 'Turnos'], ['motivosTE', 'Motivos'], ['rutas', 'Rutas'],
  ['comunidades', 'Comunidades'], ['puntosReunion', 'Puntos de reunión'], ['asignaciones', 'Asignaciones'], ['accesos', 'Accesos'],
];

export default function PrepararProduccion() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [fase, setFase] = useState('inicio'); // inicio | leyendo | inventario | borrando | listo
  const [mensaje, setMensaje] = useState('');
  const [avance, setAvance] = useState(null);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState(null); // { colecciones, inventario }
  const [marcados, setMarcados] = useState(() => new Set());
  const [palabra, setPalabra] = useState('');
  const [verificacion, setVerificacion] = useState(null);
  const [quedan, setQuedan] = useState(null);
  const [cuentasFinales, setCuentasFinales] = useState([]);

  const esAdmin = usuario?.rol === 'admin';
  // Si la pantalla se cierra a la mitad de la fase 1, la ventana de limpieza caduca sola (máx. 2 horas, según las reglas)
  const [anio] = useState(() => new Date().getFullYear());

  const accesos = useMemo(() => new Map((datos?.colecciones.accesos ?? []).map(a => [a.id, a.data])), [datos]);
  const usuariosMarcados = useMemo(() => (datos ? datos.inventario.usuarios.filter(u => marcados.has(u.uid)) : []), [datos, marcados]);
  const cuentas = useMemo(() => cuentasAuthABorrar(usuariosMarcados, accesos), [usuariosMarcados, accesos]);
  if (!esAdmin) return null;
  const actor = { uid: usuario.uid, nombre: usuario.nombre ?? '', nomina: usuario.nomina ?? '' };

  const fase1 = async () => {
    setError(''); setFase('leyendo'); setMensaje('Abriendo la ventana de limpieza…');
    try {
      await abrirVentana(actor);
      const colecciones = await leerColeccionesParaRespaldo({ conBorradores: true, onProgreso: setMensaje });
      const respaldo = construirRespaldo({ colecciones, exportadoPor: actor.nombre });
      descargarArchivoJson(respaldo, nombreRespaldoCompleto());
      registrarDescarga(ACCIONES_DESCARGA.respaldoCompleto, { conteo: respaldo.conteo, origen: 'preparar_produccion' });
      setDatos({ colecciones, inventario: armarInventario(colecciones, { uid: usuario.uid, nomina: usuario.nomina }) });
      setMarcados(new Set()); setPalabra('');
      setFase('inventario');
      toast.success('Respaldo descargado. Guárdalo antes de borrar nada.');
    } catch (err) {
      console.error('Preparar para producción:', err);
      setError(`No se pudo completar el respaldo (${err.code ?? err.message}). No se borró nada.`);
      await cerrarVentana().catch(() => {});
      setFase('inicio');
    } finally { setMensaje(''); }
  };

  const fase2 = async () => {
    setError(''); setFase('borrando'); setAvance({ hechas: 0, total: 0 });
    try {
      const r = await ejecutarLimpieza({
        colecciones: datos.colecciones, usuariosABorrar: usuariosMarcados, inventario: datos.inventario, cuentasAuth: cuentas, actor,
        onProgreso: (hechas, total) => setAvance({ hechas, total }),
      });
      setQuedan(r.quedan); setCuentasFinales(cuentas);
      setVerificacion(await leerVerificacion());
      setFase('listo');
      toast.success('Limpieza terminada.');
    } catch (err) {
      console.error('Limpieza para producción:', err);
      setError(`La limpieza se detuvo (${err.code ?? err.message}). Lo ya borrado no se puede deshacer, pero tienes el respaldo; vuelve a empezar desde el paso 1 para completarla.`);
      setFase('inicio'); setDatos(null);
    } finally { setAvance(null); }
  };

  const copiar = (texto) => navigator.clipboard?.writeText(texto).then(() => toast.success('Copiado.')).catch(() => {});
  const alternar = (uid) => setMarcados(prev => { const s = new Set(prev); if (s.has(uid)) s.delete(uid); else s.add(uid); return s; });
  const listaCuentas = (lista) => lista.flatMap(c => c.correos).join('\n');
  const inv = datos?.inventario;

  const tablaCuentas = (lista) => (lista.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Ninguna: no marcaste usuarios.</p> : (
    <div className="space-y-2">
      <Tabla etiqueta="Cuentas de Authentication por borrar">
        <thead><tr><Th>Nómina</Th><Th>Nombre</Th><Th>Cuentas (correo interno)</Th></tr></thead>
        <tbody>{lista.map(c => <Fila key={c.nomina}><Td mono>{c.nomina}</Td><Td>{c.nombre}</Td><Td mono>{c.correos.join(' · ')}</Td></Fila>)}</tbody>
      </Tabla>
      <Boton tamano="sm" icono={Copy} onClick={() => copiar(listaCuentas(lista))}>Copiar los correos</Boton>
      <p className="text-xs text-[var(--text-muted)]">Bórralas en la consola de Firebase › Authentication (busca cada correo). Si una versión anterior ya no existe, sáltala.</p>
    </div>
  ));

  return (
    <Tarjeta titulo="Preparar para producción" accion={<ClipboardCheck className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />}>
      <div className="space-y-5" id="preparar-produccion">
        <p className="text-sm text-[var(--text-secondary)]">
          Borra los datos de prueba antes de arrancar. <b className="font-medium text-[var(--text-main)]">Paso 1</b> (no borra nada): descarga un respaldo completo y muestra lo que se borraría.{' '}
          <b className="font-medium text-[var(--text-main)]">Paso 2</b>: solo si escribes {PALABRA_BORRAR}. No se tocan el padrón, las áreas, los puestos, los turnos, los motivos, los catálogos, los usuarios que no marques, las asignaciones ni los accesos.
        </p>
        {error && <Aviso tono="error">{error}</Aviso>}

        {(fase === 'inicio' || fase === 'leyendo') && (
          <div className="flex flex-wrap items-center gap-3">
            <Boton id="btn-preparar-produccion" variante="primario" icono={DatabaseBackup} estado={fase === 'leyendo' ? 'cargando' : undefined} onClick={fase1}>
              Paso 1: respaldar y ver qué se borraría
            </Boton>
            {mensaje && <span role="status" className="text-xs text-[var(--text-muted)]">{mensaje}</span>}
          </div>
        )}

        {(fase === 'inventario' || fase === 'borrando') && inv && (
          <div className="space-y-6">
            <Aviso tono="exito">Respaldo descargado ({Object.values(datos.colecciones).reduce((n, l) => n + l.length, 0)} documentos). Guárdalo en una carpeta segura: es lo único que permite recuperar lo que se borre.</Aviso>

            <section aria-label="Lo que se borraría" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Se borraría</h3>
              <Tabla etiqueta="Lo que se borraría">
                <thead><tr><Th>Datos</Th><Th derecha>Documentos</Th></tr></thead>
                <tbody>{ETIQUETAS.map(([k, t]) => <Fila key={k}><Td><span className="whitespace-pre">{t}</span></Td><Td derecha>{inv.conteo[k]}</Td></Fila>)}</tbody>
              </Tabla>
              {(inv.folios.tiempoExtra.length > 0 || inv.folios.solicitudes.length > 0) && (
                <details className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-[var(--text-main)]">Folios que se borrarían ({inv.folios.tiempoExtra.length} de tiempo extra, {inv.folios.solicitudes.length} de transporte)</summary>
                  <p className="mt-2 text-[var(--text-secondary)]"><b>Tiempo extra:</b> {inv.folios.tiempoExtra.map(f => `${f.folio} (${f.estatus})`).join(' · ') || '—'}</p>
                  <p className="mt-2 text-[var(--text-secondary)]"><b>Transporte:</b> {inv.folios.solicitudes.map(f => f.folio).join(' · ') || '—'}</p>
                </details>
              )}
            </section>

            <section aria-label="Lo que se conserva" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Se conserva (no se toca)</h3>
              <p className="text-xs text-[var(--text-secondary)]">{PROTEGIDAS.map(([k, t]) => `${t}: ${inv.protegidos[k]}`).join(' · ')}</p>
            </section>

            <section aria-label="Usuarios de prueba" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Usuarios: marca los de prueba que se borrarán</h3>
              <p className="text-xs text-[var(--text-secondary)]">Aparecen primero los que parecen de prueba (su nómina no está en el padrón). Solo se borra su perfil; sus asignaciones y accesos no se tocan (revócalas en Asignaciones si hace falta). Tú no puedes marcarte.</p>
              <Tabla etiqueta="Usuarios" alto="max-h-80">
                <thead><tr><Th>Borrar</Th><Th>Nómina</Th><Th>Nombre</Th><Th>Rol</Th><Th>Notas</Th></tr></thead>
                <tbody>
                  {inv.usuarios.map(u => (
                    <Fila key={u.uid}>
                      <Td><input type="checkbox" aria-label={`Borrar el usuario ${u.nombre}`} checked={marcados.has(u.uid)} disabled={!puedeMarcarse(u) || fase === 'borrando'} onChange={() => alternar(u.uid)} className="h-4 w-4 accent-[var(--accent)]" /></Td>
                      <Td mono>{u.nomina}</Td><Td>{u.nombre}</Td><Td>{u.rol}</Td>
                      <Td>
                        <span className="inline-flex flex-wrap gap-1">
                          {u.parecePrueba && <Insignia tono="aviso">Parece de prueba</Insignia>}
                          {u.esYo && <Insignia>Eres tú</Insignia>}
                          {u.enPadron && <Insignia tono="exito">En el padrón</Insignia>}
                          {u.asignaciones > 0 && <Insignia>{u.asignaciones} asignaciones</Insignia>}
                        </span>
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            </section>

            <section aria-label="Cuentas de Authentication" className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Cuentas de Authentication que tendrás que borrar en la consola</h3>
              {tablaCuentas(cuentas)}
            </section>

            <section aria-label="Confirmar" className="space-y-3 rounded-md border border-[var(--status-error-border)] p-4">
              <h3 className="text-sm font-semibold text-[var(--status-error-text)]">Paso 2: borrar</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Se borra lo de la tabla de arriba y {usuariosMarcados.length} usuarios; el próximo folio será TE-{anio}-0001. No se puede deshacer (salvo con el respaldo).
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Campo etiqueta={`Escribe ${PALABRA_BORRAR} para confirmar`} className="sm:w-64">
                  <Entrada placeholder={PALABRA_BORRAR} value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off" disabled={fase === 'borrando'} />
                </Campo>
                <Boton id="btn-borrar-produccion" variante="peligro" icono={Trash2} estado={fase === 'borrando' ? 'cargando' : undefined} disabled={palabra !== PALABRA_BORRAR || fase === 'borrando'} onClick={fase2}>
                  Borrar y reiniciar el folio
                </Boton>
              </div>
              {fase === 'borrando' && avance && (
                <div role="status" className="space-y-1">
                  <p className="text-sm text-[var(--text-main)]">Borrando… {avance.total ? `${avance.hechas} de ${avance.total} documentos` : ''}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} /></div>
                </div>
              )}
            </section>
          </div>
        )}

        {fase === 'listo' && verificacion && (
          <div className="space-y-5" aria-label="Lista de verificación">
            <Aviso tono="exito">Limpieza terminada. Queda un solo renglón en la bitácora: «Limpieza para producción».</Aviso>
            <Verificacion v={verificacion} quedan={quedan} />
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Pendiente en la consola: borrar estas cuentas de Authentication</h3>
              {tablaCuentas(cuentasFinales)}
            </section>
            <Boton onClick={() => { setFase('inicio'); setDatos(null); setVerificacion(null); }}>Cerrar</Boton>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

/** Lista de verificación: elegibles por área, usuarios sin asignación, turnos y motivos cargados y cero solicitudes */
function Verificacion({ v, quedan }) {
  const [ahora] = useState(() => new Date());
  const porArea = v.areas.filter(a => a.participaTE).map(a => ({ a, n: v.empleados.filter(e => esElegibleActivo(e) && e.areaId === a.id).length }));
  const sinAsignacion = v.usuarios.filter(u => u.rol === 'usuario' && u.activo !== false && !v.asignaciones.some(x => String(x.nomina) === String(u.nomina) && esVigente(x, ahora)));
  const turnosOk = v.turnos.filter(t => t.entrada && t.salida).length;
  const fila = (ok, texto, extra = null) => (
    <li className="flex items-start gap-2 text-sm text-[var(--text-main)]">
      <Insignia tono={ok ? 'exito' : 'aviso'}>{ok ? 'Listo' : 'Revisar'}</Insignia><span>{texto}{extra}</span>
    </li>
  );
  return (
    <ul className="space-y-2">
      {fila(quedan === 0, `Solicitudes restantes: ${quedan} (deben ser 0)`)}
      {fila(porArea.some(x => x.n > 0), `Elegibles por área: ${porArea.map(x => `${x.a.nombre} ${x.n}`).join(' · ')} (total ${porArea.reduce((n, x) => n + x.n, 0)})`)}
      {fila(sinAsignacion.length === 0, `Usuarios sin asignación: ${sinAsignacion.length}`, sinAsignacion.length > 0 && (
        <> · {sinAsignacion.slice(0, 15).map(u => u.nombre).join(', ')}{sinAsignacion.length > 15 ? '…' : ''} <Link to={rutaAccesos('usuarios')} className="font-medium text-[var(--accent-text)] underline">Asignar</Link></>
      ))}
      {fila(turnosOk >= 3, `Turnos con horario cargado: ${turnosOk} de ${v.turnos.length}`)}
      {fila(v.motivos.filter(m => m.activo !== false).length > 0, `Motivos cargados: ${v.motivos.filter(m => m.activo !== false).length} activos`)}
    </ul>
  );
}
