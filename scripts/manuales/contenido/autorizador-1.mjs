// Contenido del manual del AUTORIZADOR 1 (jefe de un área). Español sencillo, frases cortas, trato de «tú» (igual que la aplicación). Mismos bloques que el del solicitante.
export default {
  rol: 'Autorizador 1',
  archivo: 'autorizador-1',
  quien: 'Para el jefe de un área (por ejemplo, el jefe de Moldes) que revisa y autoriza —o devuelve— el tiempo extra que pide su gente.',
  guia: {
    titulo: 'Guía rápida · Autorizador 1',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Mira', 'En el menú toca <b>Por autorizar</b>. Las más antiguas salen primero.'],
      ['Revisa', 'Toca <b>Revisar</b> en una solicitud: mira empleados, horarios, motivos y rutas.'],
      ['Autoriza', 'Toca <b>Autorizar</b>. Pasa a Autorización 2. El comentario es opcional.'],
      ['O devuelve', 'Escribe qué debe corregir (mínimo 10 letras) y toca <b>Devolver</b>.'],
      ['Varias', 'Marca las casillas y toca <b>Autorizar seleccionadas</b> (o <b>Todas</b>).'],
      ['Avisa', 'El sistema <b>no avisa solo</b>: dile a Autorización 2 que ya firmaste, o a quien la pidió que la corrija.'],
    ],
    recuerda: [
      'Lo que tú mismo capturaste <b>no lo puedes autorizar</b>: lo firma Autorización 2.',
      'Si pasa la fecha del tiempo extra sin firma, la solicitud queda <b>Vencida</b>: solo Autorización 2 puede autorizarla fuera de tiempo.',
      'Cada <b>ruta adicional</b> cuesta: revisa la justificación antes de autorizar.',
      'Si pasas <b>30 minutos sin usar</b> el portal, se cierra tu sesión.',
    ],
    contacto: 'Dudas de solicitudes: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir tiempo extra y transporte. Tú eres el <b>primer nivel de autorización</b> de tu área: ves lo que pide tu gente y decides si se autoriza o se devuelve.' },
        { p: 'Así camina una solicitud:' },
        { lista: [
          '<b>Quien la pide</b> (solicitante de tu área) la captura y la envía.',
          '<b>Tú</b> (Autorización 1) la revisas y la autorizas o la devuelves.',
          '<b>Autorización 2</b> da la segunda firma.',
          '<b>Recursos Humanos</b> la confirma y pide el transporte al proveedor.',
        ] },
        { nota: 'El sistema <b>no manda correos ni mensajes</b>. Después de firmar o devolver, avísale tú a la persona que sigue.' },
        { aviso: 'No puedes autorizar lo que tú mismo capturaste. Si tú pides tiempo extra, tu solicitud va directo a Autorización 2.' },
      ],
    },
    {
      id: 'primeros-pasos', titulo: 'Primeros pasos',
      bloques: [
        { h: 'Entrar al portal' },
        { p: 'Abre <b>https://centurymold-qro.web.app</b> en tu navegador (Chrome, Edge o el de tu celular).' },
        { pasos: [
          'Escribe tu <b>número de nómina</b>.',
          'Escribe tu <b>contraseña</b>. El ojito sirve para ver lo que escribes.',
          'Toca <b>Iniciar sesión</b>.',
          'Si no la recuerdas, toca <b>¿Olvidaste tu contraseña?</b>.',
        ], img: 'solicitante/01-entrar' },
        { p: 'La primera vez, el portal te pide crear una <b>contraseña nueva</b> (mínimo 8 caracteres, con letras y números). Las contraseñas solo se restablecen <b>en persona</b>, con Sistemas o Recursos Humanos y tu identificación.' },
        { h: 'Tu pantalla de inicio' },
        { pasos: [
          'En el menú de la izquierda, <b>Por autorizar</b> muestra cuántas solicitudes esperan tu firma.',
          'En el inicio ves un resumen de lo pendiente y lo que viene en los próximos días.',
        ], img: 'autorizador-1/01-inicio' },
        { nota: 'En el pie del menú está <b>Ayuda y manuales</b>, con este manual y su guía rápida en PDF, y <b>Cerrar sesión</b>. En una computadora compartida, cierra tu sesión al terminar.' },
      ],
    },
    {
      id: 'autorizar', titulo: 'Revisar y autorizar una solicitud',
      bloques: [
        { p: 'Entra a <b>Por autorizar</b>. Las solicitudes más antiguas salen primero y las que vencen hoy lo dicen.' },
        { pasos: [
          'La pestaña <b>Por autorizar</b> muestra lo que espera tu firma. <b>Vencidas</b> e <b>Historial de mi área</b> están a un lado.',
          'Toca <b>Revisar</b> en la solicitud que quieras ver.',
          'Con <b>Todas</b> marcas todas las casillas; con <b>Autorizar seleccionadas</b> las firmas juntas (más abajo).',
        ], img: 'autorizador-1/02-bandeja' },
        { p: 'Al tocar <b>Revisar</b> se abre la solicitud completa: fecha, motivos, cada empleado con su horario y su ruta, y el historial. Léela antes de decidir. Si usa <b>más de una ruta</b>, revisa la justificación: cada ruta extra cuesta.' },
        { pasos: [
          'Si quieres, escribe un <b>comentario</b> (al autorizar es opcional).',
          'Toca <b>Devolver</b> si hay algo que corregir (más abajo).',
          'Toca <b>Autorizar</b>. La solicitud pasa a Autorización 2.',
        ], img: 'autorizador-1/04-detalle' },
        { p: 'Al autorizar, la pantalla confirma y te recuerda a quién avisarle.' },
        { pasos: ['Lee el aviso: dice qué solicitud autorizaste y quién la revisa ahora.'], img: 'autorizador-1/05-autorizada', ancho: 'chico' },
        { nota: 'Si otra persona respondió la misma solicitud mientras la tenías abierta, el portal te avisa («Alguien más ya respondió esta solicitud»): no se firma dos veces.' },
      ],
    },
    {
      id: 'devolver', titulo: 'Devolver una solicitud',
      bloques: [
        { p: 'Si algo está mal (horarios, empleados, motivo, rutas), no la autorices: <b>devuélvela</b> con una explicación clara.' },
        { pasos: [
          'Abre la solicitud con <b>Revisar</b>.',
          'Escribe en <b>Comentario</b> qué debe corregir quien la pidió. Es obligatorio y lleva <b>mínimo 10 letras</b>.',
          'Toca <b>Devolver</b>.',
        ], img: 'autorizador-1/06-devolver' },
        { pasos: ['El aviso confirma la devolución. <b>Avísale a la persona</b> para que la corrija: el portal no lo hace.'], img: 'autorizador-1/07-devuelta', ancho: 'chico' },
        { p: 'La persona la corrige y la reenvía; vuelve a empezar en tu bandeja con el mismo folio.' },
      ],
    },
    {
      id: 'varias', titulo: 'Autorizar varias a la vez',
      bloques: [
        { p: 'Cuando varias solicitudes están bien, no hace falta abrir una por una.' },
        { pasos: [
          'Marca la casilla de cada solicitud (o <b>Todas</b>).',
          'Toca <b>Autorizar seleccionadas</b>. El portal te muestra el total de empleados y horas antes de firmar.',
        ], img: 'autorizador-1/03-varias' },
        { nota: 'Cada solicitud se firma por separado. Si alguna ya la había respondido otra persona, esa se salta y el resultado te dice cuáles sí se autorizaron.' },
      ],
    },
    {
      id: 'vencidas-historial', titulo: 'Vencidas e historial de tu área',
      bloques: [
        { pasos: ['<b>Vencidas</b>: la fecha del tiempo extra ya pasó sin autorizarse. Tú ya no las puedes firmar ni devolver; solo Autorización 2 puede autorizarlas fuera de tiempo.'], img: 'autorizador-1/08-vencidas' },
        { pasos: ['<b>Historial de mi área</b>: todo lo que ya salió de tu bandeja (autorizado, devuelto, cancelado o confirmado) para consultarlo.'], img: 'autorizador-1/09-historial' },
      ],
    },
    {
      id: 'tus-solicitudes', titulo: 'Si tú también pides tiempo extra',
      bloques: [
        { p: 'Tú también puedes capturar tiempo extra de tu área. Se hace igual que en el manual del Solicitante, con una diferencia:' },
        { pasos: ['Toca <b>Solicitar tiempo extra</b> en <b>Mis solicitudes</b>.'], img: 'autorizador-1/10-mis-solicitudes', ancho: 'chico' },
        { aviso: 'Lo que tú capturas <b>se salta tu propio nivel</b>: pasa directo a Autorización 2 (tú no te autorizas). Si hay que corregir algo, te lo devuelve Autorización 2.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['No veo una solicitud de mi gente.', 'Solo ves lo de tu área y lo que ya fue enviado (un borrador solo lo ve quien lo está armando). Si te falta un permiso, pídelo a Recursos Humanos o a Autorización 2.'],
          ['Quiero deshacer una firma.', 'No se puede deshacer. Si ya autorizaste algo por error, avisa a Autorización 2 o a Recursos Humanos: ellos pueden devolverla o cancelarla con un motivo.'],
          ['¿Puedo autorizar cuando estoy de vacaciones?', 'Tu permiso tiene fechas. Si vas a faltar, pide a Recursos Humanos o a Autorización 2 que asignen a tu suplente en su lugar.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; no se pierde lo ya firmado.'],
          ['Olvidé mi contraseña.', 'Solo se restablece en persona con Sistemas o Recursos Humanos y tu identificación. Nunca la des por teléfono ni por mensaje.'],
        ] },
      ],
    },
  ],
};
