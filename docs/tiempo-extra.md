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
- Áreas con `participaTE: false` (Administrativo): solo capturan RH o una Aut. 2. Lo de RH va **directo a `pendiente_aut2`** (lo firma una Aut. 2 u otra persona de RH).
- **Una Aut. 2 vigente autoriza lo que ella misma captura**: al enviar (de cualquier área donde pueda capturar) la solicitud queda **`autorizada`** en el mismo paso, con su firma `aut2` (`comoRH: false`, comentario «Capturada y autorizada por Aut. 2»), una sola entrada `enviada_autorizada` (nivel 2) en el historial y sin firma de nivel 1; pasa directo a *Por enviar al proveedor*. Si la reenvía una devuelta, igual.
- **Nadie más autoriza ni devuelve lo que creó él mismo.** El Aut. 1 no autoriza lo suyo (va a nivel 2); lo de RH sin ser Aut. 2 lo firma una Aut. 2 u otra persona de RH.
- Solo se incluyen empleados cuya `areaId` en el padrón sea la del área de la solicitud (lo exigen las reglas).

## Dos tipos de rol

1. **Rol del sistema** (`usuarios/{uid}.rol`): solo `admin`, `rh` o `usuario`. Solo un admin da o quita `rh` y `admin`.
   Los roles anteriores `superintendente` y `autorizador` se corrigen a mano a `usuario` (ver Carga inicial y limpieza).
2. **Rol operativo**: asignaciones por área.

### `asignaciones/{nomina}_{rol}_{areaId|planta}`

```
nomina, nombre, puesto, puestoId, rol ('aut2' | 'aut1' | 'solicitante'), areaId (null en aut2),
desde, hasta (null = permanente; se guarda como el fin del día), motivo, activo,
asignadoPor { uid, nombre }, fechaAsignacion (serverTimestamp)
```

- **Posición**: el titular va arriba y centrado en el organigrama, con tarjeta grande; quien cubre "Por ausencia" va debajo, más pequeño; sin posición, al final con un aviso.
  Los dos pueden firmar igual (la bandeja no distingue; queda registrado quién firmó). Se da al asignar y se cambia con "Cambiar posición" (tabla de Asignaciones y panel de la persona;
  solo quien puede asignar ese rol: el admin para Aut. 2; RH y Aut. 2 para Aut. 1). Las Aut. 2 anteriores no la traen: el admin las ajusta en Usuarios y accesos › Asignaciones.
- **Nombre y puesto** se copian del padrón al asignar (el Aut. 1 no lee el padrón de otras áreas): el organigrama los muestra desde la asignación. "Actualizar nombres y puestos de las
  asignaciones" (admin, Asignaciones) los copia a las ya existentes, con simulación primero; la importación del padrón actualiza también el puesto/nombre guardado si cambian.
- **Privacidad del organigrama** (`vistaDePersona`): RH y admin ven el panel completo; el Aut. 2, el completo de los niveles inferiores y el básico de otros Aut. 2; el Aut. 1, solo el básico
  (nombre, puesto, nómina, rol, área y vigencia) de su nivel e inferiores, y las personas de niveles superiores no se abren. La bitácora (quién asignó a quién) no la leen el Aut. 1 ni el solicitante.
  Límite de Firestore: no hay permisos por campo, así que un Aut. 1 que consulte a mano `asignaciones` podría leer `asignadoPor`, `fechaAsignacion` y `motivo`; la pantalla no los muestra.
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

## Pantalla *Usuarios y accesos* (`/personal/accesos/:tab`)

- **Usuarios** (RH/admin): tabla de cuentas con rol del sistema y la columna *Roles operativos* (etiquetas vigentes:
  "Solicitante · Producción", "Aut. 1 · Moldes hasta 20/10").
- **Asignaciones** (quien puede asignar): tabla con filtros (rol, área, estado Vigentes/Programadas/Vencidas/Revocadas) y
  buscador; *Asignar rol*, *Revocar*, *Extender* y *Ver historial* (de la bitácora). Al elegir rol y área, el buscador
  sugiere primero a los empleados de esa área (por `areaId`), ordenados por puesto. Si la persona no tiene usuario:
  **Sin usuario** y, para RH/admin, **Crear usuario**.
- **Organigrama** (todos; solo lectura salvo para quien asigna): generado **solo** con asignaciones vigentes, con la forma
  de la hoja *Niveles de autorización*: todos los Aut. 2 vigentes arriba, al mismo nivel y uno al lado del otro (orden: nivel del puesto y luego nombre; sin jerarquía entre ellos), una columna por área con participaTE con su Aut. 1 (amarillo) y sus
  solicitantes (rosa). Quien asigna ve *+ Aut. 1* / *+ Solicitante* por columna y puede revocar desde la tarjeta. Un área sin
  Aut. 1 vigente muestra "Sin Autorización 1: las solicitudes de esta área no podrán avanzar".

## Navegación e Inicio por rol

La app se organiza por **lo que la persona hace**, no por módulos (RH y admin tienen el menú por secciones y el panel de indicadores como Inicio). Una persona con varios
roles ve la unión de lo que le toca a cada uno. Lógica pura en `src/utils/navegacion.js` (con pruebas).

| Rol | Menú | Inicio |
|---|---|---|
| Solicitante | Inicio · Solicitar tiempo extra · Mis solicitudes | botón grande "Solicitar tiempo extra"; empleados de mi área; borrador / en autorización / devueltas (resaltadas) / autorizadas del mes; próximos autorizados |
| Aut. 1 | lo del solicitante + Por autorizar (contador) + Mi área | además "Por autorizar (N)" y "Últimas solicitudes de mi área" |
| Aut. 2 | Inicio · Solicitar tiempo extra · Mis solicitudes · Por autorizar · Todas las solicitudes · Organigrama · Asignar roles | por autorizar nivel 2, solicitudes de la semana por área, empleados de planta |
| RH / admin | Inicio · Tiempo extra (Solicitar, Mis solicitudes, Por autorizar, Por enviar al proveedor, Todas las solicitudes) · Transporte (Solicitudes de transporte, Catálogos) · Personal y estructura (Padrón, Estructura, Usuarios y accesos, Organigrama) · Herramientas (solo admin) | **Requieren atención** (resaltado si >0): por enviar al proveedor, fechas vencidas sin confirmar, por autorizar nivel 1, por autorizar nivel 2 (con la más antigua) y devueltas. **Esta semana**: horas autorizadas (semana y mes), empleados con tiempo extra y con transporte en 7 días. Accesos rápidos y tabla de los próximos 7 días |
| Sin ningún rol | Inicio | «Pide acceso al área de Sistemas o, en su caso, a Recursos Humanos» |

