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

## Navegación e Inicio por rol

La app se organiza por **lo que la persona hace**, no por módulos (RH y admin conservan el menú por secciones y el portal). Una persona con varios
roles ve la unión de lo que le toca a cada uno. Lógica pura en `src/utils/navegacion.js` (con pruebas).

| Rol | Menú | Inicio |
|---|---|---|
| Solicitante | Inicio · Solicitar tiempo extra · Mis solicitudes | botón grande "Solicitar tiempo extra"; empleados de mi área; borrador / en autorización / devueltas (resaltadas) / autorizadas del mes; próximos autorizados |
| Aut. 1 | lo del solicitante + Por autorizar (contador) + Mi área | además "Por autorizar (N)" y "Últimas solicitudes de mi área" |
| Aut. 2 | Inicio · Por autorizar · Consulta de solicitudes · Organigrama · Asignar roles | por autorizar nivel 2, solicitudes de la semana por área, empleados de planta |
| RH / admin | Transporte, Tiempo extra, Administración | portal + "Autorizadas pendientes de recibir" |

- El saludo usa el nombre de pila ("Buenas tardes, Oscar") con el formateador de nombres del organigrama; si no puede separar con seguridad, saluda sin nombre.
- `/tiempo-extra/nueva`, `/mis-solicitudes`, `/autorizar` y `/consulta` muestran "Próximamente" hasta los siguientes prompts.
- El solicitante pide transporte **solo dentro del tiempo extra** (elige la ruta de cada empleado): la "Nueva solicitud" de transporte suelta la crean solo RH y admin.
  Quien tenga solicitudes de transporte suyas anteriores conserva "Transporte (consulta)" (solo lectura).
- **Organigrama**: el solicitante no lo ve; el Aut. 1 ve solo su área (pestaña "Mi área") con el Nivel 2 arriba; Aut. 2, RH y admin, completo.

### Quién lee qué (reglas)

- **Padrón** (`empleados`): admin, RH y Aut. 2 todo; solicitante y Aut. 1 solo los de sus áreas vigentes. Sus consultas llevan `where('areaId', 'in', susÁreas)`
  (en trozos de 10): el `CatalogosProvider` lo hace solo según el rol. Una consulta abierta (o con un área ajena) se rechaza.
- **Asignaciones**: cada quien las suyas; el Aut. 1, las de su área y las de Aut. 2; Aut. 2, RH y admin, todas (`useAsignaciones()`).
  El Aut. 1 ve el Nivel 2 del organigrama con el nombre guardado en la asignación y sin puesto (no lee el padrón de otras áreas).
- **Tiempo extra**: las consultas de Aut. 1, Aut. 2 y RH usan `estatus in [sin borrador]` (`ESTATUS_TE_VISIBLES`): los borradores solo los lee su creador.

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

## Captura: borrador, lotes y folio (pantallas `/tiempo-extra/nueva`, `/:id/editar` y `/mis-solicitudes`)

Un lote de Firestore admite 20 lecturas en las reglas y cada empleado cuesta una (validar su `areaId` contra el padrón), así que los empleados se
escriben en **lotes de 10**. Por eso TODA solicitud nace como **borrador**:

1. **Crear**: `tiempoExtra/BR-xxxxxxxxxxxx` (id propio que exigen las reglas), estatus `borrador`, **sin folio**. Lo crea un solicitante o el **Aut. 1** vigente del
   área (el Aut. 1 también captura: su solicitud se salta su propio nivel), o RH / Aut. 2 en un área sin participaTE. **Solo el creador lo ve y lo edita**
   (ni sus empleados ni su historial los leen Aut. 1, Aut. 2, RH ni admin). Un borrador no gasta folios.
2. **Armar**: "Guardar borrador" escribe la solicitud y los empleados nuevos o modificados en lotes de 10 con barra de progreso (`guardarBorrador`); se puede salir y continuar.
   Las reglas validan cada empleado: está en el padrón con la misma `areaId` y trae solo los campos del modelo
   (`nombre, puesto, turnoNomina, horaEntrada, horaSalida, horas, requiereAlimentos, requiereTransporte, rutaId, comunidadId, puntoReunionId`).
3. **Enviar a autorización** (`enviarSolicitud`): en **una transacción** toma el siguiente número del contador `contadores/te-AAAA`, pone el folio
   `TE-AAAA-NNNN`, el estatus (`pendiente_aut1`, o `pendiente_aut2` si es el Aut. 1 de esa área o el área no participa), el resumen calculado y la entrada
   `enviada` del historial. Las reglas exigen que el folio sea exactamente el número que deja el contador (que sube 1) y del año en curso.
