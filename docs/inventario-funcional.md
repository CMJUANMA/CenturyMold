# Inventario funcional y propuesta de reorganización

Fecha del análisis: 16/oct/2026. Alcance: **solo lectura del código** (`src/`, `firestore.rules`, `tests/`, `scripts/`, `docs/`). No se modificó nada más que este archivo.
Límite honesto: no se consultaron los datos de producción; lo que dice "campo viejo" o "nadie lo lee" se refiere al **código**, no a lo que haya guardado en Firestore.

## ✅ Estado de la implementación (16/oct/2026)

Las tablas de abajo son el diagnóstico original (con las URLs y nombres de **antes**). Esto es lo que ya se hizo, por fases (un commit por fase):

| Fase | Qué se hizo | Estado |
|---|---|---|
| 1 | `src/funciones.js` con `transporteSuelto: false`; rutas `/transporte/nueva`, `/transporte/editar/:id` y `/transporte/mis-solicitudes` detrás de `RutaFuncion`; fuera del menú (RH y por rol), de los contadores/listeners, de las tarjetas y, en *Solicitudes de transporte*, el lápiz (D5), Aprobar/Rechazar/Revertir (D7), «Todas las pendientes» y el filtro de origen. Prueba `tests/funciones.test.js` (apagado y encendido) | ✅ |
| 2 | Inicio unificado: `InicioRH` con **Requieren atención** y **Esta semana** (D11), accesos rápidos y tabla de 7 días; se eliminaron `Portal`, `TiempoExtraInicio` y el panel viejo; sin el indicador «Pendientes» de transporte; `src/rutas.js` | ✅ |
| 3 | URLs nuevas (D4): `/transporte/solicitudes`, `/transporte/catalogos`, `/personal/padron`, `/personal/estructura`, `/personal/accesos[/:tab]`; menú nuevo por rol; renombres (D8); 9 redirecciones fuera (D6); `modulos.js`, `RutaModulo` y `Redirigir` fuera; pantalla 404 | ✅ |
| 4 | **Mi cuenta** (D2) junta Perfil y Configuración; Importar empleados y Respaldo del padrón dentro de Padrón; Diagnóstico → **Herramientas** (solo admin); botón **Formato de rutas** en *Por enviar al proveedor* (D1); Consulta de solo lectura (D3) | ✅ (ver nota) |
| 5 | Se eliminó código muerto (`Proximamente.jsx`, `transicionesTE`, `estatusInicialTE`, `TRANSICIONES_TE`, `ROL_LABELS_CORTOS`, `ROLES_SISTEMA`, `usePendientesTE`, scripts `generar-excel-prueba` y `test-excel`); caché de Firebase fuera de git y en `.gitignore`; README, `docs/` y `ayudas.js` actualizados; lista para «Preparar para producción» (D9) | ✅ |

**Notas y diferencias con la propuesta**
- **D3 (Consulta de solo lectura)**: lo *autorizado* ya no se actúa en Consulta; el detalle remite a «Por enviar al proveedor». **Excepción**: la cancelación de lo ya *confirmado* (`procesada`) se queda en Consulta, porque «Por enviar al proveedor» solo lista lo autorizado y esa cancelación avisa al transporte; no hay otro lugar donde hacerla.
- **Consulta** acepta `?estatus=...` para que los indicadores del Inicio lleven ya filtrado (por autorizar nivel 1 y devueltas).
- **«Diagnóstico»** antes lo veía RH (Revisar colecciones); ahora es **solo admin** (Herramientas).
- **D9**: no se borró nada de Firebase; la lista está en `docs/tiempo-extra.md` > *Preparar para producción*.
- **D10**: «Carga inicial» y «Crear estructura inicial» siguen disponibles (solo admin) hasta después del piloto.
- **Pendiente (no pedido)**: ayuda de pantalla (`?`) en Inicio, Padrón, Organigrama y Asignaciones; que las tarjetas del Inicio de solicitante abran la pestaña correspondiente de *Mis solicitudes*; `invalidarAreas` y `etiquetaEstatusTE` quedaron (solo uso interno / pruebas).

---

**Veredictos** usados en todas las tablas: **Se queda** · **Se junta con…** · **Se oculta** (se conserva el código, detrás de un interruptor) · **Se elimina** (código muerto o sin sentido) · **Se renombra / se mueve**.

---

## 0. Hallazgos principales

1. **La app tiene dos "inicios" para RH/admin y un tercero escondido**: el Portal (`/`), el panel de transporte (`/rutas`) y el resumen de tiempo extra (`/tiempo-extra`). Los tres muestran contadores parecidos y ninguno muestra el estado real del tiempo extra (horas, vencidas, devueltas).
2. **Las pantallas de administración viven bajo `/rutas/rh/...`** (padrón, estructura, catálogos) aunque ya no son de "transporte". El menú las pone en "Administración" pero la URL y el subtítulo de la barra dicen "Transporte".
3. **Un camino de tres pasos para el proveedor**: RH confirma en *Por enviar al proveedor* → el transporte nace *aprobado* en *Todas las solicitudes* → ahí mismo baja el *Formato de rutas*. El Excel del proveedor no está donde RH confirma (hay un enlace de texto).
4. **Cinco descargas de Excel dispersas** (formato de rutas, resumen de horas extra, exportar consulta, respaldo del padrón, accesos en lote) más los formatos de importación.
5. **Con el transporte suelto oculto, el flujo "Aprobar / Rechazar / Revertir" de transporte queda sin uso** (el transporte de tiempo extra nace *aprobado*) y el indicador "Pendientes" del panel de rutas siempre dará 0.
6. **Código muerto confirmado** (sección 1g): `Proximamente.jsx`, 5 funciones/constantes sin usar, la rama "superintendente" de `Inicio.jsx`, comentarios que siguen diciendo "próximamente".
7. **Hay un archivo de caché de Firebase versionado** (`.firebase/hosting.ZGlzdA.cache`) y scripts de prueba sueltos sin enlace desde `package.json`.
8. **No existe ruta comodín**: una URL inexistente muestra el error genérico del router.

---

## 1. INVENTARIO

### 1a. Rutas / URLs (`App.jsx`)

Roles: **A**=admin, **RH**, **A2**=Aut. 2, **A1**=Aut. 1, **S**=solicitante, **U**=usuario sin rol. "Todos*" = cualquier usuario con sesión. Lee/escribe = colecciones de Firestore.