- El saludo usa el nombre de pila ("Buenas tardes, Oscar") con el formateador de nombres del organigrama; si no puede separar con seguridad, saluda sin nombre.
- El solicitante pide transporte **solo dentro del tiempo extra** (elige la ruta de cada empleado): la "Nueva solicitud" de transporte suelta la crean solo RH y admin.
  "Nueva solicitud", "Mis solicitudes" y "Transporte (consulta)" de transporte están ocultas con `FUNCIONES.transporteSuelto = false` (`src/funciones.js`); ponerlo en `true` las devuelve.
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
Menú, Inicio, contadores y suscripciones lo usan: nadie se suscribe a datos que no puede leer.

- Módulo de **rutas**: lo ven RH/admin y los solicitantes vigentes de cualquier área. Las solicitudes nuevas guardan `areaId`
  (si hay varias áreas, se elige una); las anteriores sin `areaId` siguen funcionando para su dueño.
- Módulo de **tiempo extra**: RH/admin, Aut. 2, y quien tenga aut1 o solicitante vigente.
- `useAreas()` entrega el catálogo de áreas (nombres) leído una vez por sesión.

## URLs

Todas salen de `src/rutas.js` (una línea por URL) y las del transporte suelto de `src/funciones.js`. No hay redirecciones de URLs anteriores.

- `/` Inicio por rol · `/tiempo-extra/...` tiempo extra · `/transporte/solicitudes` y `/transporte/catalogos` · `/personal/padron`, `/personal/estructura`, `/personal/accesos[/:tab]`
- `/mi-cuenta` (todos) · `/herramientas` (solo admin). Cualquier otra URL muestra «No encontramos esa página».
- Acceso: `RutaPuede` (capacidades de `src/utils/permisos.js`: solicitar / autorizar / consultar / recibir / rh / admin); ver `docs/permisos.md` y `RutaFuncion` (interruptores).

Contador de tiempo extra: Aut. 1 → `pendiente_aut1` de sus áreas; Aut. 2 y RH → `pendiente_aut2`; RH → `autorizada` por recibir;
solicitante → sus `devuelta`. Nunca cuenta lo que creó la propia persona.

## Carga inicial y limpieza

- **Cargar asignaciones iniciales** (Usuarios y accesos > Asignaciones, solo admin): lista de revisión con la configuración de la hoja
  *Niveles de autorización* (Aut. 2: 11 y 50296; un Aut. 1 por área; los solicitantes de cada área). Una fila por asignación, con casilla,
  rol, área, nómina, nombre y puesto **del padrón**, el área del empleado en el padrón y su estado: *Listo*, *Ya existe* (sin casilla),
  *No está en el padrón* (sin casilla), *Área distinta* (marcada, con aviso), *Sin usuario* (aviso) y *Revisar nombre* (desmarcada: el nombre del
  padrón no coincide con el de la hoja). Crea con las mismas funciones que *Asignar rol* (permanentes, con bitácora) y es idempotente. Al terminar abre el Organigrama.
  Las propuestas están en `src/utils/cargaInicial.js`.
- **Limpiar estructura vieja** (Herramientas > Diagnóstico y limpieza, solo admin; escribir `LIMPIAR`): quita `areaTE` y `areaTEManual` del padrón, con respaldo JSON antes.
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
   (`nombre, puesto, horaEntrada, horaSalida, horas, requiereAlimentos, requiereTransporte, rutaId, comunidadId, puntoReunionId`).
3. **Enviar a autorización** (`enviarSolicitud`): en **una transacción** toma el siguiente número del contador `contadores/te-AAAA`, pone el folio
   `TE-AAAA-NNNN`, el estatus (`pendiente_aut1`, o `pendiente_aut2` si es el Aut. 1 de esa área o el área no participa), el resumen calculado y la entrada
   `enviada` del historial. Las reglas exigen que el folio sea exactamente el número que deja el contador (que sube 1) y del año en curso.
4. **Devuelta → corregir y reenviar**: se edita igual (contenido y empleados); al reenviar **conserva su folio**, se quitan `aut1`/`aut2` y vuelve a empezar en Aut. 1
   (o en Aut. 2 si quien reenvía es su Aut. 1); entrada `reenviada`.
5. **Cancelar** una pendiente o devuelta exige **motivo** (`motivoCancelacion`, mínimo 3 caracteres; queda también en el historial). Un **borrador no se cancela: se elimina**
   (solo el propio; primero se borran sus empleados en lotes y al final la solicitud).

Campos de la solicitud: `areaId, areaNombre, creadoPor(+Nomina/Nombre), fechaTE, motivos` (del catálogo, hasta 5; ver *Motivos del tiempo extra*) y `motivo` (el nombre del primero; en las solicitudes anteriores, el único motivo),
`comentario` (obligatorio al enviar, 10+ caracteres), `estatus, resumen, folio` (desde que se envía), `devolucion`, `motivoCancelacion`.

Editor: elige el área (fija si solo tiene una), fecha (hoy o futura), motivos y comentario; "Agregar empleados" abre el selector de **todos los activos del área**
(buscador, filtros por puesto y ruta, casillas para agregar 30 o más de golpe). Cada empleado: entrada (7:00, 16:00, 19:00, 0:00), salida (16:00, 19:00, 0:00, 7:00),
horas calculadas (cruza medianoche), alimentos y transporte (marcado por defecto, con ruta → comunidad → punto precargados del padrón con confirmación; lo confirmado se
guarda en el padrón de empleados de su área). Barra "aplicar a todos / a los seleccionados" y resumen fijo (empleados, horas, transporte, alimentos y empleados por horario).
Validaciones: sin repetidos, entrada ≠ salida, transporte completo, máximo `MAX_PASAJEROS` (150); **aviso sin bloquear** si el empleado ya tiene otro tiempo extra no cancelado
ese día (solo ve lo que puede leer: lo suyo y, si es Aut. 1, lo de su área).

