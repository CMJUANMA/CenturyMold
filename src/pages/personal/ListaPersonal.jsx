/**
 * ListaPersonal.jsx — Lista del personal ELEGIBLE para tiempo extra, a la que se llega desde la tarjeta «Personal» del Inicio.
 * Solo lectura: nómina, nombre, puesto y área, con buscador. RH, admin, Nóminas y Aut. 2 ven todas las áreas (con filtro); Aut. 1 y
 * solicitantes, solo la(s) suya(s). El teléfono solo lo ven quienes ya pueden verlo: RH, admin, Nóminas y el solicitante de esa área.
 * ?area=<id> abre la lista ya filtrada por esa área.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { useAccesos } from '../../hooks/useAccesos';
import { useAreas } from '../../hooks/useAreas';
import { useCatalogos } from '../../hooks/useCatalogos';
import { RUTAS } from '../../rutas';
import { leerTelefonos, leerTodosLosTelefonos } from '../../utils/contactosDb';
import { formatoTelefono } from '../../utils/telefono';
import { areasDeLaLista, filtrarLista, quienVeTelefono } from '../../utils/listaPersonal';
import Boton from '../../components/ui/Boton';
import { Entrada, Selector } from '../../components/ui/Campo';
import EncabezadoPagina from '../../components/ui/EncabezadoPagina';
import EstadoVacio from '../../components/ui/EstadoVacio';
import { EsqueletoTabla } from '../../components/ui/Esqueleto';
import { Fila, Tabla, Td, Th } from '../../components/ui/Tabla';

export default function ListaPersonal() {
  const accesos = useAccesos();
  const { areas, nombres } = useAreas();
  const { empleadosElegibles, cargando } = useCatalogos();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [telefonos, setTelefonos] = useState(() => new Map());

  const disponibles = useMemo(() => areasDeLaLista(accesos, areas), [accesos, areas]);
  const areaPedida = params.get('area') ?? '';
  const area = disponibles.some(a => a.id === areaPedida) ? areaPedida : '';
  const completo = accesos.esRH || accesos.esAut2 || accesos.esNomina;

  const lista = useMemo(
    () => filtrarLista(empleadosElegibles, { areaId: area, areasPermitidas: completo ? null : disponibles.map(a => a.id), busqueda }),
    [empleadosElegibles, area, completo, disponibles, busqueda],
  );
  const { muestra: muestraTelefono, puede: puedeTelefonoDe } = useMemo(() => quienVeTelefono(accesos), [accesos]);

  // Teléfonos: RH, admin y Nóminas leen la colección; el solicitante, uno por uno y solo de su área
  const clave = useMemo(
    () => (cargando || !muestraTelefono ? '' : lista.filter(puedeTelefonoDe).map(e => String(e.nomina)).join(',')),
    [cargando, muestraTelefono, lista, puedeTelefonoDe],
  );
  const lee = accesos.esRH || accesos.esNomina ? 'todos' : 'uno';
  useEffect(() => {
    if (!muestraTelefono || !clave) return undefined;
    let vigente = true;
    (lee === 'todos' ? leerTodosLosTelefonos() : leerTelefonos(clave.split(',')))
      .then(m => { if (vigente) setTelefonos(m); })
      .catch(err => console.error('Teléfonos:', err));
    return () => { vigente = false; };
  }, [muestraTelefono, clave, lee]);

  const titulo = area ? `Personal · ${nombres.get(area) ?? area}` : completo ? 'Personal activo' : 'Personal de mi área';
  const cambiarArea = (valor) => setParams(valor ? { area: valor } : {}, { replace: true });

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        antetitulo="Solo consulta"
        titulo={titulo}
        descripcion="El personal que puede capturarse en tiempo extra, con su puesto y su área."
        accion={<Boton to={RUTAS.inicio} icono={ArrowLeft}>Volver al Inicio</Boton>}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <Entrada type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nómina o nombre" aria-label="Buscar por nómina o nombre" className="pl-9" />
        </div>
        {disponibles.length > 1 && (
          <Selector value={area} onChange={e => cambiarArea(e.target.value)} aria-label="Área" className="sm:w-56">
            <option value="">{completo ? 'Todas las áreas' : 'Todas mis áreas'}</option>
            {disponibles.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Selector>
        )}
        <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">{lista.length} {lista.length === 1 ? 'persona' : 'personas'}</span>
      </div>

      {cargando ? <EsqueletoTabla filas={6} columnas={4} /> : lista.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)]">
          <EstadoVacio icono={Users} titulo="Sin personal" texto={busqueda ? 'Nadie coincide con la búsqueda.' : 'No hay personal elegible en esta lista.'}
            accion={busqueda ? { texto: 'Limpiar búsqueda', onClick: () => setBusqueda('') } : undefined} />
        </div>
      ) : (
        <Tabla etiqueta="Personal elegible para tiempo extra">
          <thead><tr><Th>Nómina</Th><Th>Nombre</Th><Th>Puesto</Th><Th>Área</Th>{muestraTelefono && <Th>Teléfono</Th>}</tr></thead>
          <tbody>
            {lista.map(e => (
              <Fila key={e.nomina}>
                <Td mono>{e.nomina}</Td>
                <Td>{e.nombre}</Td>
                <Td className="text-[var(--text-secondary)]">{e.puesto || '—'}</Td>
                <Td className="text-[var(--text-secondary)]">{nombres.get(e.areaId) ?? '—'}</Td>
                {muestraTelefono && <Td mono className="whitespace-nowrap">{puedeTelefonoDe(e) ? (formatoTelefono(telefonos.get(String(e.nomina))) || '—') : ''}</Td>}
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}
    </div>
  );
}
