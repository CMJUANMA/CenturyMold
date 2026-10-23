/**
 * DialogosNomina.jsx — Las ventanas de la revisión de nómina que escogen a una persona o un motivo: «Agregar empleado», «Reemplazar por otro empleado» y
 * «Cambiar motivo y P.O./TB». Ninguna pide la razón del ajuste ni guarda en Firestore: devuelven el cambio al borrador de la pantalla, que se guarda junto
 * con los demás pidiendo UNA sola razón.
 */
import { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import BuscadorEmpleado from '../../components/BuscadorEmpleado';
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Entrada } from '../../components/ui/Campo';
import BloqueMotivosTE from '../te/BloqueMotivosTE';
import { cambioAgregar, cambioMotivo, cambioReemplazar, problemaEmpleadoManual } from '../../utils/formatoNomina';
import { motivoDesdeGuardado, motivoVacio, motivosParaGuardar, problemasDeMotivos } from '../../utils/motivosTE';

function Pie({ onClose, onAceptar, valido, texto }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Boton onClick={onClose}>Cancelar</Boton>
      <Boton variante="primario" onClick={onAceptar} disabled={!valido}>{texto}</Boton>
    </div>
  );
}

function PersonaElegida({ persona, nombre, onCambiar }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] px-3 py-2 text-sm">
      <span>{nombre(persona.nombre)} <span className="font-mono text-xs text-[var(--text-muted)]">{persona.nomina}</span></span>
      <Boton tamano="sm" variante="fantasma" onClick={onCambiar}>Cambiar</Boton>
    </div>
  );
}

/** Agregar a alguien que no venía en las solicitudes: del padrón (primero los del área) o capturado a mano */
export function ModalAgregarEmpleado({ area, nombresAreas, empleados, motivos, nominasEnTabla, nombre, onClose, onAgregar }) {
  const [manual, setManual] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [aceptaOtraArea, setAceptaOtraArea] = useState(false);
  const [datos, setDatos] = useState({ nomina: '', nombre: '' });
  const [motivo, setMotivo] = useState(() => [motivoVacio()]);

  const enPadron = useMemo(() => new Map(empleados.map(e => [String(e.nomina), e])), [empleados]);
  const sugeridos = useMemo(() => (e) => e.areaId === area.areaId, [area.areaId]);
  const deOtraArea = !!elegido && !!elegido.areaId && elegido.areaId !== area.areaId;
  const areaDe = (e) => nombresAreas.get(e?.areaId) ?? e?.areaId ?? 'otra área';

  const nominaManual = datos.nomina.trim();
  const problemaManual = manual ? problemaEmpleadoManual(datos) : null;
  const errorNomina = !manual ? null
    : nominasEnTabla.includes(nominaManual) ? 'Esa nómina ya está en la tabla.'
      : enPadron.has(nominaManual) ? 'Esa nómina sí está en el padrón: búscala en la lista para agregarla.' : null;
  const problemasMotivo = problemasDeMotivos(motivo, motivos);

  const persona = manual ? { nomina: nominaManual, nombre: datos.nombre.trim().toUpperCase(), puesto: '' } : elegido;
  const yaEsta = !manual && !!elegido && nominasEnTabla.includes(String(elegido.nomina));
  const valido = !!persona && problemasMotivo.length === 0 && !yaEsta && (manual ? !problemaManual && !errorNomina : !deOtraArea || aceptaOtraArea);

  const aceptar = () => {
    if (!valido) return;
    onAgregar(cambioAgregar(persona, motivosParaGuardar(motivo, motivos)[0], { enPadron: !manual, areaOrigen: manual ? '' : (elegido.areaId ?? '') }));
  };

  return (
    <Modal isOpen onClose={onClose} title="Agregar empleado" maxWidth="max-w-xl"
      subtitulo={`Solo entra al formato de ${area.nombre}; no crea solicitudes. Las horas se capturan en la tabla.`}
      pie={<Pie onClose={onClose} onAceptar={aceptar} valido={valido} texto="Agregar al formato" />}>
      <div className="space-y-5">
        {!manual ? (
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--text-secondary)]">Empleado</span>
            {elegido ? (
              <PersonaElegida persona={elegido} nombre={nombre} onCambiar={() => { setElegido(null); setAceptaOtraArea(false); }} />
            ) : (
              <BuscadorEmpleado empleados={empleados} onSelect={setElegido} excluir={nominasEnTabla} autoFocus sugeridos={sugeridos}
                etiquetaSugeridos={`Empleados de ${area.nombre}`} placeholder="Buscar por nombre o nómina…" />
            )}
            {yaEsta && <p className="text-xs text-[var(--status-error-text)]" role="alert">Esa persona ya está en la tabla de esta área y semana.</p>}
            {deOtraArea && !yaEsta && (
              <Aviso tono="aviso" titulo={`Es de ${areaDe(elegido)}`}
                accion={aceptaOtraArea ? undefined : <Boton tamano="sm" onClick={() => setAceptaOtraArea(true)}>Sí, agregarlo aquí</Boton>}>
                {aceptaOtraArea ? `Se agregará a ${area.nombre} aunque pertenece a ${areaDe(elegido)}.` : `¿Agregarlo a ${area.nombre}?`}
              </Aviso>
            )}
            <button type="button" onClick={() => { setManual(true); setElegido(null); }} className="cursor-pointer text-xs font-medium text-[var(--accent-text)] underline">
              No aparece en el padrón: capturar nómina y nombre a mano
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Aviso tono="aviso" titulo="No está en el padrón">Se agrega con los datos que captures; el renglón queda marcado como «Agregado» y fuera del padrón.</Aviso>
            <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
              <Campo etiqueta="Nómina" obligatorio error={nominaManual && (errorNomina || (problemaManual?.startsWith('La nómina') ? problemaManual : null))}>
                <Entrada inputMode="numeric" maxLength={10} autoFocus value={datos.nomina} onChange={e => setDatos(d => ({ ...d, nomina: e.target.value.replace(/\D/g, '') }))} />
              </Campo>
              <Campo etiqueta="Nombre completo" obligatorio error={datos.nombre && problemaManual && !problemaManual.startsWith('La nómina') ? problemaManual : null}>
                <Entrada maxLength={80} value={datos.nombre} onChange={e => setDatos(d => ({ ...d, nombre: e.target.value }))} placeholder="Apellidos y nombres" />
              </Campo>
            </div>
            <button type="button" onClick={() => setManual(false)} className="cursor-pointer text-xs font-medium text-[var(--accent-text)] underline">Buscar en el padrón</button>
          </div>
        )}
        {persona && (
          <BloqueMotivosTE unico motivos={motivo} catalogo={motivos} onChange={setMotivo} problemas={problemasMotivo.filter(p => p.mensaje && motivo[0]?.motivoId)} />
        )}
        {!persona && <p className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><UserPlus className="h-4 w-4" aria-hidden="true" />Elige a la persona para indicar su motivo.</p>}
      </div>
    </Modal>
  );
}

