# Portal de procesos — Century Mold Querétaro

Aplicación web interna de **tiempo extra y transporte de personal**. Los solicitantes de cada área capturan el tiempo extra de sus empleados
(con el transporte de cada uno); el Aut. 1 y el Aut. 2 lo autorizan; Recursos Humanos (RH) lo confirma en *Por enviar al proveedor*, lo que genera la
solicitud de transporte, y baja el *Formato de rutas* en Excel para el proveedor. La solicitud de transporte suelta (sin tiempo extra) está apagada: ver *Interruptor de funciones*.

Stack: React 19 + Vite, Tailwind CSS 4, Firebase (Authentication y Firestore). No hay servidor propio:
la seguridad la dan las reglas de Firestore (`firestore.rules`).

## Roles

**Rol del sistema** (`usuarios/{uid}.rol`): solo `admin`, `rh` o `usuario`.

| Rol | Qué puede hacer |
|---|---|
| `usuario` | Lo que le den sus **roles operativos** (asignaciones por área, ver abajo); sin ellos solo entra a su Inicio (con el aviso «Pide acceso a Recursos Humanos») y cambia su contraseña en *Mi cuenta*. |
| `rh` | Confirmar el tiempo extra y bajar los Excel, solicitudes de transporte, padrón, estructura, rutas y puntos de reunión, usuarios con rol `usuario` y asignaciones de Aut. 1 y solicitante. |
| `admin` | Todo lo de RH, además de dar o quitar `rh` y `admin`, asignar Aut. 2 y borrar usuarios o solicitudes. |

**Roles operativos** (`asignaciones/{nomina}_{rol}_{área}`, con vigencia opcional): `solicitante` (captura tiempo extra de su área),
`aut1` (autoriza el nivel 1 de su área) y `aut2` (nivel 2, toda la planta). Se asignan en *Usuarios y accesos*; el puesto no da permisos.
Detalle en `docs/tiempo-extra.md`. Roles, estatus y etiquetas: `src/utils/constantes.js` y `src/utils/asignaciones.js`; en `firestore.rules`, `esAdmin`, `esRH` y `asignacionVigente`.

## Cuentas y contraseñas

Cada persona entra con su nómina; internamente su correo es `{nómina}@rutas.app`, **ficticio** (no recibe correo).

- **Crear cuentas**: *Usuarios y accesos > Usuarios > Nuevo usuario* o **Crear usuarios en lote** (personas con rol operativo vigente y sin cuenta, más otros empleados
  del padrón). El lote genera una contraseña temporal por persona (`CM-7K4P-Q9TX`, sin 0/O/1/I/L), crea las cuentas una por una y descarga
  `Accesos_Iniciales_AAAA-MM-DD_HHmm.xlsx` con los accesos y una hoja de instrucciones. Las contraseñas **no se guardan** en Firestore ni en la bitácora:
  solo viven en el navegador mientras el modal siga abierto. Todos entran con `debeCambiarPassword: true` (cambio obligatorio en el primer acceso).
- **Restablecer el acceso de otra persona** (RH y admin; mientras no haya funciones de servidor): *Usuarios › Restablecer acceso* abre un asistente. La app no puede cambiar una
  contraseña ajena (exige el Admin SDK), así que: 1) se borra la cuenta en Firebase Console > Authentication (el asistente da el enlace y la nómina para copiar);
  2) al confirmarlo, crea una cuenta nueva con contraseña temporal `CM-XXXX-XXXX` y `debeCambiarPassword: true`, mueve el perfil al uid nuevo (rol, preferencias y datos) y borra el viejo;
  3) muestra la contraseña una sola vez. Las asignaciones no se tocan (van por nómina). Queda en la bitácora quién restableció a quién (sin contraseña).
  RH solo restablece a usuarios con rol «usuario»; el admin, a cualquiera menos a sí mismo. Las reglas (`restablece` en `firestore.rules`) solo dejan borrar el perfil viejo en el mismo lote que crea el nuevo y su bitácora.
  Limitación: los borradores y solicitudes de tiempo extra que la persona creó con la cuenta anterior quedan ligados al uid viejo y ya no le aparecen en «Mis solicitudes».
  En el login, «¿Olvidaste tu contraseña?» solo explica que se restablece en persona.
  - **Alternativa definitiva (pendiente)**: una Cloud Function invocable solo por admin/RH que ponga la contraseña con el Admin SDK. Requiere el plan Blaze de Firebase.

> Permisos por rol y por combinación: `docs/permisos.md` (matriz generada desde `src/utils/permisos.js`).

## Seguridad

Auditoría completa, hallazgos, pasos de consola y pendientes: **`docs/seguridad.md`**. Lo esencial: la barrera real son las reglas de Firestore (probadas con intentos de ataque en `tests/firestore.rules.auditoria.test.js`); `firebase.json` envía una política de seguridad de contenido y
los demás encabezados; la sesión se cierra a los 15 minutos sin actividad; todo Excel que se descarga pasa por `bufferSeguro` (`src/utils/excelSeguro.js`, neutraliza fórmulas); las contraseñas piden 8 caracteres con letra y número; las descargas de información y los cambios de usuarios quedan en la bitácora;
*Herramientas › Respaldo completo (JSON)* (admin) descarga todos los datos. La configuración web de Firebase es pública por diseño.

## Pantallas y URLs

Todas las URLs están en `src/rutas.js` (las del transporte suelto, en `src/funciones.js`); el menú sale de `src/utils/navegacion.js`.

