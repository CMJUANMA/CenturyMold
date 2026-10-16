# Estructura: Áreas → Puestos → Empleados

El área de un empleado sale de su **puesto**. El departamento de la nómina (`depto`) es solo informativo.

## Colecciones

| Colección | Campos | Quién escribe |
|---|---|---|
| `areas/{areaId}` (slug: `produccion`, `almacen`, `calidad`, `mantenimiento`, `moldes`, `administrativo`) | `nombre`, `participaTE`, `activa`, `orden` | admin y RH |
| `puestos/{puestoId}` (slug del nombre) | `nombre` (MAYÚSCULAS), `areaId`, `activo`, `alias[]`, `nivelJerarquico` (opcional, entero >= 1; 1 = el más alto; ordena el organigrama), `fechaCreacion`, `creadoPor` | admin y RH |
| `empleados/{nomina}` + `puestoId`, `areaId`, `areaExcepcion`, `areaExcepcionMotivo` | `areaId` = área efectiva | admin y RH |
| `bitacora/{autoId}` | `accion`, `entidad`, `antes`, `despues`, `porUid`, `porNombre`, `fecha` | solo se crea (admin y RH); nadie edita ni borra |

**Área efectiva** = `areaExcepcion` si existe; si no, el área del puesto. La importación nunca toca la excepción.

Las bajas son lógicas. Un área no se desactiva con puestos activos y un puesto no se desactiva con empleados
activos (lo valida la pantalla; una regla de Firestore no puede consultarlo). Nada se borra (`delete: false`).

## Resolución de puestos al importar (`src/utils/puestos.js` → `resolverPuesto`)

1. **a. Limpieza automática**: trim, espacios dobles, mayúsculas, acentos, caracteres de control y `_x0002_`. Si coincide con un puesto
   o un alias se asigna solo ("Corregido automáticamente: antes → después").
2. **b. Corrección propuesta**: un solo puesto a 1–2 letras (Levenshtein, máx. 15 % del largo). Con dos candidatos igual de cercanos no se propone.
3. **c. No reconocido**: "Es igual a…" (alias), "Agregar como puesto nuevo" (con área) u "Omitir estas filas".

Lo que RH confirma queda como **alias** del puesto. No se puede confirmar la importación con puestos sin resolver.
El mismo panel (`ResolucionPuestos`) lo usa **Estructura → Puestos → Asignar puestos y áreas** para los empleados que ya estaban en el padrón.

## Reglas (`firestore.rules`)

`areas` y `puestos`: leen usuarios activos, escriben admin y RH. `bitacora`: crean y leen admin y RH. En `empleados`, `puestoId`, `areaId`,
`areaExcepcion` y `areaExcepcionMotivo` solo los cambian admin y RH (un solicitante vigente de esa área solo ruta/comunidad/punto).
Pruebas: `tests/firestore.rules.estructura.test.js` (`npm run test:rules`). Matcher y estructura: `tests/puestos.test.js` (`npm run test:unit`).

## Pendiente (siguiente etapa)

Los permisos por área ya son asignaciones (`docs/tiempo-extra.md`). La estructura vieja (`areasTE`, `config/areasTE`, `accesosTE`, `empleados.areaTE`/`areaTEManual`) se limpia desde RH > Catálogos > Diagnóstico (solo admin).