| ID | URL | Pantalla | Qué hace | Quién | Cómo se llega | Lee / Escribe | Veredicto |
|---|---|---|---|---|---|---|---|
| R01 | `/login` | Login | Nómina + contraseña (se mapea a `nómina@rutas.app`) | Sin sesión | Directo | usuarios (auth) | Se queda |
| R02 | `/cambiar-password` | CambiarPassword | Cambio obligatorio en el primer acceso | Todos* con `debeCambiarPassword` | Redirección automática | usuarios / usuarios | Se queda |
| R03 | `/` | Home → **Portal** (RH/A) o **InicioRol** (resto) | Pantalla inicial | Todos* | Menú "Inicio", login | tiempoExtra, solicitudes, empleados / – | Se renombra / se mueve (Home pasa a mostrar el panel nuevo; ver §4) |
| R04 | `/perfil` | Perfil | Datos de la cuenta + cambio de contraseña | Todos* | Pie del menú | usuarios / Auth | Se junta con Configuración ("Mi cuenta") |
| R05 | `/configuracion` | Configuración | Ayudas sí/no, tamaño de letra, tema | Todos* | Pie del menú, ícono móvil | usuarios / usuarios | Se junta con Perfil |
| R06 | `/rutas/mis-solicitudes` | MisSolicitudes | Historial de transporte suelto propio (ver, editar, cancelar) | Todos* (sin guardia; el menú solo lo ofrece si hay solicitudes propias) | Menú, tarjeta de Inicio, tras guardar una nueva | solicitudes (+pasajeros) / solicitudes | **Se oculta** |
| R07 | `/rutas` | Inicio (panel de transporte) | 4 indicadores + accesos + próximos servicios | RH/A | Menú "Resumen", tarjeta del Portal | solicitudes, empleados, rutas / – | Se renombra / se mueve (será el Inicio de RH/A en `/`) |
| R08 | `/rutas/solicitud/nueva` | NuevaSolicitud | Alta de transporte suelto | RH/A | Menú, tarjeta de Inicio | empleados, catálogos / solicitudes + pasajeros | **Se oculta** |
| R09 | `/rutas/solicitud/editar/:id` | EditarSolicitud | Edita una solicitud de transporte | RH/A | Botón lápiz en Todas las solicitudes (solo origen manual) y en Mis solicitudes | solicitudes, empleados / solicitudes | **Se oculta** (ver decisión D5) |
| R10 | `/rutas/rh/solicitudes` | RhSolicitudes | Todas las solicitudes de transporte: filtros, aprobar/rechazar/revertir, Formato de rutas | RH/A | Menú, Portal, Recepción (enlaces) | solicitudes / solicitudes | Se queda (se renombra/mueve de URL) |
| R11 | `/rutas/rh/empleados` | RhEmpleados | Padrón: alta, edición, baja | RH/A | Menú "Padrón de empleados" | empleados, catálogos / empleados | Se queda (mover URL; recibe la importación y el respaldo) |
| R12 | `/rutas/rh/catalogos` | RhCatalogos | Rutas, comunidades, puntos de reunión + importaciones + respaldo + Diagnóstico | RH/A | Menú "Catálogos del sistema" | rutas, comunidades, puntosReunion, empleados / ídem | Se renombra / se mueve (ver §3) |
| R13 | `/rutas/rh/estructura` | Estructura | Áreas, Puestos (con Nivel), Excepciones y pendientes, Turnos | RH/A | Menú "Estructura" | areas, puestos, empleados, turnosNomina, usuarios / ídem + bitacora | Se queda (mover URL) |
| R14 | `/tiempo-extra` | TiempoExtraInicio | "Resumen" de TE para RH: 3 bloques de roles + tarjeta Por enviar | RH/A (el resto rebota a `/`) | Menú "Resumen", tarjeta del Portal | asignaciones, tiempoExtra / – | **Se elimina** (lo absorbe el Inicio nuevo) |
| R15 | `/tiempo-extra/nueva` | EditorTE | Capturar un TE (borrador/enviar) | S, A1, RH/A | Menú, botón rojo de Inicio | empleados, turnosNomina, catálogos / tiempoExtra (+empleados, historial), contadores | Se queda |
| R16 | `/tiempo-extra/:id/editar` | EditorTE | Continuar borrador o corregir devuelta | S, A1, RH/A (solo el creador) | Mis solicitudes | ídem | Se queda |
| R17 | `/tiempo-extra/mis-solicitudes` | MisSolicitudesTE | Seguimiento por estatus + acciones | S, A1, RH/A | Menú, tarjetas de Inicio | tiempoExtra / tiempoExtra | Se queda |
| R18 | `/tiempo-extra/autorizar` | BandejaTE | Autorizar / devolver (nivel 1 y 2) + historial del área | A1, A2, RH/A | Menú, Inicio | tiempoExtra / tiempoExtra, bitacora | Se queda |
| R19 | `/tiempo-extra/consulta` | ConsultaTE | Todas las solicitudes (sin borradores), tarjetas, Excel; RH confirma/cancela; acepta `?abrir=ID` | A2, RH/A | Menú, enlace desde Todas las solicitudes | tiempoExtra / tiempoExtra | Se queda |
| R20 | `/tiempo-extra/recepcion` | RecepcionTE ("Por enviar al proveedor") | Confirmar lo autorizado y generar transporte | RH/A | Menú, tarjeta del Portal | tiempoExtra / tiempoExtra + solicitudes | Se queda |
| R21 | `/accesos` | UsuariosYAccesos | Entra a la primera pestaña que le toque | RH/A, A2 (asignar), A1 (su área) | Menú | usuarios, asignaciones, puestos, empleados / ídem + bitacora | Se queda |
| R22 | `/accesos/:tab` | idem (`usuarios` · `asignaciones` · `organigrama`) | Pestañas | según pestaña | Menú, enlaces | ídem | Se queda |
| R23 | `/solicitud/nueva` | Redirección → R08 | URL anterior a los módulos | – | Solo URL | – | Se elimina (nadie la usa; el código ya cambió dos veces de base) |
| R24 | `/solicitud/editar/:id` | Redirección → R09 | ídem | – | Solo URL | – | Se elimina |
| R25 | `/mis-solicitudes` | Redirección → R06 | ídem | – | Solo URL | – | Se elimina |
| R26 | `/rh/solicitudes` | Redirección → R10 | ídem | – | Solo URL | – | Se elimina |
| R27 | `/rh/empleados` | Redirección → R11 | ídem | – | Solo URL | – | Se elimina |
| R28 | `/rh/catalogos` | Redirección → R12 | ídem | – | Solo URL | – | Se elimina |
| R29 | `/rh/usuarios` | Redirección → `/accesos` | ídem | – | Solo URL | – | Se elimina |
| R30 | `/rutas/rh/usuarios` | Redirección → `/accesos` | ídem | – | Solo URL | – | Se elimina |
| R31 | `/tiempo-extra/niveles` | Redirección → `/accesos/organigrama` | URL de una versión anterior | – | Solo URL | – | Se elimina |
| R32 | (no existe) `*` | Ruta comodín / 404 | Hoy se ve el error del router | – | – | – | **Se agrega** una pantalla "No encontramos esa página" |