Consultas: las del Aut. 1, la Aut. 2 y RH sobre `tiempoExtra` deben **excluir borradores** (`estatus in ESTATUS_TE_VISIBLES`); una consulta solo por `areaId` se rechaza.

## Bandejas de autorización y consulta

- **`/tiempo-extra/autorizar`** (en tiempo real): el Aut. 1 ve `pendiente_aut1` de sus áreas; la Aut. 2 y RH/admin, `pendiente_aut2` de toda la planta; con los dos roles, dos
  secciones ("Nivel 1" y "Nivel 2"). Las más antiguas primero (por el tiempo que llevan esperando en su nivel), con filtros de área y fechas, insignia "Fecha vencida"
  (se puede autorizar, con confirmación extra) y las propias deshabilitadas ("No puedes autorizar tu propia solicitud"). El detalle muestra encabezado, empleados con su ruta,
  resumen por bloque de horario, historial y, si fue devuelta antes, ese motivo. En celular se vuelve una lista de tarjetas con botones grandes.
- **Autorizar** (comentario opcional) guarda `aut1` o `aut2` como `{ nomina, nombre, fecha, comentario, comoRH }`: `comoRH` es true cuando RH/admin firma el nivel 2 **sin ser Aut. 2**, para saber si firmó
  Salvador, Marco o alguien de RH (las reglas exigen que diga la verdad). **Devolver** exige un motivo de 10+ caracteres y guarda `devolucion { nivel, nomina, nombre, motivo, fecha }`.
  Cada acción corre en `runTransaction`: relee el estatus y aborta con "Alguien más ya respondió esta solicitud" si cambió (también si el solicitante canceló). Escribe el historial.
- **Autorizar varias**: casillas y "Autorizar N seleccionadas" (confirmación con total de empleados y horas); cada una en su transacción y un resumen de las que fallaron. Devolver siempre es de una en una.
  Lo que desaparece de la bandeja sin que uno lo haya respondido muestra un aviso.
- El Aut. 1 tiene además "Historial de mi área" (lo que ya pasó por su nivel, solo lectura).
- **`/tiempo-extra/consulta`** (Aut. 2, RH y admin): todas las solicitudes salvo borradores; filtros de área, estatus, fechas del TE y solicitante; tarjetas (pendientes por nivel, autorizadas de la
  semana, empleados y horas autorizados del mes por área) y **Exportar a Excel** (hoja "Resumen" por área y estatus; hoja "Detalle" con una fila por empleado y quién firmó cada nivel).
- Contadores en vivo en "Por autorizar" (menú, incluido el de RH) y en la tarjeta del Inicio; el Inicio del solicitante se actualiza solo cuando se le devuelve o se le autoriza una solicitud.

## Por enviar al proveedor (antes "Recepción") y transporte

> La pantalla y el menú se llaman ahora **Por enviar al proveedor** (la ruta sigue siendo `/tiempo-extra/recepcion`), con una explicación fija y un mini diagrama del flujo.
> "Recibir" pasó a **Confirmar**: "Confirmar y generar transporte" (o "Confirmar (sin transporte)"), "Confirmar todas las de esta fecha", y el estatus `procesada` se muestra como
> "Confirmada por RH". Al confirmar sale "Listo. El transporte de [fecha] ya aparece en Solicitudes de transporte…" con enlace. Los nombres técnicos (`recibirSolicitud`, `recibidaPor`…) no cambian.

- **`/tiempo-extra/recepcion`** (RH y admin, en tiempo real): lo `autorizada` que falta recibir, agrupado por fecha del TE (la más próxima primero), con empleados, horas, transporte, alimentos y
  quién firmó cada nivel (con "(RH)" si firmó por su rol). El detalle es el mismo que el de la bandeja. **No se editan empleados**: si algo está mal, RH usa **Devolver** (motivo de 10+ caracteres, `devolucion.nivel = 3`,
  la solicitud vuelve a su solicitante).
- **Recibir y generar transporte** (`recibirSolicitud`): crea **una** solicitud de transporte por TE solo con los empleados que pidieron transporte y pasa el TE a `procesada`
  (`recibidaPor`, `fechaRecepcion`, `solicitudTransporteId`). Si nadie pidió transporte solo marca `procesada`. **Recibir todas de esta fecha** hace lo mismo por cada una, con confirmación y resumen.
- **Todo o nada**: es una sola `runTransaction` (solicitud, un pasajero por empleado, TE, historial y bitácora, ≤ ~160 escrituras de 500 posibles). Relee el estatus y aborta con "Alguien más ya respondió esta solicitud" si ya no
  está autorizada. Los empleados se leen antes (una transacción no admite consultas); no pueden cambiar porque solo el creador los edita y solo en borrador o devuelta. Las reglas lo refuerzan con `getAfter`: la
  solicitud de transporte solo se crea si en la misma operación el TE (hoy `autorizada`) pasa a `procesada` apuntando a ella, y el TE solo pasa a `procesada` con transporte si esa solicitud nace en la misma operación.
  Un TE con empleados con transporte no puede procesarse sin generarla. Varias a la vez: una transacción cada una.
- **Solicitud de transporte generada**: `origen: 'tiempo_extra'`, `tiempoExtraId`, `folioTE`, `areaId`, `solicitanteNombre`/`solicitanteNomina` (el solicitante original), `creadoPor` = quien recibió (RH), `estatus: 'aprobada'`,
  `fechaServicio` = fecha del TE. Cada pasajero lleva su propia entrada y salida (en el formato de rutas, "4:00PM"), alimentos, ruta, comunidad, punto, **área** y **turno**.
