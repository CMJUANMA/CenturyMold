/**
 * ModalUsuariosLote.jsx — "Crear usuarios en lote" (RH y admin).
 * Selecciona a las personas con asignación vigente y sin cuenta (más otras del padrón si hace falta), genera una contraseña
 * temporal por persona, crea las cuentas una por una (rol de sistema "usuario" por defecto; un admin puede elegir RH por persona,
 * debeCambiarPassword: true) y entrega
 * un Excel con los accesos. Las contraseñas solo existen en memoria mientras este modal siga abierto: no se guardan en
 * Firestore ni en la bitácora.
 *
 * Cada renglón permite elegir, además del rol del sistema, UNA asignación (Aut. 2 solo un admin, Aut. 1 o Solicitante con su área) que se guarda
 * justo después de crear la cuenta, con la misma validación y bitácora que la pantalla Asignaciones. Al terminar, quien quedó sin ninguna
 * asignación aparece en una lista con un botón «Asignar» que abre la edición de su usuario.
 */
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldAlert, UserPlus, X } from 'lucide-react';
import Modal from '../../../components/Modal';
import BuscadorEmpleado from '../../../components/BuscadorEmpleado';
import { useConfirmar } from '../../../hooks/useConfirmar';
import { useToast } from '../../../hooks/useToast';
import { crearCuentaUsuario, mensajeErrorAlta } from '../../../utils/usuariosDb';
import { ejecutarEnLotes, opBitacora } from '../../../utils/estructuraDb';
import { candidatosSinCuenta, descargarLibroAccesos, generarPassword } from '../../../utils/accesosIniciales';
import { ROL_OP, ROL_OP_LABELS, aIsoLocal, esVigente, etiquetaAsignacion, rolesAsignables, validarNuevaAsignacion } from '../../../utils/asignaciones';
import { asignarRol } from '../../../utils/asignacionesDb';
import { ROLES, ROL_LABELS } from '../../../utils/constantes';
import { btnPrimary, btnSecondary, btnIcon, selectCls } from './ui';

const PAUSA_MS = 400; // entre cuenta y cuenta, para no topar los límites de Firebase Auth
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

export default function ModalUsuariosLote({ abierto, ...resto }) {
  // Se monta solo mientras está abierto: al cerrar se pierden las contraseñas, como debe ser
  return abierto ? <Contenido {...resto} /> : null;
}