Guardias de ruta: `RutaProtegida` (sesión + cambio de contraseña), `RutaModulo` (módulo `rutas` = solo RH/A; `tiempo-extra` = quien tenga cualquier acceso), `RutaRol` (RH/A), `RutaCapacidad` (solicitar / autorizar / consultar / recibir). **No hay ninguna ruta "Próximamente"** en `App.jsx`; el comentario "Pantallas que llegan en los siguientes prompts" está desactualizado.

### 1b. Menú lateral, por rol, en el orden en que aparece

Todos ven al pie: **Mi perfil** (`/perfil`), **Configuración**, **Cerrar sesión**. En celular hay barra superior con ⚙ y hamburguesa.

**RH y admin (idénticos; `itemsMenuRH`)**

| ID | Sección | Opción | Va a | Contador | Veredicto |
|---|---|---|---|---|---|
| M01 | (sin sección) | Inicio (portal) | `/` | – | Se renombra: "Inicio" |
| M02 | Transporte (rutas) | Resumen | `/rutas` | – | Se junta con M01 (el panel pasa a ser el Inicio) |
| M03 | ″ | Nueva solicitud | `/rutas/solicitud/nueva` | – | **Se oculta** |
| M04 | ″ | Mis solicitudes | `/rutas/mis-solicitudes` | verde = novedades | **Se oculta** |
| M05 | ″ | Todas las solicitudes | `/rutas/rh/solicitudes` | pendientes de transporte | Se renombra: "Solicitudes de transporte" |
| M06 | ″ | Catálogos del sistema | `/rutas/rh/catalogos` | – | Se renombra: "Rutas y puntos de reunión" |
| M07 | Tiempo extra | Resumen | `/tiempo-extra` | – | **Se elimina** (duplica M01; ya hay dos "Resumen") |
| M08 | ″ | Solicitar tiempo extra | `/tiempo-extra/nueva` | – | Se queda |
| M09 | ″ | Mis solicitudes de TE | `/tiempo-extra/mis-solicitudes` | – | Se renombra: "Mis solicitudes" (al ocultar M04 ya no hay confusión) |
| M10 | ″ | Por autorizar | `/tiempo-extra/autorizar` | pendientes | Se queda |
| M11 | ″ | Por enviar al proveedor | `/tiempo-extra/recepcion` | autorizadas | Se queda |
| M12 | ″ | Consulta de solicitudes | `/tiempo-extra/consulta` | – | Se renombra: "Todas las solicitudes de tiempo extra" |
| M13 | ″ | Organigrama | `/accesos/organigrama` | – | Se mueve a "Administración" (es una pestaña de Usuarios y accesos) |
| M14 | Administración | Padrón de empleados | `/rutas/rh/empleados` | – | Se queda (mover URL) |
| M15 | ″ | Estructura | `/rutas/rh/estructura` | – | Se queda (mover URL) |
| M16 | ″ | Usuarios y accesos | `/accesos` | – | Se queda |

**Resto de los usuarios (`itemsMenuPorRol`; es la unión de lo que toca a cada rol)**

| ID | Opción | Quién la ve | Va a | Contador | Veredicto |
|---|---|---|---|---|---|
| M20 | Inicio | todos | `/` | – | Se queda |
| M21 | Solicitar tiempo extra | S, A1 | `/tiempo-extra/nueva` | – | Se queda |
| M22 | Mis solicitudes | S, A1 | `/tiempo-extra/mis-solicitudes` | – | Se queda |
| M23 | Por autorizar | A1, A2 | `/tiempo-extra/autorizar` | pendientes | Se queda |
| M24 | Consulta de solicitudes | A2 | `/tiempo-extra/consulta` | – | Se renombra: "Todas las solicitudes" |
| M25 | Organigrama | A2 | `/accesos/organigrama` | – | Se queda |
| M26 | Asignar roles | A2 | `/accesos/asignaciones` | – | Se queda |
| M27 | Mi área | A1 (si no es A2) | `/accesos/organigrama` | – | Se queda |
| M28 | Transporte (consulta) | quien tenga transporte suelto propio | `/rutas/mis-solicitudes` | – | **Se oculta** (y con él el hook `useTransporteAnterior`) |
| M29 | Perfil / Configuración / Cerrar sesión | todos | – | – | Perfil + Configuración se juntan: "Mi cuenta" |

Usuario sin rol: solo **Inicio** (con el aviso "Todavía no tienes funciones asignadas") y el pie.

### 1c. Botones y acciones por pantalla (y si se repiten)

