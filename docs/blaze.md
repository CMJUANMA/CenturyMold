# Plan para el plan Blaze (después del piloto)

**Decisión vigente: Blaze NO se activa hasta que termine el piloto.** Este documento es el plan para presentarlo y ejecutarlo después. Todo lo de aquí está pendiente en `docs/seguridad.md`
(P-1 a P-4 y S-02, S-10, S-12, S-18).

## Por qué

Hoy la app crea las cuentas **desde el navegador** y no puede cambiar contraseñas ajenas. Eso obliga a tener el registro abierto en Authentication, a restablecer contraseñas con un asistente manual
(borrar la cuenta en la consola y crear otra), a escribir la bitácora desde el navegador (puede inventarse un renglón) y a no tener respaldos programados. Con funciones en el servidor (Admin SDK) todo eso se resuelve.

| Hoy (Spark) | Con Blaze |
|---|---|
| Registro abierto: cualquiera con la configuración pública puede crear cuentas basura u ocupar una nómina | Registro cerrado; solo la función crea cuentas |
| Restablecer contraseña = crear una cuenta de la versión siguiente y mover el perfil (el uid cambia y se pierde «Mis solicitudes» de la persona; accesos/{nomina} dice qué correo usar) | La función pone una contraseña temporal a la **misma** cuenta; no se pierde nada |
| Desactivar un usuario: la app y las reglas lo bloquean al instante, pero el token de Authentication sigue vivo | Se revocan sus sesiones y se deshabilita la cuenta |
| Bitácora e historial escritos por el navegador | Escritos por el servidor: inalterables |
| Respaldo manual (JSON) semanal | Copias diarias automáticas con retención y recuperación a un punto en el tiempo |
| Nómina única solo «de palabra» (la app lo evita en pantalla) | La función rechaza nóminas duplicadas |

## Qué se construye (cuatro piezas, en este orden)

1. **Funciones de usuarios** (callable, solo admin/RH; región `us-central1` o la más cercana):
   - `crearUsuario({ nomina, nombre, rol })`: crea la cuenta `{nómina}@rutas.app` con contraseña temporal `CM-XXXX-XXXX` y `debeCambiarPassword: true`, y el perfil `usuarios/{uid}`. Rechaza nómina repetida. Un RH solo puede crear rol `usuario` (como las reglas actuales).
   - `crearUsuariosLote([...])`: lo mismo en lote (para el Excel de accesos).
   - `restablecerPassword({ uid })`: nueva contraseña temporal para la **misma** cuenta, `debeCambiarPassword: true`, revoca sesiones. **Reemplaza el flujo actual de «Restablecer contraseña»** (cuenta nueva `{nómina}.vN@rutas.app` + `accesos/{nomina}`): al llegar Blaze la función cambia la contraseña directamente, el login deja de leer `accesos/`, se **limpian las cuentas viejas** (las que quedaron sin perfil, de las versiones anteriores) con el Admin SDK y se retiran la colección `accesos`, sus reglas (`get` público) y `utils/accesos*.js`.
   - `cambiarEstadoUsuario({ uid, activo })`: pone `activo`, **deshabilita la cuenta** y revoca los tokens (hoy solo cambia el perfil).
   - La contraseña temporal se devuelve **una sola vez** a quien la pide y no se guarda.
   - Después: **cerrar el registro abierto** (ver pasos) y retirar la app secundaria (`firebaseSecundario.js`) y el flujo de «Restablecer contraseña» por versiones de cuenta.
2. **Bitácora e historial del lado del servidor**: disparadores sobre `asignaciones`, `usuarios` y `tiempoExtra` que escriben el renglón de bitácora/historial (quién, qué, antes/después) con el uid de la petición.
   Las reglas pasan a `allow create, update, delete: if false` para esas colecciones de bitácora/historial (el cliente solo lee).
3. **Respaldos programados de Firestore**: copia diaria con retención (por ejemplo 7 diarias + 4 semanales) y recuperación a un punto en el tiempo (7 días). El «Respaldo completo (JSON)» se conserva como segunda copia.
4. **Nómina única y revocación**: `nominas/{nómina}` (o validación dentro de `crearUsuario`) para impedir dos usuarios con la misma nómina; revisión de sesiones activas al cambiar el rol.

Esfuerzo estimado: piezas 1 y 4, 2–3 días; pieza 2, 1–2 días; pieza 3, medio día (configuración). Cada pieza con sus pruebas (las de reglas ya existen y se adaptan).

## Costo estimado (confirmar en la calculadora de precios de Firebase)

Blaze es **pago por uso con las mismas cuotas gratuitas** de Spark (Hosting, Firestore, Authentication siguen gratis dentro de sus topes) y exige una tarjeta. Para esta planta (decenas o pocos cientos de usuarios):

| Concepto | Uso esperado | Costo mensual estimado |
|---|---|---|
| Cloud Functions (invocaciones, cómputo) | cientos al mes | 0 USD (la cuota gratuita incluye 2 millones de invocaciones) |
| Artifact Registry / Cloud Build (al desplegar funciones) | unos MB | ~0–0.50 USD |
| Respaldos programados de Firestore (almacenamiento) | decenas de MB × retención | ~0.10–2 USD |
| Authentication (verificación en dos pasos por SMS, si se activara) | — | solo si se usa SMS (no necesario) |
| **Total esperado** | | **0–3 USD/mes** (tope razonable 5 USD) |

