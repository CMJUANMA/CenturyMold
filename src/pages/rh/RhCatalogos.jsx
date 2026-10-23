/**
 * RhCatalogos.jsx — "Catálogos" (/transporte/catalogos): rutas, comunidades y puntos de reunión con CRUD y carga masiva, y los motivos del tiempo extra
 * Acceso: roles rh y admin (esPersonalRH)
 * Un solo botón principal por pestaña («Nueva ruta», «Nueva comunidad», «Nuevo punto», «Nuevo motivo»); Importar directorio va en contorno.
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { ArrowDown, ArrowUp, ListChecks, MapPin, Navigation, Upload, Check, Plus, Pencil, Power, Search } from 'lucide-react';
import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { slugify } from '../../utils/comparacionImportacion';
import { esActivo } from '../../utils/activo';
import { useRecargarCatalogos } from '../../hooks/useCatalogos';
import { MAX_NOMBRE_MOTIVO, TIPOS_NUMERO, ordenarMotivos } from '../../utils/motivosTE';
import { cambiarActivoMotivo, crearMotivo, guardarMotivo, intercambiarOrden, sembrarMotivos } from '../../utils/motivosDb';

// Importación masiva (arrastra exceljs): se descarga solo al abrir el modal
const ModalImportacion = lazy(() => import('./ModalImportacion'));
import Modal from '../../components/Modal';
import Aviso from '../../components/ui/Aviso';
import Boton from '../../components/ui/Boton';
import { Campo, Casilla, Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoTabla } from '../../components/ui/Esqueleto';
import Insignia from '../../components/ui/Insignia';
import Pestanas from '../../components/ui/Pestanas';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';
import { ROLES } from '../../utils/constantes';
import { useConfirmar } from '../../hooks/useConfirmar';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { id: 'rutas', etiqueta: 'Rutas', icono: Navigation },
  { id: 'comunidades', etiqueta: 'Comunidades', icono: MapPin },
  { id: 'puntos', etiqueta: 'Puntos de reunión', icono: MapPin },
  { id: 'motivos', etiqueta: 'Motivos', icono: ListChecks },
];

// ── Componentes compartidos ───────────────────────────────────────────────
/** Búsqueda + contador + botón principal de la pestaña */
function Barra({ valor, onCambio, placeholder, etiquetaBusqueda, contador, textoNuevo, onNuevo, deshabilitarNuevo }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        <Entrada type="search" value={valor} onChange={e => onCambio(e.target.value)} placeholder={placeholder} aria-label={etiquetaBusqueda} className="pl-9" />
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">{contador}</span>
        <Boton variante="primario" icono={Plus} onClick={onNuevo} disabled={deshabilitarNuevo}>{textoNuevo}</Boton>
      </div>
    </div>
  );
}

function EstadoActivo({ activo, femenino = true }) {
  return activo
    ? <Insignia tono="exito">{femenino ? 'Activa' : 'Activo'}</Insignia>
    : <Insignia tono="neutro" icono={Power}>{femenino ? 'Inactiva' : 'Inactivo'}</Insignia>;
}