4. **Devuelta → corregir y reenviar**: se edita igual (contenido y empleados); al reenviar **conserva su folio**, se quitan `aut1`/`aut2` y vuelve a empezar en Aut. 1
   (o en Aut. 2 si quien reenvía es su Aut. 1); entrada `reenviada`.
5. **Cancelar** una pendiente o devuelta exige **motivo** (`motivoCancelacion`, mínimo 3 caracteres; queda también en el historial). Un **borrador no se cancela: se elimina**
   (solo el propio; primero se borran sus empleados en lotes y al final la solicitud).

Campos de la solicitud: `areaId, areaNombre, creadoPor(+Nomina/Nombre), fechaTE, motivo` (Producción, Mantenimiento, Calidad, Inventario, Embarques u Otro),
`comentario` (obligatorio al enviar, 10+ caracteres), `estatus, resumen, folio` (desde que se envía), `devolucion`, `motivoCancelacion`.

Editor: elige el área (fija si solo tiene una), fecha (hoy o futura), motivo y comentario; "Agregar empleados" abre el selector de **todos los activos del área**
(buscador, filtros por puesto y turno A/B/C, casillas para agregar 30 o más de golpe). Cada empleado: entrada (7:00, 16:00, 19:00, 0:00), salida (16:00, 19:00, 0:00, 7:00),
horas calculadas (cruza medianoche), alimentos y transporte (marcado por defecto, con ruta → comunidad → punto precargados del padrón con confirmación; lo confirmado se
guarda en el padrón de empleados de su área). Barra "aplicar a todos / a los seleccionados" y resumen fijo (empleados, horas, transporte, alimentos y empleados por horario).
Validaciones: sin repetidos, entrada ≠ salida, transporte completo, máximo `MAX_PASAJEROS` (150); **aviso sin bloquear** si el empleado ya tiene otro tiempo extra no cancelado
ese día (solo ve lo que puede leer: lo suyo y, si es Aut. 1, lo de su área).

Consultas: las del Aut. 1, la Aut. 2 y RH sobre `tiempoExtra` deben **excluir borradores** (`estatus in ESTATUS_TE_VISIBLES`); una consulta solo por `areaId` se rechaza.

## Modelo de datos

### `tiempoExtra/{id}` — id propio del borrador (`BR-…`); el **folio** (`TE-2026-0001`) es un campo que se asigna al enviar

```
folio                 'TE-2026-0001' (se asigna al enviar; no existe en un borrador)
areaId, areaNombre
creadoPor (uid), creadoPorNomina, creadoPorNombre
fechaTE ('AAAA-MM-DD'), motivo, estatus
resumen: { totalEmpleados, totalHoras, totalTransporte, totalAlimentos }
aut1, aut2:  { nomina, nombre, fecha, comentario }      ← se llenan al firmar
devolucion:  { nivel (1|2), nomina, nombre, motivo, fecha }
solicitudRutaId       ← la pone RH al procesar
fechaCreacion, fechaActualizacion   ← serverTimestamp()
```

- **Folio**: contador en `contadores/te-AAAA` (`{ ultimo }`), incrementado **de uno en uno dentro de la transacción de envío** (las reglas exigen `ultimo == anterior + 1`, o `1` al crear,
  y que el folio sea ese número). Ver `enviarSolicitud` en `src/utils/tiempoExtraDb.js`.

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
| borrador | pendiente_aut1 (o pendiente_aut2) | el creador: asigna folio, resumen y bitácora en una transacción |
| pendiente_aut1, pendiente_aut2, devuelta | cancelada | el creador, con motivo |
| borrador | (se elimina) | el creador |
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

- **Límite de empleados por lote**: ver *Captura: borrador, lotes y folio* (lotes de hasta 10).
- La captura debe usar `usuario.nomina` (perfil); un usuario sin nómina no pasa ninguna regla de TE ni de asignaciones.
- Las consultas con `orderBy` sobre `tiempoExtra` necesitarán índices compuestos en `firestore.indexes.json`.
- Las pantallas de captura y autorización de TE aún no existen (solo las reglas y el modelo).
- Un solicitante de un área sin participaTE (Administrativo) no se puede asignar: una persona de Administrativo que hoy pide rutas necesita
  decisión de RH (la migración las lista como "por decidir").

## Pruebas

- `npm run test:rules` — reglas (rutas/usuarios, estructura, tiempo extra y asignaciones) contra el emulador de Firestore; requiere Java 11+.
- `npm run test:unit` — importación, puestos, asignaciones, organigrama y migración (sin emulador).
- `npm run prueba:humo` — pruebas de humo de utilidades.
