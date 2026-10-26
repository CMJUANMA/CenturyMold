# Permisos: quién ve y hace qué

Dos capas que **se suman** (unión):

- **Rol del sistema** (`usuarios/{uid}.rol`: `admin`, `rh`, `nomina`, `usuario`): acceso a las pantallas de administración y RH (`admin`, `rh`) o al panel de Nóminas (`nomina`).
- **Roles operativos** (Aut. 2, Aut. 1, Solicitante): capturar y autorizar. Se dan en *Usuarios y accesos › Asignaciones*, por nómina, con vigencia.

Una cuenta con rol del sistema `usuario` y una asignación de Aut. 2 solo ve lo de Aut. 2: **no ve nada de RH**. Si esa persona también es de RH, hay que cambiarle el rol del sistema a RH
(Usuarios › editar). RH, Aut. 2 vigente y admin pueden dar o quitar el rol RH y el rol Nóminas, con confirmación y registro en la bitácora; nadie cambia su propio rol ni se da Nóminas a sí mismo (tampoco el admin); Administrador solo lo da y lo quita un admin. A un RH o a Nóminas que no es admin solo se le cambia el rol (no su nombre ni su estado). **Restablecer contraseña:** el admin a cualquiera menos a sí mismo; RH y Aut. 2 vigente a usuarios con rol `usuario` **y a Nóminas**, nunca a un RH ni a un admin. *RH + Aut. 2* ve lo de ambos; *admin + Aut. 1* ve el menú de admin y además firma el nivel 1 de su área.

## Nóminas (rol del sistema `nomina`, p. ej. Alma Granados)

Para quien hace la nómina y manda las solicitudes de transporte al proveedor cuando RH no está. **Ve y descarga; no autoriza ni administra.**

- **Ve:** todo el tiempo extra de **todas** las áreas en cualquier estatus **excepto borradores**, con su detalle e historial (menú *Tiempo extra*, con filtros de fecha, área, estatus y turno); *Solicitudes de transporte*; *Formato de rutas*; *Personal* (padrón) y *Estructura* en solo lectura, incluido el **teléfono** (lo manda al proveedor).
- **Hace:** el paso *Por enviar al proveedor* (confirmar un tiempo extra autorizado y generar su solicitud de transporte) y descarga todos los Excel que ya existen (resumen de horas extra, consulta, Formato de rutas, padrón). Todo queda en la bitácora con su nombre.
- **No puede:** crear, autorizar, devolver, editar ni cancelar tiempo extra; administrar usuarios, contraseñas, roles, asignaciones, catálogos ni estructura; ver la bitácora completa ni Herramientas.
- **Con una asignación** (p. ej. solicitante de un área) conserva además esos permisos: su menú los suma debajo de Inicio.
- **Reglas de Firestore:** lectura de la planta; la única escritura sobre tiempo extra es *autorizada → procesada* con exactamente los campos `estatus, recibidaPor, fechaRecepcion, solicitudTransporteId, fechaActualizacion`, la solicitud de transporte de ese tiempo extra (con sus pasajeros) creada en la misma operación, su renglón de historial y de bitácora; o, con la fecha ya pasada, «cerrar sin transporte» (a procesada sin solicitud de transporte, con `cerradaSinTransporte`). **Bitácora:** solo escribe los tipos que corresponden a sus acciones reales, siempre con su propio uid y nombre: las descargas (`descargar_padron`, `descargar_resumen_te`, `descargar_consulta_te`, `descargar_formato_rutas`, `descargar_formato_te_nomina`), `recibir` (confirmar el envío al proveedor), `cerrar_sin_transporte` y, sobre `ajustesNomina/…`, `ajustar_nomina`, `deshacer_ajustes_nomina` y `firmar_nomina`. No puede escribir el respaldo completo ni ningún otro tipo. Pruebas: `tests/firestore.rules.nomina.test.js` y `tests/firestore.rules.ajustes-nomina.test.js`.

### Reportes de nómina (Nóminas, RH y admin)

Pantalla *Reportes de nómina › Formato de tiempo extra* (`/nomina/reportes`): el **FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA** semanal por área, ya lleno, para recoger las firmas.

