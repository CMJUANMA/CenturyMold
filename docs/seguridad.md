# Auditoría de seguridad

Auditoría previa al piloto en todas las áreas (19/oct/2026). Alcance: reglas de Firestore, Authentication, Hosting, código del cliente, Excel, dependencias,
secretos, sesión, datos personales, respaldos y App Check. Método: lectura de todo el código y de las reglas, **intentos de ataque con pruebas** contra el
emulador (como solicitante, Aut. 1, RH, sin perfil y sin sesión), `npm audit`, búsqueda de secretos en todo el historial de git y un recorrido de la app
con la política de seguridad de contenido aplicada.

**Resultado: ningún hallazgo Crítico.** Con las reglas anteriores, un usuario con sesión podía falsificar nombres en firmas y bitácora, escribir documentos
enormes y (RH) cambiar la nómina de un usuario; esos puntos y otros 8 ya están corregidos y probados. Lo que queda pendiente requiere el plan Blaze
(funciones en el servidor) o una decisión tuya; está al final con costo y recomendación.

Estado: ✅ corregido y probado · ⏳ pendiente (Blaze o decisión) · ℹ️ informativo / aceptado.

## Resumen de hallazgos

| # | Nivel | Hallazgo | Estado |
|---|---|---|---|
| S-01 | **Alto** | Sin respaldos automáticos de la base de datos | ✅ respaldo manual completo · ⏳ programado (Blaze) |
| S-02 | **Medio** | Registro abierto en Authentication (cualquiera con la configuración pública puede crear cuentas) | ⏳ Blaze |
| S-03 | **Medio** | Firmas, historial, bitácora y asignaciones con el nombre falsificable (solo se validaba el uid / la nómina) | ✅ |
| S-04 | **Medio** | Solicitudes de tiempo extra sin tipos ni topes: documentos enormes, `resumen` con cifras absurdas, empleados con campos de cualquier tipo | ✅ |
| S-05 | **Medio** | RH podía cambiar la nómina de un usuario (y heredar los roles de otra persona); dos usuarios pueden compartir nómina | ✅ cambio de nómina · ⏳ duplicados |
| S-06 | **Medio** | Sin encabezados de seguridad (CSP, anti‑clickjacking, HSTS, etc.) | ✅ |
| S-07 | **Medio** | Sin cierre de sesión por inactividad (equipos compartidos) | ✅ 15 min |
| S-08 | **Medio** | Inyección de fórmulas en los Excel que se descargan | ✅ |
| S-09 | **Medio** | Altas, cambios de rol y desactivaciones de usuarios y las descargas de Excel no quedaban en la bitácora | ✅ |
| S-10 | **Medio** | La bitácora y el historial los escribe el navegador: un RH malicioso puede inventar renglones a su nombre | ⏳ Blaze |
| S-11 | **Medio** | App Check apagado (cualquier script con la configuración pública puede hablar con Firestore) | ✅ código listo · ⏳ pasos en consola |
| S-12 | **Medio** | Enumeración de cuentas: el registro abierto revela qué nóminas existen (`email-already-in-use`) | ⏳ Blaze + consola |
| S-13 | Bajo | Política de contraseñas débil (6 caracteres en la temporal, sin complejidad) | ✅ |
| S-14 | Bajo | Sin protección extra contra intentos repetidos (solo el límite de Firebase) | ⏳ opcional |
| S-15 | Bajo | Importaciones de Excel sin límite de tamaño ni de filas | ✅ |
| S-16 | Bajo | `exceljs` 4.4.0 sin mantenimiento desde 2023 (lee archivos de usuarios) | ⏳ decisión |
| S-17 | Bajo | `npm audit`: 17 avisos (12 altos) | ℹ️ ninguno alcanzable en el navegador |
| S-18 | Bajo | `debeCambiarPassword` se baja desde el cliente (se puede saltar el cambio obligatorio) | ℹ️ aceptado |
| S-19 | Bajo | La Aut. 2 lee todos los usuarios y todo el padrón; cualquier usuario activo lee quién es Aut. 2 | ℹ️ por diseño |
| S-20 | Bajo | Reglas del transporte suelto (apagado) y de la colección heredada `PuntosReunion` sin topes | ✅ topes · ℹ️ se pueden retirar |
| S-21 | Bajo | `resumen` de cada solicitud lo calcula el cliente (RH lo contrasta al recibir) | ✅ acotado · ⏳ cálculo en servidor (Blaze) |
| S-22 | Bajo | Minimización de datos personales (fecha de alta, departamento, nivel) | ⏳ decisión |
| S-23 | Info | Margen de las reglas: tope de 1000 expresiones por petición | ℹ️ ver nota |
| S-24 | Info | Secretos: ninguno en el repo ni en el historial; la configuración web de Firebase es pública | ℹ️ |

