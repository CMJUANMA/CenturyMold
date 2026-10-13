# Solicitud de tiempo extra (TE) y permisos por asignaciones

Segundo módulo del portal. **Los permisos viven en el ROL y a las personas se les ASIGNA un rol** (con área y, si es
temporal, con fechas). El puesto ya no da permisos: solo sirve para sugerir candidatos al asignar.
Las pantallas de captura y de autorización vienen después.

## Flujo

```
Solicitante del área ──captura──► pendiente_aut1 ──Aut. 1──► pendiente_aut2 ──Aut. 2──► autorizada ──RH──► procesada
                                       │                          │
                                       └──────── devuelta ◄───────┘   (con motivo; el solicitante corrige y reenvía)
```

- Se autoriza o se devuelve la **solicitud completa**. Devolver exige un motivo.
- **Aut. 1**: asignación `aut1` vigente de esa área. **Aut. 2**: asignación `aut2` vigente, o RH/admin (RH solo firma este nivel).
- Si quien captura también es Aut. 1 vigente de esa área, entra **directo a `pendiente_aut2`** (también al reenviar).
- Áreas con `participaTE: false` (Administrativo): solo capturan RH o una Aut. 2, y la solicitud va **directo a `pendiente_aut2`**.
- **Nadie autoriza ni devuelve lo que creó él mismo.** Si la creó una Aut. 2, la firma otra Aut. 2 o RH.
- Solo se incluyen empleados cuya `areaId` en el padrón sea la del área de la solicitud (lo exigen las reglas).

## Dos tipos de rol

1. **Rol del sistema** (`usuarios/{uid}.rol`): solo `admin`, `rh` o `usuario`. Solo un admin da o quita `rh` y `admin`.
   Los roles anteriores `superintendente` y `autorizador` se corrigen a mano a `usuario` (ver Carga inicial y limpieza).
2. **Rol operativo**: asignaciones por área.

### `asignaciones/{nomina}_{rol}_{areaId|planta}`

```
nomina, nombre, rol ('aut2' | 'aut1' | 'solicitante'), areaId (null en aut2),
desde, hasta (null = permanente; se guarda como el fin del día), motivo, activo,
asignadoPor { uid, nombre }, fechaAsignacion (serverTimestamp)
```

- Una persona puede tener varias (p. ej. solicitante en Mantenimiento y Aut. 1 temporal en Moldes).
- **Vigente** = `activo`, `desde <= ahora` y (sin `hasta` o `ahora <= hasta`); es lo mismo en `src/utils/asignaciones.js` y en las reglas.
  Una temporal vence sola: la app recalcula cada minuto y las reglas comparan con `request.time`.
- **Revocar** = `activo: false`; nunca se borra. Cada alta, cambio o revocación deja un renglón en `bitacora`
  (`entidad: 'asignacion'`, `antes`/`despues` con el id) en el mismo lote.
- `aut1` y `solicitante` solo se asignan en áreas con `participaTE: true`.

| Quién | Puede asignar |
|---|---|
| Admin | todo (aut2, aut1, solicitante; y rol rh/admin en Usuarios) |
| RH y Aut. 2 vigente | aut1 y solicitante, en cualquier área con participaTE |
| Aut. 1 y solicitante | nada |
| Cualquiera, salvo admin | no puede crear ni cambiar sus propias asignaciones |

## Pantalla *Usuarios y accesos* (`/accesos/:tab`)

- **Usuarios** (RH/admin): tabla de cuentas con rol del sistema y la columna *Roles operativos* (etiquetas vigentes:
  "Solicitante · Producción", "Aut. 1 · Moldes hasta 20/10").
- **Asignaciones** (quien puede asignar): tabla con filtros (rol, área, estado Vigentes/Programadas/Vencidas/Revocadas) y
  buscador; *Asignar rol*, *Revocar*, *Extender* y *Ver historial* (de la bitácora). Al elegir rol y área, el buscador
  sugiere primero a los empleados de esa área (por `areaId`), ordenados por puesto. Si la persona no tiene usuario:
  **Sin usuario** y, para RH/admin, **Crear usuario**.