| URL | Pantalla | Quién |
|---|---|---|
| `/` | **Inicio**: RH y admin ven indicadores (requieren atención y esta semana) y accesos rápidos; los demás, el panel de su rol | todos |
| `/tiempo-extra/nueva`, `/:id/editar`, `/mis-solicitudes` | Solicitar tiempo extra y seguimiento | solicitante, Aut. 1, RH |
| `/tiempo-extra/autorizar` | Por autorizar | Aut. 1, Aut. 2, RH |
| `/tiempo-extra/consulta` | Todas las solicitudes de tiempo extra (solo lectura) | Aut. 2, RH |
| `/tiempo-extra/recepcion` | Por enviar al proveedor: confirmar, devolver, **Formato de rutas** y resumen de horas extra | RH |
| `/transporte/solicitudes` | Solicitudes de transporte (las que genera el tiempo extra) | RH |
| `/transporte/catalogos` | Rutas y puntos de reunión | RH |
| `/personal/padron` | Padrón de empleados (alta, importación y respaldo) | RH |
| `/personal/estructura` | Áreas, puestos (con nivel), excepciones y turnos | RH |
| `/personal/accesos[/usuarios\|asignaciones\|organigrama]` | Usuarios y accesos, Organigrama | RH; Aut. 2 y Aut. 1 según su rol |
| `/mi-cuenta` | Mi cuenta: datos, ayudas, tamaño de letra, tema y contraseña | todos |
| `/herramientas` | Diagnóstico y limpieza | solo admin |

## Interruptor de funciones

`src/funciones.js` → `FUNCIONES.transporteSuelto` (hoy `false`). Apagado, no hay ningún camino (menú, rutas, botones, tarjetas, contadores ni enlaces) a *Nueva solicitud* de transporte,
*Mis solicitudes* de transporte, editar transporte ni *Transporte (consulta)*, y en *Solicitudes de transporte* se ocultan el lápiz, Aprobar / Rechazar / Revertir,
«Todas las pendientes» y el filtro de origen. El código se conserva: para reactivarlo en el piloto basta poner `true`. `tests/funciones.test.js` prueba los dos casos.

## Flujo de una solicitud de tiempo extra

`borrador` → `pendiente_aut1` → `pendiente_aut2` → `autorizada` → `procesada` (RH la confirma y se crea la solicitud de transporte, que nace `aprobada`).
Puede `devolverse` (vuelve a su creador) o `cancelarse`. Detalle en `docs/tiempo-extra.md`. Cada solicitud guarda un resumen (empleados, horas, transporte, alimentos) para listarla sin leer a sus empleados,
que viven en `tiempoExtra/{id}/empleados`. Las solicitudes de transporte guardan el suyo y sus pasajeros en `solicitudes/{id}/pasajeros`.

## Configuración

1. Instala [Node.js](https://nodejs.org) (20 o superior) y las dependencias: `npm install`.
2. Copia `.env.example` como `.env` y llena las variables `VITE_FIREBASE_*` con los datos de tu proyecto de Firebase.
   El archivo `.env` no se sube al repositorio.
3. En Firebase habilita **Authentication → Correo/contraseña**. Los usuarios inician sesión con su número de nómina
   (internamente `nomina@rutas.app`).
4. El primer usuario administrador se crea a mano: una cuenta en Authentication y un documento
   `usuarios/{uid}` con `nomina`, `nombre`, `rol: "admin"`, `activo: true` y `areaIds: []`. Desde ahí, RH crea al resto
   en la pantalla *Usuarios y accesos* (la contraseña inicial es temporal: el usuario debe cambiarla en su primer acceso).

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga. |
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` para revisarlo. |
| `npm run lint` | Revisa el código con Oxlint (debe quedar sin advertencias). |
| `npm run prueba:humo` | Pruebas rápidas de la lógica pura (fechas, validación, resúmenes, importación de Excel). |

## Desplegar reglas e índices de Firestore

Las reglas (`firestore.rules`) y los índices (`firestore.indexes.json`) se despliegan con la CLI de Firebase:

```powershell
npm install -g firebase-tools     # una sola vez (o usa: npx firebase-tools ...)
firebase login                    # una sola vez
firebase deploy --only firestore  # reglas + índices
firebase deploy --only firestore:rules   # solo reglas
```

El proyecto por defecto está en `.firebaserc`. Despliega las reglas **antes** de publicar una versión de la
app que dependa de ellas. Si una consulta nueva necesita un índice compuesto, Firestore muestra un enlace en el
error de la consola del navegador; agrégalo a `firestore.indexes.json` y vuelve a desplegar.

## Estructura

```
src/
  components/   Piezas de interfaz (Navbar, Modal, Toast, FormatoRutas, PreferenciasPanel, guardias de ruta…)
  context/      Proveedores: sesión (Auth), catálogos compartidos, confirmaciones; *Store.js guarda cada contexto
  hooks/        useAuth, useToast, useCatalogos, useConfirmar
  pages/        Pantallas; pages/te/ tiempo extra, pages/rh/ las de RH y admin (se cargan bajo demanda)
  rutas.js, funciones.js   URLs de la app e interruptores de funciones
  utils/        Constantes, fechas, resumen/validación de solicitudes, exportación e importación de Excel
scripts/        Utilidades de desarrollo (pruebas y prueba de humo)
firestore.rules, firestore.indexes.json, firebase.json   Configuración de Firestore
```

Colecciones de Firestore: `usuarios`, `asignaciones`, `areas`, `puestos`, `empleados`, `rutas`, `comunidades`, `puntosReunion`, `turnosNomina`, `tiempoExtra`
(+ `empleados` e `historial`), `solicitudes` (+ `pasajeros`), `contadores` y `bitacora`.

## Notas

- Excel: solo se usa `exceljs` (archivos `.xlsx`). La importación masiva no acepta `.xls`.
- Tema claro/oscuro con variables CSS en `src/index.css`.
