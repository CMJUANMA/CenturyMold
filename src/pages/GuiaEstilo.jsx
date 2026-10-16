/**
 * GuiaEstilo.jsx — /herramientas/guia-de-estilo (solo admin): el sistema de diseño de la app, para revisarlo y para que todo lo nuevo lo siga
 * (ver docs/diseno.md). Muestra colores, tipografía, botones, campos, tabla, tarjetas, insignias, avisos, estados vacíos, esqueletos y
 * pestañas, en el tema que esté activo (hay un selector de tema arriba para verlos en claro y en oscuro).
 */
import { useState } from 'react';
import { Download, Inbox, Monitor, Moon, Plus, Save, Sun, Users } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../hooks/useToast';
import BadgeEstatus from '../components/BadgeEstatus';
import Modal from '../components/Modal';
import Aviso from '../components/ui/Aviso';
import Boton, { useAccionBoton } from '../components/ui/Boton';
import { AreaTexto, Campo, Casilla, Entrada, OpcionRadio, Selector } from '../components/ui/Campo';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';
import EstadoVacio from '../components/ui/EstadoVacio';
import { Esqueleto, EsqueletoIndicadores, EsqueletoTabla } from '../components/ui/Esqueleto';
import Insignia from '../components/ui/Insignia';
import Pestanas from '../components/ui/Pestanas';
import { Fila, Tabla, Td, Th } from '../components/ui/Tabla';
import { Indicador, Tarjeta } from '../components/ui/Tarjeta';

const Seccion = ({ id, titulo, descripcion, children }) => (
  <section id={id} className="space-y-4 border-t border-[var(--border-color)] pt-8" aria-labelledby={`${id}-t`}>
    <div>
      <h2 id={`${id}-t`} className="text-xl font-semibold text-[var(--text-main)]">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-[var(--text-secondary)]">{descripcion}</p>}
    </div>
    {children}
  </section>
);

const COLORES = [
  ['Fondos y superficies', [['--bg-app', 'Fondo de la app'], ['--bg-surface', 'Superficie (tarjetas, menú)'], ['--bg-surface-secondary', 'Superficie secundaria'], ['--bg-surface-hover', 'Hover / apagado'], ['--border-color', 'Borde'], ['--border-subtle', 'Borde suave']]],
  ['Texto', [['--text-main', 'Principal'], ['--text-secondary', 'Secundario'], ['--text-muted', 'Apagado'], ['--text-disabled', 'Deshabilitado']]],
  ['Acento de marca (único)', [['--accent', 'Botón principal (texto blanco)'], ['--accent-hover', 'Botón principal, hover'], ['--accent-soft', 'Ítem activo del menú'], ['--accent-text', 'Rojo para texto e íconos']]],
  ['Estados (siempre con ícono y texto)', [['--status-success-bg', 'Éxito, fondo'], ['--status-success-text', 'Éxito, texto'], ['--status-warning-bg', 'Aviso, fondo'], ['--status-warning-text', 'Aviso, texto'], ['--status-error-bg', 'Error, fondo'], ['--status-error-text', 'Error, texto'], ['--status-info-bg', 'Información, fondo'], ['--status-info-text', 'Información, texto']]],
];

const TIPOS = [
  ['Título de página', 'text-2xl font-semibold tracking-tight', '30 px · semibold'],
  ['Subtítulo grande', 'text-xl font-semibold', '20 px · semibold'],
  ['Subtítulo', 'text-lg font-semibold', '18 px · semibold'],
  ['Cuerpo', 'text-sm', '15 px · regular'],
  ['Etiqueta / dato de tabla', 'text-xs font-medium', '13 px · medium'],
  ['Folio, nómina u hora', 'font-mono text-sm', 'IBM Plex Mono'],
];

const ESTATUS_TE = ['borrador', 'pendiente_aut1', 'pendiente_aut2', 'autorizada', 'devuelta', 'procesada', 'cancelada'];