- **Turno por hora de entrada** (el formulario de rutas NO tiene un mapeo: ahí el turno se elige a mano): el turno que contiene la hora — Turno 1: 7:00–15:59 · Turno 2: 16:00–23:59 · Turno 3: 0:00–6:59 (`turnoPorEntrada`).
  Así 7:00 → 1, 16:00 → 2, 0:00 → 3 y **19:00 → 2** (no inicia turno; entra durante el turno 2).
- **Cancelación posterior** (RH y admin, desde Recepción o Consulta; `cancelarAutorizada`): "Cancelar tiempo extra autorizado" con motivo de 10+ caracteres, desde `autorizada` o `procesada`. Si ya estaba recibida, en la misma
  transacción cancela su solicitud de transporte siempre que no esté "enviada al proveedor"; si ya se envió, no toca su estatus, la marca `requiereRevision` y avisa "El transporte de [fecha] ya se envió al proveedor; avísale por teléfono".
  Queda en el historial del TE y en `bitacora` (`entidad: 'tiempoExtra'`).
- **Solicitudes de transporte** (`/transporte/solicitudes`; antes "Todas las solicitudes"): las de tiempo extra llevan la insignia "Tiempo extra · TE-…" con enlace al TE (`/tiempo-extra/consulta?abrir=ID`), el filtro de origen Todas / Normales / Tiempo extra,
  la columna AREA y no se editan ahí. El detalle de un TE (Mis solicitudes, bandeja, recepción y consulta) muestra su solicitud de transporte con su estatus: la regla de lectura de `solicitudes` deja leerla a quien puede leer ese TE.
- **Excel del proveedor** (`src/utils/libroProveedor.js`, el mismo formato de siempre): se agregó la columna **AREA** al inicio (área del pasajero; en solicitudes viejas, la de la solicitud, o vacía); el pasajero de TE va en la hoja del turno
  de su entrada; su bloque dice "Solicitante: [original] · Tiempo extra TE-AAAA-NNNN" (un bloque por TE).
- **Formato de rutas (proveedor)** (`components/FormatoRutas.jsx`): el mismo Excel del proveedor, con selector de fecha (Hoy · Mañana · una fecha o rango) y vista previa; está en **Por enviar al proveedor** (para confirmar y descargar en la misma pantalla) y en **Solicitudes de transporte**.
- **Descargar resumen de horas extra** (Por enviar al proveedor y Consulta, solo RH; mismo panel `BotonDescargaResumenTE`/`DescargaTE`, `exportarTiempoExtraRH.js`): periodo (Hoy · Ayer · Esta semana ·
  Semana anterior · Este mes · Personalizado), área, "Incluir" (todas las autorizadas, por defecto, o solo las confirmadas por RH), vista previa (solicitudes, empleados, horas, alimentos; sin datos no descarga)
  y una línea por hoja. Archivo `TiempoExtra_AAAA-MM-DD_a_AAAA-MM-DD.xlsx`. Autorizadas y confirmadas de un rango de fechas y un área, con el estilo del formato del proveedor. Hojas: Detalle (una fila por empleado, con
  horas, ruta, solicitante, Aut. 1, Aut. 2 y fecha de autorización), Horas por empleado (días con TE y horas totales, para nómina), Alimentos (conteo por fecha y horario, para el comedor) y Resumen (empleados y horas por área y fecha).
  La consulta usa el índice compuesto `estatus + fechaTE` de `firestore.indexes.json`.
- El solicitante ve `procesada` como "Confirmada por RH · transporte solicitado" (o "· sin transporte"), y lo autorizado con transporte como "Por enviar al proveedor". Menú de RH: "Por enviar al proveedor" con contador; la tarjeta del portal y del resumen lleva a esa pantalla.

## Motivos del tiempo extra (catálogo, varios por solicitud, P.O./TB)

**Catálogo** (`motivosTE/{id}`, lo editan RH y admin en *Catálogos › Motivos*; lo lee cualquier usuario activo; nadie lo borra, la baja es lógica):
`{ nombre, orden, activo, requiereNumero: null | 'po' | 'tb', requiereComentario }`. Se puede agregar, editar, subir/bajar (cambia `orden`) y desactivar. Un motivo desactivado ya no se ofrece en
solicitudes nuevas, pero las solicitudes que lo tienen lo siguen mostrando bien (guardan una copia del nombre). La **carga inicial** son nueve motivos, en este orden: Cubrir vacante / falta de
personal · Embarques fin de semana · Inventario físico · Cubrir vacaciones / cumpleaños / incapacidad · Adecuación de contenedores · Cubrir tiempo de la brigada · Cargo a P.O. (`requiereNumero: 'po'`) ·
Cargo a TB (`'tb'`) · Otro (`requiereComentario: true`). Con el catálogo vacío, la pestaña ofrece «Cargar motivos iniciales» (ids fijos: repetirla no duplica); `scripts/cargar-motivos.mjs` hace lo mismo
desde la terminal. Código: `src/utils/motivosTE.js` (lógica pura) y `motivosDb.js` (escrituras).

**Captura** (`pages/te/BloqueMotivosTE.jsx`, en *Solicitar tiempo extra*, borrador, corrección tras devolución y autoguardado): un primer motivo obligatorio y «+ Agregar otro motivo» (máximo 5; cada
uno agregado se puede quitar). Según el motivo: **P.O.** pide «Número de P.O.» (obligatorio, solo dígitos, de 6 a 15); **TB**, «Número de TB» (obligatorio, letras y números, hasta 20); **Otro**,
«Describe el motivo» (obligatorio, mínimo 10 caracteres). Todos llevan un «Detalle» opcional (hasta 120). No se repite el mismo motivo con el mismo número. Con más de un motivo, cada empleado tiene un select
«Motivo» (por defecto el primero) y la barra de aplicar tiene «Aplicar a todos» para el motivo; si se quita un motivo, quienes lo tenían pasan al primero.

