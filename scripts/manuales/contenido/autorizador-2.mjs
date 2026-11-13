// Contenido del manual del AUTORIZADOR 2 (segunda firma de toda la planta + administración de usuarios y accesos). Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
// Los números de los pasos coinciden con los números de las flechas de cada captura (ver scripts/manuales/roles/autorizador-2.mjs).
export default {
  rol: 'Autorizador 2',
  archivo: 'autorizador-2',
  quien: 'Para quien da la segunda firma del tiempo extra de toda la planta, autoriza lo que ya venció y administra usuarios, contraseñas y roles.',
  guia: {
    titulo: 'Guía rápida · Autorizador 2',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Por autorizar', 'Menú › <b>Por autorizar</b>. Toca <b>Revisar</b>: empleados, horarios, rutas, historial.'],
      ['Decide', '<b>Autorizar</b> (comentario opcional) o <b>Devolver</b> (explica qué corregir, mínimo 10 letras).'],
      ['Varias', 'Marca las casillas y toca <b>Autorizar seleccionadas</b>.'],
      ['Vencidas', 'Pestaña <b>Vencidas</b> › <b>Autorizar fuera de tiempo</b> con un motivo (10 a 500 letras).'],
      ['Usuarios', 'Menú › <b>Asignar roles</b> › <b>Usuarios</b>: <b>Nuevo usuario</b>, lápiz ✎ (roles), llave 🔑 (contraseña).'],
      ['Avisa', 'El sistema <b>no manda avisos</b>: dile tú a quien sigue (RH, o quien capturó).'],
    ],
    recuerda: [
      'La contraseña temporal se ve <b>una sola vez</b>: entrégala <b>en persona</b>, nunca por teléfono ni mensaje.',
      'Lo que <b>tú capturas</b> queda autorizado al enviarlo; no lo firmas dos veces.',
      'Tú das y quitas <b>RH</b>, <b>Nóminas</b>, <b>Aut. 1</b> y <b>Solicitante</b>. Aut. 2 y Administrador los da un administrador.',
      'Una firma <b>no se deshace</b>: si fue un error, avisa a Recursos Humanos antes de que confirme.',
    ],
    contacto: 'Dudas de solicitudes: <b>Recursos Humanos</b> · Fallas del portal: <b>Sistemas</b>',
  },
  secciones: [
    // ───────────────────────── ANTES DE EMPEZAR ─────────────────────────
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir y autorizar tiempo extra y transporte. Como <b>Autorizador 2</b> tienes dos trabajos:' },
        { lista: [
          '<b>Dar la segunda firma</b> del tiempo extra de toda la planta (y poder autorizar lo que ya venció).',
          '<b>Administrar usuarios y accesos</b>: crear usuarios, restablecer contraseñas y dar o quitar roles.',
        ] },
        { h: 'Cómo camina una solicitud' },
        { lista: [
          '<b>Quien la pide</b> (solicitante) la captura y la envía.',
          '<b>El jefe de su área</b> (Autorización 1) la autoriza o la devuelve.',
          '<b>Tú</b> (Autorización 2) das la segunda firma o la devuelves.',
          '<b>Recursos Humanos</b> la confirma y genera el transporte para el proveedor.',
        ] },
        { nota: 'El sistema <b>no manda correos ni mensajes</b>. Después de autorizar o devolver, avisa tú a la persona que sigue. Cada vez que este manual diga «avisa», es por eso.' },
        { h: 'Lo que puedes hacer' },
        { lista: [
          'Ver y firmar en nivel 2 lo de todas las áreas, en <b>Por autorizar</b>.',
          'Capturar tu propio tiempo extra; lo que tú envías <b>queda autorizado</b> al instante.',
          'Autorizar <b>fuera de tiempo</b> lo que venció, con un motivo.',
          'Consultar todas las solicitudes con filtros y bajarlas en Excel.',
          'Crear usuarios (uno por uno o en lote), restablecer contraseñas y activar o desactivar.',
          'Dar y quitar los roles <b>Recursos Humanos</b> y <b>Nóminas</b>, y asignar <b>Autorizador 1</b> y <b>Solicitante</b> por área y con fechas.',
          'Ver el <b>organigrama</b> de la planta y la <b>lista del personal elegible</b>.',
        ] },
        { no: [
          'Firmar lo que <b>tú mismo creaste</b> en el nivel de revisión (tu captura ya queda autorizada al enviarla).',
          'Dar el rol <b>Autorizador 2</b> o <b>Administrador</b>: solo lo da un administrador.',
          'Restablecer la contraseña de un <b>Recursos Humanos</b>, de un administrador o la <b>tuya</b>.',
          'Cambiar tu propio rol ni darte a ti mismo el rol de Nóminas.',
          'Confirmar el envío al proveedor, cancelar solicitudes o bajar el Formato de rutas: eso es de Recursos Humanos.',
          'Editar el padrón de empleados, la estructura, los catálogos ni los reportes de nómina.',
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
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>. Solo se restablece <b>en persona</b>, con Sistemas o Recursos Humanos y tu identificación.',
        ], img: 'solicitante/01-entrar' },
        { p: 'La primera vez que entras con una contraseña temporal, el portal te pide crear una <b>contraseña nueva</b>: mínimo 8 caracteres, con letras y números.' },
        { h: 'Tu pantalla de inicio' },
        { p: 'Al entrar ves tu <b>Inicio</b>: un resumen de la planta y lo que espera tu firma.' },
        { pasos: [
          '<b>Por autorizar</b> en el menú trae un número: cuántas solicitudes esperan tu firma.',
          '<b>Ir a la bandeja</b> abre esa lista.',
          '<b>Personal de planta</b> dice cuántos empleados son elegibles para tiempo extra; <b>Ver lista</b> los muestra.',
          'La tabla cuenta las solicitudes de la semana por área.',
        ], img: 'autorizador-2/01-inicio' },
        { h: 'El menú' },
        { pasos: [
          '<b>Solicitar tiempo extra</b> y <b>Mis solicitudes</b>: para capturar el tuyo.',
          '<b>Todas las solicitudes</b>: la consulta de toda la planta.',
          '<b>Organigrama</b>: quién autoriza y quién captura en cada área.',
          '<b>Asignar roles</b>: Usuarios y accesos.',
          '<b>Ayuda y manuales</b> (abajo): este manual y su guía rápida en PDF, con «Descargar PDF». Abajo también está <b>Cerrar sesión</b>.',
        ], img: 'autorizador-2/02-menu', ancho: 'chico' },
        { h: 'Mi cuenta' },
        { p: 'Tu nombre, abajo en el menú, abre <b>Mi cuenta</b>.' },
        { pasos: [
          '<b>Mostrar ayudas</b>: los textos de ayuda y los recorridos guiados.',
          '<b>Tamaño de letra</b>: Normal o Grande.',
          '<b>Tema</b>: Claro, Oscuro o Automático (igual que tu equipo).',
          '<b>Cambiar mi contraseña</b>.',
        ], img: 'autorizador-2/03-mi-cuenta' },
        { nota: 'Por seguridad, la sesión se cierra sola a los <b>30 minutos sin usar</b> el portal. Entra de nuevo; lo que ya firmaste no se pierde. En una computadora compartida, cierra tu sesión al terminar.' },
      ],
    },
    // ───────────────────────── LO DE TODOS LOS DÍAS ─────────────────────────
    {
      id: 'por-autorizar', titulo: 'Por autorizar: tu bandeja',
      bloques: [
        { p: '<b>Para qué sirve.</b> Aquí están las solicitudes que ya firmó el jefe de área y esperan tu firma, de todas las áreas. <b>Cuándo se usa:</b> todos los días.' },
        { pasos: [
          'La pestaña <b>Por autorizar</b> es lo que espera tu firma.',
          '<b>Vencidas</b>: las que ya pasaron de fecha (más adelante).',
          '<b>Revisar</b> abre la solicitud completa.',
          '<b>Todas</b> marca todas las casillas.',
          '<b>Autorizar seleccionadas</b> firma varias juntas.',
        ], img: 'autorizador-2/04-bandeja' },
        { p: 'Cada renglón trae el folio, el área, los motivos, quién la pidió, la fecha del tiempo extra, cuántos empleados y horas, cuántos van con transporte y cuánto tiempo lleva esperando. Las más antiguas salen primero. Una insignia <b>2 rutas</b> (o más) significa que hay empleados en rutas distintas: cada ruta extra cuesta, así que revisa la justificación.' },
        { h: 'Filtrar la lista' },
        { pasos: [
          '<b>Área</b>: ver solo una.',
          '<b>Fecha del tiempo extra, desde</b>.',
          '<b>Hasta</b>.',
        ], img: 'autorizador-2/05-filtros' },
        { p: 'Los filtros solo cambian lo que ves; no cambian ninguna solicitud. La lista se actualiza sola cuando alguien firma, devuelve o envía.' },
      ],
    },
    {
      id: 'revisar', titulo: 'Revisar una solicitud, parte por parte',
      bloques: [
        { p: 'Toca <b>Revisar</b>. Se abre la solicitud completa; léela de arriba abajo antes de decidir.' },
        { h: 'Arriba: los datos generales' },
        { pasos: [
          'El <b>folio</b> (por ejemplo TE-2026-0012) identifica la solicitud. Dentro verás el <b>estatus</b>, el <b>tipo</b> (turno extra o extensión de turno), el <b>área</b>, quién la pidió, la <b>fecha</b>, los <b>motivos</b>, cuántos <b>empleados</b> y <b>horas</b>, cuántos <b>con transporte</b> y <b>con alimentos</b>, y quién firmó el nivel 1.',
          '<b>Empleados por horario</b> resume cuántas personas entran a cada horario.',
        ], img: 'autorizador-2/06-detalle-arriba' },
        { p: 'El <b>comentario</b> explica para qué se necesita. Los <b>motivos</b> dicen por qué: si es «Cargo a P.O.» o TB, trae el número; el detalle añade una frase corta.' },
        { h: 'En medio: los empleados' },
        { pasos: [
          '<b>Empleados (n)</b>: la lista, con nómina, nombre y puesto.',
          '<b>Horario</b>: entrada y salida. Si termina después de medianoche lo dice, por ejemplo «12:00 a. m. (medianoche)» y «Termina: … (día siguiente)».',
          '<b>Ruta / comunidad / punto</b>: dónde lo recoge el transporte, o «Sin transporte».',
        ], img: 'autorizador-2/07-detalle-empleados' },
        { nota: 'Fíjate en los horarios que cruzan la medianoche y en quién va <b>sin transporte</b>: son lo que más se corrige después.' },
        { h: 'Abajo: historial y decisión' },
        { pasos: [
          '<b>Historial</b>: quién hizo qué y cuándo (creada, autorizada nivel 1, devuelta, etc.), con los comentarios.',
          '<b>Comentario</b>: opcional al autorizar, obligatorio al devolver (mínimo 10 letras).',
          '<b>Devolver</b>: regresa la solicitud con tu motivo.',
          '<b>Autorizar</b>: da tu firma.',
        ], img: 'autorizador-2/08-detalle-abajo' },
      ],
    },
    {
      id: 'autorizar', titulo: 'Autorizar',
      bloques: [
        { p: '<b>Para qué sirve.</b> Tu firma de nivel 2 es la última: después solo falta que Recursos Humanos la confirme. <b>Cuándo se usa:</b> cuando la solicitud está bien.' },
        { pasos: [
          'Revisa la solicitud (sección anterior).',
          'Si quieres, escribe un comentario.',
          'Toca <b>Autorizar</b>.',
        ] },
        { pasos: ['El aviso confirma la firma. La solicitud pasa a <b>Autorizada</b> y Recursos Humanos ya la ve en <b>Por enviar al proveedor</b>.'], img: 'autorizador-2/09-autorizada', ancho: 'chico' },
        { p: '<b>Qué pasa después.</b> Su estatus es <b>Autorizada</b> y entra, para la semana que le toca, al formato de nómina. Avisa a Recursos Humanos si es urgente (por ejemplo, si el tiempo extra es hoy o mañana y el transporte debe salir pronto).' },
        { nota: 'Si otra persona respondió la misma solicitud mientras la tenías abierta, el portal te avisa («Alguien más ya respondió esta solicitud»): no se firma dos veces. Cierra y revisa la lista.' },
      ],
    },
    {
      id: 'devolver', titulo: 'Devolver una solicitud',
      bloques: [
        { p: '<b>Para qué sirve.</b> Regresar una solicitud a quien la capturó para que la corrija. <b>Cuándo se usa:</b> si hay un error de horarios, empleados, motivo, transporte o rutas.' },
        { p: 'El motivo es obligatorio. Mientras no escribas al menos <b>10 letras</b>, el botón <b>Devolver</b> está apagado.' },
        { pasos: ['Escribe qué debe corregir en <b>Comentario</b>.', '<b>Devolver</b> sigue apagado hasta que el comentario tenga 10 letras.'], img: 'autorizador-2/10-devolver-sin-motivo' },
        { pasos: ['Escribe un motivo claro: qué está mal y cómo corregirlo.', 'Toca <b>Devolver</b>.'], img: 'autorizador-2/11-devolver' },
        { pasos: ['El aviso confirma la devolución. <b>Avisa a quien capturó</b> para que la corrija: el portal no lo hace.'], img: 'autorizador-2/12-devuelta', ancho: 'chico' },
        { p: '<b>Qué pasa después.</b> Su estatus es <b>Devuelta</b> y regresa a quien la pidió, con tu motivo. Al corregirla y reenviarla, <b>vuelve a empezar desde el nivel 1</b> con el mismo folio; el jefe de área la firma otra vez y luego te llega a ti.' },
      ],
    },
    {
      id: 'varias', titulo: 'Autorizar varias a la vez',
      bloques: [
        { p: '<b>Para qué sirve.</b> Firmar de un golpe varias solicitudes que ya revisaste. <b>Cuándo se usa:</b> cuando hay muchas y estás seguro de todas.' },
        { pasos: [
          'Marca la casilla de cada solicitud (o <b>Todas</b>).',
          'Toca <b>Autorizar seleccionadas</b>.',
        ], img: 'autorizador-2/13-varias' },
        { pasos: ['El portal te muestra el <b>total de empleados y horas</b> que vas a firmar. Revisa y confirma con el botón.'], img: 'autorizador-2/14-varias-confirmar', ancho: 'chico' },
        { nota: 'Cada solicitud se firma por separado. Si alguna ya la había respondido otra persona, esa se salta y el resultado te dice cuáles sí se autorizaron.' },
        { aviso: 'Antes de firmar muchas juntas, abre al menos las que tengan <b>2 rutas</b> o muchas horas: un error aquí se repite en todas.' },
      ],
    },
    {
      id: 'capturar', titulo: 'Capturar tu propio tiempo extra',
      bloques: [
        { p: 'Tú también puedes pedir tiempo extra. <b>Cómo se arma la solicitud es igual que en el manual del Solicitante</b> (fecha, motivos, empleados, horarios, transporte, comentario y envío); revísalo en <b>Ayuda y manuales</b>. Aquí solo está lo que cambia para ti.' },
        { pasos: [
          'Al abrir <b>Solicitar tiempo extra</b>, el área sale como <b>Administrativo</b>. Si además eres solicitante o Autorizador 1 de otra área, puedes elegirla.',
          'El aviso de arriba lo dice: <b>«Como eres Autorización 2, al enviarla quedará autorizada»</b>.',
        ], img: 'autorizador-2/15-solicitar' },
        { h: 'Qué cambia' },
        { lista: [
          '<b>Se autoriza sola.</b> Al enviar, tu solicitud queda <b>Autorizada</b> en el mismo paso, con tu firma de nivel 2 («Capturada y autorizada por Aut. 2»). No pasa por el jefe de área.',
          'Va directo a <b>Por enviar al proveedor</b>, donde Recursos Humanos la confirma.',
          'Como no se puede firmar lo que uno mismo creó, tu solicitud <b>no aparece en tu bandeja</b> de Por autorizar.',
          'En un área distinta de Administrativo solo puedes capturar si tienes en ella una asignación de solicitante o de Autorizador 1.',
        ] },
        { pasos: [
          '<b>Mis solicitudes</b> agrupa lo tuyo por pestañas (Borradores, En autorización, Devueltas, Autorizadas, Vencidas, Canceladas). En <b>Autorizadas</b> están las que enviaste y se firmaron solas.',
          '<b>Continuar</b> retoma un borrador.',
        ], img: 'autorizador-2/16-mis-solicitudes' },
        { aviso: 'Como tu captura queda autorizada sin que nadie más la revise, <b>verifica tú</b> los empleados, horarios y transporte antes de enviar.' },
      ],
    },
    // ───────────────────────── LO DE VEZ EN CUANDO ─────────────────────────
    {
      id: 'fuera-de-tiempo', titulo: 'Vencidas: autorizar fuera de tiempo',
      bloques: [
        { p: '<b>Para qué sirve.</b> Una solicitud <b>vence</b> cuando pasa el día del tiempo extra sin terminar de autorizarse. Ya nadie la firma de la forma normal. Si de verdad se trabajó, <b>solo tú</b> puedes autorizarla fuera de tiempo. <b>Cuándo se usa:</b> de vez en cuando, cuando se reporta tiempo extra que no se alcanzó a firmar.' },
        { pasos: [
          'Entra a <b>Por autorizar</b> y abre la pestaña <b>Vencidas</b>.',
          '<b>Revisar</b> abre la solicitud.',
        ], img: 'autorizador-2/17-vencidas' },
        { pasos: ['Revisa que sea cierto: empleados, horas y fecha. Toca <b>Autorizar fuera de tiempo</b>.'], img: 'autorizador-2/18-fuera-de-tiempo' },
        { pasos: [
          'Escribe el <b>motivo</b> (de 10 a 500 letras): por qué se autoriza ahora.',
          'Toca el botón para confirmar.',
        ], img: 'autorizador-2/19-fuera-de-tiempo-motivo' },
        { pasos: ['El aviso confirma que quedó autorizada fuera de tiempo.'], img: 'autorizador-2/20-fuera-de-tiempo-listo', ancho: 'chico' },
        { h: 'Qué pasa después' },
        { lista: [
          'Queda <b>Autorizada</b>, con tu nombre, la fecha y tu motivo. En <b>Todas las solicitudes</b> se marca como «Fuera de tiempo» (hay filtro).',
          'Si venía del nivel 1 sin la firma del jefe de área, queda anotado que la autorizó Autorización 2.',
          'Entra al formato de nómina de su semana. <b>Si Nóminas ya firmó esa semana</b>, el portal te avisa antes de confirmar: no se agrega sola al formato firmado, hay que pedir a Recursos Humanos que reabra el área.',
          'Avisa a Recursos Humanos: como la fecha ya pasó, el transporte ya no se pide (se cierra «sin transporte») y sus horas siguen contando para nómina.',
        ] },
        { no: [
          'Autorizar fuera de tiempo una <b>borrador</b> o una <b>devuelta</b> vencida: se <b>duplican con otra fecha</b> desde Mis solicitudes (lo hace quien las capturó).',
          'Autorizar fuera de tiempo lo que <b>tú mismo creaste</b>.',
        ] },
      ],
    },
    {
      id: 'consulta', titulo: 'Todas las solicitudes (consulta)',
      bloques: [
        { p: '<b>Para qué sirve.</b> Ver toda la planta en una sola pantalla, en cualquier estatus (menos los borradores de otras personas). Es de <b>solo lectura</b>: para firmar o devolver usa <b>Por autorizar</b>. <b>Cuándo se usa:</b> para saber dónde va una solicitud, quién firmó, o armar un reporte.' },
        { pasos: [
          '<b>Exportar consulta (n)</b> baja a Excel lo que ves en pantalla, con los filtros puestos.',
          'Los resúmenes de arriba: pendientes por nivel, autorizadas esta semana y autorizado del mes por área (empleados y horas).',
          '<b>Área</b> y los demás filtros.',
        ], img: 'autorizador-2/21-consulta' },
        { pasos: [
          '<b>Estatus</b>: por ejemplo En autorización nivel 1, Vencida, Cancelada.',
          '<b>Fuera de tiempo</b>: solo las que se autorizaron así.',
          '<b>Fecha del tiempo extra</b>, desde y hasta. También hay Turno, Motivo, Solicitante, Nombre o nómina y Folio.',
        ], img: 'autorizador-2/22-consulta-filtros' },
        { p: 'Si escribes un folio o una nómina, la lista se acorta. <b>Limpiar filtros</b> los quita todos.' },
        { pasos: ['<b>Ver</b> abre el detalle de la solicitud: lo mismo que en tu bandeja, pero sin botones de firma.'], img: 'autorizador-2/23-consulta-detalle', ancho: 'chico' },
        { pasos: ['Al terminar de descargar, el portal te dice qué archivo bajó. Ábrelo desde el ícono de descargas del navegador o en la carpeta Descargas.'], img: 'autorizador-2/24-consulta-exportada', ancho: 'chico' },
        { nota: 'El Excel de la consulta es una lista de lo que ves, con estatus y quién firmó. <b>No es el reporte de nómina</b>: ese lo prepara Nóminas.' },
      ],
    },
    {
      id: 'usuarios', titulo: 'Usuarios y accesos: usuarios',
      bloques: [
        { p: '<b>Para qué sirve.</b> Cada persona entra con su número de nómina y una contraseña. Aquí das de alta a las personas, les cambias el rol y restableces su contraseña. <b>Cuándo se usa:</b> de vez en cuando: cuando entra alguien, cambia de puesto u olvida su contraseña. Se entra por <b>Asignar roles</b> en el menú, pestaña <b>Usuarios</b>.' },
        { pasos: [
          '<b>Nuevo usuario</b>: crea uno.',
          '<b>Crear usuarios en lote</b>: varios a la vez.',
          'El buscador filtra por nómina o nombre; también hay filtros de rol y de estado.',
          'El lápiz ✎ <b>edita</b>: nombre, rol del sistema y asignaciones.',
          'La llave 🔑 <b>restablece la contraseña</b>.',
          'El ojo <b>activa o desactiva</b> (una persona desactivada ya no puede entrar).',
        ], img: 'autorizador-2/25-usuarios' },
        { p: 'La tabla trae dos columnas distintas, y conviene no confundirlas:' },
        { lista: [
          '<b>Rol del sistema</b>: Usuario, Recursos Humanos, Nóminas o Administrador. Abre pantallas de administración y RH.',
          '<b>Asignaciones</b>: Autorización 2, Autorización 1 o Solicitante, por área y con fechas. Eso es lo que permite <b>capturar y autorizar</b>.',
        ] },
        { nota: 'Sin asignación, una persona solo ve su Inicio y su cuenta. El puesto <b>no da permisos</b>: los permisos salen del rol y de las asignaciones. Si ves el aviso «¿Esta persona también es de RH? Si sí, cámbiale el rol a RH», es porque tiene una asignación pero su rol del sistema es «Usuario».' },
        { h: 'Crear un usuario' },
        { pasos: [
          'Busca a la persona por nómina o nombre en el padrón. Solo salen <b>empleados activos que aún no tienen usuario</b>.',
          'Verás el <b>Rol del sistema</b>: un usuario nuevo siempre se crea como «Usuario»; RH o Nóminas se dan después, al editarlo.',
          'Toca <b>Crear usuario</b>. La contraseña temporal se genera sola.',
        ], img: 'autorizador-2/26-nuevo-usuario' },
        { pasos: ['Si la persona no está en el padrón, toca <b>Capturar a mano</b> y escribe nómina y nombre. Avisa a Recursos Humanos para que la den de alta en el padrón.'], img: 'autorizador-2/27-capturar-a-mano', ancho: 'chico' },
        { h: 'La contraseña temporal' },
        { pasos: [
          'Esta es la <b>contraseña temporal</b>. Se ve <b>una sola vez</b>.',
          '<b>Copiar contraseña</b>, o anótala.',
          'Cuando ya la copiaste o la anotaste, toca <b>Ya la copié o la anoté, cerrar</b>.',
        ], img: 'autorizador-2/28-contrasena-temporal' },
        { aviso: '<b>Entrégala en persona</b>, nunca por teléfono, correo ni mensaje. Al entrar por primera vez, la persona debe crear una contraseña propia. Si cierras sin copiarla, no se puede volver a ver: tendrás que restablecerla.' },
        { h: 'Crear varios en lote' },
        { pasos: [
          'La lista trae a las personas con <b>asignación vigente</b> (Aut. 1, Solicitante) que <b>todavía no tienen usuario</b>: nómina, nombre, puesto, área y su asignación. Marca a quienes quieres. <b>Agregar otros empleados</b> busca a alguien más en el padrón.',
          'El botón de abajo dice <b>Crear n cuentas</b> (n = las que marcaste).',
        ], img: 'autorizador-2/29-lote' },
        { pasos: ['Busca y elige a los empleados. Toca <b>Listo</b> para volver a la lista y revisarla.'], img: 'autorizador-2/30-lote-buscar', ancho: 'chico' },
        { p: 'Todas se crean con el rol del sistema «Usuario»; RH o Nóminas se dan después con el lápiz. Al terminar, el portal <b>baja un archivo de Excel con los accesos</b> (nómina, nombre y contraseña temporal de cada persona). Esas contraseñas <b>solo existen mientras la ventana está abierta</b>: si la cierras antes de descargar el archivo, el portal te pregunta «¿Ya descargaste el archivo?». Guarda el Excel en un lugar seguro, entrega cada contraseña <b>en persona</b> a su dueño y borra el archivo cuando termines.' },
      ],
    },
    {
      id: 'editar-roles', titulo: 'Editar un usuario y dar roles',
      bloques: [
        { p: '<b>Para qué sirve.</b> Cambiar el nombre o el rol del sistema de alguien, y darle o quitarle permisos de captura y autorización. Se hace con el <b>lápiz ✎</b> de la fila.' },
        { pasos: [
          '<b>Nombre completo</b>.',
          '<b>Rol del sistema</b>: Usuario, Recursos Humanos o Nóminas.',
          '<b>Agregar asignación</b>: Autorización 1 o Solicitante.',
          '<b>Guardar nombre y rol</b> solo guarda el nombre y el rol del sistema. Las asignaciones se guardan <b>al instante</b>, cada una por separado.',
        ], img: 'autorizador-2/31-editar-usuario' },
        { h: 'Dar una asignación (Aut. 1 o Solicitante)' },
        { pasos: [
          '<b>Tipo</b>: Autorización 1 (firma el nivel 1 de un área) o Solicitante (captura).',
          '<b>Área</b>: en cuál.',
          '<b>Desde</b> (y <b>Hasta</b>): vacío en «Hasta» significa permanente. Úsalo para suplencias.',
          '<b>Agregar</b>. Queda en la bitácora.',
        ], img: 'autorizador-2/32-agregar-asignacion' },
        { nota: 'Las áreas que no participan en tiempo extra (como Administrativo) no se pueden asignar. <b>Autorización 2</b> no aparece en esta lista porque la da un administrador.' },
        { h: 'Dar o quitar Recursos Humanos o Nóminas' },
        { p: 'En <b>Rol del sistema</b> elige <b>Recursos Humanos</b> o <b>Nóminas</b> y toca <b>Guardar nombre y rol</b>. El portal pide confirmación.' },
        { pasos: [
          'Lee la pregunta: dice a quién y qué acceso.',
          'Toca <b>Dar acceso</b> (al quitarlo, el botón cambia de texto). Queda en la bitácora con tu nombre.',
        ], img: 'autorizador-2/33-dar-rol-rh', ancho: 'chico' },
        { no: [
          'Cambiar <b>tu propio</b> rol, o darte a ti mismo el rol de Nóminas.',
          'Cambiar el nombre o el estado de alguien que ya es RH o Nóminas: solo le cambias el <b>rol</b>.',
          'Dar o quitar <b>Administrador</b>: solo un administrador.',
        ] },
        { aviso: 'Una cuenta con rol «Usuario» y solo una asignación de Autorización 2 <b>no ve nada de RH</b>. Si esa persona además es de Recursos Humanos, cámbiale el rol del sistema a Recursos Humanos.' },
      ],
    },
    {
      id: 'contrasenas', titulo: 'Restablecer una contraseña y desactivar',
      bloques: [
        { p: '<b>Para qué sirve.</b> Una persona olvidó su contraseña o la bloqueó. <b>Cuándo se usa:</b> cuando alguien llega a pedirlo.' },
        { aviso: 'Antes de restablecer, <b>verifica a la persona en persona, con su identificación</b>. Nunca restablezcas por teléfono, correo o mensaje: cualquiera podría hacerse pasar por ella.' },
        { pasos: [
          'En la fila de la persona, toca la llave 🔑.',
          'Toca <b>Restablecer contraseña</b>.',
        ], img: 'autorizador-2/34-restablecer' },
        { pasos: [
          'Esta es la nueva contraseña temporal, que se ve <b>una sola vez</b>.',
          'Toca <b>Ya la copié o la anoté, cerrar</b> cuando la hayas copiado.',
        ], img: 'autorizador-2/35-restablecida', ancho: 'chico' },
        { p: '<b>Qué pasa después.</b> La persona entra con la contraseña temporal y el portal le pide crear una nueva. Conserva su rol y sus asignaciones.' },
        { aviso: 'Al restablecer, los <b>borradores y solicitudes que la persona creó con su sesión anterior</b> pueden dejar de aparecerle en «Mis solicitudes». Avísale y, si hace falta, pide a Recursos Humanos que revise.' },
        { no: [
          'Restablecer la contraseña de un <b>Recursos Humanos</b> o de un administrador (lo hace un administrador).',
          'Restablecer <b>tu propia</b> contraseña: usa <b>Mi cuenta › Cambiar mi contraseña</b>.',
        ] },
        { h: 'Desactivar a alguien' },
        { pasos: ['El ojo desactiva a la persona: ya no podrá entrar, pero conserva su historial y sus datos. El mismo botón la vuelve a activar.'], img: 'autorizador-2/36-desactivar', ancho: 'chico' },
        { nota: 'Desactiva a quien deja la empresa o ya no debe tener acceso.' },
      ],
    },
    {
      id: 'asignaciones', titulo: 'Asignar roles (pestaña Asignaciones)',
      bloques: [
        { p: '<b>Para qué sirve.</b> Ver de un vistazo <b>quién tiene qué permiso, en qué área y hasta cuándo</b>, y dar uno nuevo sin buscar a la persona en Usuarios. <b>Cuándo se usa:</b> para suplencias y cambios de jefe de área.' },
        { pasos: [
          '<b>Asignar rol</b> abre el formulario.',
          'Los filtros de rol, área y estado (Vigentes, Programadas, Vencidas, Revocadas).',
          'La tabla: persona, rol, área, vigencia, estado, motivo y acciones.',
        ], img: 'autorizador-2/37-asignaciones' },
        { pasos: [
          '<b>Rol</b>: Autorización 1 o Solicitante.',
          '<b>Área</b>.',
          '<b>Empleado</b>: la persona, buscada en el padrón.',
          '<b>Desde</b> (y <b>Hasta</b>, vacío = permanente). Motivo opcional.',
          '<b>Asignar</b>.',
        ], img: 'autorizador-2/38-asignar-rol' },
        { p: 'En cada renglón puedes <b>extender</b> la vigencia (si la suplencia se alarga) o <b>revocar</b> el permiso. Todo queda en la bitácora.' },
        { nota: 'Las asignaciones tienen estado: <b>Programada</b> (empieza después), <b>Vigente</b>, <b>Vencida</b> (ya terminó) y <b>Revocada</b>. Una asignación vencida o revocada ya no da permisos.' },
      ],
    },
    {
      id: 'organigrama', titulo: 'Organigrama',
      bloques: [
        { p: '<b>Para qué sirve.</b> Ver quién autoriza y quién captura en cada área, y detectar áreas sin autorizador. <b>Cuándo se usa:</b> al revisar quién cubre qué.' },
        { pasos: [
          '<b>Resaltar sin usuario</b> marca a quien está en el padrón pero aún no tiene usuario.',
          '<b>Nivel 2 · Planta</b>: quien firma en el nivel 2.',
          'Cada área muestra su Autorización 1 y sus solicitantes. Si falta uno dice <b>Sin Autorización 1</b> («las solicitudes de esta área no podrán avanzar») y trae un botón <b>Asignar</b>.',
        ], img: 'autorizador-2/39-organigrama' },
        { pasos: [
          'Al tocar a una persona se abre su ficha: sus asignaciones, con vigencia y quién las dio. <b>Extender</b> alarga la vigencia.',
          '<b>Revocar</b> la quita.',
          '<b>Historial</b>: todo lo que se ha hecho con sus permisos.',
        ], img: 'autorizador-2/40-organigrama-persona' },
      ],
    },
    {
      id: 'lista-personal', titulo: 'Personal elegible para tiempo extra',
      bloques: [
        { p: '<b>Para qué sirve.</b> Consultar a quién se le puede capturar tiempo extra (los «elegibles»). Es solo consulta. Se entra desde <b>Personal de planta › Ver lista</b> en tu Inicio.' },
        { pasos: [
          'Filtra por <b>área</b>.',
          'La tabla trae nómina, nombre, puesto y área.',
        ], img: 'autorizador-2/41-lista-personal' },
        { nota: 'Si alguien no sale aquí, es porque no está activo o no está marcado como elegible en el padrón (supervisores, jefes y administrativos normalmente no lo están). Recursos Humanos lo corrige en <b>Personal</b>.' },
      ],
    },
    // ───────────────────────── CASOS ESPECIALES ─────────────────────────
    {
      id: 'casos', titulo: 'Casos especiales',
      bloques: [
        { h: 'Autoricé por error' },
        { p: 'Una firma <b>no se deshace</b>. Pide a Recursos Humanos que <b>devuelva</b> la solicitud (para corregirla) o la <b>cancele</b> con un motivo, y que lo haga <b>antes de confirmarla</b> al proveedor. Si ya se confirmó, RH la cancela y avisa al proveedor por su cuenta: <b>la aplicación no avisa al proveedor</b>.' },
        { h: 'Una solicitud que debería estar no aparece en mi bandeja' },
        { lista: [
          'Solo te llegan las que ya firmó el jefe de área. Búscala en <b>Todas las solicitudes</b>: te dice en qué nivel está.',
          'Si no la ves ahí, es un <b>borrador</b> (solo lo ve quien lo está armando).',
          'Si tú la creaste, no la firmas: se autorizó sola al enviarla.',
          'Si el área no tiene Autorizador 1, la solicitud no avanza: míralo en el <b>Organigrama</b> («Sin Autorización 1») y asigna a alguien.',
        ] },
        { h: 'No encuentro a un empleado' },
        { lista: [
          '<b>Al crear un usuario</b>: solo salen empleados activos y sin usuario. Si no sale, ya tiene usuario (búscalo en la lista) o no está en el padrón: usa «Capturar a mano» y avisa a Recursos Humanos.',
          '<b>Al capturar tiempo extra</b>: solo salen los elegibles de esa área. Revisa la <b>Lista del personal elegible</b>; si falta, Recursos Humanos lo marca como elegible en Personal.',
        ] },
        { h: 'La semana ya estaba firmada en Nóminas' },
        { p: 'Si autorizas fuera de tiempo algo de una semana que Nóminas ya firmó, el portal te avisa antes de confirmar. La solicitud queda autorizada, pero <b>no se agrega sola al formato firmado</b>. Avisa a Recursos Humanos: ellos pueden reabrir el área para que Nóminas la corrija y la firme de nuevo.' },
        { h: 'Una persona también es de Recursos Humanos' },
        { p: 'Con rol «Usuario» y una asignación de Autorización 2, no ve nada de RH. Edítala con el lápiz y cambia su <b>Rol del sistema</b> a Recursos Humanos.' },
        { h: 'Dos personas respondieron lo mismo' },
        { p: 'El portal no deja firmar dos veces. Al que llega segundo le avisa «Alguien más ya respondió esta solicitud» y no se cambia nada.' },
        { h: 'El proveedor no recibió a alguien' },
        { p: 'La aplicación <b>no avisa al proveedor por sí sola</b>; quien manda el Formato de rutas es Recursos Humanos. Si te reportan que alguien no fue recogido, pide a Recursos Humanos que revise en el portal que la solicitud estaba <b>confirmada</b> y que la persona sale en el <b>Formato de rutas del día correcto</b> (ojo con los horarios que cruzan la medianoche: van al día siguiente), con su ruta, comunidad, punto de reunión y teléfono. Tú puedes comprobar en <b>Todas las solicitudes › Ver</b> que la persona estaba en la solicitud y con transporte.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['¿Puedo firmar mi propia solicitud?', 'No hace falta: lo que capturas queda autorizado al enviarlo. Lo que no puedes es firmar, en el nivel de revisión, algo que tú creaste.'],
          ['¿Puedo devolver una solicitud que ya autoricé?', 'No desde tu bandeja. Pide a Recursos Humanos que la devuelva (nivel 3) o la cancele.'],
          ['¿Por qué no veo «Por enviar al proveedor» ni el Formato de rutas?', 'Son de Recursos Humanos y Nóminas. Tu trabajo termina al autorizar.'],
          ['¿Puedo darle a alguien el rol de Autorización 2?', 'No. Solo un administrador. Tú sí puedes dar Autorización 1, Solicitante, Recursos Humanos y Nóminas.'],
          ['Creé un usuario y cerré sin copiar la contraseña.', 'No se puede volver a ver. Restablece la contraseña de esa persona y entrega la nueva en persona.'],
          ['Alguien olvidó su contraseña y está lejos.', 'Solo se restablece en persona. Nunca la des por teléfono ni por mensaje, aunque suene urgente.'],
          ['¿Cómo sé quién cambió un permiso?', 'En el <b>Organigrama</b>, al tocar a una persona, su <b>Historial</b> muestra cada alta, cambio y baja con su autor y su fecha.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; lo ya firmado no se pierde.'],
        ] },
      ],
    },
    {
      id: 'estatus', titulo: 'Qué significa cada estatus',
      bloques: [
        { p: 'Así se ve cada estatus y qué haces tú con él:' },
        { tabla: 'estatus', rol: 'autorizador-2' },
      ],
    },
  ],
};