- **Semana ISO 8601** (lunes a domingo, «Semana 43 · 19–25 oct 2026»); por defecto la última semana completa, con flechas y rango libre de hasta 7 días.
- **Qué cuenta:** solo lo autorizado por Aut. 2 (`autorizada` o `procesada`). Las pendientes y devueltas de esa semana solo se avisan (cuántas y de qué áreas).
- **Ajustes** (corregir las horas de un día, quitar a quien no asistió, reemplazarlo por otra persona del padrón, agregar a alguien que no venía en las solicitudes o corregir el motivo y el P.O./TB de un renglón): se acumulan en la pantalla de revisión y se guardan juntos con **un solo motivo** para todo el guardado; quedan aparte en `ajustesNomina/{año-semana}_{areaId}` (cada cambio con ese motivo) y **nunca modifican ni crean solicitudes**. «Deshacer ajustes» vuelve a lo autorizado.
- **Marcar como firmada** bloquea el área y la semana; solo RH y admin pueden reabrirla (las reglas lo exigen). Todo queda en la bitácora.
- **Reglas de Firestore:** `ajustesNomina` lo leen y lo escriben solo Nóminas, RH y admin (hasta 1000 cambios y 300 renglones por documento); nadie lo borra; firmada = bloqueada. **Excepción:** un Aut. 2 vigente puede LEER un documento por su id (`get`, nunca listar ni escribir) para que, antes de autorizar una vencida fuera de tiempo, la pantalla le avise si esa área y semana ya están firmadas. Pruebas: `tests/firestore.rules.ajustes-nomina.test.js` y `tests/firestore.rules.fuera-de-tiempo.test.js`.
- **Excel:** réplica del formato en papel (carta horizontal, una hoja por área; con más de 15 empleados continúa en otra página). «Descargar todas las áreas» agrega una primera hoja *Resumen* (horas por área, por empleado y por motivo con su porcentaje, y por número de P.O./TB). Las constantes del formato (casillas de área, mapeo de áreas de la app, firmas, notas y pie `CM-FRH-??` / `REV-00` / `Fecha de Rev: 28 Oct 2021`) están en `src/utils/formatoNomina.js`. La columna *P.O./TB* lleva el número de cada empleado.

## La matriz

✔ = lo ve o puede; — = no. «Sin rol» = rol del sistema `usuario` sin asignaciones (solo Inicio, Mi cuenta y cambiar contraseña).
La tabla se **genera** desde `src/utils/permisos.js` (`npm run docs:permisos`); una prueba falla si se desfasa. No la edites a mano.