/** Editar + activar/desactivar de una fila */
function AccionesFila({ activo, onEditar, onAlternar, nombre }) {
  return (
    <div className="inline-flex gap-1">
      <Boton variante="fantasma" tamano="icono" onClick={onEditar} title="Editar" aria-label={`Editar ${nombre}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Boton>
      <Boton variante="fantasma" tamano="icono" onClick={onAlternar} title={activo ? 'Desactivar' : 'Activar'} aria-label={`${activo ? 'Desactivar' : 'Activar'} ${nombre}`}>
        <Power className={`h-4 w-4 ${activo ? 'text-[var(--status-success-text)]' : ''}`} aria-hidden="true" />
      </Boton>
    </div>
  );
}

/** Modal con formulario: avisos de error/éxito, campos (children) y pie con Cancelar + acción principal */
function ModalForm({ titulo, onClose, onSubmit, guardando, error, exito, textoGuardar, children }) {
  return (
    <Modal isOpen onClose={onClose} title={titulo} maxWidth="max-w-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Aviso tono="error">{error}</Aviso>}
        {exito && <Aviso tono="exito">{exito}</Aviso>}
        {children}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:justify-end">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" icono={Check} estado={guardando ? 'cargando' : undefined}>{textoGuardar}</Boton>
        </div>
      </form>
    </Modal>
  );
}

// ── Tab Rutas ─────────────────────────────────────────────────────────────
function TabRutas({ rutas, comunidades, puntos, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null); // null | { modo: 'crear'|'editar', ruta? }
  const [form, setForm] = useState({ nombre: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const filtradas = rutas.filter(r => !busqueda || r.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  const abrirCrear = () => { setForm({ nombre: '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (r) => { setForm({ nombre: r.nombre }); setError(''); setExito(''); setModal({ modo: 'editar', ruta: r }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = slugify(nombre);
        const existe = rutas.find(r => r.id === id);
        if (existe) { setError('Ya existe una ruta con ese nombre.'); return; }
        await setDoc(doc(db, 'rutas', id), { nombre, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'rutas', modal.ruta.id), { nombre });
      }
      setExito(modal.modo === 'crear' ? 'Ruta creada correctamente.' : 'Ruta actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (r) => {
    const comsDep = comunidades.filter(c => c.rutaId === r.id).length;
    const ptosDep = puntos.filter(p => p.rutaId === r.id).length;
    const accion = r.activo !== false ? 'desactivar' : 'activar';
    let msg = `¿Deseas ${accion} la ruta "${r.nombre}"?`;
    if (r.activo !== false && (comsDep || ptosDep)) msg += ` Dependen de ella ${comsDep} comunidad(es) y ${ptosDep} punto(s).`;
    if (!await confirmar({ titulo: `${r.activo !== false ? 'Desactivar' : 'Activar'} ruta`, mensaje: msg, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: r.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'rutas', r.id), { activo: r.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar la ruta: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <Barra valor={busqueda} onCambio={setBusqueda} placeholder="Buscar ruta" etiquetaBusqueda="Buscar ruta"
        contador={`${filtradas.length} ${filtradas.length === 1 ? 'ruta' : 'rutas'}`} textoNuevo="Nueva ruta" onNuevo={abrirCrear} />

      {filtradas.length === 0
        ? <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio titulo="No hay rutas" texto="Crea una con «Nueva ruta» o carga varias con «Importar directorio»." /></div>
        : (
          <Tabla etiqueta="Rutas">
            <thead>
              <tr><Th>Nombre de la ruta</Th><Th derecha>Comunidades</Th><Th derecha>Puntos</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
            </thead>
            <tbody>
              {filtradas.map(r => {
                const nComs = comunidades.filter(c => c.rutaId === r.id).length;
                const nPtos = puntos.filter(p => p.rutaId === r.id).length;
                return (
                  <Fila key={r.id}>
                    <Td className="font-medium">{r.nombre}</Td>
                    <Td derecha className="text-[var(--text-secondary)]">{nComs}</Td>
                    <Td derecha className="text-[var(--text-secondary)]">{nPtos}</Td>
                    <Td><EstadoActivo activo={r.activo !== false} /></Td>
                    <Td className="text-right"><AccionesFila nombre={r.nombre} activo={r.activo !== false} onEditar={() => abrirEditar(r)} onAlternar={() => toggleActivo(r)} /></Td>
                  </Fila>
                );
              })}
            </tbody>
          </Tabla>
        )}

      {modal && (
        <ModalForm titulo={modal.modo === 'crear' ? 'Nueva ruta' : 'Editar ruta'} onClose={() => setModal(null)} onSubmit={handleGuardar}
          guardando={guardando} error={error} exito={exito} textoGuardar={modal.modo === 'crear' ? 'Crear ruta' : 'Guardar cambios'}>
          <Campo etiqueta="Nombre de la ruta" ayuda="El ID no cambia al editar; solo el nombre visible." obligatorio>
            <Entrada required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: RUTA NORTE" />
          </Campo>
        </ModalForm>
      )}
    </div>
  );
}

// ── Tab Comunidades ───────────────────────────────────────────────────────
function TabComunidades({ comunidades, rutas, puntos, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(esActivo);
  const filtradas = comunidades.filter(c => !busqueda ||
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === c.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirCrear = () => { setForm({ nombre: '', rutaId: rutasActivas[0]?.id ?? '' }); setError(''); setExito(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (c) => { setForm({ nombre: c.nombre, rutaId: c.rutaId }); setError(''); setExito(''); setModal({ modo: 'editar', com: c }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim().toUpperCase();
    const rutaId = form.rutaId;
    if (!nombre || !rutaId) { setError('Nombre y ruta son obligatorios.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const id = `${rutaId}__${slugify(nombre)}`;
        await setDoc(doc(db, 'comunidades', id), { nombre, rutaId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'comunidades', modal.com.id), { nombre, rutaId });
      }
      setExito(modal.modo === 'crear' ? 'Comunidad creada.' : 'Comunidad actualizada.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1200);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (c) => {
    const accion = c.activo !== false ? 'desactivar' : 'activar';
    const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
    if (!await confirmar({ titulo: `${c.activo !== false ? 'Desactivar' : 'Activar'} comunidad`, mensaje: `¿${accion} la comunidad "${c.nombre}" de ruta "${rutaNombre}"?`, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: c.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'comunidades', c.id), { activo: c.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar la comunidad: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <Barra valor={busqueda} onCambio={setBusqueda} placeholder="Buscar comunidad o ruta" etiquetaBusqueda="Buscar comunidad o ruta"
        contador={`${filtradas.length} ${filtradas.length === 1 ? 'comunidad' : 'comunidades'}`} textoNuevo="Nueva comunidad" onNuevo={abrirCrear} deshabilitarNuevo={rutasActivas.length === 0} />
      {rutasActivas.length === 0 && <Aviso tono="aviso">Primero crea al menos una ruta activa antes de agregar comunidades.</Aviso>}
      {filtradas.length === 0
        ? <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio titulo="No hay comunidades" texto="Crea una con «Nueva comunidad» o importa el directorio." /></div>
        : (
          <Tabla etiqueta="Comunidades">
            <thead>
              <tr><Th>Comunidad</Th><Th>Ruta</Th><Th derecha>Puntos</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const rutaNombre = rutas.find(r => r.id === c.rutaId)?.nombre ?? c.rutaId;
                const nPtos = puntos.filter(p => p.comunidadId === c.id).length;
                return (
                  <Fila key={c.id}>
                    <Td className="font-medium">{c.nombre}</Td>
                    <Td className="text-[var(--text-secondary)]">{rutaNombre}</Td>
                    <Td derecha className="text-[var(--text-secondary)]">{nPtos}</Td>
                    <Td><EstadoActivo activo={c.activo !== false} /></Td>
                    <Td className="text-right"><AccionesFila nombre={c.nombre} activo={c.activo !== false} onEditar={() => abrirEditar(c)} onAlternar={() => toggleActivo(c)} /></Td>
                  </Fila>
                );
              })}
            </tbody>
          </Tabla>
        )}
      {modal && (
        <ModalForm titulo={modal.modo === 'crear' ? 'Nueva comunidad' : 'Editar comunidad'} onClose={() => setModal(null)} onSubmit={handleGuardar}
          guardando={guardando} error={error} exito={exito} textoGuardar={modal.modo === 'crear' ? 'Crear' : 'Guardar'}>
          <Campo etiqueta="Ruta" obligatorio>
            <Selector required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))}>
              <option value="">Seleccionar ruta…</option>
              {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Nombre de la comunidad" obligatorio>
            <Entrada required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: COLONIA SAN PEDRO" />
          </Campo>
        </ModalForm>
      )}
    </div>
  );
}

// ── Tab Puntos ────────────────────────────────────────────────────────────
function TabPuntos({ puntos, comunidades, rutas, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nombre: '', rutaId: '', comunidadId: '', clave: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rutasActivas = rutas.filter(esActivo);
  const comsDeRuta = comunidades.filter(c => c.rutaId === form.rutaId && esActivo(c));

  const filtrados = puntos.filter(p => !busqueda ||
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.clave?.toLowerCase().includes(busqueda.toLowerCase()) ||
    comunidades.find(c => c.id === p.comunidadId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    rutas.find(r => r.id === p.rutaId)?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const generarClave = (rutaId, comunidadId) => {
    const ruta = rutas.find(r => r.id === rutaId);
    const com = comunidades.find(c => c.id === comunidadId);
    if (!ruta || !com) return '';
    const iniciales = ruta.nombre.split(' ').map(w => w[0] ?? '').join('').slice(0, 3).toUpperCase();
    const existentes = puntos.filter(p => p.comunidadId === comunidadId).length;
    return `${iniciales}${String(existentes + 1).padStart(2, '0')}`;
  };

  const abrirCrear = () => {
    const rutaId = rutasActivas[0]?.id ?? '';
    const comsInit = comunidades.filter(c => c.rutaId === rutaId && esActivo(c));
    const comunidadId = comsInit[0]?.id ?? '';
    setForm({ nombre: '', rutaId, comunidadId, clave: '' });
    setError(''); setExito(''); setModal({ modo: 'crear' });
  };
  const abrirEditar = (p) => { setForm({ nombre: p.nombre, rutaId: p.rutaId, comunidadId: p.comunidadId, clave: p.clave }); setError(''); setExito(''); setModal({ modo: 'editar', punto: p }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const { nombre, rutaId, comunidadId, clave } = form;
    if (!nombre.trim() || !rutaId || !comunidadId) { setError('Nombre, ruta y comunidad son obligatorios.'); return; }
    const claveReal = (clave.trim() || generarClave(rutaId, comunidadId)).toUpperCase();
    if (!claveReal) { setError('No se pudo generar la clave. Ingrésala manualmente.'); return; }
    setGuardando(true); setError('');
    try {
      if (modal.modo === 'crear') {
        const existe = puntos.find(p => p.clave === claveReal);
        if (existe) { setError(`La clave "${claveReal}" ya existe.`); return; }
        await setDoc(doc(db, 'puntosReunion', claveReal), { nombre: nombre.trim().toUpperCase(), clave: claveReal, rutaId, comunidadId, activo: true }, { merge: true });
      } else {
        await updateDoc(doc(db, 'puntosReunion', modal.punto.id), { nombre: nombre.trim().toUpperCase(), rutaId, comunidadId });
      }
      setExito(modal.modo === 'crear' ? `Punto creado con clave ${claveReal}.` : 'Punto actualizado.');
      reload(); setTimeout(() => { setModal(null); setExito(''); }, 1400);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const toggleActivo = async (p) => {
    const accion = p.activo !== false ? 'desactivar' : 'activar';
    if (!await confirmar({ titulo: `${p.activo !== false ? 'Desactivar' : 'Activar'} punto de reunión`, mensaje: `¿${accion} el punto "${p.nombre}" (clave: ${p.clave})?`, textoConfirmar: accion.charAt(0).toUpperCase() + accion.slice(1), peligroso: p.activo !== false })) return;
    try {
      await updateDoc(doc(db, 'puntosReunion', p.id), { activo: p.activo === false });
      reload();
    } catch (err) {
      toast.error('No se pudo actualizar el punto: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <Barra valor={busqueda} onCambio={setBusqueda} placeholder="Buscar punto, clave, comunidad o ruta" etiquetaBusqueda="Buscar punto de reunión"
        contador={`${filtrados.length} ${filtrados.length === 1 ? 'punto' : 'puntos'}`} textoNuevo="Nuevo punto" onNuevo={abrirCrear} deshabilitarNuevo={rutasActivas.length === 0} />
      {filtrados.length === 0
        ? <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]"><EstadoVacio titulo="No hay puntos de reunión" texto="Crea uno con «Nuevo punto» o importa el directorio." /></div>
        : (
          <Tabla etiqueta="Puntos de reunión">
            <thead>
              <tr><Th>Clave</Th><Th>Nombre del punto</Th><Th>Comunidad</Th><Th>Ruta</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const comNombre = comunidades.find(c => c.id === p.comunidadId)?.nombre ?? p.comunidadId;
                const rutaNombre = rutas.find(r => r.id === p.rutaId)?.nombre ?? p.rutaId;
                return (
                  <Fila key={p.id}>
                    <Td mono>{p.clave}</Td>
                    <Td className="font-medium">{p.nombre}</Td>
                    <Td className="text-[var(--text-secondary)]">{comNombre}</Td>
                    <Td className="text-[var(--text-secondary)]">{rutaNombre}</Td>
                    <Td><EstadoActivo activo={p.activo !== false} femenino={false} /></Td>
                    <Td className="text-right"><AccionesFila nombre={p.nombre} activo={p.activo !== false} onEditar={() => abrirEditar(p)} onAlternar={() => toggleActivo(p)} /></Td>
                  </Fila>
                );
              })}
            </tbody>
          </Tabla>
        )}
      {modal && (
        <ModalForm titulo={modal.modo === 'crear' ? 'Nuevo punto de reunión' : 'Editar punto de reunión'} onClose={() => setModal(null)} onSubmit={handleGuardar}
          guardando={guardando} error={error} exito={exito} textoGuardar={modal.modo === 'crear' ? 'Crear punto' : 'Guardar'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Ruta" obligatorio>
              <Selector required value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value, comunidadId: '' }))}>
                <option value="">Seleccionar…</option>
                {rutasActivas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Comunidad" obligatorio>
              <Selector required value={form.comunidadId} onChange={e => setForm(f => ({ ...f, comunidadId: e.target.value }))} disabled={!form.rutaId}>
                <option value="">Seleccionar…</option>
                {comsDeRuta.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Selector>
            </Campo>
          </div>
          <Campo etiqueta="Nombre del punto" obligatorio>
            <Entrada required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: PARQUE CENTRAL" />
          </Campo>
          {modal.modo === 'crear' && (
            <Campo etiqueta="Clave" ayuda={form.rutaId && form.comunidadId && !form.clave ? `Se generará: ${generarClave(form.rutaId, form.comunidadId)}` : 'Déjala vacía para generarla automáticamente.'}>
              <Entrada value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} placeholder="Ej: SN01" maxLength={10} />
            </Campo>
          )}
        </ModalForm>
      )}
    </div>
  );
}

// ── Tab Motivos (tiempo extra) ────────────────────────────────────────────
/** Lo que pide el motivo al capturar la solicitud, en texto */
const textoPide = (m) => [m.requiereNumero ? `Número de ${TIPOS_NUMERO[m.requiereNumero]}` : '', m.requiereComentario ? 'Descripción del motivo' : ''].filter(Boolean).join(' y ') || '—';

function TabMotivos({ motivos, reload }) {
  const confirmar = useConfirmar();
  const toast = useToast();
  const [modal, setModal] = useState(null); // null | { modo: 'crear'|'editar', motivo? }
  const [form, setForm] = useState({ nombre: '', requiereNumero: '', requiereComentario: false });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const lista = ordenarMotivos(motivos);
  const abrirCrear = () => { setForm({ nombre: '', requiereNumero: '', requiereComentario: false }); setError(''); setModal({ modo: 'crear' }); };
  const abrirEditar = (m) => { setForm({ nombre: m.nombre ?? '', requiereNumero: m.requiereNumero ?? '', requiereComentario: m.requiereComentario === true }); setError(''); setModal({ modo: 'editar', motivo: m }); };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) { setError('El nombre es obligatorio.'); return; }
    if (lista.some(m => m.id !== modal.motivo?.id && (m.nombre ?? '').trim().toLowerCase() === nombre.toLowerCase())) { setError('Ya existe un motivo con ese nombre.'); return; }
    setGuardando(true); setError('');
    try {
      const campos = { nombre, requiereNumero: form.requiereNumero || null, requiereComentario: form.requiereComentario };
      if (modal.modo === 'crear') await crearMotivo(campos, lista);
      else await guardarMotivo(modal.motivo.id, { ...modal.motivo, ...campos });
      toast.success(modal.modo === 'crear' ? 'Motivo creado.' : 'Motivo actualizado.');
      setModal(null); reload();
    } catch (err) { setError('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const alternar = async (m) => {
    const activo = m.activo !== false;
    if (activo && !await confirmar({
      titulo: 'Desactivar motivo', textoConfirmar: 'Desactivar', peligroso: true,
      mensaje: `«${m.nombre}» ya no se podrá elegir en solicitudes nuevas. Las solicitudes que ya lo tienen lo siguen mostrando igual.`,
    })) return;
    try { await cambiarActivoMotivo(m.id, !activo); reload(); }
    catch (err) { toast.error('No se pudo actualizar el motivo: ' + err.message); }
  };

  const mover = async (i, delta) => {
    const otro = lista[i + delta];
    if (!otro) return;
    try { await intercambiarOrden(lista[i], otro); reload(); }
    catch (err) { toast.error('No se pudo cambiar el orden: ' + err.message); }
  };

  const cargarIniciales = async () => {
    setGuardando(true);
    try { await sembrarMotivos(); toast.success('Motivos iniciales cargados.'); reload(); }
    catch (err) { toast.error('No se pudieron cargar los motivos: ' + err.message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Los motivos que se eligen al solicitar tiempo extra. Desactivar uno no cambia las solicitudes que ya lo tienen.</p>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">{lista.length} {lista.length === 1 ? 'motivo' : 'motivos'}</span>
          <Boton variante="primario" icono={Plus} onClick={abrirCrear}>Nuevo motivo</Boton>
        </div>
      </div>

      {lista.length === 0
        ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
            <EstadoVacio titulo="Aún no hay motivos" texto="Sin motivos nadie puede enviar tiempo extra. Carga los nueve motivos iniciales o crea el primero con «Nuevo motivo»."
              accion={{ texto: guardando ? 'Cargando…' : 'Cargar motivos iniciales', onClick: cargarIniciales }} />
          </div>
        )
        : (
          <Tabla etiqueta="Motivos del tiempo extra">
            <thead>
              <tr><Th>Orden</Th><Th>Motivo</Th><Th>Pide al solicitar</Th><Th>Estado</Th><Th derecha>Acciones</Th></tr>
            </thead>
            <tbody>
              {lista.map((m, i) => (
                <Fila key={m.id}>
                  <Td>
                    <div className="inline-flex items-center gap-1">
                      <Boton variante="fantasma" tamano="icono" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${m.nombre}`} title="Subir"><ArrowUp className="h-4 w-4" aria-hidden="true" /></Boton>
                      <Boton variante="fantasma" tamano="icono" onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar ${m.nombre}`} title="Bajar"><ArrowDown className="h-4 w-4" aria-hidden="true" /></Boton>
                    </div>
                  </Td>
                  <Td className="font-medium">{m.nombre}</Td>
                  <Td className="text-[var(--text-secondary)]">{textoPide(m)}</Td>
                  <Td><EstadoActivo activo={m.activo !== false} femenino={false} /></Td>
                  <Td className="text-right"><AccionesFila nombre={m.nombre} activo={m.activo !== false} onEditar={() => abrirEditar(m)} onAlternar={() => alternar(m)} /></Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}

      {modal && (
        <ModalForm titulo={modal.modo === 'crear' ? 'Nuevo motivo' : 'Editar motivo'} onClose={() => setModal(null)} onSubmit={handleGuardar}
          guardando={guardando} error={error} textoGuardar={modal.modo === 'crear' ? 'Crear motivo' : 'Guardar cambios'}>
          <Campo etiqueta="Nombre del motivo" obligatorio ayuda="Así se ve en las solicitudes y en el formato de nómina.">
            <Entrada required autoFocus maxLength={MAX_NOMBRE_MOTIVO} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Inventario físico" />
          </Campo>
          <Campo etiqueta="¿Qué número pide?" ayuda="Con P.O. o TB, la solicitud pide el número.">
            <Selector value={form.requiereNumero} onChange={e => setForm(f => ({ ...f, requiereNumero: e.target.value }))}>
              <option value="">Ninguno</option><option value="po">Número de P.O.</option><option value="tb">Número de TB</option>
            </Selector>
          </Campo>
          <Casilla etiqueta="Pide describir el motivo" ayuda="El solicitante debe escribir de qué se trata (al menos 10 caracteres), como en «Otro»."
            checked={form.requiereComentario} onChange={e => setForm(f => ({ ...f, requiereComentario: e.target.checked }))} />
        </ModalForm>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function RhCatalogos() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('rutas');
  const [modalTipo, setModalTipo] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [rev, setRev] = useState(0); // fuerza recarga

  const recargarCompartidos = useRecargarCatalogos();
  // Además de releer esta pantalla, invalida los catálogos compartidos (Nueva/Editar solicitud)
  const reload = () => { setCargando(true); setErrorCarga(''); setRev(v => v + 1); recargarCompartidos(); };

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'rutas')),
      getDocs(collection(db, 'comunidades')),
      getDocs(collection(db, 'puntosReunion')),
      getDocs(collection(db, 'motivosTE')),
    ])
      .then(([rutasSnap, comsSnap, ptsSnap, motivosSnap]) => {
        setMotivos(motivosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRutas(rutasSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setComunidades(comsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
        setPuntos(ptsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.clave ?? '').localeCompare(b.clave ?? '')));
      })
      .catch(err => setErrorCarga('Error al cargar datos: ' + err.message))
      .finally(() => setCargando(false));
  }, [rev]);

  const puedeCargarMasivo = usuario?.rol === ROLES.ADMIN || usuario?.rol === ROLES.RH;

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Recursos Humanos"
        titulo="Catálogos"
        descripcion="Rutas, comunidades y puntos de reunión del transporte, y los motivos del tiempo extra."
        accion={puedeCargarMasivo && tabActiva !== 'motivos' ? <Boton id="btn-importar-directorio" icono={Upload} onClick={() => setModalTipo('directorio')}>Importar directorio</Boton> : null}
      />

      {errorCarga && <Aviso tono="error" titulo="No se pudieron cargar los catálogos">{errorCarga}. Revisa tu conexión y vuelve a abrir esta pantalla.</Aviso>}

      <Pestanas etiqueta="Catálogos" items={TABS} activa={tabActiva} onCambio={setTabActiva} />

      <div className="min-h-[200px]">
        {cargando ? <EsqueletoTabla filas={4} columnas={5} /> : (
          <>
            {tabActiva === 'rutas' && <TabRutas rutas={rutas} comunidades={comunidades} puntos={puntos} reload={reload} />}
            {tabActiva === 'comunidades' && <TabComunidades comunidades={comunidades} rutas={rutas} puntos={puntos} reload={reload} />}
            {tabActiva === 'puntos' && <TabPuntos puntos={puntos} comunidades={comunidades} rutas={rutas} reload={reload} />}
            {tabActiva === 'motivos' && <TabMotivos motivos={motivos} reload={reload} />}
          </>
        )}
      </div>

      {/* Modal importación */}
      {modalTipo && (
        <Suspense fallback={null}>
          <ModalImportacion tipo={modalTipo} onClose={() => { setModalTipo(null); reload(); }} onImportado={reload} />
        </Suspense>
      )}
    </div>
  );
}
