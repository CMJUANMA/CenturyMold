// Contenido del manual de NÓMINAS. Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
// Los números de los pasos coinciden con los números de las flechas de cada captura (ver scripts/manuales/roles/nominas.mjs).
export default {
  rol: 'Nóminas',
  archivo: 'nominas',
  quien: 'Para quien prepara cada semana el formato de autorización de tiempo extra por área: lo revisa, lo ajusta, lo firma y lo descarga; y que apoya a Recursos Humanos con el transporte.',
  guia: {
    titulo: 'Guía rápida · Nóminas',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Semana', '<b>Formato de tiempo extra</b>. Elige la semana con las flechas ‹ › (o un rango de hasta 7 días).'],
      ['Área', 'Toca <b>Revisar</b> en el área: se abre la hoja con las horas de cada día.'],
      ['Corrige', 'Escribe las horas en la celda. En el menú ⋯ de la fila: <b>Quitar</b>, <b>Reemplazar</b>, <b>Cambiar motivo y P.O./TB</b>. Arriba: <b>Agregar empleado</b>.'],
      ['Guarda', '<b>Guardar cambios</b> y escribe un motivo (3 a 120 letras). <b>Deshacer ajustes</b> vuelve a lo autorizado.'],
      ['Firma', '<b>Marcar como firmada</b>: el área queda bloqueada. Solo RH la reabre.'],
      ['Descarga', '<b>Descargar</b> (un área) o, en Más opciones, <b>Descargar todas las áreas</b> (con la hoja Resumen).'],
    ],
    recuerda: [
      'Solo entra lo <b>autorizado</b> (por Autorización 2). Pendiente, devuelta o vencida no cuenta; si alguien trabajó, agrégalo a mano.',
      'Tus cambios son <b>ajustes del formato</b>: nunca modifican las solicitudes. Cada uno lleva su motivo y su bitácora.',
      'Con cambios sin guardar <b>no puedes firmar ni descargar</b>: guarda primero.',
      'Nóminas <b>no autoriza</b> ni administra usuarios. Nadie se da a sí mismo el rol de Nóminas.',
    ],
    contacto: 'Dudas del formato: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    // ───────────────────────── ANTES DE EMPEZAR ─────────────────────────
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir y autorizar tiempo extra y transporte. <b>Nóminas</b> usa lo que ya quedó autorizado para armar, cada semana y por área, el <b>FORMATO DE AUTORIZACIÓN DE TIEMPO EXTRA</b>: se revisa, se corrige si hace falta, se firma y se manda a pago. Además puedes confirmar el envío al proveedor cuando Recursos Humanos no está.' },
        { h: 'Cómo funciona el formato' },
        { lista: [
          'Es <b>una hoja por área y por semana</b> (lunes a domingo). Muestra, por empleado, las horas de cada día, su motivo y su P.O. o TB.',
          'Sale de las solicitudes <b>autorizadas por Autorización 2</b> (estatus Autorizada o Confirmada por RH). Lo pendiente, devuelto, vencido o cancelado <b>no cuenta</b>.',
          'Tú lo revisas y lo ajustas. Los ajustes <b>no cambian las solicitudes</b>: quedan aparte, cada uno con su motivo y su nombre.',
          'Cuando está bien, lo <b>marcas como firmado</b> (queda bloqueado) y lo <b>descargas en Excel</b>.',
        ] },
        { nota: 'La semana va de <b>lunes a domingo</b> (semana ISO). Por ejemplo, «Semana 47 · 16–22 nov 2026». El portal abre por defecto la <b>última semana completa</b>.' },
        { h: 'Lo que puedes hacer' },
        { lista: [
          'Ver el formato de todas las áreas, por semana o por un rango de hasta 7 días.',
          'Corregir horas, quitar, reemplazar y agregar empleados, y cambiar motivos y P.O./TB en el formato.',
          'Guardar tus ajustes, deshacerlos, firmar un área y descargar el Excel (un área, las áreas con tiempo extra o todas).',
          'Consultar todo el tiempo extra de la planta, las solicitudes de transporte, el Formato de rutas, el personal (con teléfono) y la estructura.',
          'Confirmar el tiempo extra autorizado en <b>Por enviar al proveedor</b> y bajar el Formato de rutas, y descargar el resumen de horas extra.',
        ] },
        { no: [
          'Autorizar, devolver, editar o cancelar solicitudes de tiempo extra.',
          'Cambiar lo autorizado: tus ajustes solo afectan el formato.',
          '<b>Reabrir</b> un área firmada: solo Recursos Humanos y el administrador.',
          'Crear usuarios, restablecer contraseñas, dar roles (ni darte a ti mismo el rol de Nóminas).',
          'Editar el padrón, la estructura o los catálogos: en Personal y Estructura solo consultas.',
          'Ver los borradores de otras personas.',
        ] },
      ],
    },
    // ───────────────────────── PRIMEROS PASOS ─────────────────────────
    {
      id: 'primeros-pasos', titulo: 'Primeros pasos',
      bloques: [
        { h: 'Entrar al portal' },
        { p: 'Abre <b>https://centurymold-qro.web.app</b> en tu navegador (Chrome, Edge o el de tu celular).' },
        { pasos: [
          'Escribe tu <b>número de nómina</b>.',
          'Escribe tu <b>contraseña</b>. El ojito sirve para ver lo que escribes.',
          'Toca <b>Iniciar sesión</b>.',
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>. Solo se restablece <b>en persona</b>, con Recursos Humanos, un Autorizador 2 o Sistemas y tu identificación.',
        ], img: 'solicitante/01-entrar' },
        { p: 'La primera vez que entras con una contraseña temporal, el portal te pide crear una <b>contraseña nueva</b>: mínimo 8 caracteres, con letras y números.' },
        { h: 'Tu pantalla de inicio' },
        { pasos: [
          'En el menú, bajo <b>Reportes de nómina</b>, está <b>Formato de tiempo extra</b>: tu pantalla principal.',
          '<b>Abrir el formato de la semana</b>: te lleva a la última semana completa, con el estado de cada área (Sin revisar, Ajustada o Firmada).',
          '<b>Por enviar al proveedor</b>: cuántas autorizadas esperan confirmación. Las tarjetas dicen también las fechas vencidas, los empleados por enviar y el personal elegible.',
        ], img: 'nominas/01-inicio' },
        { h: 'El menú' },
        { pasos: [
          '<b>Formato de tiempo extra</b> (Reportes de nómina).',
          '<b>Por enviar al proveedor</b>, con su contador.',
          '<b>Formato de rutas</b>: el Excel del proveedor.',
          '<b>Personal</b> (y <b>Estructura</b>): solo consulta.',
        ], img: 'nominas/02-menu', ancho: 'chico' },
        { nota: 'También tienes <b>Tiempo extra</b> (consulta) y <b>Solicitudes de transporte</b>. Abajo: <b>Ayuda y manuales</b> (este manual y su guía rápida en PDF) y <b>Cerrar sesión</b>. Por seguridad, la sesión se cierra a los <b>30 minutos sin usar</b>: <b>tus cambios sin guardar se pierden</b>, así que guarda seguido.' },
      ],
    },
    // ───────────────────────── LO DE TODOS LOS DÍAS ─────────────────────────
    {
      id: 'semana', titulo: 'Reportes de nómina: elegir la semana',
      bloques: [
        { p: '<b>Para qué sirve.</b> Es la puerta del formato: elegir qué semana (o qué días) vas a trabajar y ver el estado de cada área. <b>Cuándo se usa:</b> cada semana, a partir del lunes.' },
        { pasos: [
          '<b>Semana anterior</b>.',
          '<b>Semana siguiente</b>. La pantalla abre en la última semana <b>completa</b>; para la semana en curso usa esta flecha.',
          '<b>Rango de fechas</b>: en lugar de una semana, hasta 7 días.',
          '<b>Descargar áreas con tiempo extra</b>: el Excel de todas las que tienen algo.',
          '<b>Más opciones</b>: incluye <b>Descargar todas las áreas</b>.',
        ], img: 'nominas/03-semana' },
        { p: 'Si la semana todavía no termina, el portal avisa: <i>«Este periodo aún no termina: lo autorizado todavía puede cambiar»</i>. Conviene firmar cuando la semana ya terminó.' },
        { h: 'Las áreas de la semana' },
        { pasos: [
          'Arriba, avisos de lo que <b>no entra</b> al formato (siguiente apartado).',
          '<b>Revisar</b> abre la hoja del área.',
          '<b>Descargar</b> baja el Excel de esa área.',
          'Las áreas sin tiempo extra dicen «Sin tiempo extra esta semana»; tienen <b>Revisar</b> por si hay que agregar a alguien a mano.',
        ], img: 'nominas/04-areas' },
        { p: 'Cada tarjeta trae el <b>estado</b> del área: <b>Sin revisar</b> (aún no la tocas), <b>Ajustada</b> (guardaste cambios) o <b>Firmada</b> (bloqueada), además de los empleados y las horas totales.' },
        { h: 'Qué no entra al formato' },
        { lista: [
          '<b>Sin autorizar</b>: solicitudes del periodo todavía pendientes o devueltas. El aviso dice cuántas y de qué áreas. No entran mientras Autorización 2 no las autorice, y <b>puedes firmar la semana sin ellas</b>. <b>Verlas en Tiempo extra</b> las muestra.',
          '<b>Vencidas</b>: pasó el día sin autorizarse. No cuentan. Si alguien <b>sí trabajó</b>, pide a Autorización 2 que la autorice fuera de tiempo, o agrégalo a mano en <b>Revisar</b>.',
        ] },
        { pasos: ['El aviso de vencidas aparece en la semana donde cayeron, con el botón <b>Ver las vencidas</b>.'], img: 'nominas/05-vencidas', ancho: 'chico' },
        { h: 'Un rango de fechas' },
        { pasos: [
          '<b>Desde</b>.',
          '<b>Hasta</b>. Máximo 7 días, y la fecha final no puede ser anterior.',
          '<b>Por semana</b> regresa a elegir una semana.',
        ], img: 'nominas/06-rango' },
        { h: 'Descargar de una vez' },
        { pasos: ['<b>Descargar todas las áreas</b> baja un solo Excel con las seis áreas (las vacías en blanco) y la hoja <b>Resumen</b>. Más adelante se explica cómo leerlo.'], img: 'nominas/05-mas-opciones', ancho: 'chico' },
      ],
    },
    {
      id: 'revisar', titulo: 'Revisar un área, como una hoja de cálculo',
      bloques: [
        { p: '<b>Para qué sirve.</b> Ver lo autorizado de un área y corregirlo antes de firmar. Toca <b>Revisar</b> en la tarjeta del área.' },
        { pasos: [
          'Cada columna es un <b>día de la semana</b>, con su fecha. Después van <b>Subtotal</b>, <b>Motivo</b> y <b>P.O./TB</b>.',
          'Cada celda trae las horas autorizadas de ese empleado ese día. Se escribe directo.',
          'El menú <b>⋯</b> de la fila: quitar, reemplazar, cambiar motivo y P.O./TB, o restaurar.',
          '<b>Agregar empleado</b>: para quien no venía en las solicitudes.',
          '<b>Descargar</b>: el Excel del área (se apaga si hay cambios sin guardar).',
        ], img: 'nominas/07-revisar-area' },
        { p: 'Abajo ves, de un vistazo, el <b>estado</b> del área y <b>cuántos empleados y horas</b> lleva en total. Una fila con varios motivos (por ejemplo, un día por inventario y otro por embarque) los muestra juntos. El <b>buscador</b> de arriba filtra por nombre o nómina. <b>Volver a la semana</b> regresa a la lista de áreas.' },
        { nota: 'Todo lo que ves viene de lo autorizado. Lo que cambies aquí <b>no modifica las solicitudes</b>: son ajustes del formato.' },
      ],
    },
    {
      id: 'horas', titulo: 'Corregir las horas de un día',
      bloques: [
        { p: '<b>Para qué sirve.</b> Cuando alguien trabajó más o menos de lo autorizado. <b>Cuándo se usa:</b> cuando llegan las listas de asistencia.' },
        { pasos: [
          'Haz clic en la celda y escribe las horas. Acepta medios y cuartos (<b>0.5</b>, <b>7.25</b>); también con coma. Vacío = sin horas.',
          'Pulsa <b>Enter</b>, <b>Tab</b> o una flecha para confirmar y pasar a la siguiente celda.',
          'La celda cambiada se pinta de otro color y el subtotal se actualiza. Abajo dice cuántos <b>cambios sin guardar</b> llevas.',
          '<b>Descartar</b> tira esos cambios sin guardar. <b>Guardar cambios</b> los guarda (siguiente sección).',
        ], img: 'nominas/08-horas' },
        { aviso: 'Con cambios sin guardar, <b>Marcar como firmada</b> y <b>Descargar</b> están apagados: el Excel solo lleva lo guardado.' },
      ],
    },
    {
      id: 'renglon', titulo: 'Quitar, reemplazar y cambiar el motivo de un empleado',
      bloques: [
        { p: 'Todo esto se hace con el menú <b>⋯</b> de cada fila.' },
        { pasos: [
          '<b>Reemplazar por otro empleado</b>: sus horas pasan a quien elijas.',
          '<b>Cambiar motivo y P.O./TB</b>.',
          '<b>Restaurar lo autorizado</b>: regresa esa fila a como venía (se enciende cuando hay algo que restaurar).',
          '<b>Quitar (no asistió)</b>.',
        ], img: 'nominas/09-menu-renglon' },
        { h: 'Quitar a alguien que no asistió' },
        { pasos: [
          'Escribe el <b>motivo</b> (por ejemplo, «No asistió»), de 3 a 120 letras. Se pide en el momento.',
          'Toca <b>Quitar</b>.',
        ], img: 'nominas/10-quitar-motivo', ancho: 'chico' },
        { pasos: ['La fila queda <b>tachada</b> con la etiqueta «Quitado» y ya no cuenta en el total. Lo autorizado en la solicitud <b>no cambia</b>.'], img: 'nominas/11-quitado' },
        { pasos: ['Para regresarla, abre su menú ⋯ y toca <b>Restaurar lo autorizado</b>.'], img: 'nominas/12-restaurar' },
        { h: 'Reemplazar a alguien' },
        { p: 'Úsalo cuando fue otra persona la que trabajó. Sale el titular y entra su reemplazo, con las mismas horas, y la fila lo indica («Reemplaza a …»).' },
        { pasos: [
          'Busca y elige a quien lo reemplaza (por nómina o nombre).',
          'Toca <b>Reemplazar</b>.',
        ], img: 'nominas/13-reemplazar', ancho: 'chico' },
        { h: 'Cambiar el motivo y el P.O./TB' },
        { pasos: [
          'Elige el <b>motivo</b>. Si el motivo lleva número (Cargo a P.O. o a TB), aparece el campo del número.',
          'Escribe el número (solo dígitos, de 6 a 15) y, si quieres, un detalle.',
          'Toca <b>Aplicar al renglón</b>.',
        ], img: 'nominas/14-motivo-po', ancho: 'chico' },
        { nota: 'La columna <b>P.O./TB</b> del Excel lleva el número de cada empleado, para que el área de cuentas por pagar lo cargue.' },
      ],
    },
    {
      id: 'agregar', titulo: 'Agregar a un empleado que no venía',
      bloques: [
        { p: '<b>Para qué sirve.</b> Cuando alguien trabajó tiempo extra que no se capturó (o venció sin autorizarse). <b>Cuándo se usa:</b> de vez en cuando.' },
        { pasos: [
          'Busca a la persona por nómina o nombre y elígela. Si no está en el padrón puedes <b>capturarla a mano</b> (queda marcada «fuera del padrón»).',
          'Elige el <b>motivo</b> del tiempo extra y, si quieres, un detalle.',
          'Escribe el <b>motivo del ajuste</b> (por qué se agrega, de 3 a 120 letras).',
          'Toca <b>Agregar al formato</b>.',
        ], img: 'nominas/15-agregar' },
        { p: 'Si la persona es de <b>otra área</b>, el portal avisa («Es de Almacén: se agregará a Moldes aunque pertenece a Almacén»); puedes seguir.' },
        { pasos: ['La fila nueva se resalta unos segundos con la etiqueta «Agregado» y el cursor queda en su primera celda: <b>captura sus horas</b>.'], img: 'nominas/16-agregado' },
        { aviso: 'Agregar a alguien <b>no crea una solicitud</b>: solo entra al formato de esa área y semana. Si de verdad corresponde pagarle, queda en el Excel con el motivo que escribiste.' },
      ],
    },
    {
      id: 'guardar', titulo: 'Guardar, descartar y deshacer',
      bloques: [
        { h: 'Guardar los cambios' },
        { pasos: [
          'Toca <b>Guardar cambios</b>.',
          'Si hay cambios de horas, reemplazos o de motivo, escribe el <b>motivo del ajuste</b> (de 3 a 120 letras): se aplica a todos y queda en la bitácora. Lo que agregaste o quitaste ya trae el suyo.',
          'Confirma con <b>Guardar cambios</b>.',
        ], img: 'nominas/17-guardar', ancho: 'chico' },
        { pasos: [
          'El área queda <b>Ajustada</b> y aparece <b>Deshacer ajustes</b>.',
          '<b>Marcar como firmada</b> y <b>Descargar</b> se encienden.',
          'El aviso dice cuántos cambios se guardaron.',
        ], img: 'nominas/18-guardado' },
        { h: 'Deshacer los ajustes' },
        { pasos: ['<b>Deshacer ajustes</b> borra <b>todos</b> los cambios guardados del área y el formato vuelve a lo autorizado en las solicitudes. Pide confirmación.'], img: 'nominas/19-deshacer', ancho: 'chico' },
        { nota: '<b>Descartar</b> (con cambios sin guardar) tira solo lo que todavía no guardaste. <b>Deshacer ajustes</b> borra lo ya guardado. Si sales de la pantalla con cambios sin guardar, el portal pregunta si quieres salir sin guardar.' },
      ],
    },
    {
      id: 'firmar', titulo: 'Firmar el área',
      bloques: [
        { p: '<b>Para qué sirve.</b> Cuando el formato ya tiene las firmas en papel y está correcto, lo marcas como firmado: queda <b>bloqueado</b> y nadie lo cambia. <b>Cuándo se usa:</b> una vez por área y semana.' },
        { pasos: ['Toca <b>Marcar como firmada</b> y confirma. Solo se puede si no tienes cambios sin guardar y el área tiene empleados.'], img: 'nominas/20-firmar-confirmar', ancho: 'chico' },
        { pasos: [
          'El aviso dice que el área ya está firmada, por quién y que, si hay que corregir algo, pida a Recursos Humanos que la reabra.',
          '<b>Descargar</b> sigue disponible: baja el Excel con lo firmado.',
        ], img: 'nominas/21-firmada' },
        { pasos: ['En la lista de la semana, el área aparece como <b>Firmada</b>.'], img: 'nominas/24-area-firmada', ancho: 'chico' },
        { aviso: 'Una vez firmada, <b>solo Recursos Humanos o el administrador</b> pueden reabrirla (botón <b>Reabrir</b> en la revisión del área). Tú no. Si necesitas corregir, avísales; los ajustes y motivos que ya había se conservan.' },
      ],
    },
    {
      id: 'excel', titulo: 'Descargar el Excel y cómo leerlo',
      bloques: [
        { p: 'Hay <b>tres descargas</b>, todas del mismo formato:' },
        { lista: [
          '<b>Descargar</b> en una tarjeta de área o dentro de la revisión: el Excel de <b>esa área</b>.',
          '<b>Descargar áreas con tiempo extra</b>: todas las áreas que tienen algo, con la hoja Resumen.',
          '<b>Descargar todas las áreas</b> (en Más opciones): las seis áreas, las vacías en blanco, con la hoja Resumen.',
        ] },
        { pasos: ['Al terminar, el aviso dice qué archivo se descargó. Ábrelo desde el ícono de descargas del navegador o en la carpeta Descargas. Los nombres son parecidos a «Tiempo extra semana 47 - todas las areas.xlsx».'], img: 'nominas/22-descargada', ancho: 'chico' },
        { h: 'La hoja de un área' },
        { p: 'Es la réplica del formato en papel (carta horizontal, una hoja por área; con más de 15 empleados continúa en otra página).' },
        { pasos: [
          'Arriba: el <b>área</b> (casilla marcada), el <b>número de semana</b>, las fechas y la fecha de impresión.',
          'La fila de <b>días</b>: lunes a domingo con su fecha.',
          'Cada fila: <b>Item</b>, <b>No. Empleado</b>, <b>nombre</b>, las horas de cada día, el <b>Sub-Total</b>, el <b>P.O./TB</b> y la <b>descripción del motivo</b> (si cambió de un día a otro, lo dice por día).',
          '<b>Total Hrs.</b>: lo de cada día y el total de la semana.',
          'Abajo, los recuadros de <b>firmas</b> (supervisor, program manager si hay P.O./TB, gerente de planta y RRHH) y las notas del formato.',
        ], img: 'nominas/23-excel-area' },
        { h: 'La hoja Resumen' },
        { p: 'Solo viene en las descargas de varias áreas. Sirve para capturar la nómina y para ver el panorama de la semana.' },
        { pasos: [
          '<b>Horas por área</b>: empleados y horas de cada área, con el total.',
          '<b>Horas por empleado</b> (para capturar la nómina): área, número, nombre y horas de cada persona.',
          '<b>Horas por motivo</b>: cuántas horas y qué porcentaje del total por cada motivo.',
          '<b>Horas por número de P.O./TB</b>: horas, áreas y empleados de cada P.O. o TB.',
        ], img: 'nominas/25-excel-resumen' },
        { nota: 'Las horas del Excel ya llevan <b>tus ajustes</b> (la hoja Resumen lo dice: «Horas ya ajustadas por Nóminas»). Si el área no está guardada, el Excel solo lleva lo guardado. Una semana todavía en curso se puede descargar, pero lo autorizado puede cambiar.' },
      ],
    },
    // ───────────────────────── LO DE VEZ EN CUANDO ─────────────────────────
    {
      id: 'proveedor', titulo: 'Por enviar al proveedor y Formato de rutas (cuando cubres a RH)',
      bloques: [
        { p: 'Cuando Recursos Humanos no está, tú puedes <b>confirmar</b> el tiempo extra autorizado y bajar el Excel del proveedor de transporte. La pantalla es la misma que usa Recursos Humanos; <b>solo confirma</b>: no devuelve ni cancela.' },
        { pasos: [
          '<b>Formato de rutas (proveedor)</b>.',
          '<b>Confirmar todas las de esta fecha</b>: confirma el grupo de un día (también hay Confirmar todas las fechas).',
          '<b>Revisar</b> abre la solicitud; ahí está <b>Confirmar y generar transporte</b>.',
        ], img: 'nominas/26-por-enviar' },
        { lista: [
          'Confirmar crea la <b>solicitud de transporte</b> de cada solicitud con empleados en transporte; las que no llevan, se confirman sin generar nada.',
          'Si la fecha del tiempo extra ya pasó, el portal ya no crea transporte: se cierra «sin transporte» y sus horas siguen contando para nómina.',
          'Para devolver o cancelar, pide ayuda a Recursos Humanos.',
        ] },
        { pasos: ['<b>Formato de rutas</b>: elige Hoy, Mañana, una fecha o un rango y baja el Excel (<b>Transporte_AAAA-MM-DD.xlsx</b>). Solo lleva a quienes van en transporte, con ruta, comunidad, punto de reunión, horario y teléfono. Si dice «No hay tiempo extra confirmado», primero confirma.'], img: 'nominas/27-formato-rutas', ancho: 'chico' },
        { aviso: 'La aplicación <b>no avisa al proveedor</b>: el archivo lo manda quien lo baja. Lo que cruza la <b>medianoche</b> lleva el viaje de regreso el <b>día siguiente</b>.' },
        { h: 'Solicitudes de transporte' },
        { pasos: [
          '<b>Hoy</b>, <b>Esta semana</b> y <b>Próxima semana</b> (o las fechas desde y hasta).',
          '<b>Estado</b> y buscador por solicitante o folio.',
        ], img: 'nominas/28-solicitudes-transporte' },
        { nota: 'Aquí solo <b>ves y descargas</b>. La lista queda vacía hasta que alguien confirma tiempo extra con empleados en transporte.' },
      ],
    },
    {
      id: 'consultar', titulo: 'Consultar: tiempo extra, personal y estructura',
      bloques: [
        { h: 'Tiempo extra (consulta)' },
        { p: 'Toda la planta, en cualquier estatus <b>menos los borradores</b>, con su detalle e historial. Es de solo lectura.' },
        { pasos: [
          '<b>Exportar consulta (n)</b>: Excel con lo que ves (con estatus y quién firmó). No es el reporte de nómina.',
          'Filtro de <b>turno</b> (A, B o C): útil para nómina.',
          'Filtro de <b>estatus</b>: por ejemplo, para encontrar las vencidas o las pendientes que no entran al formato.',
        ], img: 'nominas/29-tiempo-extra' },
        { p: 'Arriba ves los resúmenes: pendientes por nivel, autorizadas de la semana y lo autorizado del mes por área. Junto a <b>Exportar consulta</b> está <b>Descargar resumen de horas extra</b>: todos los empleados con tiempo extra autorizado o confirmado, lleven transporte o no (para nómina y comedor).' },
        { h: 'Personal' },
        { pasos: [
          '<b>Exportar padrón (respaldo)</b>.',
          'Aquí, además de nómina, nombre, puesto, ruta y área, ves el <b>teléfono</b> (que se manda al proveedor). Es solo consulta: los cambios los hace Recursos Humanos.',
        ], img: 'nominas/30-personal' },
        { h: 'Estructura' },
        { pasos: [
          '<b>Puestos</b>: cada puesto con su área y nivel.',
          '<b>Turnos</b>: el horario normal de cada turno. Solo consulta.',
        ], img: 'nominas/31-estructura' },
        { nota: 'También puedes ver la <b>lista del personal elegible</b> (desde el Inicio, <b>Personal activo › Ver lista</b>).' },
      ],
    },
    // ───────────────────────── CASOS ESPECIALES ─────────────────────────
    {
      id: 'casos', titulo: 'Casos especiales',
      bloques: [
        { h: 'La semana ya estaba firmada y falta algo' },
        { p: 'Pide a Recursos Humanos que <b>reabra</b> el área (en la revisión del área, botón <b>Reabrir</b>). Cuando la reabra, agrega o corrige, guarda con su motivo y vuelve a firmar. Los ajustes anteriores se conservan.' },
        { h: 'Falta una solicitud en el formato' },
        { lista: [
          'Solo entra lo <b>autorizado por Autorización 2</b>. Mira el aviso de la semana: «sin autorizar» (pendientes o devueltas) y «vencidas» no cuentan.',
          'Búscala en <b>Tiempo extra</b>: te dice su estatus y en qué nivel está.',
          'Si está pendiente, avisa a Autorización 2. Si venció y sí se trabajó, pide a Autorización 2 que la autorice fuera de tiempo, o agrega a las personas a mano en la revisión del área.',
        ] },
        { h: 'Alguien trabajó pero nunca se capturó' },
        { p: 'Agrégalo con <b>Agregar empleado</b> (sección anterior), con su motivo del tiempo extra y el motivo del ajuste. No se crea ninguna solicitud: solo entra al formato.' },
        { h: 'Alguien que está en la solicitud no asistió' },
        { p: 'Quítalo con <b>Quitar (no asistió)</b> y escribe el motivo. La solicitud no cambia; el formato ya no lo cuenta.' },
        { h: 'Trabajó otra persona en su lugar' },
        { p: 'Usa <b>Reemplazar por otro empleado</b>. Si trabajó además, agrégalo aparte.' },
        { h: 'Me equivoqué al ajustar' },
        { lista: [
          'Antes de guardar: <b>Descartar</b>, o <b>Restaurar lo autorizado</b> en la fila.',
          'Ya guardado: corrige la celda y guarda otra vez, o usa <b>Deshacer ajustes</b> para volver todo a lo autorizado.',
          'Ya firmado: pide a Recursos Humanos que reabra.',
        ] },
        { h: 'No puedo firmar ni descargar' },
        { p: 'Tienes cambios sin guardar. Toca <b>Guardar cambios</b> primero. También se apagan si el área no tiene empleados.' },
        { h: 'El proveedor no recibió a alguien' },
        { p: 'La app <b>no avisa al proveedor</b>. Revisa: que la solicitud estuviera <b>Confirmada por RH</b>; que la persona llevara transporte (ruta, comunidad y punto); que salga en el <b>Formato de rutas del día correcto</b> (ojo con lo que cruza la medianoche: el regreso va al día siguiente); que su teléfono esté en Personal; y que el archivo se mandó al proveedor <b>después</b> de confirmar. Para corregir datos de una persona, avisa a Recursos Humanos.' },
        { h: 'Mis cambios sin guardar se perdieron' },
        { p: 'La sesión se cierra a los 30 minutos sin usar, y lo no guardado se pierde. Guarda con frecuencia, aunque no hayas terminado el área.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['Mi semana sale vacía.', 'Al entrar se abre la última semana completa. Para la semana en curso, toca «Semana siguiente». Si aun así no hay nada, no hay tiempo extra autorizado esa semana.'],
          ['¿Mis ajustes cambian las solicitudes?', 'No. Son ajustes del formato, aparte, con su motivo y su nombre. Las solicitudes quedan como se autorizaron.'],
          ['¿Puedo firmar una semana que no ha terminado?', 'Se puede, pero lo autorizado todavía puede cambiar: después habría que pedir a Recursos Humanos que reabra el área. Conviene esperar al domingo.'],
          ['¿Puedo firmar sin las solicitudes pendientes?', 'Sí. Mientras no estén autorizadas no entran al formato; el aviso de la semana lo dice.'],
          ['¿Quién puede reabrir un área firmada?', 'Solo Recursos Humanos y el administrador. Tú no.'],
          ['El Excel no trae mis últimos cambios.', 'El Excel lleva solo lo guardado. Toca Guardar cambios y descarga otra vez.'],
          ['¿Por qué el Excel de un área no trae la hoja Resumen?', 'La hoja Resumen viene en las descargas de varias áreas (Descargar áreas con tiempo extra y Descargar todas las áreas).'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; lo ya guardado no se pierde, pero lo no guardado sí.'],
        ] },
      ],
    },
    {
      id: 'estatus', titulo: 'Qué significa cada estatus',
      bloques: [
        { p: 'Así afecta cada estatus del tiempo extra al formato de nómina:' },
        { tabla: 'estatus', rol: 'nominas' },
        { p: '<b>Estados del área</b> en Reportes de nómina: <b>Sin revisar</b> (nadie la ha ajustado), <b>Ajustada</b> (hay cambios guardados) y <b>Firmada</b> (bloqueada; solo RH la reabre).' },
      ],
    },
  ],
};