<!-- MATRIZ:INICIO -->
| Pantalla / acción | Admin | RH | Nóminas | Aut. 2 | Aut. 1 | Solicitante | Sin rol |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Inicio y cuenta** ||||||||
| Pantalla: Inicio (RH y admin: indicadores; los demás: su panel por rol) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pantalla: Mi cuenta (datos, ayudas, letra, tema, contraseña) _(Se entra por el pie del menú)_ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Botón: Cambiar su propia contraseña y sus preferencias | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Tiempo extra** ||||||||
| Pantalla: Solicitar tiempo extra | ✔ | ✔ | — | ✔ | ✔ | ✔ | — |
| Pantalla: Mis solicitudes | ✔ | ✔ | — | ✔ | ✔ | ✔ | — |
| Pantalla: Por autorizar | ✔ | ✔ | — | ✔ | ✔ | — | — |
| Pantalla: Todas las solicitudes (solo lectura; RH además cancela; para Nóminas es «Tiempo extra», con filtro de turno) | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Pantalla: Por enviar al proveedor (Nóminas solo confirma; RH además devuelve y cancela) | ✔ | ✔ | ✔ | — | — | — | — |
| Acción: Capturar y enviar tiempo extra de un área que participa _(Solo en sus áreas. RH no captura en áreas que participan)_ | — | — | — | — | ✔ | ✔ | — |
| Acción: Capturar tiempo extra de un área que no participa (Administrativo) _(RH la deja en nivel 2 (la firma un Aut. 2 u otra persona de RH); la Aut. 2 la deja autorizada al enviarla)_ | ✔ | ✔ | — | ✔ | — | — | — |
| Acción: Lo que captura y envía queda autorizado al enviarlo (firma de nivel 2 «Capturada y autorizada por Aut. 2») _(Solo la Aut. 2 vigente, en cualquier área donde pueda capturar. El Aut. 1 y RH no autorizan lo suyo)_ | — | — | — | ✔ | — | — | — |
| Acción: Autorizar o devolver, nivel 1 _(Solo lo de su área; no lo que él mismo creó)_ | — | — | — | — | ✔ | — | — |
| Acción: Autorizar o devolver, nivel 2 _(RH firma «como RH»; no lo que él mismo creó)_ | ✔ | ✔ | — | ✔ | — | — | — |
| Acción: Autorizar fuera de tiempo una solicitud vencida (que estaba en nivel 1 o 2) _(Solo la Aut. 2 vigente, con un motivo de 10+ caracteres y no lo que ella misma creó. RH sin Aut. 2, Aut. 1, solicitante y Nóminas no. Las borradores y devueltas vencidas no: se duplican con otra fecha)_ | — | — | — | ✔ | — | — | — |
| Botón: Confirmar y generar la solicitud de transporte (Por enviar al proveedor) _(Queda en la bitácora con el nombre de quien confirma)_ | ✔ | ✔ | ✔ | — | — | — | — |
| Botón: Devolver un tiempo extra autorizado (nivel 3) | ✔ | ✔ | — | — | — | — | — |
| Botón: Cancelar un tiempo extra autorizado o confirmado | ✔ | ✔ | — | — | — | — | — |
| Botón: Descargar Formato de rutas y resumen de horas extra | ✔ | ✔ | ✔ | — | — | — | — |
| Botón: Exportar «Todas las solicitudes» a Excel | ✔ | ✔ | ✔ | ✔ | — | — | — |
| **Transporte** ||||||||
| Pantalla: Solicitudes de transporte (Nóminas: solo ve y descarga) | ✔ | ✔ | ✔ | — | — | — | — |
| Pantalla: Formato de rutas (Excel para el proveedor) | ✔ | ✔ | ✔ | — | — | — | — |
| Pantalla: Catálogos (rutas, comunidades, puntos de reunión y, en la pestaña Motivos, los motivos del tiempo extra: agregar, editar, ordenar y desactivar) | ✔ | ✔ | — | — | — | — | — |
| **Reportes de nómina** ||||||||
| Pantalla: Reportes de nómina: formato de autorización de tiempo extra por área y semana | ✔ | ✔ | ✔ | — | — | — | — |
| Pantalla: Revisar un área de la semana (pantalla completa, edición como hoja de cálculo) _(Se entra por «Revisar» en la tarjeta del área)_ | ✔ | ✔ | ✔ | — | — | — | — |
| Acción: Ajustar el formato (corregir horas, quitar, reemplazar, agregar un empleado que no venía en las solicitudes o corregir el motivo y P.O./TB de un renglón) y marcarlo como firmado; los cambios no tocan las solicitudes _(Los cambios se guardan juntos con un solo motivo, que queda en la bitácora)_ | ✔ | ✔ | ✔ | — | — | — | — |
| Botón: Reabrir un área firmada | ✔ | ✔ | — | — | — | — | — |
| Botón: Descargar el formato en Excel (un área o todas, con su hoja Resumen) | ✔ | ✔ | ✔ | — | — | — | — |
| **Personal y estructura** ||||||||
| Pantalla: Padrón de empleados (Nóminas: «Personal», solo lectura, con teléfono) | ✔ | ✔ | ✔ | — | — | — | — |
| Pantalla: Estructura (áreas, puestos, turnos; Nóminas: solo lectura) | ✔ | ✔ | ✔ | — | — | — | — |
| Pantalla: Usuarios y accesos (cada quien ve solo las pestañas que le tocan) _(En el menú de RH es un ítem; los demás entran por su pestaña)_ | ✔ | ✔ | — | ✔ | ✔ | — | — |
| Pantalla: Usuarios y accesos › Usuarios | ✔ | ✔ | — | ✔ | — | — | — |
| Pantalla: Usuarios y accesos › Asignaciones («Asignar roles» en el menú de Aut. 2) | ✔ | ✔ | — | ✔ | — | — | — |
| Pantalla: Organigrama («Mi área» para Aut. 1: solo su área) | ✔ | ✔ | — | ✔ | ✔ | — | — |
| Botón: Padrón: exportar a Excel (respaldo) | ✔ | ✔ | ✔ | — | — | — | — |
| Acción: Padrón: alta, edición, baja, importación y respaldo | ✔ | ✔ | — | — | — | — | — |
| Acción: Estructura y catálogos: crear y editar áreas, puestos, turnos, rutas y puntos | ✔ | ✔ | — | — | — | — | — |
| Botón: Estructura inicial y limpieza de estructura vieja | ✔ | — | — | — | — | — | — |
| **Herramientas (admin)** ||||||||
| Pantalla: Herramientas › Diagnóstico y limpieza | ✔ | — | — | — | — | — | — |
| Pantalla: Herramientas › Vista previa por rol _(Dentro de Herramientas)_ | ✔ | — | — | — | — | — | — |
| Botón: Herramientas › Respaldo completo (JSON) | ✔ | — | — | — | — | — | — |
| Pantalla: Guía de estilo | ✔ | — | — | — | — | — | — |
| **Usuarios y accesos** ||||||||
| Botón: Nuevo usuario / Crear usuarios en lote (rol «usuario») | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Editar, activar o desactivar usuarios con rol «usuario» _(Nadie edita su propio usuario (salvo admin))_ | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Dar o quitar el rol del sistema RH (con confirmación y bitácora) _(Nadie cambia su propio rol. A un RH solo se le cambia el rol (nombre y estado, solo el admin))_ | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Dar o quitar el rol del sistema Nóminas (con confirmación y bitácora) _(Nadie se lo da a sí mismo. A quien ya es Nóminas solo se le cambia el rol)_ | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Dar o quitar el rol del sistema Administrador | ✔ | — | — | — | — | — | — |
| Botón: Restablecer contraseña (RH y Aut. 2: a usuarios y a Nóminas; admin: a cualquiera menos a sí mismo) _(Contraseña temporal que se muestra una sola vez; nadie la restablece a sí mismo)_ | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Asignar, extender o revocar Aut. 1 y Solicitante _(Nadie, salvo admin, se asigna a sí mismo. Solo en áreas que participan)_ | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Asignar, extender o revocar Aut. 2 | ✔ | — | — | — | — | — | — |
| Botón: Ver el historial de una persona en el organigrama | ✔ | ✔ | — | ✔ | — | — | — |
| Botón: Cargar asignaciones iniciales / Actualizar nombres y puestos | ✔ | — | — | — | — | — | — |
<!-- MATRIZ:FIN -->