**Qué se guarda.** En la solicitud: `motivos: [{ motivoId, nombre, numero, comentario, detalle, tipoNumero }]` (el nombre se **copia**; `tipoNumero` = 'po' | 'tb' | '' copia lo que pedía el motivo, para
distinguir P.O. de TB en los reportes) y `motivo` = el nombre del primero (para lo que solo lee texto). En cada empleado: `motivoIndex` (0 a 4). La bitácora de la solicitud
(`historial`, 'enviada' / 'reenviada') lleva «Motivos: …». **Compatibilidad:** las solicitudes anteriores traen solo `motivo` (+ `motivoOtro` con «Otro»); se siguen mostrando tal cual
(`motivosDeTE` las normaliza) y **no se migró ningún dato**. Si una anterior (borrador o devuelta) se edita, la pantalla pide elegir un motivo del catálogo y al guardar se borra `motivoOtro`.

**Dónde se ve.** Detalle de la solicitud (con el motivo de cada empleado cuando hay varios), *Mis solicitudes*, *Por autorizar* (Aut. 1 y Aut. 2), *Por enviar al proveedor* y *Consulta* (también para Nóminas):
los motivos como etiquetas («Cargo a P.O. 4551099797», «Inventario físico · apoyo a inventario»). La consulta tiene filtro
por motivo. Los Excel de consulta y de horas para RH traen el motivo de cada empleado.

**Formato de nómina** (*Reportes de nómina*): la columna «Descripción Motivo/Razón» lleva el motivo de cada empleado con su detalle («Sáb: …; Dom: …» si cambia en la semana); la columna «P.O./TB», el número que
le corresponde. La firma (2) del Excel queda como en el formato en papel («Nombre & Firma de Program Manager** (si aplica)»), sin avisos ni resaltado. La hoja «Resumen» agrega las horas por motivo con su porcentaje y una tabla de horas
por número de P.O./TB. Los ajustes permiten además **corregir el motivo (y el P.O./TB) de un renglón** (cambio tipo `motivo` en `ajustesNomina`; manda sobre lo de las solicitudes y no las modifica).

**Reglas** (`firestore.rules`): `motivosTE` (lectura de cualquier usuario activo, escritura RH/admin, validada, sin borrado) y, en `tiempoExtra`, `motivos` (lista de hasta 5 mapas con esos campos y nombre ≤ 60),
al enviar al menos uno con `motivo` = nombre del primero, y `motivoIndex` entero de 0 a 4 en cada empleado. Una petición solo puede evaluar 1000 expresiones y las reglas no recorren listas, así que lo demás
(formato del P.O./TB, descripción de «Otro», largo de los textos libres) lo valida la app. Pruebas: `tests/motivos-te.test.js`, `tests/firestore.rules.motivos.test.js`,
`tests/firestore.rules.captura-te.test.js` y `tests/formato-nomina*.test.js`.

## Tiempo extra vencido

**Cuándo vence.** Una solicitud está **vencida** cuando termina el día de su fecha (después de las 11:59 p. m. de `fechaTE`, **hora de México**) y su estatus sigue siendo `borrador`, `pendiente_aut1`,
`pendiente_aut2` o `devuelta`. Se **calcula en el cliente**, con una sola función, `esVencida(t, ahora)` en `src/utils/tiempoExtra.js` (junto con `hoyMexico`, `venceHoy`, `estatusVisible`,
`esFechaPasadaSinEnviar` y `conVenceHoyPrimero`); **no se escribe ningún estatus en Firestore** (no hay Cloud Functions). La hora de México es `America/Mexico_City` (sin horario de verano desde 2022:
la medianoche local es a las 06:00 UTC). Las pantallas se actualizan solas cada minuto (`useAhora`). Si algún día hay Blaze se puede volver un estatus real: `docs/blaze.md`.
Autorizada, procesada y cancelada nunca vencen.

**Qué se ve.** Etiqueta gris **«Vencida»** (`BadgeEstatus t={t}`) con el texto «No se autorizó antes de la fecha», en lugar de «En autorización» o «Devuelta».
- *Por autorizar* (Aut. 1 y Aut. 2): las vencidas salen de la lista principal y de los contadores (`useBandeja`, `usePorAutorizar`) y van en la pestaña **«Vencidas»**, solo consulta (sin Autorizar ni Devolver).
  Las pendientes que vencen **hoy** llevan la etiqueta **«Vence hoy»** y salen primero.
- *Mis solicitudes*: pestaña **«Vencidas»** (cada solicitud va en una sola pestaña, la de su estatus visible); botón **«Duplicar con otra fecha»** (`duplicarComoBorrador`: copia empleados con su horario y transporte,
  motivos, tipo y comentario en un borrador nuevo con la fecha elegida, de hoy en adelante) y, si era borrador, **Eliminar**.
- *Inicio* de todos los roles: los contadores (en borrador, en autorización, devueltas, nivel 1 y 2, solicitudes de la semana) **excluyen** las vencidas.
- *Consulta* (también Nóminas): filtro de estatus con **«Vencida»**; el Excel de la consulta las agrupa como «Vencida».

**Bloqueo.** No se autoriza ni se devuelve una vencida: botones ocultos, validación **dentro de la transacción** (`autorizarSolicitud` / `devolverSolicitud`: «Esta solicitud ya venció») **y en las reglas de Firestore**
(`pasoElDia(fechaTE)`: `request.time - 6 h >= timestamp.date(año, mes, día) + 1 día`, en las cuatro transiciones de autorizar y devolver; cabe holgadamente en el límite de 1000 expresiones). Cancelar sigue permitido.
Pruebas: `tests/firestore.rules.vencidas.test.js`. (Las demás pruebas de reglas usan fechas de 2099 para no vencer nunca.)

**Autorizada que ya pasó de fecha sin enviarse** (*Por enviar al proveedor*): sale aparte, en **«Fecha pasada – transporte no enviado»**, con **«Cerrar sin transporte»** (una o todas):
`cerrarSinTransporte` pasa la solicitud a `procesada` **sin generar solicitud de transporte**, con `cerradaSinTransporte: true`, su renglón de historial (`recibida_rh`) y de bitácora (`cerrar_sin_transporte`), todo en una
transacción. Solo con la fecha ya pasada (la regla lo comprueba) y solo RH, admin y Nóminas. **Sus horas siguen contando para nómina**, porque sí se autorizó.

