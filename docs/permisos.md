# Permisos: quién ve y hace qué

Dos capas que **se suman** (unión):

- **Rol del sistema** (`usuarios/{uid}.rol`: `admin`, `rh`, `usuario`): acceso a las pantallas de administración y RH.
- **Roles operativos** (Aut. 2, Aut. 1, Solicitante): capturar y autorizar. Se dan en *Usuarios y accesos › Asignaciones*, por nómina, con vigencia.

Una cuenta con rol del sistema `usuario` y una asignación de Aut. 2 solo ve lo de Aut. 2: **no ve nada de RH**. Si esa persona también es de RH, hay que cambiarle el rol del sistema a RH
(Usuarios › editar; solo un admin puede dar RH). *RH + Aut. 2* ve lo de ambos; *admin + Aut. 1* ve el menú de admin y además firma el nivel 1 de su área.

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
| Pantalla: Solicitar tiempo extra | ✔ | ✔ | — | ✔ | ✔ | — |
| Pantalla: Mis solicitudes | ✔ | ✔ | — | ✔ | ✔ | — |
| Pantalla: Por autorizar | ✔ | ✔ | ✔ | ✔ | — | — |
| Pantalla: Todas las solicitudes (solo lectura; RH además cancela) | ✔ | ✔ | ✔ | — | — | — |
| Pantalla: Por enviar al proveedor | ✔ | ✔ | — | — | — | — |
| Acción: Capturar y enviar tiempo extra de un área que participa _(Solo en sus áreas. RH no captura en áreas que participan)_ | — | — | — | ✔ | ✔ | — |
| Acción: Capturar tiempo extra de un área que no participa (Administrativo) _(Las reglas también lo permiten a un Aut. 2 sin RH, pero la pantalla no le da acceso: ver docs/permisos.md › Pendiente)_ | ✔ | ✔ | — | — | — | — |
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
| Pantalla: Usuarios y accesos › Usuarios | ✔ | ✔ | — | — | — | — |
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
| Botón: Nuevo usuario / Crear usuarios en lote (rol «usuario») | ✔ | ✔ | — | — | — | — |
| Botón: Editar, activar o desactivar usuarios con rol «usuario» | ✔ | ✔ | — | — | — | — |
| Botón: Dar o quitar el rol del sistema RH o Administrador, y tocar a quien ya lo tiene | ✔ | — | — | — | — | — |
| Botón: Restablecer acceso (RH: a usuarios con rol «usuario»; admin: a cualquiera menos a sí mismo) | ✔ | ✔ | — | — | — | — |
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

## Pendiente de decisión

- **Aut. 2 capturando en áreas que no participan (Administrativo).** `firestore.rules` y `docs/tiempo-extra.md` lo permiten («RH o un Aut. 2»), pero ni el menú ni la ruta *Solicitar tiempo extra* le dan acceso a un Aut. 2 sin RH.
  Hoy solo captura ahí RH. Si debe poder, hay que sumar `esAut2` a la capacidad `solicitar` y a su menú/Inicio (cambio pequeño, con sus pruebas).
- Los botones de borrar solicitudes y tiempos extra (`delete` solo admin en las reglas) no existen en la pantalla.
