# Solicitud de tiempo extra (TE)

Segundo módulo del portal. Esta etapa deja la **base**: áreas y niveles de autorización, padrón con área,
portal por módulos, modelo de datos y reglas de Firestore. Las pantallas de captura y de autorización
vienen después.

## Flujo

```
Solicitante del área ──captura──► pendiente_aut1 ──Aut. 1──► pendiente_aut2 ──Aut. 2──► autorizada ──RH──► procesada
                                       │                          │
                                       └──────── devuelta ◄───────┘   (con motivo; el solicitante corrige y reenvía:
                                                                       vuelve a empezar en Aut. 1)
```

- Se autoriza o se devuelve la **solicitud completa**. Devolver exige un motivo.
- **Aut. 1**: el autorizador1 o el suplente1 de esa área.
- **Aut. 2**: el titular (`autorizador2Nomina`), el suplente (`suplente2Nomina`) o **cualquier usuario RH/admin**.
  El historial registra quién firmó. RH solo firma en el nivel 2; si la Aut. 2 ya está firmada, RH solo consulta y descarga.
- Si quien captura es el Aut. 1 (o suplente) de esa área, la solicitud entra **directo a `pendiente_aut2`** y el historial
  lo registra (`creada`). Al reenviar una devuelta pasa lo mismo.
- **Nadie autoriza ni devuelve una solicitud que creó él mismo** (ni siquiera RH o la Aut. 2).
- Un solicitante solo debe incluir empleados de su área (ver "Limitaciones").

## Acceso: por la matriz, no por el rol

Todo se define por **número de nómina** (los puestos cambian):

| Acceso | Condición |
|---|---|
| Solicitante | su nómina está en `areasTE/{área}.solicitantesNominas` de alguna área |
| Aut. 1 | es `autorizador1Nomina` o `suplente1Nomina` de alguna área |
| Aut. 2 | es `autorizador2Nomina` o `suplente2Nomina` de `config/tiempoExtra`, o tiene rol RH/admin |

`useAccesosTE()` (`src/hooks/useAccesosTE.js`) devuelve `{ areasSolicitante, areasAut1, esAut2 }` (más `tieneAcceso`,
`cargando`, `error`, `matriz`) y lee la matriz **una vez por sesión** (`src/utils/matrizTE.js`). Al guardar la matriz,
la pantalla de niveles invalida esa caché (`invalidarMatrizTE()`).

Roles de `usuarios/{uid}.rol`: `superintendente` (se muestra como **Solicitante**; no se migró ningún dato), `rh`, `admin`
y el nuevo **`autorizador`**, para quien solo autoriza (directores y gerentes): no ve el módulo de rutas.

## Portal y módulos

- `/` es el portal: una tarjeta por módulo con el contador de pendientes de ese usuario.
- `/rutas/...` transporte (las URLs viejas `/solicitud/...`, `/mis-solicitudes`, `/rh/...` redirigen).
- `/tiempo-extra/...` tiempo extra; `/tiempo-extra/niveles` (RH) es la matriz.
- `src/modulos.js` configura cada módulo: `id`, `nombre`, `icono`, `base`, `acceso(usuario, {te})` y `useContador(...)`.
  Para un proceso nuevo: una entrada ahí, sus rutas bajo `base` en `App.jsx` (envueltas en `<RutaModulo modulo="..." />`)
  y, si lleva contador, su hook en `src/hooks/usePendientes.js`.

Contador de tiempo extra: Aut. 1 → `pendiente_aut1` de sus áreas; Aut. 2 → `pendiente_aut2`; RH → `autorizada` por recibir;
solicitante → sus `devuelta`. Nunca cuenta lo que creó la propia persona.

## Áreas, niveles y reglas

### `areasTE/{areaId}` (id = slug del nombre: `produccion`, `almacen`, `calidad`, `mantenimiento`, `moldes`)

```
nombre, activa,
autorizador1Nomina, suplente1Nomina (opcional),
solicitantesNominas: [nómina, ...]
```

### `config/tiempoExtra`

```
autorizador2Nomina, suplente2Nomina
```

### `config/areasTE` — reglas departamento + puesto → área

```
reglas: [ { depto: '316', puestos: ['QUALITY INSPECTOR'], area: 'calidad' }, { depto: '316', area: 'produccion' }, ... ]
```

Se evalúan **en orden**; gana la primera donde coincidan `depto` y, si trae `puestos`, el puesto. `area: ''` = sin área
(no participa en TE). Sin documento se usan las reglas iniciales de `src/utils/areasTE.js`. Se editan en
*Tiempo extra > Niveles de autorización > Reglas de área* (con un probador de combinaciones).

Reglas iniciales: 316 (QUALITY INSPECTOR → Calidad, resto → Producción), 317 → Calidad, 319 y 324 → Producción,
323 (RESINER o SCRAP MILLER → Producción, resto → Almacén), 322/328/329 → Almacén, 320 → Mantenimiento,
321 → Moldes, 318/331/461/472/474 → sin área. Un departamento **sin ninguna regla** también queda sin área, pero la
vista previa de la importación lo avisa aparte ("sin regla").

### Pantalla *Niveles de autorización* (RH)

Matriz como la hoja de Excel de RH: columnas = áreas; filas *Autorización 2* y *Por ausencia* a todo el ancho;
*Autorización 1*, *Aut. 1 por ausencia* (opcional) y *Solicitantes* por área. Cada celda se llena buscando en el padrón
por nombre o nómina. Si la persona no tiene usuario muestra **Sin usuario** y **Crear usuario** (abre el alta con nómina y
nombre ya llenos). El botón *Cargar configuración inicial* llena la matriz de prueba (sin guardar hasta presionar *Guardar*).

