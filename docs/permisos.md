# Permisos: quién ve y hace qué

Dos capas que **se suman** (unión):

- **Rol del sistema** (`usuarios/{uid}.rol`: `admin`, `rh`, `usuario`): acceso a las pantallas de administración y RH.
- **Roles operativos** (Aut. 2, Aut. 1, Solicitante): capturar y autorizar. Se dan en *Usuarios y accesos › Asignaciones*, por nómina, con vigencia.

Una cuenta con rol del sistema `usuario` y una asignación de Aut. 2 solo ve lo de Aut. 2: **no ve nada de RH**. Si esa persona también es de RH, hay que cambiarle el rol del sistema a RH
(Usuarios › editar). RH, Aut. 2 vigente y admin pueden dar o quitar el rol RH, con confirmación y registro en la bitácora; nadie cambia su propio rol; Administrador solo lo da y lo quita un admin. A un RH que no es admin solo se le cambia el rol (no su nombre ni su estado). *RH + Aut. 2* ve lo de ambos; *admin + Aut. 1* ve el menú de admin y además firma el nivel 1 de su área.

## La matriz

✔ = lo ve o puede; — = no. «Sin rol» = rol del sistema `usuario` sin asignaciones (solo Inicio, Mi cuenta y cambiar contraseña).
La tabla se **genera** desde `src/utils/permisos.js` (`npm run docs:permisos`); una prueba falla si se desfasa. No la edites a mano.

<!-- MATRIZ:INICIO -->
| Pantalla / acción | Admin | RH | Aut. 2 | Aut. 1 | Solicitante | Sin rol |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Inicio y cuenta** |||||||
| Pantalla: Inicio (RH y admin: indicadores; los demás: su panel por rol) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pantalla: Mi cuenta (datos, ayudas, letra, tema, contraseña) _(Se entra por el pie del menú)_ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Botón: Cambiar su propia contraseña y sus preferencias | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Tiempo extra** |||||||
| Pantalla: Solicitar tiempo extra | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Pantalla: Mis solicitudes | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Pantalla: Por autorizar | ✔ | ✔ | ✔ | ✔ | — | — |
| Pantalla: Todas las solicitudes (solo lectura; RH además cancela) | ✔ | ✔ | ✔ | — | — | — |
| Pantalla: Por enviar al proveedor | ✔ | ✔ | — | — | — | — |
| Acción: Capturar y enviar tiempo extra de un área que participa _(Solo en sus áreas. RH no captura en áreas que participan)_ | — | — | — | ✔ | ✔ | — |
| Acción: Capturar tiempo extra de un área que no participa (Administrativo) _(RH la deja en nivel 2 (la firma un Aut. 2 u otra persona de RH); la Aut. 2 la deja autorizada al enviarla)_ | ✔ | ✔ | ✔ | — | — | — |
| Acción: Lo que captura y envía queda autorizado al enviarlo (firma de nivel 2 «Capturada y autorizada por Aut. 2») _(Solo la Aut. 2 vigente, en cualquier área donde pueda capturar. El Aut. 1 y RH no autorizan lo suyo)_ | — | — | ✔ | — | — | — |
| Acción: Autorizar o devolver, nivel 1 _(Solo lo de su área; no lo que él mismo creó)_ | — | — | — | ✔ | — | — |
| Acción: Autorizar o devolver, nivel 2 _(RH firma «como RH»; no lo que él mismo creó)_ | ✔ | ✔ | ✔ | — | — | — |
| Botón: Confirmar y generar transporte / Devolver (nivel 3) | ✔ | ✔ | — | — | — | — |
| Botón: Cancelar un tiempo extra autorizado o confirmado | ✔ | ✔ | — | — | — | — |
| Botón: Descargar Formato de rutas y resumen de horas extra | ✔ | ✔ | — | — | — | — |
| Botón: Exportar «Todas las solicitudes» a Excel | ✔ | ✔ | ✔ | — | — | — |
| **Transporte** |||||||
| Pantalla: Solicitudes de transporte | ✔ | ✔ | — | — | — | — |
| Pantalla: Rutas y puntos de reunión | ✔ | ✔ | — | — | — | — |
| **Personal y estructura** |||||||
| Pantalla: Padrón de empleados | ✔ | ✔ | — | — | — | — |
| Pantalla: Estructura (áreas, puestos, turnos) | ✔ | ✔ | — | — | — | — |
| Pantalla: Usuarios y accesos (cada quien ve solo las pestañas que le tocan) _(En el menú de RH es un ítem; los demás entran por su pestaña)_ | ✔ | ✔ | ✔ | ✔ | — | — |
| Pantalla: Usuarios y accesos › Usuarios | ✔ | ✔ | ✔ | — | — | — |
| Pantalla: Usuarios y accesos › Asignaciones («Asignar roles» en el menú de Aut. 2) | ✔ | ✔ | ✔ | — | — | — |
| Pantalla: Organigrama («Mi área» para Aut. 1: solo su área) | ✔ | ✔ | ✔ | ✔ | — | — |
| Acción: Padrón: alta, edición, baja, importación y respaldo | ✔ | ✔ | — | — | — | — |
| Acción: Estructura y catálogos: crear y editar áreas, puestos, turnos, rutas y puntos | ✔ | ✔ | — | — | — | — |
| Botón: Estructura inicial y limpieza de estructura vieja | ✔ | — | — | — | — | — |
| **Herramientas (admin)** |||||||
| Pantalla: Herramientas › Diagnóstico y limpieza | ✔ | — | — | — | — | — |
| Pantalla: Herramientas › Vista previa por rol _(Dentro de Herramientas)_ | ✔ | — | — | — | — | — |
| Botón: Herramientas › Respaldo completo (JSON) | ✔ | — | — | — | — | — |
| Pantalla: Guía de estilo | ✔ | — | — | — | — | — |
| **Usuarios y accesos** |||||||
| Botón: Nuevo usuario / Crear usuarios en lote (rol «usuario») | ✔ | ✔ | ✔ | — | — | — |
| Botón: Editar, activar o desactivar usuarios con rol «usuario» _(Nadie edita su propio usuario (salvo admin))_ | ✔ | ✔ | ✔ | — | — | — |
| Botón: Dar o quitar el rol del sistema RH (con confirmación y bitácora) _(Nadie cambia su propio rol. A un RH solo se le cambia el rol (nombre y estado, solo el admin))_ | ✔ | ✔ | ✔ | — | — | — |
| Botón: Dar o quitar el rol del sistema Administrador | ✔ | — | — | — | — | — |
| Botón: Restablecer contraseña (RH y Aut. 2: a usuarios con rol «usuario»; admin: a cualquiera menos a sí mismo) _(Contraseña temporal que se muestra una sola vez; nadie la restablece a sí mismo)_ | ✔ | ✔ | ✔ | — | — | — |
| Botón: Asignar, extender o revocar Aut. 1 y Solicitante _(Nadie, salvo admin, se asigna a sí mismo. Solo en áreas que participan)_ | ✔ | ✔ | ✔ | — | — | — |
| Botón: Asignar, extender o revocar Aut. 2 | ✔ | — | — | — | — | — |
| Botón: Ver el historial de una persona en el organigrama | ✔ | ✔ | ✔ | — | — | — |
| Botón: Cargar asignaciones iniciales / Actualizar nombres y puestos | ✔ | — | — | — | — | — |
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

## Pendiente de decisión

- Los botones de borrar solicitudes y tiempos extra (`delete` solo admin en las reglas) no existen en la pantalla.