export default function GuiaEstilo() {
  const { modo, setModo } = useTheme();
  const toast = useToast();
  const [estado, ejecutar] = useAccionBoton();
  const [pestana, setPestana] = useState('uno');
  const [modal, setModal] = useState(false);
  const [error, setError] = useState(true);
  const guardar = () => ejecutar(() => new Promise(r => setTimeout(r, 1200)));

  return (
    <div className="space-y-10 pb-12">
      <EncabezadoPagina
        antetitulo="Herramientas · solo admin"
        titulo="Guía de estilo"
        descripcion="El sistema de diseño de Century Mold: todo lo nuevo se arma con estas piezas."
        accion={(
          <div role="group" aria-label="Tema" className="inline-flex rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
            {[['claro', 'Claro', Sun], ['oscuro', 'Oscuro', Moon], ['auto', 'Automático', Monitor]].map(([id, texto, Icono]) => (
              <button key={id} type="button" onClick={() => setModo(id)} aria-pressed={modo === id}
                className={`inline-flex min-h-11 items-center gap-2 rounded px-3 text-xs font-medium transition-colors duration-150 md:min-h-8 ${modo === id ? 'bg-[var(--bg-surface-hover)] text-[var(--text-main)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}>
                <Icono className="h-4 w-4" aria-hidden="true" />{texto}
              </button>
            ))}
          </div>
        )}
      />

      <Seccion id="colores" titulo="Color" descripcion="Acento único: el rojo #d61110, reservado para la acción principal de cada pantalla, el ítem activo del menú y detalles críticos. Lo demás es neutro.">
        <div className="space-y-6">
          {COLORES.map(([grupo, lista]) => (
            <div key={grupo}>
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">{grupo}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {lista.map(([token, nombre]) => (
                  <div key={token} className="overflow-hidden rounded-lg border border-[var(--border-color)]">
                    <div className="h-14" style={{ background: `var(${token})` }} />
                    <div className="bg-[var(--bg-surface)] p-2.5">
                      <p className="text-xs font-medium text-[var(--text-main)]">{nombre}</p>
                      <p className="font-mono text-xs text-[var(--text-muted)]">{token}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Aviso tono="info" titulo="Contraste (WCAG AA)">
          Texto blanco sobre el rojo de marca: 5.3 a 1. Rojo de texto en tema claro (#d61110) sobre blanco: 5.3 a 1. En tema oscuro, el rojo de texto (#ff6a63)
          sobre la superficie (#1A1C1F): 6.1 a 1. El error no usa el rojo de la marca: es un ladrillo sobre fondo suave, con ícono.
        </Aviso>
      </Seccion>

      <Seccion id="tipografia" titulo="Tipografía" descripcion="IBM Plex Sans para todo el texto; IBM Plex Mono solo para folios, nóminas y horas. “Letra grande” (Mi cuenta) escala toda esta escala en proporción.">
        <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          {TIPOS.map(([nombre, clase, dato]) => (
            <div key={nombre} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between">
              <p className={`${clase} text-[var(--text-main)]`}>{nombre}: TE-2026-0012 · 7:00 a 16:00</p>
              <p className="shrink-0 text-xs text-[var(--text-muted)]">{dato}</p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion id="botones" titulo="Botones" descripcion="Un solo botón primario (rojo) por pantalla. Devolver, Cancelar y Revocar van en contorno con texto de error, nunca en rojo sólido.">
        <div className="space-y-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="primario" icono={Plus}>Solicitar tiempo extra</Boton>
            <Boton variante="secundario">Secundario</Boton>
            <Boton variante="contorno" icono={Download}>Contorno</Boton>
            <Boton variante="fantasma">Fantasma</Boton>
            <Boton variante="peligro">Devolver</Boton>
            <Boton variante="primario" disabled>Deshabilitado</Boton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Boton variante="contorno" tamano="sm">Tamaño pequeño</Boton>
            <Boton variante="peligro" tamano="sm">Cancelar</Boton>
            <Boton variante="primario" estado={estado === 'reposo' ? undefined : estado} icono={Save} onClick={guardar}>
              {estado === 'cargando' ? 'Guardando…' : estado === 'hecho' ? 'Guardado' : 'Guardar (probar)'}
            </Boton>
            <span className="text-xs text-[var(--text-muted)]">El botón pasa de “cargando” a “hecho” sin bloquear la pantalla.</span>
          </div>
        </div>
      </Seccion>

      <Seccion id="campos" titulo="Campos de formulario" descripcion="La etiqueta siempre está visible; el error va junto al campo con ícono y dice qué hacer. Áreas táctiles de 44 px en celular.">
        <div className="grid gap-5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:grid-cols-2">
          <Campo etiqueta="Número de nómina" ayuda="Escríbalo tal como aparece en su gafete."><Entrada placeholder="Ejemplo: 12345" /></Campo>
          <Campo etiqueta="Área" obligatorio><Selector defaultValue=""><option value="" disabled>Elige el área…</option><option>Moldes</option><option>Producción</option></Selector></Campo>
          <Campo etiqueta="Fecha del tiempo extra" error={error ? 'Elige una fecha de hoy en adelante.' : undefined}><Entrada type="date" /></Campo>
          <Campo etiqueta="Comentario"><AreaTexto placeholder="Explica por qué se necesita el tiempo extra" /></Campo>
          <div>
            <Casilla etiqueta="Necesita alimentos" ayuda="Se suma al reporte del comedor." defaultChecked />
            <Casilla etiqueta="Necesita transporte" />
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Tipo de tiempo extra</legend>
            <OpcionRadio name="tipo" etiqueta="Turno extra" defaultChecked />
            <OpcionRadio name="tipo" etiqueta="Extensión de turno" />
          </fieldset>
          <div className="sm:col-span-2">
            <Boton variante="fantasma" tamano="sm" onClick={() => setError(v => !v)}>{error ? 'Quitar el error del ejemplo' : 'Mostrar el error del ejemplo'}</Boton>
          </div>
        </div>
      </Seccion>

      <Seccion id="tabla" titulo="Tabla" descripcion="Encabezado fijo, filas con hover suave, cifras a la derecha; folios y horas en IBM Plex Mono.">
        <Tabla etiqueta="Ejemplo de tabla" alto="max-h-72">
          <thead><tr><Th>Folio</Th><Th>Área</Th><Th derecha>Empleados</Th><Th derecha>Horas</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {[['TE-2026-0004', 'Moldes', 8, 64, 'autorizada'], ['TE-2026-0007', 'Calidad', 5, 40, 'procesada'], ['TE-2026-0009', 'Producción', 3, 24, 'devuelta'], ['TE-2026-0010', 'Moldes', 2, 16, 'pendiente_aut2']].map(([f, a, e, h, s]) => (
              <Fila key={f}><Td mono>{f}</Td><Td>{a}</Td><Td derecha mono>{e}</Td><Td derecha mono>{h}</Td><Td><BadgeEstatus estatus={s} modulo="te" /></Td></Fila>
            ))}
          </tbody>
        </Tabla>
      </Seccion>

      <Seccion id="tarjetas" titulo="Tarjetas e indicadores" descripcion="Número grande, etiqueta pequeña y enlace. Los que piden atención se resaltan en tono de aviso, con ícono y texto; el rojo de marca no se usa aquí.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador etiqueta="Por enviar al proveedor" valor={3} icono={Inbox} atencion ayuda="Autorizadas por confirmar" to="#tarjetas" />
          <Indicador etiqueta="Empleados con tiempo extra" valor={11} icono={Users} ayuda="autorizados esta semana" to="#tarjetas" />
          <Indicador etiqueta="Cargando" valor={0} cargando />
        </div>
        <Tarjeta titulo="Tarjeta con título" accion={<Boton variante="contorno" tamano="sm">Acción</Boton>}>
          <p className="text-sm text-[var(--text-secondary)]">Superficie con borde de 1 px, sin sombra. El espacio interior es de 16 a 24 px.</p>
        </Tarjeta>
      </Seccion>

      <Seccion id="insignias" titulo="Insignias de estatus y avisos" descripcion="Tonos apagados siempre acompañados de ícono y texto.">
        <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-5">
          {ESTATUS_TE.map(s => <BadgeEstatus key={s} estatus={s} modulo="te" />)}
          <Insignia tono="error">Rechazada</Insignia>
          <Insignia>Neutral</Insignia>
        </div>
        <div className="grid gap-3">
          <Aviso tono="exito">Se guardó la solicitud y se envió a autorización.</Aviso>
          <Aviso tono="aviso" titulo="Falta un dato">Elige la ruta de dos empleados antes de enviar.</Aviso>
          <Aviso tono="error" titulo="No se pudo guardar">Revisa tu conexión y vuelve a intentarlo. Si sigue igual, avisa a Recursos Humanos.</Aviso>
          <Aviso tono="info">Las solicitudes se actualizan solas; no necesitas recargar la página.</Aviso>
        </div>
        <div className="flex flex-wrap gap-3">
          <Boton variante="contorno" tamano="sm" onClick={() => toast.success('Solicitud enviada a autorización.')}>Probar aviso de éxito</Boton>
          <Boton variante="contorno" tamano="sm" onClick={() => toast.error('No se pudo guardar. Vuelve a intentarlo.')}>Probar aviso de error</Boton>
          <Boton variante="contorno" tamano="sm" onClick={() => setModal(true)}>Probar ventana (modal)</Boton>
        </div>
        <Modal isOpen={modal} onClose={() => setModal(false)} title="Devolver solicitud" maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">La solicitud regresa a quien la pidió para que la corrija y la reenvíe.</p>
            <Campo etiqueta="Motivo de la devolución" ayuda="Mínimo 10 letras."><AreaTexto /></Campo>
            <div className="flex justify-end gap-3"><Boton onClick={() => setModal(false)}>Cancelar</Boton><Boton variante="peligro" onClick={() => setModal(false)}>Devolver</Boton></div>
          </div>
        </Modal>
      </Seccion>

      <Seccion id="vacios" titulo="Estados vacíos y esqueletos de carga" descripcion="Un estado vacío dice qué hacer y trae el botón para hacerlo, sin ilustraciones. Los esqueletos tienen la forma del contenido.">
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio texto="Aún no tienes solicitudes de tiempo extra." accion={{ texto: 'Solicitar tiempo extra', to: '#vacios' }} />
        </div>
        <EsqueletoIndicadores cantidad={3} className="grid gap-4 sm:grid-cols-3" />
        <EsqueletoTabla filas={3} columnas={5} />
        <div className="flex gap-3"><Esqueleto className="h-4 w-40" /><Esqueleto className="h-4 w-24" /></div>
      </Seccion>

      <Seccion id="pestanas" titulo="Pestañas" descripcion="La activa lleva el acento de la marca. Se manejan también con las flechas del teclado.">
        <Pestanas items={[{ id: 'uno', etiqueta: 'Borradores', contador: 2 }, { id: 'dos', etiqueta: 'En autorización', contador: 5 }, { id: 'tres', etiqueta: 'Devueltas', contador: 1 }]} activa={pestana} onCambio={setPestana} />
      </Seccion>
    </div>
  );
}