- **Organigrama** (todos; solo lectura salvo para quien asigna): generado **solo** con asignaciones vigentes, con la forma
  de la hoja *Niveles de autorización*: Aut. 2 arriba, una columna por área con participaTE con su Aut. 1 (amarillo) y sus
  solicitantes (rosa). Quien asigna ve *+ Aut. 1* / *+ Solicitante* por columna y puede revocar desde la tarjeta. Un área sin
  Aut. 1 vigente muestra "Sin Autorización 1: las solicitudes de esta área no podrán avanzar".

## Accesos en la app

`useAccesos()` (`src/hooks/useAccesos.js`, proveedor `AccesosProvider`) lee **una vez por sesión, en vivo,** las asignaciones de la
nómina del usuario (`where nomina == la suya`), filtra las vigentes y devuelve
`{ esAdmin, esRH, esAut2, areasAut1, areasSolicitante }` (ids de área) más `tieneAcceso`, `cargando` y `error`.
Menú, portal, contadores y suscripciones lo usan: nadie se suscribe a datos que no puede leer.

- Módulo de **rutas**: lo ven RH/admin y los solicitantes vigentes de cualquier área. Las solicitudes nuevas guardan `areaId`
  (si hay varias áreas, se elige una); las anteriores sin `areaId` siguen funcionando para su dueño.
- Módulo de **tiempo extra**: RH/admin, Aut. 2, y quien tenga aut1 o solicitante vigente.
- `useAreas()` entrega el catálogo de áreas (nombres) leído una vez por sesión.

## Portal y módulos

- `/` es el portal: una tarjeta por módulo con el contador de pendientes de ese usuario.
- `/rutas/...` transporte (las URLs viejas `/solicitud/...`, `/mis-solicitudes`, `/rh/...` redirigen).
- `/tiempo-extra/...` tiempo extra. `/accesos/...` usuarios, asignaciones y organigrama (`/rutas/rh/usuarios` y `/tiempo-extra/niveles` redirigen).
- `src/modulos.js` configura cada módulo: `id`, `nombre`, `icono`, `base`, `acceso(usuario, accesos)` y `useContador(...)`.

Contador de tiempo extra: Aut. 1 → `pendiente_aut1` de sus áreas; Aut. 2 y RH → `pendiente_aut2`; RH → `autorizada` por recibir;
solicitante → sus `devuelta`. Nunca cuenta lo que creó la propia persona.

## Carga inicial y limpieza

- **Cargar asignaciones iniciales** (Usuarios y accesos > Asignaciones, solo admin): lista de revisión con la configuración de la hoja
  *Niveles de autorización* (Aut. 2: 11 y 50296; un Aut. 1 por área; los solicitantes de cada área). Una fila por asignación, con casilla,
  rol, área, nómina, nombre y puesto **del padrón**, el área del empleado en el padrón y su estado: *Listo*, *Ya existe* (sin casilla),
  *No está en el padrón* (sin casilla), *Área distinta* (marcada, con aviso), *Sin usuario* (aviso) y *Revisar nombre* (desmarcada: el nombre del
  padrón no coincide con el de la hoja). Crea con las mismas funciones que *Asignar rol* (permanentes, con bitácora) y es idempotente. Al terminar abre el Organigrama.
  Las propuestas están en `src/utils/cargaInicial.js`.
- **Limpiar estructura vieja** (RH > Catálogos > Diagnóstico, solo admin; escribir `LIMPIAR`): quita `areaTE` y `areaTEManual` del padrón, con respaldo JSON antes.
  `areasTE`, `config/areasTE`, `config/tiempoExtra` y `accesosTE` ya no tienen reglas de Firestore (la app no las toca); si existieran, se borran desde la consola de Firebase.
- La matriz anterior nunca se llenó, así que no hubo migración de datos: los roles `superintendente`/`autorizador` que queden se corrigen a mano en *Usuarios*.

## Borrador: captura por lotes (esquema para el prompt 3B; las reglas y pruebas ya existen, la pantalla no)

Un lote de Firestore admite 20 lecturas en las reglas y cada empleado cuesta una (validar su `areaId` en el padrón), así que una solicitud
con muchos empleados no cabe en un solo lote de captura (caben 12 con la captura directa). Por eso la captura pasa por un **borrador**:

1. **Crear**: la solicitud se crea en estatus `borrador` (con su folio, el contador de siempre y la entrada `creada` del historial), sin empleados.
   Lo crea quien puede capturar en esa área (solicitante vigente; RH o Aut. 2 en un área que no participa). **Solo el creador la ve y la edita**:
   el Aut. 1, la Aut. 2, RH y admin no la leen (ni sus empleados ni su historial).