**Reportes de nómina.** Las vencidas **no cuentan** en el formato. Un aviso dice «X solicitudes de esta semana vencieron sin autorizarse» con enlace a la consulta filtrada por «Vencida», para que Nóminas decida si
agrega a alguien a mano en la revisión. Pruebas: `tests/vencidas-te.test.js` (vence a medianoche, vence hoy, devuelta vencida, borrador vencido, autorizada sin enviar con fecha pasada, contadores y nómina).

## Revisión de nómina (pantalla completa)

**Dónde:** *Reportes de nómina › Revisar* en la tarjeta de un área abre `/nomina/semana/:anioSemana/:areaId` (`:anioSemana` es la clave del periodo: `2026-42`, o `r20261019-20261023` en un rango libre);
«← Volver a la semana» regresa a la misma semana. Solo Nóminas, RH y admin (capacidad `reportesNomina`).

**La hoja.** Una tabla con encabezado fijo y columnas # / Nómina / Nombre fijas al desplazar de lado; el nombre va en un renglón (como en el padrón, con recorte y el nombre completo al pasar el mouse); buscador por
nombre o nómina; total abajo. Cada día es un campo numérico que se edita directo (medios y cuartos; vacío = sin horas): **Enter** baja, **Mayús+Enter** sube, **↑ ↓** cambian de renglón, **← →** de día,
**Tab** avanza y **Esc** deja el valor. Una celda cambiada se pinta con color suave y al pasar el mouse dice «Autorizado: 9 h». El menú **⋯** de cada renglón: *Reemplazar por otro empleado*, *Cambiar motivo y P.O./TB*,
*Restaurar lo autorizado* y *Quitar (no asistió)*. La barra de abajo, siempre a la vista, trae el estado, empleados, horas, «X cambios sin guardar», *Guardar cambios*, *Marcar como firmada* y *Descargar*.

**Guardar.** Los cambios se acumulan como borrador (en la pantalla) y se guardan **juntos**: *Guardar cambios* pide **un solo motivo** (3 a 120 letras) para todo ese guardado. En `ajustesNomina` cada cambio
queda con ese motivo y la bitácora (`ajustar_nomina`) guarda un renglón con el motivo, el total y el detalle (hasta 80 cambios: tipo, nómina, día, antes y después). Con cambios sin guardar, salir de la
pantalla o cerrar la pestaña avisa; *Marcar como firmada* y *Descargar* piden guardar primero. No se guarda un empleado agregado sin horas ni el mismo empleado dos veces en el área.

**Agregar empleado.** *+ Agregar empleado* busca en el padrón activo (primero los del área); si es de otra área avisa «Es de <área>, ¿agregarlo aquí?». Si no está en el padrón se captura nómina (solo números) y nombre
a mano, con el aviso «No está en el padrón». El renglón sale con la etiqueta «Agregado», horas por día editables y su motivo (del catálogo, con P.O./TB si aplica). **Solo vive en `ajustesNomina`**
(cambio tipo `agregar`, `clave` `+nómina`): no crea ni modifica solicitudes de tiempo extra, y sale en el Excel y en la hoja Resumen como cualquier otro renglón.

**Reglas y pruebas.** `ajustesNomina` admite hasta 1000 cambios y 300 renglones; las reglas no recorren listas, así que «no repetir empleado» y «agregado con horas» los valida la pantalla. Nóminas no puede escribir
`tiempoExtra`. Pruebas: `tests/revision-nomina.test.js` y `tests/firestore.rules.ajustes-nomina.test.js`.

## Tiempo extra que cruza la medianoche

**Regla:** si la hora de fin es menor o igual a la de inicio, el tiempo extra termina **al día siguiente** (22:00 → 7:00 = 9 h; 16:00 → 0:00 = 8 h). Las horas (`calcularHoras`) son siempre positivas; 7:00 → 7:00
serían 24 h, por eso **la entrada y la salida no pueden ser la misma hora** («La entrada y la salida no pueden ser la misma hora»). **No hay tope de duración**: `duracionMaximaHoras` en
`src/funciones.js` (null = sin límite) queda por si después hay que ponerlo; con un número, la captura rechaza lo que dure más y la extensión no ofrece salidas que lo pasen. 12:00 a. m. como

**Cómo se ve:** «Termina: miércoles 21 oct, 7:00 a. m. (día siguiente)» (`textoTermina`) en la fila de cada empleado al capturar, en el detalle (tabla y tarjetas) y en una columna «Termina» de los Excel de consulta y de
horas para RH. Las listas (bandejas, consulta, mis solicitudes) llevan la insignia «Termina al día siguiente» cuando alguien termina después de las 12:00 a. m. (el fin justo a medianoche, el turno 2 normal, no la lleva).

**Transporte:** cada pasajero guarda `fechaLlegada` (día de inicio), `fechaSalida` y `turnoSalida`. La LLEGADA va el día de inicio; la SALIDA, el día en que termina (el siguiente si cruza). Un pasajero que viene y
se va otro día sale en **dos hojas** del Formato de rutas: la llegada el día del servicio (SALIDA «NO REQUIERE») y la salida al día siguiente (ENTRADA «YA EN PLANTA») en el turno que termina a esa hora (7:00 a. m. → turno 3).
Una extensión que termina de madrugada solo sale al día siguiente. **Excepción:** el fin justo a las 12:00 a. m. (16:00 → 0:00) sigue en el servicio del día que empezó, como siempre (si no, todo el turno 2 se partiría).
La solicitud de transporte guarda `conteoFechas` ({ día: viajes }): el Formato de rutas busca desde el día anterior y cada fecha (Hoy, Mañana, una fecha o un rango) muestra y baja solo los viajes de esos días. Al
confirmar, el aviso dice que las salidas de otro día van en el formato de ese día. Los pasajeros anteriores (sin esas fechas) no cambian.

