// Contenido del manual del AUTORIZADOR 1 (jefe de un área). Español sencillo, frases cortas, trato de «tú» (igual que la aplicación).
// Los números de los pasos coinciden con los números de las flechas de cada captura (ver scripts/manuales/roles/autorizador-1.mjs).
export default {
  rol: 'Autorizador 1',
  archivo: 'autorizador-1',
  quien: 'Para el jefe de un área (por ejemplo, el jefe de Moldes) que revisa y autoriza —o devuelve— el tiempo extra que pide su gente.',
  guia: {
    titulo: 'Guía rápida · Autorizador 1',
    pasos: [
      ['Entra', 'Abre <b>centurymold-qro.web.app</b>. Escribe tu <b>nómina</b> y tu <b>contraseña</b>.'],
      ['Mira', 'Menú › <b>Por autorizar</b>. Las más antiguas salen primero; «Vence hoy» te avisa lo urgente.'],
      ['Revisa', 'Toca <b>Revisar</b>: empleados, horarios, transporte, motivos, P.O./TB e historial.'],
      ['Autoriza', 'Toca <b>Autorizar</b>. Pasa a Autorización 2. El comentario es opcional.'],
      ['O devuelve', 'Escribe qué debe corregir (mínimo 10 letras) y toca <b>Devolver</b>.'],
      ['Varias', 'Marca las casillas y toca <b>Autorizar seleccionadas</b>. Te muestra el total antes.'],
      ['Avisa', 'El sistema <b>no avisa solo</b>: dile a Autorización 2 que ya firmaste, o a quien la pidió que la corrija.'],
    ],
    recuerda: [
      'Lo que tú mismo capturaste <b>no lo firmas</b>: pasa directo a Autorización 2.',
      'Si pasa la fecha sin firma, queda <b>Vencida</b>: ya no la firmas; solo Autorización 2 puede autorizarla fuera de tiempo.',
      'Cada <b>ruta adicional</b> cuesta: revisa la justificación antes de autorizar.',
      'Una firma <b>no se deshace</b>. Si fue un error, avisa a Recursos Humanos antes de que confirmen.',
    ],
    contacto: 'Dudas de solicitudes: <b>Recursos Humanos</b> · Contraseña o fallas: <b>Sistemas</b> (en persona, con tu identificación)',
  },
  secciones: [
    // ───────────────────────── ANTES DE EMPEZAR ─────────────────────────
    {
      id: 'antes', titulo: 'Antes de empezar',
      bloques: [
        { p: 'El <b>Portal de procesos</b> es el sistema de Century Mold para pedir y autorizar tiempo extra y transporte. Tú eres el <b>primer nivel de autorización de tu área</b>: ves lo que pide tu gente y decides si se autoriza o se devuelve.' },
        { h: 'Cómo camina una solicitud' },
        { lista: [
          '<b>Quien la pide</b> (solicitante de tu área) la captura y la envía.',
          '<b>Tú</b> (Autorización 1) la revisas y la autorizas o la devuelves.',
          '<b>Autorización 2</b> da la segunda firma.',
          '<b>Recursos Humanos</b> la confirma y pide el transporte al proveedor.',
        ] },
        { nota: 'El sistema <b>no manda correos ni mensajes</b>. Después de firmar o devolver, avisa tú a la persona que sigue. Cada vez que este manual diga «avisa», es por eso.' },
        { h: 'Lo que puedes hacer' },
        { lista: [
          'Ver y firmar en nivel 1 las solicitudes de <b>tu área</b>, en <b>Por autorizar</b>: una por una o varias a la vez.',
          'Devolver una solicitud con un motivo.',
          'Ver las <b>vencidas</b> y el <b>historial de tu área</b>.',
          'Ver <b>Mi área</b> (quién autoriza y quién solicita) y la <b>lista del personal</b> al que puedes pedirle tiempo extra.',
          'Capturar tiempo extra de tu área (pasa directo a Autorización 2).',
        ] },
        { no: [
          'Firmar lo que <b>tú mismo capturaste</b>: va directo a Autorización 2.',
          'Autorizar o devolver una solicitud <b>vencida</b>: solo Autorización 2 puede autorizarla fuera de tiempo.',
          'Ver ni firmar solicitudes de <b>otras áreas</b>.',
          'Deshacer una firma o cancelar una solicitud ya autorizada: se pide a Recursos Humanos.',
          'Confirmar el envío al proveedor ni bajar el Formato de rutas.',
          'Dar roles, crear usuarios ni restablecer contraseñas.',
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
        { p: 'Arriba dice tu rol y tu área (por ejemplo, «Autorización 1 · Moldes»).' },
        { pasos: [
          '<b>Por autorizar</b> en el menú trae un número: cuántas solicitudes esperan tu firma.',
          '<b>Ir a la bandeja</b> abre esa lista.',
          '<b>Personal de mi área</b>: a cuántos puedes pedirles tiempo extra; <b>Ver lista</b> los muestra.',
          '<b>Últimas solicitudes de mi área</b>, con su estatus. Más arriba: borradores, en autorización, devueltas y autorizadas este mes.',
        ], img: 'autorizador-1/01-inicio' },
        { h: 'El menú' },
        { pasos: [
          '<b>Solicitar tiempo extra</b>: para capturar el de tu área.',
          '<b>Mis solicitudes</b>: lo que tú capturaste.',
          '<b>Por autorizar</b>: tu bandeja.',
          '<b>Mi área</b>: el organigrama de tu área.',
          '<b>Ayuda y manuales</b> (abajo): este manual y su guía rápida en PDF, con «Descargar PDF». Abajo también está <b>Cerrar sesión</b>.',
        ], img: 'autorizador-1/02-menu', ancho: 'chico' },
        { nota: 'En <b>Mi cuenta</b> (tu nombre, abajo en el menú) cambias tu contraseña, el tamaño de letra, el tema y las ayudas. Por seguridad la sesión se cierra a los <b>30 minutos sin usar</b>; lo ya firmado no se pierde. En una computadora compartida, cierra tu sesión al terminar.' },
      ],
    },
    // ───────────────────────── LO DE TODOS LOS DÍAS ─────────────────────────
    {
      id: 'bandeja', titulo: 'Por autorizar: tu bandeja',
      bloques: [
        { p: '<b>Para qué sirve.</b> Aquí están las solicitudes de tu área que esperan tu firma. <b>Cuándo se usa:</b> todos los días.' },
        { pasos: [
          'La pestaña <b>Por autorizar</b> es lo que espera tu firma.',
          '<b>Vencidas</b>: las que ya pasaron de fecha.',
          '<b>Historial de mi área</b>: lo que ya salió de tu bandeja.',
          'La insignia <b>Vence hoy</b> marca lo urgente: si no firmas hoy, queda vencida.',
          '<b>Revisar</b> abre la solicitud completa.',
        ], img: 'autorizador-1/03-bandeja' },
        { p: 'Las más antiguas salen primero. Cada renglón trae el folio, el motivo, quién la pidió, la fecha, cuántos empleados y horas, cuántos van con transporte y cuánto lleva esperando. Una insignia <b>Extensión de turno</b> significa que el empleado ya está en la planta y se queda más tiempo. Una insignia <b>2 rutas</b> (o más) significa empleados en rutas distintas: cada ruta extra cuesta, así que revisa la justificación. Las solicitudes que tú mismo capturaste no aparecen aquí.' },
        { pasos: [
          '<b>Área</b>: si tienes más de un área.',
          '<b>Fecha del tiempo extra, desde</b> y <b>Hasta</b>.',
          '<b>Todas</b> marca todas las casillas.',
          '<b>Autorizar seleccionadas</b> firma varias juntas (más adelante).',
        ], img: 'autorizador-1/04-filtros' },
        { p: 'La lista se actualiza sola cuando alguien firma, devuelve o envía.' },
      ],
    },
    {
      id: 'revisar', titulo: 'Revisar una solicitud, parte por parte',
      bloques: [
        { p: 'Toca <b>Revisar</b>. Se abre la solicitud completa; léela de arriba abajo antes de decidir.' },
        { h: 'Arriba: los datos generales' },
        { pasos: [
          'El <b>folio</b> (por ejemplo TE-2026-0003) identifica la solicitud. Dentro verás el <b>estatus</b>, el <b>tipo</b> (turno extra o extensión de turno), el <b>área</b>, quién la pidió, la <b>fecha</b>, los <b>motivos</b>, cuántos <b>empleados</b> y <b>horas</b>, cuántos <b>con transporte</b> y <b>con alimentos</b>, y quién firmó cada nivel.',
          '<b>Empleados por horario</b> resume cuántas personas entran a cada horario.',
        ], img: 'autorizador-1/05-detalle-arriba' },
        { p: 'El <b>comentario</b> explica para qué se necesita. Los <b>motivos</b> dicen por qué; si es «Cargo a P.O.» o TB, trae el número, y el detalle añade una frase corta. Una solicitud puede tener varios motivos.' },
        { h: 'En medio: los empleados' },
        { pasos: [
          '<b>Empleados (n)</b>: la lista, con nómina, nombre y puesto.',
          '<b>Horario</b>: entrada y salida. Si termina después de medianoche lo dice, por ejemplo «12:00 a. m. (medianoche)» y «Termina: miércoles 18 nov (día siguiente)».',
          '<b>Alimentos</b>: si lleva comida. A la derecha va <b>Ruta / comunidad / punto</b>: dónde lo recoge el transporte, o «Sin transporte».',
        ], img: 'autorizador-1/06-detalle-empleados' },
        { nota: 'Fíjate en los horarios que cruzan la medianoche y en quién va <b>sin transporte</b>: son lo que más se corrige después. El portal también te recuerda: «Cada ruta adicional representa un costo extra. Revisa la justificación antes de autorizar.»' },
        { h: 'Abajo: historial y decisión' },
        { pasos: [
          '<b>Historial</b>: quién hizo qué y cuándo (creada, devuelta, reenviada…), con los comentarios.',
          '<b>Comentario</b>: opcional al autorizar, obligatorio al devolver (mínimo 10 letras).',
          '<b>Devolver</b>: regresa la solicitud con tu motivo.',
          '<b>Autorizar</b>: da tu firma. Dice a dónde pasa: «Autorizar (pasa a nivel 2)».',
        ], img: 'autorizador-1/07-detalle-abajo' },
      ],
    },
    {
      id: 'autorizar', titulo: 'Autorizar',
      bloques: [
        { p: '<b>Para qué sirve.</b> Tu firma de nivel 1 pasa la solicitud a Autorización 2. <b>Cuándo se usa:</b> cuando la solicitud está bien.' },
        { pasos: [
          'Revisa la solicitud (sección anterior).',
          'Si quieres, escribe un comentario.',
          'Toca <b>Autorizar</b>.',
        ] },
        { pasos: ['El aviso confirma la firma y dice <b>quién la revisa ahora</b> (por ejemplo, «Ahora la revisa Roberto Ibarra Salazar (Aut. 2)»). También te recuerda que el sistema no avisa solo.'], img: 'autorizador-1/08-autorizada', ancho: 'chico' },
        { h: 'Qué pasa después, y a quién avisar' },
        { lista: [
          'Su estatus pasa a <b>En autorización (nivel 2)</b>. La ves en el <b>Historial de mi área</b>.',
          '<b>Avisa a Autorización 2</b> («ya firmé el folio…»), sobre todo si el tiempo extra es hoy o mañana: si pasa la fecha sin su firma, queda vencida.',
          'Después, Recursos Humanos la confirma y pide el transporte.',
        ] },
        { nota: 'Si otra persona respondió la misma solicitud mientras la tenías abierta, el portal te avisa («Alguien más ya respondió esta solicitud»): no se firma dos veces. Cierra y revisa la lista.' },
      ],
    },
    {
      id: 'devolver', titulo: 'Devolver una solicitud',
      bloques: [
        { p: '<b>Para qué sirve.</b> Regresar una solicitud a quien la capturó para que la corrija. <b>Cuándo se usa:</b> si hay un error de horarios, empleados, motivo, transporte o rutas.' },
        { p: 'El motivo es obligatorio. Mientras no escribas al menos <b>10 letras</b>, el botón <b>Devolver</b> está apagado.' },
        { pasos: ['Escribe qué debe corregir en <b>Comentario</b>.', '<b>Devolver</b> sigue apagado hasta que el comentario tenga 10 letras.'], img: 'autorizador-1/09-devolver-sin-motivo' },
        { pasos: ['Escribe un motivo claro: qué está mal y cómo corregirlo.', 'Toca <b>Devolver</b>.'], img: 'autorizador-1/10-devolver' },
        { pasos: ['El aviso confirma la devolución y te recuerda <b>avisar a quien la capturó</b>: el portal no lo hace.'], img: 'autorizador-1/11-devuelta', ancho: 'chico' },
        { p: '<b>Qué pasa después.</b> Su estatus es <b>Devuelta</b> y regresa a quien la pidió, con tu motivo. La persona la corrige y la reenvía: <b>vuelve a tu bandeja</b> con el mismo folio.' },
      ],
    },
    {
      id: 'varias', titulo: 'Autorizar varias a la vez',
      bloques: [
        { p: '<b>Para qué sirve.</b> Firmar de un golpe varias solicitudes que ya revisaste. <b>Cuándo se usa:</b> cuando hay muchas y estás seguro de todas.' },
        { pasos: [
          'Marca la casilla de cada solicitud (o <b>Todas</b>).',
          'Toca <b>Autorizar seleccionadas</b>. El botón dice cuántas llevas («Autorizar 3 seleccionadas»).',
        ], img: 'autorizador-1/12-varias' },
        { pasos: ['El portal te muestra el <b>total de empleados y horas</b> que vas a firmar. Revisa y confirma con el botón.'], img: 'autorizador-1/13-varias-confirmar', ancho: 'chico' },
        { nota: 'Cada solicitud se firma por separado. Si alguna ya la había respondido otra persona, esa se salta y el resultado te dice cuáles sí se autorizaron.' },
        { aviso: 'Antes de firmar muchas juntas, abre al menos las que tengan <b>2 rutas</b> o muchas horas: un error aquí se repite en todas. Para devolver una solicitud, ábrela y usa <b>Devolver</b>: la autorización múltiple solo autoriza.' },
      ],
    },
    // ───────────────────────── LO DE VEZ EN CUANDO ─────────────────────────
    {
      id: 'vencidas', titulo: 'Vencidas e historial de tu área',
      bloques: [
        { h: 'Vencidas' },
        { p: 'Una solicitud <b>vence</b> cuando pasa el día del tiempo extra sin terminar de autorizarse. Ya no se puede autorizar ni devolver «de la forma normal»; aquí es <b>solo consulta</b>.' },
        { pasos: [
          'Entra a la pestaña <b>Vencidas</b> (trae un contador).',
          'Cada renglón dice «No se autorizó antes de la fecha» y si era de nivel 1 o 2.',
          '<b>Ver</b> abre la solicitud, sin botones de firma.',
        ], img: 'autorizador-1/14-vencidas' },
        { pasos: ['El detalle trae un cuadro azul que lo explica: quien la pidió puede <b>duplicarla con otra fecha</b>, o un <b>Autorizador 2</b> puede autorizarla <b>fuera de tiempo</b>.'], img: 'autorizador-1/15-vencida-detalle' },
        { p: '<b>Qué haces tú.</b> Si de verdad se trabajó, avisa a Autorización 2 para que la autorice fuera de tiempo, con su motivo. Si no se trabajó, quien la pidió la duplica con otra fecha.' },
        { h: 'Historial de mi área' },
        { pasos: [
          'La pestaña <b>Historial de mi área</b>: lo que ya pasó por tu nivel (en autorización de nivel 2, autorizadas, devueltas y canceladas). Solo lectura.',
          '<b>Ver</b> abre el detalle con su historial completo.',
        ], img: 'autorizador-1/16-historial' },
        { nota: 'El historial sirve para saber en qué paso va algo que ya firmaste, y a quién avisarle si se atoró.' },
      ],
    },
    {
      id: 'mi-area', titulo: 'Mi área y el personal',
      bloques: [
        { h: 'Mi área (organigrama)' },
        { p: 'Muestra quién autoriza y quién captura en tu área. Sirve para comprobar que <b>tu gente puede capturar</b> y que tu área tiene Autorizador 1.' },
        { pasos: [
          '<b>Nivel 2 · Planta</b>: quién da la segunda firma.',
          'Tu tarjeta con <b>Autoriza nivel 1</b>.',
          '<b>Solicitantes</b>: quién puede capturar tiempo extra en tu área.',
        ], img: 'autorizador-1/17-mi-area' },
        { nota: 'Solo se muestran las asignaciones vigentes hoy. Las temporales dejan de aparecer solas al llegar su fecha final. Si falta alguien en tu área, o hay que dar un permiso, pide a Recursos Humanos o a Autorización 2: tú no das roles.' },
        { h: 'Lista del personal de mi área' },
        { p: 'Es la lista de las personas a quienes puedes pedirles tiempo extra. Se entra desde <b>Personal de mi área › Ver lista</b>, en tu Inicio. Es solo consulta.' },
        { pasos: [
          'Busca por nómina o nombre.',
          'La tabla trae nómina, nombre, puesto y área.',
        ], img: 'autorizador-1/18-lista-personal' },
        { nota: 'Si alguien no sale, es porque no está activo o no está marcado como elegible para tiempo extra en el padrón (los jefes y supervisores normalmente no lo están). Recursos Humanos lo corrige.' },
      ],
    },
    {
      id: 'capturar', titulo: 'Si tú también pides tiempo extra',
      bloques: [
        { p: 'Tú también puedes capturar tiempo extra de tu área. <b>Cómo se arma la solicitud es igual que en el manual del Solicitante</b> (fecha, motivos, empleados, horarios, transporte, comentario y envío); revísalo en <b>Ayuda y manuales</b>. Aquí solo lo que cambia para ti.' },
        { pasos: [
          'El aviso de arriba lo dice: <b>«Al enviarla pasa directo a Autorización 2 (eres su Aut. 1)»</b>.',
          'Solo puedes elegir empleados de tu área.',
        ], img: 'autorizador-1/19-solicitar' },
        { h: 'Qué cambia' },
        { lista: [
          '<b>Se salta tu propio nivel</b>: tú no te firmas. Queda en <b>En autorización (nivel 2)</b> y la firma Autorización 2.',
          'No aparece en tu bandeja de Por autorizar.',
          'Si Autorización 2 la devuelve, regresa a ti; al corregirla y reenviarla va directo a Autorización 2 otra vez.',
        ] },
        { pasos: [
          '<b>Solicitar tiempo extra</b>.',
          '<b>Mis solicitudes</b> agrupa lo tuyo por pestañas (Borradores, En autorización, Devueltas, Autorizadas, Vencidas y Canceladas). Una <b>devuelta</b> se corrige y se reenvía; una <b>vencida</b> se duplica con otra fecha.',
        ], img: 'autorizador-1/20-mis-solicitudes' },
      ],
    },
    // ───────────────────────── CASOS ESPECIALES ─────────────────────────
    {
      id: 'casos', titulo: 'Casos especiales',
      bloques: [
        { h: 'Autoricé por error' },
        { p: 'Una firma <b>no se deshace</b>. Avisa a Recursos Humanos o a Autorización 2, <b>antes de que se confirme</b> al proveedor: Recursos Humanos puede devolver la solicitud para corregirla o cancelarla con un motivo. Si ya se confirmó, Recursos Humanos la cancela y avisa al proveedor por su cuenta: <b>la aplicación no avisa al proveedor</b>.' },
        { h: 'Una solicitud de mi gente no aparece en mi bandeja' },
        { lista: [
          'Solo ves lo de <b>tu área</b> y lo que ya fue <b>enviado</b>. Un borrador solo lo ve quien lo está armando.',
          'Si ya la firmaste, está en el <b>Historial de mi área</b>.',
          'Si pasó la fecha, está en <b>Vencidas</b>.',
          'Si la capturaste tú, no la firmas: va directo a Autorización 2.',
          'Si el solicitante es de otra área, no es tuya. Pide a Recursos Humanos que revise sus áreas asignadas.',
        ] },
        { h: 'Se venció una solicitud sin que yo la viera' },
        { p: 'Mira en <b>Vencidas</b>. Si el tiempo extra sí se trabajó, avisa a Autorización 2 para que la autorice fuera de tiempo. Para evitarlo, revisa la bandeja todos los días y fíjate en <b>Vence hoy</b>.' },
        { h: 'Voy a faltar (vacaciones o incapacidad)' },
        { p: 'Tu permiso tiene fechas. Pide a Recursos Humanos o a Autorización 2 que den el rol de Autorizador 1 a tu suplente en tu área, con las fechas de tu ausencia. Mientras tanto, nadie firma el nivel 1 de tu área y sus solicitudes no avanzan.' },
        { h: 'Dos personas respondieron lo mismo' },
        { p: 'El portal no deja firmar dos veces. Al que llega segundo le avisa «Alguien más ya respondió esta solicitud» y no se cambia nada.' },
        { h: 'No encuentro a un empleado para capturar' },
        { p: 'Solo salen los elegibles de tu área. Revisa la <b>lista del personal de mi área</b>. Si falta, Recursos Humanos lo marca como elegible en el padrón.' },
        { h: 'El proveedor no recibió a alguien' },
        { p: 'La aplicación <b>no avisa al proveedor por sí sola</b>; quien manda el Formato de rutas es Recursos Humanos. Si te reportan que alguien no fue recogido, pide a Recursos Humanos que revise que la solicitud estaba <b>confirmada</b>, que la persona sale en el <b>Formato de rutas del día correcto</b> (ojo con los horarios que cruzan la medianoche: el regreso va al día siguiente) y que tiene ruta, comunidad, punto de reunión y teléfono. Tú puedes comprobar en el <b>Historial de mi área › Ver</b> que la persona estaba en la solicitud y con transporte.' },
      ],
    },
    {
      id: 'preguntas', titulo: 'Preguntas frecuentes',
      bloques: [
        { preguntas: [
          ['¿Puedo firmar lo que yo capturé?', 'No. Lo que capturas va directo a Autorización 2.'],
          ['¿Puedo devolver una solicitud que ya autoricé?', 'No desde tu bandeja. Pide a Recursos Humanos que la devuelva o la cancele.'],
          ['¿Puedo ver o firmar lo de otra área?', 'No. Solo lo de las áreas donde eres Autorizador 1.'],
          ['¿Qué pasa si no firmo a tiempo?', 'Queda <b>Vencida</b>. Ya no la firmas; solo Autorización 2 puede autorizarla fuera de tiempo.'],
          ['¿Cómo sé si Autorización 2 ya firmó?', 'En el Historial de mi área, el estatus pasa de «En autorización (nivel 2)» a «Autorizada». El portal no avisa solo.'],
          ['¿Por qué tiene «2 rutas» o más?', 'Porque hay empleados en rutas distintas. Cada ruta extra cuesta; la solicitud debe traer una justificación.'],
          ['Olvidé mi contraseña.', 'Solo se restablece en persona con Recursos Humanos, un Autorizador 2 o Sistemas y tu identificación. Nunca la des por teléfono ni por mensaje.'],
          ['Se cerró mi sesión.', 'Por seguridad se cierra a los 30 minutos sin usar. Entra de nuevo; no se pierde lo ya firmado.'],
        ] },
      ],
    },
    {
      id: 'estatus', titulo: 'Qué significa cada estatus',
      bloques: [
        { p: 'Así se ve cada estatus y qué haces tú con él:' },
        { tabla: 'estatus', rol: 'autorizador-1' },
      ],
    },
  ],
};