/** Reemplazar a un empleado por otro del padrón: sus horas pasan a quien se elija */
export function ModalReemplazar({ fila, empleados, nominasEnTabla, nombre, onClose, onReemplazar }) {
  const [elegido, setElegido] = useState(null);
  const yaEsta = !!elegido && nominasEnTabla.includes(String(elegido.nomina));
  const valido = !!elegido && !yaEsta;
  return (
    <Modal isOpen onClose={onClose} title="Reemplazar por otro empleado" maxWidth="max-w-md"
      subtitulo={`Sale ${nombre(fila.nombre)} (${fila.nomina}); sus horas pasan a quien elijas.`}
      pie={<Pie onClose={onClose} onAceptar={() => valido && onReemplazar(cambioReemplazar(fila, elegido, ''))} valido={valido} texto="Reemplazar" />}>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-[var(--text-secondary)]">Empleado que lo reemplaza</span>
        {elegido ? <PersonaElegida persona={elegido} nombre={nombre} onCambiar={() => setElegido(null)} />
          : <BuscadorEmpleado empleados={empleados} onSelect={setElegido} excluir={nominasEnTabla} autoFocus placeholder="Buscar por nombre o nómina…" />}
        {yaEsta && <p className="text-xs text-[var(--status-error-text)]" role="alert">Esa persona ya está en la tabla.</p>}
      </div>
    </Modal>
  );
}

/** Cambiar el motivo (y P.O./TB) de un renglón */
export function ModalMotivo({ fila, motivos, nombre, onClose, onCambiar }) {
  const [motivo, setMotivo] = useState(() => [fila.motivoCorregido ? { ...motivoDesdeGuardado(fila.motivoCorregido), motivoId: motivos.find(m => m.nombre === fila.motivoCorregido.nombre)?.id ?? '' } : motivoVacio()]);
  const problemas = problemasDeMotivos(motivo, motivos);
  const valido = problemas.length === 0;
  return (
    <Modal isOpen onClose={onClose} title="Cambiar motivo y P.O./TB" maxWidth="max-w-md"
      subtitulo={`${nombre(fila.nombre)} · ahora: ${fila.motivo || 'sin motivo'}${fila.numero ? ` · ${fila.numero}` : ''}`}
      pie={<Pie onClose={onClose} onAceptar={() => valido && onCambiar(cambioMotivo(fila, motivosParaGuardar(motivo, motivos)[0], ''))} valido={valido} texto="Aplicar al renglón" />}>
      <BloqueMotivosTE unico motivos={motivo} catalogo={motivos} onChange={setMotivo} problemas={problemas.filter(p => p.mensaje && motivo[0]?.motivoId)} />
    </Modal>
  );
}