| ID | Pantalla | Acción | Qué hace | ¿Otro botón hace lo mismo? | Veredicto |
|---|---|---|---|---|---|
| A01 | Portal | Tarjeta "Por enviar al proveedor" | Lleva a Recepción | M11 y R14 | Se junta (Inicio nuevo) |
| A02 | Portal | Tarjetas de módulo (Transporte / Tiempo extra) | Llevan a `/rutas` y `/tiempo-extra` | M02, M07 | Se elimina (con el Portal) |
| A03 | InicioRol | "Solicitar tiempo extra" (banda roja) | Abre el editor | M21 | Se queda (acceso rápido del rol) |
| A04 | InicioRol | "Por autorizar (N)" | Abre la bandeja | M23 | Se queda |
| A05 | InicioRol | Tarjetas En borrador / En autorización / Devueltas | Abren Mis solicitudes (las tres al mismo sitio, sin filtrar la pestaña) | M22 | Se queda; **mejora**: que cada tarjeta abra su pestaña |
| A06 | Inicio (rutas) | "Nueva solicitud" | Abre R08 | M03 | **Se oculta** |
| A07 | Inicio (rutas) | "Mis solicitudes" | Abre R06 | M04 | **Se oculta** |
| A08 | Inicio (rutas) | "Todas las solicitudes" / "Ver todas" | Abre R10 | M05 | Se queda |
| A09 | Inicio (rutas) | Tarjeta "Operación autorizada" (no RH) | Decorativa, sin acción | – | **Se elimina** (código muerto: solo la ve quien no es RH y `/rutas` es de RH) |
| A10 | EditorTE | Guardar borrador / Enviar a autorización / Reenviar | Escribe el borrador; valida, pide confirmación, asigna folio | – | Se queda |
| A11 | EditorTE | Eliminar borrador · Cancelar solicitud · Salir | Elimina / cancela con motivo / vuelve | Cancelar también en A13 | Se queda |
| A12 | EditorTE | Seleccionar empleados, "aplicar a todos", tipo, rutas, justificación, motivo "Otro: ¿Cuál?" | Captura | – | Se queda |
| A13 | MisSolicitudesTE | Continuar · Eliminar · Corregir y reenviar · Cancelar (con motivo) · ver detalle | Acciones por estatus | Cancelar y eliminar están también en el editor | Se queda |
| A14 | BandejaTE | Autorizar · Devolver (≥10 caracteres) · "Autorizar N seleccionadas" · filtros · pestaña "Historial de mi área" | Firma nivel 1/2 | – | Se queda |
| A15 | ConsultaTE | Filtros, tarjetas, abrir detalle | Consulta | – | Se queda |
| A16 | ConsultaTE | **Exportar consulta (N)** | Excel de la lista filtrada (Resumen + Detalle) | A17 (otro Excel en la misma pantalla) | Se junta con A17 (pantalla "Descargas") |
| A17 | ConsultaTE y Recepción | **Descargar resumen de horas extra** | Panel con periodo, área, vista previa y 4 hojas | La misma en dos pantallas | Se junta (una sola "Descargas") |
| A18 | ConsultaTE / Recepción (`AccionesRH`) | Confirmar y generar transporte · Devolver · Cancelar autorizado | Acciones de RH | **RH puede confirmar en dos pantallas** (Recepción y Consulta) | Se junta: confirmar solo en Recepción; Consulta queda de lectura + devolver/cancelar |
| A19 | Recepción | "Confirmar todas las de esta fecha" | Confirma en lote por fecha | – | Se queda |
| A20 | Recepción | Enlace de texto "Formato de rutas está en Transporte › Solicitudes" | Lleva a R10 | A24 | Se junta (el Excel del proveedor aparece en "Descargas" y en el mensaje de éxito) |
| A21 | RhSolicitudes | Filtros (rango, Hoy/Esta semana/Próxima semana, **Todas las pendientes**, estado, origen, búsqueda) | Filtra | – | Se queda; "Todas las pendientes" y filtro de origen **se ocultan** (sin transporte suelto no hay pendientes) |
| A22 | RhSolicitudes | Ver detalle (ojo) | Abre el detalle con pasajeros | – | Se queda |
| A23 | RhSolicitudes | Editar (RH) (lápiz, solo origen manual) | Abre R09 | A07 en Mis solicitudes | **Se oculta** (decisión D5) |
| A24 | RhSolicitudes | **Formato de rutas (proveedor)** | Excel del proveedor (modal con fecha/rango y estados) | Enlace A20 | Se queda (y se ofrece también en "Descargas") |
| A25 | RhSolicitudes | Aprobar · Rechazar (con motivo) · Revertir a pendiente | Revisión de transporte manual | – | **Se oculta** con el transporte suelto (el de TE nace aprobado); código se conserva |
| A26 | RhSolicitudes | Enlace "Abrir el tiempo extra" | Va a `ConsultaTE?abrir=` | – | Se queda |
| A27 | MisSolicitudes (rutas) | Ver · Editar · Cancelar | Gestión de transporte propio | A23 | **Se oculta** |
| A28 | RhEmpleados | Nuevo empleado · editar · baja/alta · buscar/filtrar | CRUD del padrón | – | Se queda |
| A29 | RhCatalogos | Pestañas Rutas / Comunidades / Puntos: nueva, editar, baja | CRUD de catálogos | – | Se queda |
| A30 | RhCatalogos | **Importar empleados** · Importar directorio · Exportar padrón (respaldo) | Importaciones y respaldo | El padrón está en otra pantalla (R11) | Se mueve: importar/respaldar de empleados pasa a Padrón; "Importar directorio" se queda en Rutas |
| A31 | RhCatalogos › Diagnóstico | Revisar colecciones · Limpiar estructura vieja (solo admin) | Herramientas de limpieza de una sola vez | – | Se oculta tras "Herramientas del administrador" |
| A32 | Estructura › Áreas | Nueva/editar/baja · participa en TE · **Crear estructura inicial** | CRUD de áreas; arranque único | – | Se queda; "Crear estructura inicial" **se oculta** una vez creada |
| A33 | Estructura › Puestos | Nuevo, editar, cambiar de área, alias, baja, **Nivel**, **Asignar puestos y áreas** | CRUD de puestos | "Asignar puestos y áreas" es el mismo componente que usa la importación | Se queda |
| A34 | Estructura › Excepciones y pendientes | Revisa excepciones de área y puestos sin área | Diagnóstico | – | Se queda |
| A35 | Estructura › Turnos | Captura turnos A/B/C | Alimenta "Extensión de turno" | – | Se queda |
| A36 | Usuarios y accesos › Usuarios | Nuevo usuario · **Crear usuarios en lote** (Excel de accesos) · editar | Cuentas | "Crear usuario" también se ofrece desde Asignar rol | Se queda (el atajo es útil) |
| A37 | Usuarios y accesos › Asignaciones | **Asignar rol** · Extender · Revocar · Historial · **Actualizar nombres y puestos** · **Carga inicial** | Roles operativos | "Asignar" también con los "+" del organigrama; Revocar/Extender también en el panel de la persona | Se queda; "Carga inicial" **se oculta** después de usarla |
| A38 | Usuarios y accesos › Organigrama | "+" por nivel, búsqueda, resaltar sin usuario, panel de persona | Árbol de autorización | A37 | Se queda |
| A39 | Perfil | Cambiar contraseña · mostrar/ocultar | Cuenta | – | Se junta con Configuración |
| A40 | Configuración | Ayudas · tamaño de letra · tema | Preferencias | El texto de Perfil aún dice que tiene "selector de tema" | Se junta con Perfil |
| A41 | Todas | Ayuda `?`, ayuda de pantalla y recorrido guiado | Explicaciones | – | Se queda (no todas las pantallas la tienen; ver §4.6) |

### 1d. Tarjetas e indicadores