2. **Armar**: los empleados se agregan, cambian o quitan en **lotes de máximo 10** (`writeBatch` sobre `tiempoExtra/{folio}/empleados/{nómina}`).
   Las reglas validan cada empleado: debe estar en el padrón con la misma `areaId` que la solicitud. Sobra margen: el límite real es de unos 17; 10 es el
   tope acordado. También se pueden editar `fechaTE`, `motivo` y `resumen` mientras sea borrador. Descartar = pasar a `cancelada` (con su historial).
3. **Enviar a autorización**: un solo `update` del padre (puede ir en el lote del último grupo de empleados) con el estatus nuevo, el `resumen` ya
   calculado (empleados, horas, transporte, alimentos) y la entrada `enviada` del historial en el mismo lote:
   `borrador → pendiente_aut1`, o `pendiente_aut2` si quien envía es el Aut. 1 vigente de esa área o si el área no participa en TE (`estatusInicialTE`).
   Sin firmas colgadas. Solo el creador, y solo si sigue siendo capaz de capturar en esa área.

Consecuencias para las pantallas: las consultas del Aut. 1, la Aut. 2 y RH sobre `tiempoExtra` deben **excluir borradores** (las que ya traen `where('estatus','==',…)` no
cambian; una consulta solo por `areaId` ahora se rechaza: agrega `where('estatus','!=','borrador')`). `ESTATUS_TE.BORRADOR`, su etiqueta y la acción `enviada` están en `src/utils/constantes.js`.
La captura directa a `pendiente_aut1`/`pendiente_aut2` (hasta 12 empleados) sigue permitida por las reglas.

## Modelo de datos

### `tiempoExtra/{id}` — el **id es el folio** (`TE-2026-0001`)

```
folio                 'TE-2026-0001' (= id del documento)
areaId, areaNombre
creadoPor (uid), creadoPorNomina, creadoPorNombre
fechaTE ('AAAA-MM-DD'), motivo, estatus
resumen: { totalEmpleados, totalHoras, totalTransporte, totalAlimentos }
aut1, aut2:  { nomina, nombre, fecha, comentario }      ← se llenan al firmar
devolucion:  { nivel (1|2), nomina, nombre, motivo, fecha }
solicitudRutaId       ← la pone RH al procesar
fechaCreacion, fechaActualizacion   ← serverTimestamp()
```

- **Folio**: contador en `contadores/te-AAAA` (`{ ultimo }`), incrementado **de uno en uno dentro de la transacción de
  captura** (las reglas exigen `ultimo == anterior + 1`, o `1` al crear). Usar el folio como id garantiza unicidad aunque
  el contador se manipule. Esquema de la captura:

```js
await runTransaction(db, async (tx) => {
  const ref = doc(db, 'contadores', `te-${anio}`);
  const ultimo = (await tx.get(ref)).data()?.ultimo ?? 0;
  const folio = `TE-${anio}-${String(ultimo + 1).padStart(4, '0')}`;
  tx.set(ref, { ultimo: ultimo + 1 });
  tx.set(doc(db, 'tiempoExtra', folio), { folio, ...datos, fechaCreacion: serverTimestamp(), fechaActualizacion: serverTimestamp() });
});
// Los empleados y la entrada "creada" del historial van en un lote (writeBatch) en el mismo commit
// que la solicitud, o en la misma transacción.
```

### `tiempoExtra/{id}/empleados/{nómina}`

`nombre, puesto, turnoNomina, horaInicio, horaFin, horas, requiereTransporte, ruta/comunidad/punto` (los mismos campos
que los pasajeros de rutas) `, requiereAlimentos`.

### `tiempoExtra/{id}/historial/{autoId}` — solo se crea

`accion` (`creada | enviada | autorizada_1 | autorizada_2 | devuelta | reenviada | cancelada | recibida_rh`), `nivel`, `porUid`,
`porNomina`, `porNombre`, `comentario`, `fecha`. Cada entrada debe escribirse **en el mismo lote** que la transición
del padre (las reglas comparan el estatus antes/después) y por quien tiene el rol de esa acción.

### Estatus (`ESTATUS_TE` en `src/utils/constantes.js`)