## Padrón con área e importación de nómina

`empleados/{nómina}` (id = nómina, como texto) gana: `depto`, `descDepto`, `turnoNomina` (A/B/C tal cual), `nivel`,
`fechaAlta` (`AAAA-MM-DD`), `areaTE` (id de área, `''` = sin área) y `areaTEManual`.

*Padrón de empleados > Importar* acepta el **formato propio** o el **reporte de nómina**, que se detecta por sus
encabezados (`numero_i, nombre, depto, desc_depto, turno, puesto, nivel_g, alta_g`; basta con `numero_i, nombre, depto, puesto`
y se busca en las primeras filas de cualquier hoja).

| Reporte | Empleado |
|---|---|
| numero_i | nómina (texto: hay nóminas cortas como `11` o `7219`) |
| nombre, puesto | nombre, puesto (el puesto se limpia: caracteres de control, `_x0002_`, espacios dobles/finales) |
| depto, desc_depto | `depto`, `descDepto` |
| turno, nivel_g, alta_g | `turnoNomina`, `nivel`, `fechaAlta` |

`areaTE` se calcula con las reglas. Si RH fija el área a mano (selector *Área de tiempo extra* en la edición del
empleado) se guarda `areaTEManual: true` y la importación ya no la pisa. La vista previa muestra el **conteo por área**,
los empleados **sin área** y los departamentos sin regla. Se conserva todo lo anterior: modos *agregar* / *sincronizar*,
bajas lógicas con umbral de seguridad y **no tocar ruta/comunidad/punto** cuando no vienen.

Tras cambiar las reglas, las áreas se recalculan en la próxima importación de nómina (no hay recálculo masivo).

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

`accion` (`creada | autorizada_1 | autorizada_2 | devuelta | reenviada | cancelada | recibida_rh`), `nivel`, `porUid`,
`porNomina`, `porNombre`, `comentario`, `fecha`. Cada entrada debe escribirse **en el mismo lote** que la transición
del padre (las reglas comparan el estatus antes/después) y por quien tiene el rol de esa acción.

### Estatus (`ESTATUS_TE` en `src/utils/constantes.js`)

`pendiente_aut1`, `pendiente_aut2`, `autorizada`, `devuelta`, `cancelada`, `procesada`, con `ESTATUS_TE_MAP`
(etiqueta y badge; `<BadgeEstatus modulo="te" />`) y `TRANSICIONES_TE` (de, a, quién, acción), la misma tabla que
aplican las reglas. Helpers: `transicionesTE(estatus, quien)` y `estatusInicialTE(esAut1DeLaArea)`.

| De | A | Quién |
|---|---|---|
| pendiente_aut1 | pendiente_aut2 / devuelta | Aut. 1 o suplente del área (no el creador) |
| pendiente_aut2 | autorizada / devuelta | Aut. 2, suplente o RH (no el creador) |
| autorizada | procesada | RH |
| pendiente_aut1, pendiente_aut2, devuelta | cancelada | el creador |
| devuelta | pendiente_aut1 (o pendiente_aut2 si es el Aut. 1 del área) | el creador, quitando `aut1`/`aut2` |

## Reglas de Firestore (resumen; ver `firestore.rules`)

- `areasTE`, `config/areasTE`, `config/tiempoExtra`: lee cualquier usuario activo; escriben RH y admin.
- `empleados` (padrón): lo lee cualquier usuario activo; `areaTE` solo lo cambia RH.
- `tiempoExtra` **leer**: el creador, el Aut. 1/suplente de esa área, la Aut. 2/suplente, RH y admin.
- **Crear**: nómina en `solicitantesNominas` de ese `areaId`, `creadoPor == uid`, `folio == id`, sin firmas, estatus
  `pendiente_aut1` (o `pendiente_aut2` si es el Aut. 1 de esa área), fechas = hora del servidor.
- **Editar contenido** (fecha, motivo, resumen): solo el creador y solo en `devuelta`.
- **Transiciones**: ver la tabla. Las firmas llevan la nómina de quien firma y `fecha == request.time`; devolver exige
  `motivo` no vacío y el nivel correcto. Los autorizadores no tocan `empleados`.
- **Borrar**: solo admin. **Historial**: solo crear, nunca editar ni borrar.
- Las consultas de lista deben traer el filtro que las reglas pueden probar: `where('creadoPor','==',uid)`,
  `where('areaId','==',área)` (Aut. 1; una consulta por área), `where('estatus','==',…)` (Aut. 2 y RH).

Los autorizadores se comparan por `perfil().nomina` (`usuarios/{uid}.nomina`, texto, que solo RH/admin puede escribir).

## Limitaciones conocidas

- **Empleados del área**: las reglas no pueden verificar por cada fila que el empleado pertenezca al área del
  solicitante (leer el padrón por fila excede el límite de lecturas por lote). La pantalla de captura debe ofrecer solo
  empleados con `areaTE == areaId`. Si se quiere reforzar en servidor, hace falta una Cloud Function.
- La captura debe usar `usuario.nomina` (perfil); un usuario sin nómina no pasa ninguna regla de TE.
- Las consultas con `orderBy` sobre `tiempoExtra` necesitarán índices compuestos en `firestore.indexes.json`
  (las consultas por igualdad de este módulo no).

## Pruebas

- `npm run test:rules` — reglas (127 casos) contra el emulador de Firestore; requiere Java 11+.
  `tests/firestore.rules.test.js` (rutas/usuarios) y `tests/firestore.rules.te.test.js` (tiempo extra).
- `npm run test:unit` — importación del reporte de nómina, limpieza de puestos y reglas de área (sin emulador).
- `npm run prueba:humo` — pruebas de humo de utilidades.