| ID | Dónde | Indicador | De dónde sale | Veredicto |
|---|---|---|---|---|
| K01 | Portal | "Por enviar al proveedor" N | `useResumenTE().planta` → solicitudes en `autorizada` | Se queda (sube al Inicio nuevo) |
| K02 | Portal | Tarjeta Transporte: "N pendientes" | `usePendientesRutas`: solicitudes `pendiente` | Se oculta (siempre 0 sin transporte suelto) |
| K03 | Portal | Tarjeta Tiempo extra: "N pendientes" | `usePendientesTE`: nivel 2 pendiente + autorizadas + devueltas propias (**las autorizadas se cuentan aquí y otra vez en K01**) | Se elimina (doble conteo) |
| K04 | Inicio (rutas) | Pendientes | `getCountFromServer` solicitudes `pendiente` | Se oculta |
| K05 | Inicio (rutas) | Mes en curso | `getCountFromServer` (por `fechaSolicitud`, Timestamp + ISO viejo) | Se renombra: "Solicitudes de transporte del mes" |
| K06 | Inicio (rutas) | Personal activo | `useCatalogos` (padrón) | Se queda (tarjeta secundaria) |
| K07 | Inicio (rutas) | Rutas activas | `useCatalogos` | Se queda (tarjeta secundaria) |
| K08 | Inicio (rutas) | Tabla "Próximos servicios programados" (5) | `solicitudes` con `fechaServicio >= hoy` | Se queda (incluye ya los de TE) |
| K09 | InicioRol | Empleados de mi área | padrón filtrado por área | Se queda |
| K10 | InicioRol | En borrador / En autorización / Devueltas / Autorizadas este mes | `useResumenTE().propias` | Se queda |
| K11 | InicioRol | Tabla "Próximos tiempos extra autorizados" | `propias` autorizadas futuras | Se queda |
| K12 | InicioRol (A1) | Tabla "Últimas solicitudes de mi área" | `delArea` | Se queda |
| K13 | InicioRol (A2) | Por autorizar nivel 2 · Empleados de planta · Solicitudes de la semana · tabla por área | `planta` + `usePorAutorizar` + padrón | Se queda |
| K14 | InicioRol | "Por autorizar (N)" nivel 1 · nivel 2 | `usePorAutorizar` | Se queda |
| K15 | TiempoExtraInicio | Bloques Solicitante / Aut. 1 / Aut. 2 (qué áreas tengo) | `useAccesos` | Se elimina (información de RH que ya está en el organigrama y en el pie del menú) |
| K16 | TiempoExtraInicio | Tarjeta Por enviar | `usePorRecibir` | Se junta con K01 |
| K17 | ConsultaTE | Pendientes por nivel · Autorizadas esta semana · Autorizadas del mes (empleados · horas) | solicitudes cargadas | Se queda |
| K18 | Menú | Contador "Por autorizar" · "Por enviar" · transporte pendiente · novedades de transporte | `usePorAutorizar`, `usePorRecibir`, `usePendientesRutas` | Los dos primeros se quedan; los de transporte manual se ocultan |
| K19 | MisSolicitudesTE | Contador por pestaña (Borradores / En autorización / Devueltas / Autorizadas / Canceladas) | `propias` | Se queda |

### 1e. Descargas de Excel

| ID | Dónde | Archivo | Contenido | Para quién | Veredicto |
|---|---|---|---|---|---|
| X01 | Todas las solicitudes › "Formato de rutas (proveedor)" | `libroProveedor.js` vía `exportarSolicitudes.js` | Hoja por fecha/turno con pasajeros, ruta, comunidad y punto (solicitud de transporte aprobada). Lee `empleados` | RH → proveedor de transporte | Se queda (también visible en "Descargas") |
| X02 | Consulta › "Exportar consulta (N)" | `exportarConsultaTE.js` | Hojas Resumen (por área y estatus) y Detalle (una fila por empleado, con Motivo y firmas) | A2 y RH | Se junta en "Descargas" |
| X03 | Consulta y Recepción › "Descargar resumen de horas extra" | `exportarTiempoExtraRH.js` | Detalle, Horas por empleado, Alimentos (comedor), Resumen (estilo del proveedor) | RH (nómina y comedor) | Se junta en "Descargas" |
| X04 | Catálogos › "Exportar padrón (respaldo)" | `respaldoPadron.js` | Padrón completo, activos e inactivos | RH/A | Se mueve a Padrón |
| X05 | Importación › "Descargar formato en blanco" | `formatosImportacion.js` | Plantilla de empleados o de directorio | RH/A | Se queda |
| X06 | Importación › "Descargar reporte (.xlsx)" | `formatosImportacion.js` | Resultado de la importación | RH/A | Se queda |
| X07 | Usuarios › "Crear usuarios en lote" | `accesosIniciales.js` | Accesos generados (nómina y contraseña inicial) | RH/A | Se queda |
| X08 | Diagnóstico › "Limpiar estructura vieja" | `limpiezaEstructura.js` | Respaldo **JSON** (no Excel) antes de limpiar | Admin | Se oculta con la herramienta |

### 1f. Colecciones y campos de Firestore

| ID | Colección | Quién la lee / escribe en la app | Estado | Veredicto |
|---|---|---|---|---|
| F01 | `usuarios` | AuthContext, Preferencias, Usuarios y accesos | En uso (`rol`, `nomina`, `activo`, `preferencias`, `debeCambiarPassword`). **Roles viejos** `superintendente`/`autorizador` se corrigen a `usuario` al guardar (ModalUsuario). Posible campo viejo `areaIds` (lo menciona Estructura inicial) | Se queda |
| F02 | `asignaciones` | AccesosContext, organigrama, asignaciones | En uso. `posicion` (documentos anteriores) **ya nadie la lee** | Se queda; campo `posicion` se ignora |
| F03 | `empleados` | Padrón, editor TE, importación | En uso. Campos `areaTE` y `areaTEManual` **viejos**: solo los toca la herramienta "Limpiar estructura vieja" | Se queda; campos viejos → limpieza |
| F04 | `areas` | `useAreas`, Estructura | En uso (`participaTE`, `orden`, `activa`). La **colección vieja `areasTE`** ya no tiene reglas ni código | Se queda; `areasTE` = eliminar de la consola |
| F05 | `puestos` | Estructura, importación, organigrama | En uso (+ `nivelJerarquico` nuevo) | Se queda |
| F06 | `rutas`, `comunidades`, `puntosReunion` | Catálogos, editor TE, formatos | En uso | Se queda |
| F07 | `PuntosReunion` (con mayúscula) | Solo "Revisar colecciones" (RH) | **Legado**: nadie lo escribe ni lo usa en flujos | Se elimina de reglas y de la herramienta cuando se confirme que está vacía |
| F08 | `solicitudes` (+ `pasajeros`) | Transporte; RH al confirmar TE | En uso. Campos de la época manual: `puesto`, `vistoPorSolicitante`, fechas `fechaSolicitud` mixtas (Timestamp / ISO) | Se queda; campos viejos se conservan |
| F09 | `tiempoExtra` (+ `empleados`, `historial`) | Todo el módulo | En uso (incluye `motivoOtro`) | Se queda |
| F10 | `contadores` | Folios de TE (`te-AAAA`) | En uso | Se queda |
| F11 | `turnosNomina` | Estructura › Turnos, editor TE | En uso | Se queda |
| F12 | `bitacora` | Asignaciones, estructura, TE | En uso; solo se crea | Se queda |
| F13 | `config/areasTE`, `config/tiempoExtra`, `accesosTE` | **Nadie** (sin reglas; solo se mencionan en textos) | Muertas | Se elimina de la consola de Firebase si existen; quitar menciones de la UI y de los docs |