`borrador`, `pendiente_aut1`, `pendiente_aut2`, `autorizada`, `devuelta`, `cancelada`, `procesada`, con `ESTATUS_TE_MAP`
(etiqueta y badge; `<BadgeEstatus modulo="te" />`) y `TRANSICIONES_TE` (de, a, quién, acción), la misma tabla que
aplican las reglas. Helpers: `transicionesTE(estatus, quien)` y `estatusInicialTE(esAut1DeLaArea, areaParticipa)`.

| De | A | Quién |
|---|---|---|
| pendiente_aut1 | pendiente_aut2 / devuelta | Aut. 1 vigente del área (no el creador) |
| pendiente_aut2 | autorizada / devuelta | Aut. 2 vigente o RH (no el creador) |
| autorizada | procesada | RH |
| borrador | pendiente_aut1 (o pendiente_aut2) | el creador, con el resumen calculado |
| borrador, pendiente_aut1, pendiente_aut2, devuelta | cancelada | el creador |
| devuelta | pendiente_aut1 (o pendiente_aut2 si es el Aut. 1 del área) | el creador, quitando `aut1`/`aut2` |

## Reglas de Firestore (resumen; ver `firestore.rules`)

- Helper `asignacionVigente(rol, area)`: lee `asignaciones/{perfil().nomina}_{rol}_{area}` y comprueba `activo`, `desde <= request.time`
  y `hasta`. `esAut2() = asignacionVigente('aut2', 'planta')`; `esAut1De(a)` y `esSolicitanteDe(a)` son el mismo helper.
- `asignaciones`: las lee cualquier usuario activo; las crea o edita el admin (cualquier rol) o RH / Aut. 2 vigente (solo aut1 y solicitante, en un
  área con participaTE); el id debe coincidir con `nomina_rol_area`; nadie, salvo admin, toca las suyas; nunca se borran.
  Revocar/extender solo cambia `activo`, `hasta` y `motivo`.
- `usuarios`: solo admin pone o quita `rh`/`admin`; RH crea usuarios con rol `usuario` y solo edita a quienes no son rh/admin. La Aut. 2 vigente también
  los lee (para el aviso "Sin usuario"). `bitacora`: la Aut. 2 puede crear y leer solo `entidad == 'asignacion'`.
- `tiempoExtra` **leer**: el creador, Aut. 1 vigente del área, Aut. 2 vigente, RH y admin.
  **Crear**: solicitante vigente de esa área (RH o Aut. 2 si el área no participa), `creadoPor == uid`, `folio == id`, sin firmas, estatus
  `pendiente_aut1` / `pendiente_aut2` según corresponda, fechas = hora del servidor.
- **Empleados dentro de un TE**: el empleado del padrón debe tener la misma `areaId` que la solicitud.
- **Solicitudes de ruta**: crea RH/admin o un solicitante vigente del `areaId` que declara; el dueño lee las suyas siempre, pero editarlas o
  cancelarlas exige seguir siendo solicitante vigente de esa área (las sin `areaId` solo exigen ser el dueño). Un solicitante solo cambia
  ruta/comunidad/punto de empleados de las áreas donde es solicitante vigente (la pantalla ya filtra esos cambios).
- **Transiciones**, **borrar**, **historial**: como antes (ver la tabla). Las consultas de lista deben traer el filtro que las reglas pueden probar.
- `areasTE`, `config/*` y `accesosTE` ya no tienen reglas (nadie accede a ellas desde la app).

## Limitaciones conocidas

- **Límite de empleados por lote**: ver *Borrador* (captura en lotes de hasta 10).
- La captura debe usar `usuario.nomina` (perfil); un usuario sin nómina no pasa ninguna regla de TE ni de asignaciones.
- Las consultas con `orderBy` sobre `tiempoExtra` necesitarán índices compuestos en `firestore.indexes.json`.
- Las pantallas de captura y autorización de TE aún no existen (solo las reglas y el modelo).
- Un solicitante de un área sin participaTE (Administrativo) no se puede asignar: una persona de Administrativo que hoy pide rutas necesita
  decisión de RH (la migración las lista como "por decidir").

## Pruebas

- `npm run test:rules` — reglas (rutas/usuarios, estructura, tiempo extra y asignaciones) contra el emulador de Firestore; requiere Java 11+.
- `npm run test:unit` — importación, puestos, asignaciones, organigrama y migración (sin emulador).
- `npm run prueba:humo` — pruebas de humo de utilidades.