**Nómina:** `horasNominaPor` en `src/funciones.js`: `'inicio'` (por defecto) cuenta todas las horas en el día y la semana en que EMPIEZA (23:00 del domingo a 7:00 del lunes = 8 h del domingo); `'dividir'` las reparte por
día calendario (1 h del domingo y 7 h del lunes, que va en la semana siguiente; esa semana también trae lo que empezó el domingo). Solo cambia el formato de nómina: las solicitudes no se tocan.
Pruebas: `tests/medianoche-te.test.js` (los cinco casos en horas, validación, transporte y nómina).

## Ajustes de uso (tipo, rutas, extensión de turno, descargas, ayudas)

- **Estatus**: una sola etiqueta por estatus en todas las pantallas y Excel (`ESTATUS_TE_MAP` / `etiquetaEstatusTE`): Borrador · En autorización (nivel 1) · En autorización (nivel 2) · Devuelta · Autorizada · Confirmada por RH · Cancelada.
  Había un error de orden en el mapa (el estilo de "Cancelada" pisaba la etiqueta de Borrador). La prueba recorre todos los estatus.
- **Dos descargas distintas**: *Descargar resumen de horas extra* (nómina y comedor: TODOS los empleados con TE autorizado o confirmado, lleven transporte o no) y
  *Formato de rutas (proveedor)* en "Todas las solicitudes" (solo quienes llevan transporte). Cada botón lleva su línea de ayuda; "Exportar consulta" (Consulta) es la lista filtrada en pantalla.
- **Rutas distintas** (control de costo): se cuentan las rutas distintas de los empleados que llevan transporte (llegada o salida) y se muestran en vivo ("Esta solicitud usa 3 rutas: LA LIRA (2), …"). Con más de una,
  la justificación (`justificacionRutas`, 15+ caracteres) es obligatoria para enviar (también en las reglas). Se guardan `rutasDistintas`, `desgloseRutas` [{ rutaId, nombre, empleados, llegada, salida }] y `justificacionRutas`.
  Insignia ámbar "N rutas" en bandejas, consulta, recepción y Mis solicitudes; el detalle muestra la justificación y el desglose. El selector de empleados tiene columna y filtro de Ruta (la del padrón).
- **Tipo de tiempo extra** (`tipo`): `turno_extra` (el empleado viene a la planta) o `extension` (ya está en la planta). Una **extensión**: empieza al terminar su turno normal (`horaEntrada` = fin de su turno, que quien captura elige a mano; ya no hay turno fijo por empleado. Antes salía de *Estructura > Turnos* según su
  turno de nómina), se elige hasta qué hora se queda (los bloques de salida posteriores: 16:00 → 19:00, 0:00, 7:00), las horas cuentan desde ese fin de turno (16:00 → 19:00 = 3 h) y puede
  capturarse para el mismo día. Insignia "Extensión de turno".