function Contenido({ actor, areas = [], usuarios, empleados, asignaciones, nombresArea, ahora, onClose, onCreados, onAsignar = null }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const candidatos = useMemo(
    () => candidatosSinCuenta({ asignaciones, usuarios, empleados, nombresArea, ahora }),
    [asignaciones, usuarios, empleados, nombresArea, ahora],
  );
  const [extras, setExtras] = useState([]); // empleados sin asignación agregados a mano
  const [marcadas, setMarcadas] = useState(() => new Set(candidatos.map(c => c.nomina)));
  const [otros, setOtros] = useState(false);
  // Rol del sistema por persona (nómina → rol). Solo un admin puede dar RH; los demás siempre crean «usuario»
  const [rolesSistema, setRolesSistema] = useState({});
  const rolDe = (nomina) => (actor.esAdmin && rolesSistema[nomina] === ROLES.RH ? ROLES.RH : ROLES.USUARIO);
  // Asignación elegida por persona (nómina → { rol, areaId }); '' = sin asignación por ahora
  const [asignacionDe, setAsignacionDe] = useState({});
  const [errorSeleccion, setErrorSeleccion] = useState('');
  const [perfilesCreados, setPerfilesCreados] = useState([]);
  const [fase, setFase] = useState('seleccion'); // seleccion | creando | resultado
  const [avance, setAvance] = useState({ hechas: 0, total: 0 });
  const [resultados, setResultados] = useState([]);
  const [errorDescarga, setErrorDescarga] = useState('');
  const cuentas = useRef([]); // { nomina, nombre, area, roles, password }: solo en memoria

  const filas = [...candidatos, ...extras];
  const seleccion = filas.filter(f => marcadas.has(f.nomina));
  const yaEnLista = new Set([...filas.map(f => f.nomina), ...usuarios.map(u => String(u.nomina))]);
  const nombreArea = (id) => nombresArea.get(id) ?? id ?? '';
  const rolesQueDa = rolesAsignables(actor);
  const areasTE = areas.filter(a => a.participaTE === true && a.activa !== false);
  const asigDe = (f) => asignacionDe[f.nomina] ?? { rol: '', areaId: areasTE.some(a => a.id === f.areaId) ? f.areaId : '' };
  const cambiarAsig = (f, cambio) => setAsignacionDe(prev => ({ ...prev, [f.nomina]: { ...asigDe(f), ...cambio } }));
  const empleadoDe = (nomina) => empleados.find(e => String(e.nomina) === String(nomina));

  const alternar = (n) => setMarcadas(prev => { const s = new Set(prev); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  const agregarExtra = (e) => {
    const nomina = String(e.nomina);
    setExtras(prev => [...prev, { nomina, nombre: e.nombre ?? '', puesto: e.puesto ?? '', areaId: e.areaId ?? '', roles: [] }]);
    setMarcadas(prev => new Set(prev).add(nomina));
  };

  const descargar = async () => {
    setErrorDescarga('');
    try { await descargarLibroAccesos(cuentas.current); } catch (err) { setErrorDescarga('No se pudo generar el archivo: ' + err.message); }
  };

  const crear = async () => {
    // Antes de crear nada se revisa cada asignación elegida (las mismas reglas que Asignaciones); una que ya existe vigente se omite
    const hoy = aIsoLocal(ahora);
    const elegidas = new Map();
    const problemas = [];
    for (const f of seleccion) {
      const { rol, areaId } = asigDe(f);
      if (!rol) continue;
      const v = validarNuevaAsignacion({ actor, persona: { nomina: f.nomina }, rol, areaId, desde: hoy, hasta: '', motivo: '', areas, asignaciones, ahora });
      if (v.error && !v.ya) problemas.push(`${f.nomina} ${f.nombre}: ${v.error}`);
      else if (!v.ya) elegidas.set(f.nomina, { rol, areaId, previa: v.previa });
    }
    if (problemas.length) { setErrorSeleccion(problemas.join(' · ')); return; }
    setErrorSeleccion('');
    const lista = seleccion.map(f => ({ ...f, rol: rolDe(f.nomina), password: generarPassword() }));
    setFase('creando');
    setAvance({ hechas: 0, total: lista.length });
    cuentas.current = [];
    const salida = [];
    const perfiles = [];
    for (let i = 0; i < lista.length; i++) {
      const f = lista[i];
      try {
        const { uid, perfil } = await crearCuentaUsuario({ nomina: f.nomina, nombre: f.nombre, rol: f.rol, password: f.password });
        perfiles.push({ uid, ...perfil });
        // La asignación elegida se guarda después de la cuenta; si falla, la cuenta queda creada y se avisa (se da desde su edición)
        const elegida = elegidas.get(f.nomina);
        let asignada = '';
        let errorAsignacion = '';
        if (elegida) {
          const e = empleadoDe(f.nomina);
          try {
            await asignarRol(actor, {
              nomina: f.nomina, nombre: e?.nombre ?? f.nombre, puesto: e?.puesto ?? f.puesto ?? '', puestoId: e?.puestoId ?? '', rol: elegida.rol,
              areaId: elegida.rol === ROL_OP.AUT2 ? null : elegida.areaId, desde: hoy, hasta: '', motivo: '',
            }, elegida.previa);
            asignada = etiquetaAsignacion({ rol: elegida.rol, areaId: elegida.areaId }, nombresArea);
          } catch (errAsig) { errorAsignacion = errAsig.message; }
        }
        cuentas.current.push({ nomina: f.nomina, nombre: f.nombre, area: nombreArea(f.areaId), roles: [...f.roles, ...(asignada ? [asignada] : [])].join(' · '), password: f.password });
        salida.push({ nomina: f.nomina, nombre: f.nombre, ok: true, asignada, errorAsignacion });
      } catch (err) {
        salida.push({ nomina: f.nomina, nombre: f.nombre, ok: false, error: mensajeErrorAlta(err, f.nomina, usuarios) });
      }
      setAvance({ hechas: i + 1, total: lista.length });
      if (i < lista.length - 1) await esperar(PAUSA_MS);
    }
    setResultados(salida);
    setPerfilesCreados(perfiles);
    if (perfiles.length) {
      onCreados(perfiles);
      // Quién creó cuántas cuentas; nunca contraseñas
      ejecutarEnLotes([opBitacora({
        accion: 'crear_usuarios_lote', entidad: 'usuarios',
        despues: {
          creadas: perfiles.length, fallidas: salida.length - perfiles.length, nominas: perfiles.map(p => p.nomina),
          conRolRH: perfiles.filter(p => p.rol === ROLES.RH).map(p => p.nomina),
        },
      }, actor)]).catch(err => toast.error('Las cuentas se crearon, pero no se pudo registrar en la bitácora: ' + err.message, 8000));
      descargar();
    }
    setFase('resultado');
  };

  const cerrar = async () => {
    if (fase === 'creando') return;
    if (fase === 'resultado' && cuentas.current.length > 0) {
      const ok = await confirmar({
        titulo: 'Cerrar sin conservar las contraseñas', mensaje: '¿Ya descargaste el archivo? Las contraseñas no se podrán recuperar.',
        textoConfirmar: 'Ya lo descargué, cerrar', peligroso: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const fallidas = resultados.filter(r => !r.ok);
  const creadas = resultados.length - fallidas.length;
  // Cuentas nuevas que no tienen ninguna asignación vigente (ni la de este lote ni otra): se les ofrece «Asignar»
  const sinAsignacion = resultados.filter(r => r.ok && !r.asignada
    && !asignaciones.some(a => String(a.nomina) === r.nomina && esVigente(a, ahora)));

  return (
    <Modal isOpen onClose={cerrar} title="Crear usuarios en lote" maxWidth="max-w-6xl" preventCloseOnBackdrop={fase !== 'seleccion'}>
      {fase === 'seleccion' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Personas con rol operativo vigente que todavía no tienen cuenta. Se crean con rol del sistema <b>Usuario</b> y una contraseña temporal propia
            que deberán cambiar al entrar. {actor.esAdmin
              ? <>Si alguien también es de RH (por ejemplo, una Aut. 2 que debe ver las pantallas de RH), elígelo en la columna «Rol del sistema».</>
              : <>El rol Recursos Humanos solo lo da un administrador.</>}
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] font-semibold">
                <tr>
                  <th className="px-3 py-2" /><th className="px-3 py-2">Nómina</th><th className="px-3 py-2">Nombre (padrón)</th>
                  <th className="px-3 py-2">Puesto</th><th className="px-3 py-2">Área</th><th className="px-3 py-2">Asignaciones actuales</th><th className="px-3 py-2">Rol del sistema</th><th className="px-3 py-2">Asignar ahora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filas.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[var(--text-muted)]">Todas las personas con asignación ya tienen cuenta.</td></tr>}
                {filas.map(f => (
                  <tr key={f.nomina}>
                    <td className="px-3 py-2"><input type="checkbox" checked={marcadas.has(f.nomina)} onChange={() => alternar(f.nomina)}
                      aria-label={`Crear cuenta de ${f.nombre}`} className="h-3.5 w-3.5 accent-[var(--accent)]" /></td>
                    <td className="px-3 py-2 font-mono font-semibold">{f.nomina}</td>
                    <td className="px-3 py-2">{f.nombre}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.puesto || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{nombreArea(f.areaId) || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{f.roles.length ? f.roles.join(' · ') : <i>sin asignación</i>}</td>
                    <td className="px-3 py-2">
                      {actor.esAdmin ? (
                        <select aria-label={`Rol del sistema de ${f.nombre}`} value={rolDe(f.nomina)} className={selectCls}
                          onChange={(e) => setRolesSistema(prev => ({ ...prev, [f.nomina]: e.target.value }))}>
                          <option value={ROLES.USUARIO}>{ROL_LABELS[ROLES.USUARIO]}</option>
                          <option value={ROLES.RH}>{ROL_LABELS[ROLES.RH]}</option>
                        </select>
                      ) : <span className="text-[var(--text-secondary)]">{ROL_LABELS[ROLES.USUARIO]}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select aria-label={`Asignación de ${f.nombre}`} value={asigDe(f).rol} className={selectCls}
                          onChange={(e) => cambiarAsig(f, { rol: e.target.value })}>
                          <option value="">Sin asignación</option>
                          {rolesQueDa.map(r => <option key={r} value={r}>{ROL_OP_LABELS[r]}</option>)}
                        </select>
                        {asigDe(f).rol && asigDe(f).rol !== ROL_OP.AUT2 && (
                          <select aria-label={`Área de la asignación de ${f.nombre}`} value={asigDe(f).areaId} className={selectCls}
                            onChange={(e) => cambiarAsig(f, { areaId: e.target.value })}>
                            <option value="">Elige el área…</option>
                            {areasTE.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {otros ? (
            <div className="space-y-1">
              <BuscadorEmpleado empleados={empleados} excluir={[...yaEnLista]} onSelect={agregarExtra} placeholder="Buscar en el padrón a quien no tiene asignación…" />
              <button type="button" onClick={() => setOtros(false)} className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">Listo</button>
            </div>
          ) : (
            <button type="button" onClick={() => setOtros(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer">
              <UserPlus className="h-3.5 w-3.5" />Agregar otros empleados
            </button>
          )}

          {errorSeleccion && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error-text)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span>{errorSeleccion}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3">
            <span className="text-xs text-[var(--text-muted)]">{seleccion.length} cuentas por crear</span>
            <div className="flex gap-2">
              <button type="button" onClick={cerrar} className={btnSecondary}>Cancelar</button>
              <button type="button" id="btn-crear-lote" onClick={crear} disabled={seleccion.length === 0} className={btnPrimary}>
                <UserPlus className="h-3.5 w-3.5" />Crear {seleccion.length} cuentas
              </button>
            </div>
          </div>
        </div>
      )}

      {fase === 'creando' && (
        <div className="space-y-3 py-6" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
            <Loader2 className="h-4 w-4 animate-spin" />Creando {Math.min(avance.hechas + 1, avance.total)} de {avance.total}…
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-secondary)]">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${avance.total ? (avance.hechas / avance.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-[var(--text-muted)]">No cierres esta ventana: las contraseñas solo existen aquí.</p>
        </div>
      )}

      {fase === 'resultado' && (
        <div className="space-y-4">
          {creadas > 0 && (
            <div role="alert" className="rounded-lg border-2 border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-[var(--status-warning-text)]">
              <p className="flex items-center gap-2 text-base font-semibold"><ShieldAlert className="h-5 w-5 shrink-0" />Este archivo contiene contraseñas</p>
              <p className="mt-1 text-sm font-semibold">
                Entrégalo en persona o en sobre cerrado y bórralo después. No se puede volver a descargar.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" id="btn-descargar-accesos" onClick={descargar} className={btnPrimary}><Download className="h-3.5 w-3.5" />Descargar de nuevo</button>
                <span className="text-xs">Solo está disponible mientras esta ventana siga abierta.</span>
              </div>
              {errorDescarga && <p className="mt-2 text-xs font-semibold text-[var(--status-error-text)]">{errorDescarga}</p>}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success-text)]" />{creadas} de {resultados.length} cuentas creadas.
          </div>
          {resultados.some(r => r.ok && r.asignada) && (
            <p className="text-xs text-[var(--text-secondary)]">
              Asignaciones dadas: {resultados.filter(r => r.ok && r.asignada).map(r => `${r.nomina} ${r.nombre} (${r.asignada})`).join(' · ')}.
            </p>
          )}
          {resultados.some(r => r.ok && r.errorAsignacion) && (
            <div className="space-y-1 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs text-[var(--status-warning-text)]">
              <p className="font-semibold">La cuenta se creó, pero no se pudo dar la asignación:</p>
              <ul>{resultados.filter(r => r.ok && r.errorAsignacion).map(r => <li key={r.nomina}><b>{r.nomina} {r.nombre}:</b> {r.errorAsignacion}</li>)}</ul>
            </div>
          )}
          {sinAsignacion.length > 0 && (
            <section aria-label="Usuarios sin asignación" className="space-y-2 rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--status-warning-text)]">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{sinAsignacion.length} {sinAsignacion.length === 1 ? 'usuario quedó' : 'usuarios quedaron'} sin asignación
              </p>
              <p className="text-xs text-[var(--status-warning-text)]">Sin una asignación (Aut. 1, Solicitante…) solo entran a su Inicio. Dásela ahora o después con el lápiz de editar.</p>
              <ul className="divide-y divide-[var(--status-warning-border)]">
                {sinAsignacion.map(r => (
                  <li key={r.nomina} className="flex items-center justify-between gap-2 py-1.5 text-xs text-[var(--text-main)]">
                    <span><span className="font-mono font-semibold">{r.nomina}</span> {r.nombre}</span>
                    {onAsignar && (
                      <button type="button" className={btnSecondary} aria-label={`Asignar a ${r.nombre}`}
                        onClick={() => { const p = perfilesCreados.find(x => String(x.nomina) === r.nomina); if (p) onAsignar(p); }}>
                        Asignar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {fallidas.length > 0 && (
            <div className="space-y-2 rounded-md border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-3 text-xs text-[var(--status-error-text)]">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{fallidas.length} no se pudieron crear</p>
              <ul className="space-y-1">
                {fallidas.map(f => <li key={f.nomina}><b>{f.nomina} {f.nombre}:</b> {f.error}</li>)}
              </ul>
              <p>Corrige el motivo y vuelve a abrir "Crear usuarios en lote": las cuentas ya creadas no se repiten.</p>
            </div>
          )}
          <div className="flex justify-end border-t border-[var(--border-color)] pt-3">
            <button type="button" onClick={cerrar} className={btnSecondary}><X className={`${btnIcon} !p-0 h-3.5 w-3.5`} />Cerrar</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