### 1g. Código muerto o duplicado

| ID | Elemento | Evidencia | Veredicto |
|---|---|---|---|
| C01 | `src/pages/Proximamente.jsx` | Ningún archivo lo importa; `App.jsx` ya no tiene rutas "Próximamente" | Se elimina |
| C02 | `transicionesTE`, `estatusInicialTE`, `TRANSICIONES_TE` (y `ACCIONES_TE` solo para ellas) en `utils/constantes.js` | Sin ningún uso fuera del archivo | Se elimina (las reglas de Firestore ya mandan) |
| C03 | `ROL_LABELS_CORTOS`, `ROLES_SISTEMA` | Sin uso | Se elimina |
| C04 | `etiquetaEstatusTE` | Solo la usan pruebas | Se elimina (o se usa en `BadgeEstatus`) |
| C05 | `invalidarAreas` exportada | Solo uso interno | Dejar de exportarla |
| C06 | `Inicio.jsx`: rama "superintendente" (estadísticas propias) y tarjeta "Operación autorizada" | `/rutas` solo la abre RH | Se elimina (al reconvertir la pantalla) |
| C07 | `modulos.js` / `Portal.jsx` / `TiempoExtraInicio.jsx` | Las tarjetas del portal desaparecen con el Inicio nuevo; `modulos.js` solo servirá para el interruptor | Portal y TiempoExtraInicio se eliminan; `modulos.js` se renombra `funciones.js` |
| C08 | `utils/navegacion.js`: comentario "rutas de tiempo extra que todavía no tienen pantalla" | Ya tienen | Corregir texto |
| C09 | `useTransporteAnterior.js` (+ ítem M28) | Solo para M28 | Se oculta con el interruptor |
| C10 | Formulario de transporte suelto: `NuevaSolicitud`, `EditarSolicitud`, `MisSolicitudes`, `FormularioSolicitud`, `PuestoCombobox`, `utils/solicitudes.js` (validación, pasajeros) | Solo los usa ese flujo (más `resumenPasajeros`, `MAX_PASAJEROS`, que TE sí usa) | Se oculta (no se borra) |
| C11 | `scripts/generar-excel-prueba.mjs`, `scripts/test-excel.cjs` | No están en `package.json` ni en la documentación | Se elimina (o se documentan) |
| C12 | `.firebase/hosting.ZGlzdA.cache` versionado en git; `firestore-debug.log` y `test-solicitudes.xlsx` sueltos | Temporales | Quitar del repositorio / `.gitignore` |
| C13 | Dos listas de roles: `utils/constantes.js` (`ROLES_RH`) y `utils/roles.js` (reexporta) | Duplicado menor | Se junta en una |
| C14 | Filtro y etiqueta "Origen" en Todas las solicitudes; `normalizarEstatus` / `ESTATUS_MAP` para estatus viejos | Útiles para datos anteriores | Se queda (se oculta el filtro con el interruptor) |

---

## 2. FLUJOS ACTUALES, PASO A PASO

Leyenda: ⚠ = el usuario cambia de pantalla para lo mismo · ⇄ = hay dos caminos para lo mismo.

### 2.1 Solicitante (y Aut. 1)
1. Entra → **Inicio** (panel por rol). Botón rojo **Solicitar tiempo extra**.
2. **Editor**: elige área, fecha, motivo (si es *Otro*, escribe *¿Cuál?*), tipo (turno extra / extensión), comentario; agrega empleados y fija horario, alimentos y transporte con ruta.
3. **Guardar borrador** (puede salir y volver) → **Enviar a autorización** (confirmación con resumen; recibe folio). Si quien captura es el Aut. 1 del área, salta al nivel 2.
4. Seguimiento: **Mis solicitudes** (pestañas por estatus; ⇄ también desde las tarjetas del Inicio, que no filtran la pestaña).
5. Si regresa **Devuelta**: abre **Corregir y reenviar** (el editor muestra el motivo de la devolución) y reenvía; vuelve a empezar con el mismo folio.
6. Ve cuándo RH confirmó ("Confirmada por RH · transporte solicitado") en el detalle.

### 2.2 Aut. 1 y Aut. 2
1. **Inicio** muestra "Por autorizar (N)" → **Por autorizar**. (⇄ también el contador del menú.)
2. Revisa el detalle; **Autorizar** (comentario opcional; pide confirmar si la fecha ya pasó) o **Devolver** (motivo ≥10 caracteres). Puede **autorizar varias** a la vez.
3. Aut. 1 pasa la solicitud al nivel 2; el **Aut. 2** la autoriza y queda *Autorizada*. RH también puede firmar nivel 2 ("como RH").
4. Aut. 1: pestaña **Historial de mi área**. Aut. 2: **Consulta de solicitudes** para ver todo ⚠ (es otra pantalla para ver estado).

### 2.3 RH
**Por enviar al proveedor**
1. Menú → **Por enviar al proveedor** (contador). Ve lo autorizado agrupado por fecha.
2. **Confirmar y generar transporte** (o *sin transporte*), o **Confirmar todas las de esta fecha**. Se crea una *solicitud de transporte ya aprobada* ⚠ que vive en otra pantalla. ⇄ Confirmar también se puede desde **Consulta de solicitudes**.
3. Si algo está mal: **Devolver** (motivo) o **Cancelar** (motivo).

**Transporte > Solicitudes y Formato de rutas**
4. ⚠ Para bajar el Excel del proveedor, va a **Todas las solicitudes** (ya en 2 saltos: el mensaje de éxito y un texto en Recepción tienen enlace) → filtra fecha → **Formato de rutas (proveedor)** → elige fecha/rango y estados → **Descargar Excel**.

**Resumen de horas extra (nómina y comedor)**
5. ⇄ El botón **Descargar resumen de horas extra** está en *Por enviar al proveedor* **y** en *Consulta*; elige periodo, área y qué incluir, ve la vista previa y baja el Excel.

**Transporte suelto**
6. Menú → Nueva solicitud (transporte) → llenar pasajeros → guardar → ⚠ queda *pendiente* → en **Todas las solicitudes** hay que **Aprobar** (⚠ el mismo RH que la creó) antes de que salga en el formato del proveedor. Es el flujo que se oculta.

