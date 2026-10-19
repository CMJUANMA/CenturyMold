/**
 * Herramientas.jsx — /herramientas (solo admin): vista previa por rol, diagnóstico y limpieza de una sola vez. Antes eran la pestaña "Diagnóstico" de Catálogos.
 *   Revisar colecciones (cuenta documentos y busca puntos huérfanos) · Limpiar estructura vieja (con respaldo JSON y confirmación).
 */
import RevisarColecciones from './rh/RevisarColecciones';
import LimpiezaEstructura from './rh/LimpiezaEstructura';
import VistaPreviaRol from './rh/VistaPreviaRol';
import RespaldoDatos from './rh/RespaldoDatos';
import Aviso from '../components/ui/Aviso';
import EncabezadoPagina from '../components/ui/EncabezadoPagina';

export default function Herramientas() {
  return (
    <div className="space-y-8">
      <EncabezadoPagina antetitulo="Administrador" titulo="Diagnóstico y limpieza" descripcion="Vista previa por rol y herramientas que se usan pocas veces." />
      <VistaPreviaRol />
      <Aviso tono="aviso">Lee con calma las herramientas de abajo antes de ejecutar algo: algunas escriben en la base de datos.</Aviso>
      <RespaldoDatos />
      <RevisarColecciones />
      <LimpiezaEstructura />
    </div>
  );
}