---

## Detalle de los hallazgos

### S-01 · Alto · Sin respaldos automáticos
- **Qué es.** Lo único que se respalda es el padrón (Excel, a mano). Usuarios, asignaciones, tiempo extra, bitácora y estructura no tienen copia.
- **Cómo se aprovecha (o se sufre).** Un error de un admin, una importación mal hecha, un bug o una cuenta de admin comprometida pueden borrar o corromper datos sin forma de volver atrás.
- **Corrección.** ✅ *Herramientas › Respaldo completo (JSON)* (solo admin): descarga todas las colecciones, con las subcolecciones del tiempo extra, y deja el renglón en la bitácora.
  Hacerlo cada semana. ⏳ Programado: Firestore tiene copias programadas y recuperación a un punto en el tiempo (**requieren Blaze**). Ver «Pendientes».
- Limitación: el JSON no se restaura desde la app (hoy se restauraría con un script). No incluye los borradores de otras personas (las reglas no lo permiten) ni las cuentas de Authentication.

### S-02 · Medio · Registro abierto en Authentication
- **Qué es.** La app crea cuentas desde el navegador (app secundaria con la configuración pública). Por eso el registro por correo y contraseña tiene que estar abierto: cualquiera con la
  configuración pública (que viaja en el JavaScript) puede crear cuentas `loquesea@rutas.app`.
- **Qué NO pasa.** Una cuenta sin perfil no puede leer ni escribir nada: las reglas exigen perfil activo y nadie puede crearse su propio perfil (probado en `firestore.rules.auditoria.test.js`).
- **Cómo se aprovecha.** (1) *Ocupar nóminas*: alguien crea `50610@rutas.app` antes de que RH dé de alta a esa persona; el alta falla con «cuenta huérfana» y hay que borrarla en la consola (detectable, no peligroso:
  el perfil nunca se liga a esa cuenta). (2) *Ruido y cuota*: miles de cuentas basura. (3) *Enumerar nóminas* (S-12).
- **Corrección.** Requiere cerrar el registro y crear las cuentas desde una **Cloud Function** con el Admin SDK (también sirve para restablecer contraseñas de verdad): **Blaze**. Mientras tanto,
  las reglas contienen el daño y la sección «Pasos en la consola» reduce la superficie.

### S-03 · Medio · Nombres falsificables  ✅
- **Qué era.** Las reglas comprobaban el uid y la nómina de quien firma, pero no el `nombre`. Un Aut. 1 podía firmar con `nombre: "MALDONADO SALVADOR"` y el Excel/pantalla mostraba ese nombre; un RH podía escribir
  en la bitácora con el nombre de otra persona; una asignación podía decir «asignada por» otro nombre. También se aceptaban campos de más dentro de las firmas.
- **Corrección.** Firmas (`aut1`, `aut2`), devoluciones, `recibidaPor`, `canceladaPor`, historial, bitácora y `asignadoPor` solo aceptan los campos del modelo y el **nombre real del perfil** de quien actúa;
  `creadoPorNombre` y `areaNombre` deben coincidir con el perfil y con el área. Pruebas: «no aparenta ser otra persona…», «no autoriza … firma por otra persona…», «la bitácora lleva su nombre…».