## Cómo se garantiza

- `src/utils/permisos.js` es la fuente única: `App.jsx` arma sus rutas desde `RUTAS_PROTEGIDAS` y el guardia `RutaPuede` usa `CAPACIDADES`; la pantalla de Usuarios y accesos saca sus pestañas de ahí.
- `tests/permisos.test.js`: una prueba por rol y por combinación (RH + Aut. 2, admin + Aut. 1, etc.) que revisa menú, rutas permitidas y acciones contra la matriz, con lo esperado escrito a mano.
- `firestore.rules` es la barrera real; sus pruebas están en `tests/firestore.rules*.test.js`.
- Admin: *Herramientas › Vista previa por rol* dibuja el menú, el Inicio y las pantallas de cualquier combinación, sin cambiar su sesión ni leer datos.

## Quién autoriza lo que captura

- **Aut. 2 vigente:** autoriza lo que él mismo captura. Al enviar (de cualquier área donde pueda capturar, incluida Administrativo) la solicitud queda **autorizada** en el mismo paso, con su firma de nivel 2
  (nombre, fecha y el comentario «Capturada y autorizada por Aut. 2»); el historial dice «Capturada y autorizada por Aut. 2 (nivel 2)» y pasa directo a *Por enviar al proveedor*. La pantalla avisa antes de enviar:
  «Como eres Autorización 2, al enviarla quedará autorizada».
- **Aut. 1:** no autoriza lo suyo; su solicitud se salta el nivel 1 y va al nivel 2.
- **RH sin ser Aut. 2:** su captura (solo áreas que no participan) va a *pendiente_aut2* y la firma un Aut. 2 u otra persona de RH distinta (nadie firma lo que creó).
- Un Aut. 2 sin ser solicitante ni Aut. 1 de un área solo captura en áreas que no participan (Administrativo); en las demás áreas necesita su asignación de solicitante o Aut. 1.

## Autorizar fuera de tiempo (solo Aut. 2)

- **Quién:** únicamente un **Aut. 2 vigente** (`esAut2()` en las reglas). **No pueden** el Aut. 1, el solicitante, Nóminas, ni RH/admin sin asignación de Aut. 2, ni un Aut. 2 cuya asignación ya venció. Nadie autoriza lo que creó.
- **Qué:** una solicitud **vencida** que estaba en `pendiente_aut1` o `pendiente_aut2` pasa a `autorizada` con `autorizadaFueraDeTiempo: true` y `fueraDeTiempo { nomina, nombre, fecha, motivo, estatusAnterior }`. Motivo obligatorio de 10 a 500 caracteres. Desde nivel 1 también queda la firma de nivel 1 con «Autorizada por Aut. 2 sin Aut. 1, fuera de tiempo». Las borradores y devueltas vencidas **no** (se duplican con otra fecha).
- **Reglas:** la transición es la contraria a las de autorizar normales (`pasoElDia` debe ser verdadero), con campos exactos (`soloCambia`), firma y `fueraDeTiempo` a nombre de quien la hace y con la hora del servidor. Historial `autorizada_fuera_de_tiempo` (solo Aut. 2). **Bitácora:** `autorizar_fuera_de_tiempo` sobre `tiempoExtra` (la Aut. 2 solo puede escribir ese tipo; la bitácora la lee RH). Pruebas: `tests/firestore.rules.fuera-de-tiempo.test.js` (lo que sí y lo que no: Aut. 1, solicitante, RH sin Aut. 2 y Nóminas no pueden).
## Pendiente de decisión

- Los botones de borrar solicitudes y tiempos extra (`delete` solo admin en las reglas) no existen en la pantalla.
