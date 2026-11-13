// Contenido del manual del AUTORIZADOR 2 (segunda firma de toda la planta). Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
export default {
  rol: 'Autorizador 2',
  archivo: 'autorizador-2',
  quien: 'Para quien da la segunda firma del tiempo extra de toda la planta (por ejemplo, el gerente de operaciones) y puede autorizar lo que ya venció.',
  guia: {
    titulo: 'Guía rápida · Autorizador 2',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Mira', 'En el menú toca <b>Por autorizar</b>: aquí están las que ya firmó el jefe de área.'],
      ['Revisa', 'Toca <b>Revisar</b>: empleados, horarios, motivos, rutas y quién firmó antes.'],
      ['Autoriza', 'Toca <b>Autorizar</b>. Queda lista para Recursos Humanos.'],
      ['O devuelve', 'Escribe qué debe corregir (mínimo 10 letras) y toca <b>Devolver</b>.'],
      ['Varias', 'Marca las casillas y toca <b>Autorizar seleccionadas</b> (o <b>Todas</b>).'],
      ['Vencidas', 'En <b>Vencidas</b>, toca <b>Autorizar fuera de tiempo</b> y escribe el motivo (mínimo 10 letras).'],
    ],
    recuerda: [
      'El sistema <b>no avisa solo</b>: avisa a Recursos Humanos o a quien pidió, según el caso.',
      'Lo que tú capturas queda <b>autorizado al enviarlo</b> (eres el último nivel).',
      '<b>Fuera de tiempo</b> solo lo autoriza un Autorizador 2; queda con tu nombre y tu motivo.',
      'Si la semana ya está <b>firmada en Nóminas</b>, lo autorizado fuera de tiempo no entra al formato sin ajuste.',
    ],
    contacto: 'Dudas de solicitudes: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir tiempo extra y transporte. Tú das la <b>segunda y última firma</b> de toda la planta y eres quien puede <b>autorizar lo que ya venció</b>.' },
        { p: 'Así camina una solicitud:' },
        { lista: [
          '<b>Quien la pide</b> la captura y la envía.',
          '<b>El jefe de su área</b> (Autorización 1) la autoriza o la devuelve.',
          '<b>Tú</b> (Autorización 2) das la segunda firma.',
          '<b>Recursos Humanos</b> la confirma y pide el transporte al proveedor.',
        ] },
        { nota: 'El sistema <b>no manda correos ni mensajes</b>. Después de firmar o devolver, avisa tú a la persona que sigue.' },
        { aviso: 'No puedes autorizar lo que tú mismo capturaste en el nivel de revisión. Lo que tú capturas queda autorizado al enviarlo, con tu firma.' },
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
        { p: 'Las contraseñas solo se restablecen <b>en persona</b>, con Sistemas o Recursos Humanos y tu identificación.' },
        { h: 'Tu pantalla de inicio' },
        { pasos: [
          'En el menú, <b>Por autorizar</b> te dice cuántas solicitudes esperan tu firma.',
          'El inicio resume lo pendiente y lo que viene en los próximos días.',
        ], img: 'autorizador-2/01-inicio' },
        { nota: 'En el pie del menú están <b>Ayuda y manuales</b> (este manual y su guía rápida en PDF) y <b>Cerrar sesión</b>.' },
      ],
    },
    {
      id: 'autorizar', titulo: 'Revisar y autorizar',
      bloques: [
        { p: 'En <b>Por autorizar</b> ves las solicitudes que ya firmó el jefe de área y esperan tu firma, de todas las áreas. Puedes filtrar por área o por fecha.' },
        { pasos: [
          'La pestaña <b>Por autorizar</b> muestra lo que espera tu firma.',
          'Toca <b>Revisar</b> para abrir una solicitud.',
          'Con <b>Todas</b> marcas todas las casillas.',
          'Con <b>Autorizar seleccionadas</b> firmas varias juntas.',
        ], img: 'autorizador-2/02-bandeja' },
        { p: 'La solicitud abierta trae la fecha, los motivos, cada empleado con su horario y su ruta, quién firmó antes y el historial. Si usa más de una ruta, lee la justificación: cada ruta extra cuesta.' },
        { pasos: [
          'Escribe un <b>comentario</b> si quieres (al autorizar es opcional).',
          'Toca <b>Devolver</b> si hay algo que corregir.',
          'Toca <b>Autorizar</b>: la solicitud queda lista para Recursos Humanos.',
        ], img: 'autorizador-2/03-detalle' },
        { pasos: ['El aviso confirma la firma. Recursos Humanos ya la ve en <b>Por enviar al proveedor</b>.'], img: 'autorizador-2/04-autorizada', ancho: 'chico' },
      ],
    },
    {
      id: 'devolver', titulo: 'Devolver una solicitud',
      bloques: [
        { pasos: [
          'Abre la solicitud con <b>Revisar</b>.',
          'Escribe qué debe corregir en <b>Comentario</b> (obligatorio, mínimo 10 letras).',
          'Toca <b>Devolver</b>.',
        ], img: 'autorizador-2/05-devolver' },
        { nota: 'Al devolverla, regresa a quien la pidió y <b>vuelve a empezar desde el nivel 1</b> cuando la reenvíe. Avísale a esa persona: el portal no lo hace.' },
      ],
    },
    {
      id: 'fuera-de-tiempo', titulo: 'Autorizar lo que ya venció (fuera de tiempo)',
      bloques: [
        { p: 'Una solicitud <b>vence</b> cuando pasa el día del tiempo extra sin terminar de autorizarse. Ya nadie la firma de la forma normal; <b>solo tú</b> (Autorización 2) puedes autorizarla fuera de tiempo, si de verdad se trabajó.' },
        { pasos: ['Entra a la pestaña <b>Vencidas</b> y toca <b>Revisar</b> en la solicitud.'], img: 'autorizador-2/06-vencidas' },
        { pasos: ['Toca <b>Autorizar fuera de tiempo</b>.'], img: 'autorizador-2/07-fuera-de-tiempo' },
        { pasos: [
          'Escribe el <b>motivo</b> (de 10 a 500 letras): por qué se autoriza ahora.',
          'Toca el botón para confirmar.',
        ], img: 'autorizador-2/08-fuera-de-tiempo-motivo' },
        { aviso: 'Queda registrado con tu nombre, la fecha y tu motivo. Si venía del nivel 1 sin la firma del jefe de área, queda anotado que la autorizó Autorización 2. Si Nóminas ya firmó esa semana, el portal te avisa: puede requerir un ajuste en el formato.' },
      ],
    },
    {
      id: 'consultar', titulo: 'Consultar todas las solicitudes',
      bloques: [
        { pasos: ['En el menú, <b>Tiempo extra</b> muestra todas las solicitudes de la planta, con filtros por área, estatus, fechas, turno y motivo, y permite descargar el resumen en Excel.'], img: 'autorizador-2/09-consulta' },
        { nota: 'Es de solo lectura: para autorizar o devolver, usa <b>Por autorizar</b>.' },
      ],
    },
    {
      id: 'asignaciones', titulo: 'Dar permisos a otras personas',
      bloques: [
        { p: 'Como Autorización 2 puedes dar y quitar el rol de <b>Autorizador 1</b> y de <b>solicitante</b> en un área. No puedes dar Autorización 2 ni administrar a Recursos Humanos.' },
        { pasos: ['Entra a <b>Personal › Usuarios y accesos › Asignaciones</b>. Ahí ves quién tiene qué rol y hasta cuándo, y puedes asignar o revocar.'], img: 'autorizador-2/10-asignaciones' },
        { nota: 'Cada asignación tiene fecha de inicio y, si quieres, de fin (por ejemplo, para una suplencia). Todo queda en la bitácora.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['No veo una solicitud que debería estar.', 'Solo llegan a ti las que ya firmó el jefe de área. Si aún está en el nivel 1, mira en <b>Tiempo extra</b> (consulta) quién la tiene.'],
          ['Autoricé por error.', 'No se deshace. Pide a Recursos Humanos que la devuelva o la cancele con un motivo, antes de que se confirme al proveedor.'],
          ['¿Qué pasa si autorizo fuera de tiempo y la semana ya está firmada en Nóminas?', 'El portal te lo avisa. La solicitud queda autorizada, pero su tiempo extra no entra solo al formato ya firmado: Nóminas o Recursos Humanos tienen que ajustarlo.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; lo ya firmado no se pierde.'],
        ] },
      ],
    },
  ],
};