### S-04 · Medio · Solicitudes sin tipos ni topes  ✅
- **Qué era.** Un cliente modificado podía guardar un comentario de 900 KB, un `resumen` con 999 999 empleados, una lista `desgloseRutas` de miles de elementos, empleados con campos del tipo equivocado o nombres enormes;
  también valores enormes en `rutaId` del padrón (solicitante) o en perfiles y catálogos (RH). Efecto: documentos que rompen pantallas y exportaciones, costo de lecturas, datos falsos en los Excel.
- **Corrección.** Topes y tipos en solicitudes (fecha `AAAA-MM-DD`, motivo ≤ 60, comentario ≤ 1000, resumen y rutas acotados), empleados de la solicitud (campos del modelo, `horas` 0–48, booleanos, textos cortos), historial, asignaciones, perfiles,
  áreas, puestos (alias ≤ 50), catálogos de transporte (≤ 25 campos) y el padrón que editan solicitantes. Se aplica en captura, corrección, envío y reenvío (no se escapa por otra transición). Las pruebas nuevas se corrieron también contra las reglas anteriores: 15 de los
  grupos de ataque **pasaban** (es decir, el ataque funcionaba) y ahora fallan, que es lo correcto.

### S-05 · Medio · Nómina de un usuario  ✅ / ⏳
- **Qué era.** Las asignaciones (Aut. 2, Aut. 1, solicitante) van por **nómina**, y RH podía editar cualquier campo de los usuarios con rol «usuario», incluida la nómina. Escenario: RH pone en una cuenta que controla la nómina de la Aut. 2 y hereda su rol y su firma.
- **Corrección.** ✅ RH solo edita `nombre`, `rol` y `activo`. ⏳ Queda que RH puede **crear** un usuario con una nómina que ya existe (la app lo evita en pantalla, pero una regla no puede buscar duplicados). Mitigación ya activa: toda alta, cambio y desactivación
  de usuarios queda en la bitácora (S-09) y la pantalla de Usuarios muestra la nómina. Solución completa: un registro `nominas/{nómina}` único (o la función de S-02). Recomendación: hacerlo junto con las funciones.