**Cancelar/devolver un autorizado**: desde Recepción o Consulta (⇄).

### 2.4 Admin (y RH en lo suyo)
1. **Padrón de empleados**: alta/edición/baja. ⚠ La **importación** del padrón y el **respaldo** están en *Catálogos del sistema* (otra pantalla).
2. **Estructura**: Áreas (participa en TE) → Puestos (alias, **Nivel**, asignar puestos) → Excepciones y pendientes → Turnos. ⚠ "Asignar puestos y áreas" aparece también dentro de la importación.
3. **Usuarios y accesos**: *Usuarios* (alta individual o en lote con Excel de accesos) → *Asignaciones* (asignar roles por área, **Actualizar nombres y puestos**) → *Organigrama*. ⇄ Asignar se puede hacer desde la tabla o desde los "+" del organigrama; ⚠ crear usuario también se ofrece al asignar.
4. **Configuración** (personal): ayudas, letra, tema. ⇄ **Perfil**: contraseña y datos.
5. **Herramientas**: *Catálogos › Diagnóstico* (Revisar colecciones, Limpiar estructura vieja). ⚠ Están escondidas dentro de una pestaña de catálogos.

---

## 3. EVALUACIÓN (resumen de veredictos)

**Se junta con…**
- M02 + R03 + R14 + Portal + `TiempoExtraInicio` → **un solo Inicio** para RH/admin (el panel de `/rutas`).
- K01 + K16 + A01 → una sola tarjeta "Por enviar al proveedor".
- A16 + A17 (+ A24, A20) → una sola pantalla **Descargas**.
- A18 → confirmar solo en *Por enviar al proveedor*.
- R04 + R05 → **Mi cuenta** (contraseña, ayudas, letra, tema).
- A30 (importar empleados + respaldo) → pasan a **Padrón de empleados**.

**Se oculta** (código se conserva)
- R06, R08, R09 (transporte suelto y su consulta), M03, M04, M28, A06, A07, A23, A25, A27, K02, K04, el filtro "Origen", "Todas las pendientes", los contadores de transporte manual, `useTransporteAnterior`.
- A31 (Diagnóstico) → "Herramientas del administrador". A32 "Crear estructura inicial" y A37 "Carga inicial" una vez usadas.

**Se elimina**
- R14 (`/tiempo-extra`), `Portal.jsx`, `TiempoExtraInicio.jsx`, `Proximamente.jsx`, las 9 redirecciones (R23–R31), K03 (doble conteo), K15, A09, C02–C06, C11–C13, y en la consola de Firebase `areasTE`, `config/*`, `accesosTE`, y `PuntosReunion` si está vacía.

**Se renombra / se mueve**
- URLs `/rutas/rh/*` → fuera del prefijo "rutas" (con redirección). Textos del menú (§4.2).

El detalle por elemento está en la columna *Veredicto* de las tablas 1a–1g.

---

## 4. PROPUESTA DE REORGANIZACIÓN

### 4.1 Inicio de admin y RH
La primera pantalla (`/`) será el actual panel de `/rutas`, pasando de "Transporte" a **Inicio** (archivo `InicioRH.jsx`; `/rutas` redirige a `/`). Se conserva su estructura: saludo, indicadores, accesos, tabla de próximos servicios.

**Indicadores de tiempo extra para sumarle** (todos salen de `useResumenTE().planta`, que ya está en tiempo real; sin lecturas nuevas):

| # | Indicador | Cómo se calcula | Por qué sirve |
|---|---|---|---|
| 1 | **Por enviar al proveedor** (resalta si >0) | estatus `autorizada` | Es la tarea diaria de RH |
| 2 | **Fechas vencidas sin confirmar** | `autorizada` con `fechaTE < hoy` | Lo que se pasó sin confirmar |
| 3 | **Por autorizar** (nivel 1 · nivel 2) | `pendiente_aut1` / `pendiente_aut2` | RH firma nivel 2 |
| 4 | **Más antigua sin autorizar** | `haceTiempo` del más viejo | Detecta cuellos de botella |
| 5 | **Devueltas sin corregir** | estatus `devuelta` | Seguimiento a las áreas |
| 6 | **Horas extra autorizadas: semana / mes** | `resumen.totalHoras` | Costo, lo que nómina pregunta |
| 7 | **Empleados con TE esta semana** | `resumen.totalEmpleados` | Dimensión del turno |
| 8 | **Con transporte solicitado (próximos 7 días)** | `resumen.totalTransporte` | Lo que se manda al proveedor |

Y se **ajustan los de transporte**: "Pendientes" desaparece (0 sin manuales), "Mes en curso" pasa a "Solicitudes de transporte del mes", y "Personal activo" y "Rutas activas" quedan como segunda fila pequeña. La tabla "Próximos servicios" pasa a **"Próximos tiempos extra (7 días)"**: folio, área, fecha, empleados, horas, transporte, estatus; los de transporte ya salen porque nacen de ellos.

**Accesos rápidos / tarjetas** (en este orden): Por enviar al proveedor · Por autorizar · Solicitar tiempo extra · Todas las solicitudes de tiempo extra · Solicitudes de transporte · Descargas.

### 4.2 Menú lateral final, por rol

**Admin y RH** (el admin añade solo "Herramientas")
```
Inicio
TIEMPO EXTRA
  Solicitar tiempo extra
  Mis solicitudes
  Por autorizar            (contador)
  Por enviar al proveedor  (contador)
  Todas las solicitudes
TRANSPORTE
  Solicitudes de transporte  (contador solo si hay pendientes)
  Rutas y puntos de reunión
DESCARGAS
  Descargas  (formato de rutas, horas extra, consulta)
PERSONAL Y ESTRUCTURA
  Padrón de empleados        (aquí: importar y respaldo)
  Estructura                 (áreas, puestos, turnos)
  Usuarios y accesos         (usuarios, asignaciones)
  Organigrama
HERRAMIENTAS (solo admin)
  Diagnóstico y limpieza
—— pie: Mi cuenta · Cerrar sesión
```
**Aut. 2**
```
Inicio · Por autorizar (contador) · Todas las solicitudes · Organigrama · Asignar roles
(+ Solicitar tiempo extra y Mis solicitudes si también es solicitante o Aut. 1)
```
**Aut. 1**
```
Inicio · Solicitar tiempo extra · Mis solicitudes · Por autorizar (contador) · Mi área
```
**Solicitante**
```
Inicio · Solicitar tiempo extra · Mis solicitudes
```
**Usuario sin rol**: Inicio (con el aviso de que pida acceso a RH).