**Control de gasto:** al activar Blaze, crear una **alerta de presupuesto** (por ejemplo 5 USD y 10 USD) y revisarla el primer mes. Una función con un error de bucle es el riesgo típico: por eso las funciones son *callable* con autenticación y sin disparadores recursivos.

## Pendiente opcional: que «Vencida» sea un estatus real

Hoy una solicitud **vencida** (su fecha ya pasó y sigue en borrador, pendiente_aut1, pendiente_aut2 o devuelta) **no se guarda como estatus**: la app la calcula con `esVencida` (`src/utils/tiempoExtra.js`,
hora de México) en cada pantalla, y las reglas de Firestore bloquean autorizar y devolver comparando `fechaTE` con `request.time`. Funciona sin servidor, pero tiene límites:
- Las consultas de Firestore no la conocen: las bandejas leen todas las pendientes y descartan las vencidas en el navegador.
- Reportes y Excel que lean Firestore fuera de la app verían todavía «pendiente».
Con Blaze, una **función programada** (cada noche, 00:05 hora de México) puede cambiar `estatus` a `vencida` (con `estatusAnterior`, para poder duplicar o auditar), escribir su renglón de historial y de bitácora, y las
bandejas pasarían a consultar `where('estatus', '==', 'pendiente_aut…')` sin filtrar en el cliente. Al hacerlo: agregar `vencida` a `ESTATUS_TE`, quitar el cálculo de `esVencida` (o dejarlo como respaldo) y
ajustar `tests/vencidas-te.test.js` y las reglas (`pasoElDia`).

## Pasos en la consola (cuando se decida)

1. **Facturación.** Firebase Console › Configuración del proyecto › Uso y facturación › **Modificar plan** › Blaze. Elegir la cuenta de facturación (o crearla con la tarjeta de la empresa).
2. **Presupuesto y alertas.** Google Cloud Console › Facturación › Presupuestos y alertas › Crear presupuesto: 5 USD, alertas al 50 %, 90 % y 100 %, con correo a quien administra el proyecto.
3. **Herramientas.** En la computadora de desarrollo: `npm i -g firebase-tools` (ya está en el proyecto), `firebase init functions` (JavaScript, Node 20+, carpeta `functions/`), `firebase deploy --only functions`.
4. **Permisos de la función.** Las funciones usan la cuenta de servicio por defecto (puede administrar Authentication y Firestore). Verificar en Google Cloud Console › IAM que no tenga roles de más.
5. **Cerrar el registro abierto** (solo cuando las funciones de la pieza 1 ya funcionen en producción):
   Firebase Console › Authentication › Settings › User actions › quitar **Enable create (sign-up)**. Si la opción no aparece, actualizar a **Authentication con Identity Platform** (Authentication › Settings; sin costo para el volumen de la planta) y desactivar el registro en Identity Platform › Settings › User actions.
   Después probar: *Nuevo usuario*, *Crear usuarios en lote* y *Restablecer contraseña* desde la app (ahora vía funciones).
6. **Respaldos programados.** Firestore › Backups › Create schedule (diario, retención 7 días) y otra semanal (retención 28 días); activar **Point-in-time recovery** (Firestore › Disaster recovery). Probar una restauración a una base nueva antes de confiar en ella.
7. **Protección contra eliminación.** Firestore › Database settings › **Delete protection** activada.
8. **Verificación en dos pasos** en las cuentas con rol Propietario/Editor del proyecto (si aún no se hizo).
9. **App Check** (opcional, ver `docs/seguridad.md` S-11): ya hay código listo; con Identity Platform también se puede aplicar a Authentication.

## Orden recomendado y criterio de salida

1. Terminar el piloto (Blaze sigue apagado; respaldo semanal con *Herramientas › Respaldo completo*; el Inicio del admin lo recuerda).
2. Activar Blaze + presupuesto (pasos 1–2). Desplegar la pieza 1 en paralelo con el registro abierto aún activo; probar con 2–3 usuarios.
3. Pasar la app a las funciones, **cerrar el registro** (paso 5), retirar el asistente manual y la app secundaria.
4. Piezas 2 y 3 (bitácora del servidor, respaldos programados); probar una restauración.
5. Actualizar `docs/seguridad.md` (cerrar S-02, S-10, S-12, S-18, S-01).

**Listo cuando:** no se puede crear una cuenta desde fuera de la app; restablecer contraseña conserva el uid; la bitácora no se puede escribir desde el navegador; hay copias diarias y una restauración probada.

## Plan de retorno

Si algo falla: las funciones se pueden desactivar sin tocar los datos (`firebase functions:delete`), reabrir el registro en la consola y volver al asistente manual (el código se conserva en el historial de git hasta el retiro definitivo). Blaze se puede volver a Spark desde la misma pantalla de facturación.
