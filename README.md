# Solicitud de rutas — Century Mold

Aplicación web interna para programar y autorizar el **transporte de personal**. Los solicitantes
de cada área piden servicios de ruta para sus empleados; Recursos Humanos (RH) los revisa, aprueba o rechaza y exporta
el formato maestro en Excel para el proveedor de transporte.

Stack: React 19 + Vite, Tailwind CSS 4, Firebase (Authentication y Firestore). No hay servidor propio:
la seguridad la dan las reglas de Firestore (`firestore.rules`).

## Roles

**Rol del sistema** (`usuarios/{uid}.rol`): solo `admin`, `rh` o `usuario`.

| Rol | Qué puede hacer |
|---|---|
| `usuario` | Lo que le den sus **roles operativos** (asignaciones por área, ver abajo); sin ellos solo entra al portal y cambia su contraseña. |
| `rh` | Todo lo de rutas sobre cualquier solicitud (aprobar/rechazar, exportar a Excel), empleados, catálogos, usuarios con rol `usuario` y asignaciones de Aut. 1 y solicitante. |
| `admin` | Todo lo de RH, además de dar o quitar `rh` y `admin`, asignar Aut. 2 y borrar usuarios o solicitudes. |

**Roles operativos** (`asignaciones/{nomina}_{rol}_{área}`, con vigencia opcional): `solicitante` (crea solicitudes de ruta y de tiempo extra de su área),
`aut1` (autoriza el nivel 1 de su área) y `aut2` (nivel 2, toda la planta). Se asignan en *Usuarios y accesos*; el puesto no da permisos.
Detalle en `docs/tiempo-extra.md`. Roles, estatus y etiquetas: `src/utils/constantes.js` y `src/utils/asignaciones.js`; en `firestore.rules`, `esAdmin`, `esRH` y `asignacionVigente`.

## Cuentas y contraseñas

Cada persona entra con su nómina; internamente su correo es `{nómina}@rutas.app`, **ficticio** (no recibe correo).

- **Crear cuentas**: *Usuarios y accesos > Usuarios > Nuevo usuario* o **Crear usuarios en lote** (personas con rol operativo vigente y sin cuenta, más otros empleados
  del padrón). El lote genera una contraseña temporal por persona (`CM-7K4P-Q9TX`, sin 0/O/1/I/L), crea las cuentas una por una y descarga
  `Accesos_Iniciales_AAAA-MM-DD_HHmm.xlsx` con los accesos y una hoja de instrucciones. Las contraseñas **no se guardan** en Firestore ni en la bitácora:
  solo viven en el navegador mientras el modal siga abierto. Todos entran con `debeCambiarPassword: true` (cambio obligatorio en el primer acceso).
- **Restablecer la contraseña de otra persona: la app NO puede**, y no hay forma segura de hacerlo sin Cloud Functions. Cambiar una contraseña ajena exige
  el Admin SDK de Firebase (servidor); el cliente solo puede cambiar la de la sesión que tiene abierta. El correo de restablecimiento de Firebase tampoco sirve,
  porque `{nómina}@rutas.app` no existe. La consola de Firebase tampoco permite asignar una contraseña a una cuenta de correo.
  - **Alternativa simple hoy (sin servidor)**: en Firebase Console, borrar la cuenta en *Authentication* (`{nómina}@rutas.app`) **y** su perfil en Firestore
    (`usuarios/{uid}`; si no, el alta se rechaza por nómina repetida o queda un perfil huérfano), y volver a crearla con *Nuevo usuario* o *Crear usuarios en lote*
    para obtener una contraseña temporal nueva. Los roles operativos no se pierden: las asignaciones van por nómina, no por cuenta.
  - **Alternativa definitiva (pendiente)**: una Cloud Function invocable solo por admin/RH que ponga una contraseña temporal con el Admin SDK y marque
    `debeCambiarPassword: true`. Requiere el plan Blaze de Firebase.

## Flujo de una solicitud

`pendiente` → `aprobada` | `rechazada` (RH) · `cancelada` (el solicitante) · `enviada al proveedor`.
Si el solicitante edita una solicitud aprobada, vuelve a `pendiente`. Editar usa una transacción: si RH responde
mientras alguien edita, el guardado se aborta y se avisa.

Cada solicitud guarda un resumen (total, alimentos, conteo por turno y puesto) para listarla sin leer a sus
pasajeros, que viven en la subcolección `solicitudes/{id}/pasajeros`.

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
  components/   Piezas de interfaz (Navbar, Modal, Toast, FormularioSolicitud, BadgeEstatus…)
  context/      Proveedores: sesión (Auth), catálogos compartidos, confirmaciones; *Store.js guarda cada contexto
  hooks/        useAuth, useToast, useCatalogos, useConfirmar
  pages/        Pantallas; pages/rh/ son las de RH y admin (se cargan bajo demanda)
  utils/        Constantes, fechas, resumen/validación de solicitudes, exportación e importación de Excel
scripts/        Utilidades de desarrollo (prueba de humo, generador de Excel de ejemplo)
firestore.rules, firestore.indexes.json, firebase.json   Configuración de Firestore
```

Colecciones de Firestore: `usuarios`, `areas`, `rutas`, `comunidades`, `puntosReunion`, `empleados`,
`solicitudes` y `solicitudes/{id}/pasajeros`.

## Notas

- Excel: solo se usa `exceljs` (archivos `.xlsx`). La importación masiva no acepta `.xls`.
- Tema claro/oscuro con variables CSS en `src/index.css`.