Nombres pensados para personas poco acostumbradas a la tecnología: verbos claros ("Solicitar", "Por autorizar", "Por enviar"), sin "Resumen", "Catálogos del sistema" ni "Consulta"; una sola opción llamada "Mis solicitudes".

### 4.3 Qué se junta o se renombra
- **Inicio** ← Portal + panel de rutas + resumen de TE.
- **Descargas** ← botones de Consulta, Recepción y Formato de rutas. Es una pantalla con 3 tarjetas: Formato de rutas (proveedor) · Resumen de horas extra (nómina y comedor) · Lista de solicitudes (Excel de consulta). Los botones actuales quedan donde están hasta decidir (D3).
- **Mi cuenta** ← Perfil + Configuración.
- **Padrón de empleados** recibe *Importar empleados* y *Exportar padrón*.
- **Rutas y puntos de reunión** ← "Catálogos del sistema" (rutas, comunidades, puntos + *Importar directorio*).
- **Solicitudes de transporte** ← "Todas las solicitudes" del módulo de rutas.

### 4.4 Cómo queda el Inicio de cada rol
- **RH/admin**: panel de §4.1.
- **Aut. 2**: lo que ya tiene (Por autorizar nivel 2, planta, semana por área) + "Más antigua sin autorizar" y "Autorizadas hoy".
- **Aut. 1**: Por autorizar, mi área, borradores/devueltas, próximos autorizados, últimas del área (sin cambios).
- **Solicitante**: botón Solicitar, mis estados (cada tarjeta abre su pestaña), próximos autorizados.
- **Sin rol**: aviso.

### 4.5 Ocultar "Nueva solicitud" y "Mis solicitudes" de transporte sin dejar ningún camino
**Interruptor**: un archivo `src/funciones.js` (reemplaza a `modulos.js`) con
```js
export const FUNCIONES = { transporteSuelto: false };
```
Con `true`, todo vuelve. Hay que cubrir **todos** estos puntos:

| # | Dónde | Qué esconder |
|---|---|---|
| 1 | `App.jsx` | Rutas `/rutas/solicitud/nueva`, `/rutas/solicitud/editar/:id`, `/rutas/mis-solicitudes`, y sus 3 redirecciones antiguas (que se eliminan) → envolver en un guardia que, con el interruptor apagado, regrese a `/` |
| 2 | `utils/navegacion.js` | Ítems M03, M04 (RH) y M28 (resto); el parámetro `transporteAnterior` |
| 3 | `Navbar.jsx` | `useTransporteAnterior` (ahorra una lectura por sesión), badge `novedadesUser` y listener de novedades |
| 4 | `hooks/usePendientes.js` | `usePendientesRutas`: dejar de escuchar `novedades` y `pendientes` si el interruptor está apagado |
| 5 | `pages/Inicio.jsx` (panel) | Tarjetas "Nueva solicitud" y "Mis solicitudes" y el enlace "Ver todas" hacia R06 |
| 6 | `RhSolicitudes.jsx` | Botón lápiz "Editar (RH)" (A23), botones Aprobar/Rechazar/Revertir (A25), "Todas las pendientes" y filtro "Origen" |
| 7 | `modulos.js` | Contador del módulo "rutas" (desaparece junto con el portal) |
| 8 | Reglas | Nada que cambiar; ya solo RH/admin crean. Se puede endurecer: `create` solo si `origen == 'tiempo_extra'` (opcional, fase 2) |
| 9 | Pruebas | `tests/navegacion.test.js` debe cubrir ambas posiciones del interruptor |

Efecto colateral que hay que aceptar: quien tenía transporte suelto propio de antes **dejará de poder consultarlo** en la app (RH sigue viéndolo en *Solicitudes de transporte*).

### 4.6 Otras mejoras pequeñas que salieron del análisis
- Pantalla 404 (R32).
- Que las tarjetas del Inicio abran la pestaña correspondiente de *Mis solicitudes*.
- Ayuda de pantalla (`AyudaPantalla`) solo existe en 6 pantallas; faltan Inicio, Descargas, Padrón, Organigrama, Asignaciones.
- Actualizar `docs/estructura.md` y `docs/tiempo-extra.md` con estas rutas.

### 4.7 Orden sugerido de trabajo (cuando lo autorices)
1. Interruptor `funciones.js` y ocultar transporte suelto (§4.5).
2. Inicio nuevo de RH/admin y retiro de Portal / `TiempoExtraInicio` / menú.
3. Menú nuevo por rol.
4. Pantalla Descargas.
5. Mover importación y respaldo al Padrón; "Mi cuenta".
6. Limpieza de código muerto y archivos (C01–C13) y de la consola de Firebase.
7. Cambio de URLs (`/rutas/rh/*`) con redirecciones temporales.

---

## 5. Decisiones que necesito de ti

| ID | Decisión | Mi recomendación |
|---|---|---|
| D1 | ¿La pantalla **Descargas** es nueva (tarjetas) o dejamos los botones donde están? | Pantalla nueva, y conservar un acceso directo en Recepción |
| D2 | ¿Se junta **Perfil + Configuración** en "Mi cuenta"? | Sí |
| D3 | ¿RH puede **confirmar** solo en *Por enviar al proveedor* (y en Consulta solo devolver/cancelar)? | Sí, para que haya un solo camino |
| D4 | ¿Cambiamos las **URLs** `/rutas/rh/*` (con redirecciones) o solo los nombres del menú? | Cambiarlas, pero al final (§4.7 paso 7) |
| D5 | Con el transporte suelto oculto, ¿RH conserva el lápiz **Editar** para corregir solicitudes manuales antiguas? | Ocultarlo también; se reactiva con el interruptor |
| D6 | ¿**Quitar las 9 redirecciones** de URLs anteriores a los módulos? | Sí, nadie las usa (confirmar que nadie tenga favoritos viejos) |
| D7 | ¿Aprobar/Rechazar/Revertir de transporte se oculta con el interruptor o se deja visible para el histórico? | Ocultarlo |
| D8 | Nombre de la sección de transporte: ¿"Solicitudes de transporte" o dejar "Todas las solicitudes"? | "Solicitudes de transporte" (hay otra "Todas las solicitudes" de TE) |
| D9 | ¿Borrar `areasTE`, `config/*`, `accesosTE` y `PuntosReunion` de Firebase? Requiere revisar la consola | Sí, tras confirmar que están vacías o respaldadas |
| D10 | ¿"Carga inicial" de asignaciones y "Crear estructura inicial" se ocultan ya o después del piloto? | Después del piloto |
| D11 | ¿Los indicadores de §4.1 son los correctos? ¿Cuáles quitarías/agregarías? | Los 8 propuestos |