- **Transporte por sentido**: cada empleado tiene `transporteLlegada` y `transporteSalida` (`requiereTransporte` = alguno de los dos). Turno extra: los dos marcados por defecto; extensión: solo salida (la llegada, apagada y deshabilitada: "Ya se
  encuentra en la planta"; las reglas rechazan `transporteLlegada: true` en una extensión). Los documentos anteriores valen para los dos sentidos.
- **Excel del proveedor, extensión**: el pasajero con solo salida va en la hoja de su turno normal (el turno que termina a la hora de su fin de turno: 16:00 → Turno 1, 0:00 y 19:00 → Turno 2, 7:00 → Turno 3), con ENTRADA = "YA EN PLANTA" y
  SALIDA = su hora extendida ("7:00PM"). Un turno extra con solo llegada lleva SALIDA = "NO REQUIERE". El pasajero guarda `sentido` (ambos | llegada | salida).
- **Horas**: en la app se muestran en 12 horas ("7:00 a. m.", "4:00 p. m.", "12:00 a. m."; `src/utils/horas.js`), pero se guardan igual que siempre ("7:00", "16:00" en tiempo extra; "4:00PM" en los pasajeros). El **Excel del proveedor** (ENTRADA y SALIDA) va en 24 horas con dos dígitos ("07:00", "16:00"; "YA EN PLANTA" y "NO REQUIERE" no cambian): si el proveedor pide otro formato, se cambia la constante `FORMATO_HORA_PROVEEDOR` de `horas.js` (`'12h'` devuelve "4:00PM"). Los demás Excel (resumen para RH y consulta) conservan las horas como están guardadas.
- **Teléfono para el transporte**: en la captura, cada empleado con transporte muestra su teléfono del padrón (`empleadosContacto`), se puede capturar o corregir y se guarda en el padrón al guardar o enviar; sin teléfono es solo un aviso. Solo lo ven RH y el solicitante del área (ver `docs/seguridad.md`, S-25). No se guarda en la solicitud de tiempo extra ni en sus empleados; el detalle de la solicitud de transporte (RH) y la columna `TELÉFONO` del Excel del proveedor lo leen del padrón.
- **Turnos de nómina** (solo de referencia, ya no alimentan la captura; `turnosNomina/{A|B|C}`: entrada y salida en los bloques 7:00, 16:00, 19:00 y 0:00): RH los captura en *Estructura > Turnos*; empiezan vacíos. Los lee cualquier usuario activo; los escribe RH/admin.
- **Mi cuenta** (`/mi-cuenta`, todos; junta lo que eran Perfil y Configuración): datos, contraseña, ayudas sí/no, tamaño de letra (Normal/Grande) y tema (Claro/Oscuro/Automático), guardados en `usuarios/{uid}.preferencias` (las reglas dejan a cada usuario cambiar solo ese campo de su propio documento).
  Con las ayudas activas: texto corto bajo los campos, "?" junto a los títulos (explicación de 3 o 4 pasos) y recorrido guiado la primera vez en *Solicitar tiempo extra* y *Por autorizar* (`preferencias.recorridosVistos`; se puede repetir desde el "?").
  **Todos los textos de ayuda están en `src/utils/ayudas.js`.**

### Contador de folios

`contadores/te-AAAA` solo se puede subir de uno en uno y **únicamente dentro del lote o transacción en que una solicitud propia pasa de borrador a pendiente con ese folio**: el documento del
contador lleva `solicitudId` y la regla compara con `get` (antes: borrador) y `getAfter` (después: pendiente, con el folio igual al número nuevo). Subirlo aislado falla.

## Modelo de datos

### `tiempoExtra/{id}` — id propio del borrador (`BR-…`); el **folio** (`TE-2026-0001`) es un campo que se asigna al enviar

```
folio                 'TE-2026-0001' (se asigna al enviar; no existe en un borrador)
areaId, areaNombre
creadoPor (uid), creadoPorNomina, creadoPorNombre
fechaTE ('AAAA-MM-DD'), motivo (nombre del primero), motivos [{ motivoId, nombre, numero, comentario, detalle, tipoNumero }], estatus
   (solicitudes anteriores: solo motivo y, con «Otro», motivoOtro)
resumen: { totalEmpleados, totalHoras, totalTransporte, totalAlimentos }
aut1, aut2:  { nomina, nombre, fecha, comentario }      ← se llenan al firmar
devolucion:  { nivel (1|2|3), nomina, nombre, motivo, fecha }   ← nivel 3 = RH en la recepción
recibidaPor:  { nomina, nombre, fecha }, fechaRecepcion, solicitudTransporteId   ← los pone RH al recibir (sin solicitudTransporteId si nadie pidió transporte)
motivoCancelacion, canceladaPor { nomina, nombre, fecha, comoRH }               ← al cancelar
fechaCreacion, fechaActualizacion   ← serverTimestamp()
```

- **Folio**: contador en `contadores/te-AAAA` (`{ ultimo }`), incrementado **de uno en uno dentro de la transacción de envío** (las reglas exigen `ultimo == anterior + 1`, o `1` al crear,
  y que el folio sea ese número). Ver `enviarSolicitud` en `src/utils/tiempoExtraDb.js`.

### `tiempoExtra/{id}/empleados/{nómina}`

`nombre, puesto, horaInicio, horaFin, horas, requiereTransporte, ruta/comunidad/punto` (los mismos campos
que los pasajeros de rutas) `, requiereAlimentos, motivoIndex` (a cuál de los `motivos` de la solicitud corresponde; 0 por defecto).

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
| autorizada | procesada | RH/admin (con su solicitud de transporte en la misma operación) |
| autorizada | devuelta | RH/admin, con motivo de 10+ (nivel 3) |
| autorizada, procesada | cancelada | RH/admin, con motivo de 10+ (cancela también su transporte) |
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
- Un solicitante de un área sin participaTE (Administrativo) no se puede asignar: una persona de Administrativo que hoy pide rutas necesita
  decisión de RH (la migración las lista como "por decidir").

## Pruebas

- `npm run test:rules` — reglas (rutas/usuarios, estructura, tiempo extra y asignaciones) contra el emulador de Firestore; requiere Java 11+.
- `npm run test:unit` — importación, puestos, asignaciones, organigrama y migración (sin emulador).
- `npm run prueba:humo` — pruebas de humo de utilidades.

## Preparar para producción (lista para la herramienta futura)

Todavía **no se borra nada de Firebase**. Esta es la lista de lo que la herramienta «Preparar para producción» deberá revisar, respaldar y limpiar antes del piloto real:

**Colecciones sin código ni reglas (borrar de la consola si existen)**
- `areasTE`, `config/areasTE`, `config/tiempoExtra`, `accesosTE` — la estructura anterior; nadie las lee ni escribe.
- `PuntosReunion` (con mayúscula) — legado; solo la toca *Herramientas > Diagnóstico* (RH). Confirmar que está vacía y quitar su regla.

**Campos viejos que ya nadie lee**
- `empleados.areaTE`, `empleados.areaTEManual` — se quitan con *Herramientas > Limpiar estructura vieja* (respaldo JSON antes).
- `asignaciones.posicion` (Titular / Por ausencia) — se eliminó de la app; las reglas ya rechazan escribirlo.
- `usuarios.rol` = `superintendente` / `autorizador` (se corrigen a `usuario` al guardar el usuario) y, si existiera, `usuarios.areaIds`.
- `solicitudes` de la época manual: `puesto`, `turno` y `vistoPorSolicitante`, y `fechaSolicitud` como texto ISO en lugar de Timestamp (el código acepta los dos).

**Datos de prueba que no deben llegar a producción**
- `tiempoExtra` (con sus `empleados` e `historial`), `solicitudes` (con `pasajeros`) y `bitacora` creados durante las pruebas.
- `contadores/te-AAAA`: reiniciar el folio si se borran los tiempos extra de prueba.
- Usuarios, asignaciones y empleados de prueba.

## Recordatorios de "a quién avisar"

Mientras no haya avisos por correo, la pantalla recuerda a quién avisar (solo el mensaje: sin botones de envío). El aviso **no se cierra solo**; la persona lo cierra.
Los textos están en `AVISOS` de `src/utils/ayudas.js` y la lógica en `src/utils/avisos.js` (pruebas en `tests/avisos.test.js`).

| Paso | Aviso | A quién |
|---|---|---|
| Enviar o reenviar | "Tu solicitud TE-… se envió a Autorización 1/2…" | Aut. 1 vigentes del área, o Aut. 2 vigentes si va directo al nivel 2 |
| Aut. 1 autoriza | "Autorizaste TE-… y pasó a Autorización 2…" | Aut. 2 vigentes |
| Aut. 2 autoriza | "Listo. Recursos Humanos ya la tiene en 'Por enviar al proveedor'." | — |
| Alguien devuelve (incluye RH en recepción) | "Recuerda avisarle a [solicitante]…" | Quien la capturó |
| Mis solicitudes (pendientes) | "Pendiente con: … · en espera desde hace N días" | Los mismos destinatarios del nivel en que está |

Los nombres salen **solo de las asignaciones vigentes** (nombre y puesto copiados del padrón), en formato de nombre de pila; no se leen usuarios.
Los Aut. 2 van del nivel jerárquico más alto al más bajo; quien actúa no aparece en su propio aviso. Si no hay nadie vigente, el aviso manda a avisar a RH.
Regla nueva: el solicitante puede leer las asignaciones de **Aut. 1 de su área** (consulta con `areaId` y `rol == 'aut1'`); las de Aut. 2 ya eran legibles.