### S-06 · Medio · Encabezados de seguridad  ✅
`firebase.json` ahora envía: **Content-Security-Policy** (`default-src 'self'`, `script-src 'self'` sin `unsafe-inline` ni `unsafe-eval`, `connect-src` solo Firestore y Authentication de Google, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-ancestors 'none'`, `upgrade-insecure-requests`), **X-Frame-Options: DENY**, **Strict-Transport-Security** (1 año, subdominios), **X-Content-Type-Options: nosniff**, **Referrer-Policy: strict-origin-when-cross-origin**,
**Permissions-Policy** (cámara, micrófono, geolocalización, pagos, USB… desactivados), **Cross-Origin-Opener-Policy / Resource-Policy: same-origin**.
- Para no necesitar `unsafe-inline` en scripts, el script del tema salió de `index.html` a `public/tema-inicial.js`. `style-src` conserva `'unsafe-inline'` porque React usa estilos en línea (riesgo bajo; no ejecutan código).
- Verificado en un navegador real recorriendo todas las pantallas con la CSP aplicada: sin bloqueos; y se comprobó que sí bloquea un `fetch` a otro dominio y un script en línea.
- Si algún día se usa App Check o se agrega otro servicio, hay que ampliar la CSP (ver S-11).

### S-07 · Medio · Inactividad  ✅
Cierre de sesión tras **15 minutos** sin teclado, mouse o toque, con aviso de 1 minuto («¿Sigues ahí?»). Cuenta entre pestañas (la hora de la última actividad se guarda en `localStorage`) y, si el navegador estuvo cerrado más de 15 minutos,
al volver pide iniciar sesión. Se cambia en `src/utils/inactividad.js` (`LIMITE_INACTIVIDAD_MS`). 15 minutos es un compromiso para equipos de planta que se comparten; si capturan formularios muy largos sin tocar nada, subirlo a 20–30.

### S-08 · Medio · Inyección de fórmulas en Excel  ✅
Nombres, puestos, motivos y comentarios los capturan usuarios y llegan a los Excel (padrón, resumen de horas extra, consulta, formato del proveedor, accesos, reportes de importación). Un texto que empieza con `=`, `+`, `-` o `@` puede ejecutarse al editar la celda o abrir como CSV
(`=HYPERLINK(...)`, DDE). Ahora **todo** libro pasa por `bufferSeguro` (`src/utils/excelSeguro.js`): antepone una comilla a esos textos (también en texto con formato y enlaces) y descarta fórmulas. Una prueba falla si cualquier archivo del código vuelve a llamar `writeBuffer` directamente.

### S-09 · Medio · Bitácora de usuarios y descargas  ✅
Se registran (uid y nombre reales, sin contraseñas ni contenido): alta, cambio de nombre/rol, activar y desactivar usuarios; restablecer acceso (ya existía); y las descargas: respaldo del padrón, resumen de horas extra, consulta de tiempo extra
(la Aut. 2 también), formato de rutas y respaldo completo. **El padrón no tenía registro de descargas**; ahora sí. Quién descarga qué: RH y admin (padrón, formato de rutas, resumen), Aut. 2 y RH (consulta de tiempo extra, solo lectura), admin (respaldo completo).
La Aut. 2 solo puede escribir renglones de asignaciones y de descargas; no lee la bitácora de descargas.

### S-10 · Medio · La bitácora la escribe el navegador  ⏳
Todo lo que el navegador escribe puede ser inventado por quien tenga permiso de escribirlo. Con las reglas actuales no se puede firmar como otra persona (S-03), ni editar ni borrar, pero un RH puede **agregar** renglones falsos a su propio nombre
(por ejemplo, «asignación revocada»). La única forma de que la bitácora sea inalterable es que la escriba el servidor al detectar el cambio (función con disparador): **Blaze**. Mientras tanto, la bitácora es evidencia razonable, no prueba legal.

### S-11 · Medio · App Check  ✅ código · ⏳ consola
`src/firebase.js` activa App Check con reCAPTCHA v3 si existe `VITE_APPCHECK_SITE_KEY` (hoy vacía: no hace nada). Con App Check «Aplicado» en Firestore, solo la app publicada en tu dominio puede consultar la base; un script externo con la configuración pública queda fuera.
No sustituye las reglas (son la barrera real). Pasos en «Pasos en la consola». Importante: al activarlo hay que agregar a la CSP los hosts de reCAPTCHA (ver el paso).

### S-12 · Medio · Enumeración de cuentas  ⏳
Dos vías: (1) el inicio de sesión: la app ya muestra el mismo mensaje para nómina inexistente y contraseña incorrecta, y Firebase tiene «Email enumeration protection» (se activa en la consola, ver pasos); (2) el registro abierto responde
`email-already-in-use` y revela qué nóminas existen (S-02, se cierra con Blaze). Impacto bajo: saber que existe la nómina 50610 no da acceso, pero ayuda a quien intenta adivinar contraseñas.

### S-13 · Bajo · Contraseñas  ✅
La app pide ahora **8 caracteres con letra y número**, rechaza contener la nómina, las contraseñas obvias y repetir la temporal/actual (primer acceso y Mi cuenta). La temporal que da RH debe tener 8+. Las contraseñas generadas `CM-XXXX-XXXX` tienen ~40 bits y se cambian en el primer acceso.
Firebase solo exige 6 caracteres en su lado; ver en «Pasos» por qué **no** conviene exigir un número desde la consola (las temporales pueden no llevar dígitos).

### S-14 · Bajo · Intentos repetidos  ⏳ opcional
Firebase limita los intentos fallidos por IP/cuenta (`auth/too-many-requests`, la app muestra un aviso). No hay CAPTCHA. Ataque a una nómina conocida con contraseñas comunes: lento y limitado. Opcional con Blaze: protección con reCAPTCHA Enterprise en el inicio de sesión.

### S-15 · Bajo · Importaciones de Excel  ✅
Se rechazan archivos de más de **5 MB**, libros con más de **20 000 filas**, **60 columnas** o **30 hojas** (antes de leerlos en memoria y después de leerlos), con un mensaje claro. Un archivo «bomba» de compresión podría aun así gastar memoria de **la persona de RH que lo abre** (solo su pestaña); no afecta a otros.

### S-16 · Bajo · `exceljs` sin mantenimiento ⏳ decisión
`exceljs` 4.4.0 (última versión, 2023) lee los .xlsx que importa RH. Riesgo: archivos manipulados contra una librería sin parches. Mitigaciones activas: solo RH/admin importan, límites de tamaño, los datos importados pasan por la validación de la importación y las reglas, y la versión está fija en `package-lock.json`.
Alternativas si quieres cerrarlo: SheetJS (licencia/versión del CDN) o importar CSV. Recomendación: dejarlo para el piloto y revisarlo después.

### S-17 · Bajo · Dependencias  ℹ️
`npm audit`: 17 avisos (12 altos, 5 moderados).
- **De ejecución (6):** `@grpc/grpc-js`, `@firebase/firestore`, `@firebase/firestore-compat`, `firebase` (aviso heredado de `grpc-js`, que es la versión de **Node**; el paquete del navegador no lo usa y no está en el *bundle*), y `uuid` / `exceljs` (el aviso es de `uuid` v3/v5/v6 con un búfer propio; `exceljs` usa `uuid` v4 sin búfer: no aplica).
  La «corrección» que propone `npm audit fix --force` es **bajar** a `firebase@9` o `exceljs@3`: no se aplica.
- **De desarrollo (11):** `firebase-tools` (y sus `basic-ftp`, `braces`, `chokidar`, `proxy-agent`…), `@firebase/rules-unit-testing`: solo corren en tu computadora, no se publican.
- Versiones: `package-lock.json` las fija; usar `npm ci` (no `npm install`) para reproducir. Recomendación: revisar `npm audit` y actualizar `firebase`/`firebase-tools` cada mes.

### S-18, S-19 · Bajo · aceptados
- `debeCambiarPassword`: el propio usuario puede bajar la bandera sin cambiar la contraseña (la app lo exige, las reglas no pueden saber si cambió la contraseña de Authentication). Efecto: se queda con la temporal. Se corrige con la función de S-02.
- La Aut. 2 lee todos los usuarios (nómina, nombre, rol, preferencias) y el padrón completo, y cualquier usuario activo ve quién es Aut. 2 (la pantalla avisa a quién notificar): es por diseño.

### S-20 · Bajo · reglas heredadas  ✅
Las reglas del transporte suelto (apagado) permitían al dueño escribir un historial sin tope; ahora ≤ 300 entradas y nombre ≤ 120. `PuntosReunion` (mayúscula) solo la usa Diagnóstico: si ya no se necesita, se puede quitar su regla.

### S-21 · Bajo · `resumen` calculado por el cliente  ✅ acotado / ⏳
Un cliente modificado puede declarar `totalTransporte: 0` con empleados que sí lo piden, o horas distintas. Ahora los valores están acotados y tienen el tipo correcto, y **RH lo contrasta al confirmar** (la app aborta si el resumen no coincide con los empleados). Cálculo en servidor: Blaze.

### S-22 · Bajo · Datos personales  ⏳ decisión
Datos del padrón: nómina, nombre, puesto, área, turno, departamento, nivel, **fecha de alta**, ruta/comunidad/punto de reunión. No hay salario, CURP, RFC, teléfono, domicilio ni datos médicos. Quién los ve: RH y admin (todos), la Aut. 2 (todos), Aut. 1 y solicitante (solo su área). Quién los descarga: RH y admin (padrón completo; ahora queda en la bitácora).
Minimización: `depto`, `descDepto`, `nivel` y `fechaAlta` los trae el reporte de nómina pero la app casi no los usa; se podrían dejar de guardar. Recomendación: decidir después del piloto cuáles se quedan.

### S-23 · Info · tope de 1000 expresiones
Firestore evalúa como máximo 1000 expresiones por petición. Las reglas de tiempo extra están cerca (la ruta más pesada, «Aut. 1 envía su solicitud», deja un margen de unas 60–120). Ya se compactó lo posible; **al agregar reglas nuevas a esas transiciones hay que volver a correr `npm run test:rules`**, que cubre cada transición.

### S-24 · Info · Secretos
- Búsqueda en **todo el historial** (39 commits, un autor): no hay claves de servicio, tokens, llaves privadas ni contraseñas reales; `.env` está en `.gitignore` y nunca se versionó; no hay `.pem`, `serviceAccount*` ni `credentials.json`.
  Las contraseñas `Prueba123` de `scripts/` son de los emuladores locales con datos ficticios. Una prueba (`seguridad.test.js`) falla si aparece una clave tipo `AIza…` o una llave privada en el código.
- La **configuración web de Firebase (apiKey, authDomain, projectId, appId…) es pública por diseño**: va dentro del JavaScript de cualquier app web, no autoriza nada por sí sola. Lo que protege son las reglas de Firestore, la restricción de la API key por dominio (ya la hiciste) y, opcionalmente, App Check.
- No pude comprobar si el repositorio de GitHub es privado; **verifícalo** (Settings › General › Danger zone). Aunque fuera público no expone secretos, pero sí tu estructura.

---

## Revisión por tema (lo que se comprobó)

**1. Reglas de Firestore.** Mínimo privilegio colección por colección; todo lo no listado está denegado. Comprobado con `tests/firestore.rules.auditoria.test.js` (32 intentos de ataque + 2 de respaldo): sin perfil / sin sesión / usuario dado de baja no leen ni escriben nada; un
solicitante no escala su rol, no se asigna roles, no lee otras áreas, la bitácora, otros usuarios ni todo el padrón, no se autoriza a sí mismo, no firma por otro, no infla el contador de folios (solo sube de uno en uno, ligado a su borrador); un Aut. 1 no firma otra área ni el nivel 2 ni da roles;
RH no da rh/admin, no borra usuarios, no edita la bitácora ni firma por otros. Más 314 pruebas anteriores que siguen pasando.

**2. Authentication.** Detalle en S-02, S-12, S-13, S-14. *Usuario desactivado con sesión abierta:* la app lo detecta en vivo (escucha su perfil) y cierra su sesión; además las reglas leen el perfil en **cada** petición, así que desde el instante en que `activo` pasa a `false` no puede leer ni escribir nada,
aunque su token siga vigente. Igual con un cambio de rol: la interfaz se actualiza sin recargar y las reglas aplican el rol nuevo de inmediato. Lo que no hay es revocación del token en Authentication (necesita el Admin SDK: función con Blaze); no es explotable porque las reglas ya lo niegan todo.

**3. Hosting.** S-06. En producción ya existía HSTS de Firebase; se agregó el resto.

**4. Código del cliente.** Sin `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` ni `document.write` (React escapa todo el texto). El único enlace externo (consola de Firebase en «Restablecer acceso») lleva `rel="noopener noreferrer"`.
`localStorage`/`sessionStorage` solo guardan el tema, la hora de la última actividad y una marca de recarga: nada de tokens ni datos personales (los tokens de Firebase los guarda el SDK en IndexedDB, como cualquier app de Firebase). Sin `console.log`; los `console.error` imprimen objetos de error de Firebase (códigos y rutas
de documentos, p. ej. un número de nómina), no datos de personas. Todo está vigilado por `tests/seguridad.test.js`.

**5. Excel.** S-08, S-15, S-16.

**6. Dependencias.** S-17.

**7. Secretos.** S-24.

**8. Sesión.** S-07 y lo de la desactivación (punto 2). La sesión persiste en el navegador (IndexedDB) hasta cerrar sesión o 15 min de inactividad. Si prefieres que se pierda al cerrar el navegador, se cambia la persistencia a `browserSessionPersistence` (cada pestaña pediría iniciar sesión).

**9. Datos personales.** S-22, S-09. Descargas de Excel: ahora todas las que hacen RH, admin y la Aut. 2 quedan en la bitácora, que solo leen RH y admin.

**10. Respaldos.** Hoy: respaldo del padrón (Excel) y, nuevo, **respaldo completo JSON** (admin). No hay respaldos programados (Blaze).

**11. App Check y la API key.** La restricción por dominio de la API key (hecha) es el primer paso: impide usarla desde otros sitios web (no desde un script que falsee el encabezado). Para endurecerla más, ver «Pasos» (restricción por API). App Check: S-11.

---

## Pasos en la consola (tuyos)

Los nombres pueden variar un poco según la versión de la consola (en inglés).

1. **Firebase Console › Authentication › Settings › User actions (o «Configuración de usuario»)**
   - Activa **Email enumeration protection**.
   - Si aparece **Enable create (sign-up)**, **no la desactives todavía**: la app crea las cuentas desde el navegador y dejaría de funcionar «Nuevo usuario», «Crear usuarios en lote» y «Restablecer acceso». Se desactiva cuando existan las funciones (S-02).
2. **Authentication › Sign-in method:** que solo esté habilitado **Email/Password** (apaga Anonymous y cualquier otro proveedor; no actives «Email link»).
3. **Authentication › Settings › Authorized domains:** deja solo `solicitud-rutas.web.app` y `solicitud-rutas.firebaseapp.com` (quita `localhost` si ya no desarrollas en esa computadora).
4. **Authentication › Settings › Password policy:** *si la consola te deja configurarla sin pasar a Identity Platform*: largo mínimo **8**, y **no** marques «Require numeric/uppercase/lowercase»: las contraseñas temporales `CM-XXXX-XXXX` son solo mayúsculas y dígitos y a veces no traen ningún dígito; la complejidad ya la exige la app a las contraseñas que elige cada persona. Si la consola pide actualizar a Identity Platform (Blaze), omítelo.
5. **Google Cloud Console › APIs y servicios › Credenciales › tu API key (Browser key):** además de las **restricciones de sitios web** que ya pusiste (`solicitud-rutas.web.app/*` y `solicitud-rutas.firebaseapp.com/*`), en **Restricciones de API** elige «Restringir clave» y deja **Identity Toolkit API**, **Token Service API** (Secure Token) y **Cloud Firestore API**.
   Prueba iniciando sesión después de guardar (tarda unos minutos en aplicarse).
6. **Cuentas con poder sobre el proyecto:** Firebase Console › Configuración del proyecto › Usuarios y permisos. Deja como Propietario/Editor solo a quien lo necesite y activa la **verificación en dos pasos** en esas cuentas de Google: son la llave maestra (pueden saltarse las reglas desde la consola).
7. **Firestore › Reglas:** comprueba que la fecha de publicación es de hoy (se desplegó con este cambio).
8. **GitHub:** confirma que el repositorio es privado y que quien lo ve tiene verificación en dos pasos.
9. **App Check (cuando decidas activarlo):**
   1. Firebase Console › App Check › Apps › tu app web › **reCAPTCHA v3** (o Enterprise): registra el sitio en https://www.google.com/recaptcha/admin (tipo v3, dominios `solicitud-rutas.web.app` y `solicitud-rutas.firebaseapp.com`) y pega la **clave secreta** en la consola.
   2. Pon la **clave de sitio** en `.env` como `VITE_APPCHECK_SITE_KEY=…`, compila y despliega.
   3. En `firebase.json`, en la CSP agrega: `script-src … https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`; `frame-src … https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/`; `connect-src … https://content-firebaseappcheck.googleapis.com https://www.google.com`.
   4. Entra con tu usuario y revisa en App Check › APIs la gráfica de «solicitudes verificadas». Solo cuando sea ~100 %, pulsa **Aplicar** en **Cloud Firestore**. (Para Authentication el cumplimiento requiere Identity Platform; no lo apliques ahí.)
10. **Antes de cada piloto ampliado:** corre *Herramientas › Respaldo completo* y guarda el archivo.

---

## Pendientes (Blaze o decisión), costo y recomendación

El plan **Blaze** es de pago por uso con las mismas cuotas gratuitas del plan Spark (Firestore, Authentication y Hosting siguen gratis hasta sus topes) y pide una tarjeta. Para esta planta (decenas o pocos cientos de usuarios) las funciones y las copias
cuestan **centavos a unos pocos dólares al mes** (estimación; confírmala en la calculadora de precios de Firebase y pon una **alerta de presupuesto** de, por ejemplo, 5 USD).

| # | Qué | Requiere | Costo estimado | Recomendación |
|---|---|---|---|---|
| P-1 | **Funciones: crear usuarios y restablecer contraseñas con el Admin SDK**; cerrar el registro abierto; `debeCambiarPassword` y revocar sesiones del lado servidor. Cierra S-02, S-12, S-18 y vuelve innecesario el asistente manual de «Restablecer acceso» | Blaze | ~0 USD/mes (invocaciones dentro de la cuota gratuita) | **Alta.** Es el cambio de seguridad de mayor valor. Hacerlo en la primera semana del piloto o antes. |
| P-2 | **Respaldos programados** de Firestore (copias diarias con retención) y recuperación a un punto en el tiempo | Blaze | ~0.1–2 USD/mes de almacenamiento | **Alta** (S-01). Mientras tanto: respaldo completo semanal (ya disponible). |
| P-3 | **Bitácora e historial escritos por el servidor** (disparadores) para que no se puedan inventar renglones | Blaze | ~0 USD/mes | Media (S-10). Hacerlo junto con P-1. |
| P-4 | **Nómina única** (`nominas/{nómina}`) o validación en la función de alta; cierra S-05 | Blaze o un poco de trabajo en reglas + migración | ~0 | Media. Junto con P-1. |
| P-5 | **Cálculo del resumen y folios en servidor** | Blaze | ~0 | Baja (S-21). |
| P-6 | **reCAPTCHA Enterprise / protección contra bots en el inicio de sesión** | Blaze (Identity Platform) | gratis hasta 10 000 evaluaciones/mes (verificar) | Baja (S-14). |
| P-7 | **Activar App Check** (pasos arriba) | Decisión tuya + reCAPTCHA (gratis) | 0 | Media: hazlo después de la primera semana, con la gráfica de verificadas al ~100 %. |
| P-8 | **Cambiar `exceljs`** por otra librería o por CSV | Decisión | trabajo | Baja (S-16): después del piloto. |
| P-9 | **Minimizar datos del padrón** (`depto`, `descDepto`, `nivel`, `fechaAlta`) | Decisión | trabajo | Baja (S-22). |
| P-10 | Tiempo de inactividad (hoy 15 min) y persistencia de la sesión | Decisión | 0 | Ajustar según lo que vean en planta. |
| P-11 | Que un Aut. 2 sin RH pueda capturar en Administrativo (ver `docs/permisos.md`) | Decisión | 0 | A tu criterio. |

## Cómo repetir la auditoría

- `npm test` corre todo: unitarias (incluye `seguridad.test.js`, `excel-seguro.test.js`, `permisos.test.js`) y de reglas (`firestore.rules.auditoria.test.js` con los ataques).
- Los encabezados se prueban en `tests/seguridad.test.js`. Después de desplegar cambios en la CSP, abre la app, recorre las pantallas con la consola del navegador abierta (F12) y revisa que no haya mensajes «Refused to … Content Security Policy».
- Regla práctica al tocar `firestore.rules`: cada regla nueva trae su prueba de «lo legítimo pasa» y «el abuso falla»; y si una transición de tiempo extra empieza a fallar con *«maximum of 1000 expressions»*, hay que compactar (S-23).
