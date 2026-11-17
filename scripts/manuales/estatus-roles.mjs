// «Qué significa cada estatus» visto desde cada rol: lo que cambia es la columna «Qué haces tú» (y a veces el significado). Las etiquetas son las de la aplicación.
export const ESTATUS_ROL = {
  nominas: {
    'Borrador': { significa: 'Alguien la guardó y todavía no la envía. Solo la ve quien la armó.', haz: 'Nada. No la ves.' },
    'En autorización (nivel 1)': { significa: 'Espera la firma del jefe de su área.', haz: 'Nada. <b>No entra</b> al formato de nómina. La ves en <b>Tiempo extra</b>.' },
    'En autorización (nivel 2)': { significa: 'Ya firmó el jefe de área; espera la segunda firma.', haz: 'Nada. <b>No entra</b> al formato mientras Autorización 2 no la autorice.' },
    'Devuelta': { significa: 'Alguien pidió que se corrija.', haz: 'Nada. No entra al formato hasta que se corrija y se autorice.' },
    'Autorizada': { significa: 'Tiene las firmas necesarias.', haz: '<b>Entra al formato</b> de su semana y área. Puedes confirmarla en <b>Por enviar al proveedor</b>.' },
    'Confirmada por RH': { significa: 'Recursos Humanos (o tú) la confirmó y se creó su transporte.', haz: '<b>Entra al formato</b> igual que una autorizada.' },
    'Vencida': { significa: 'Pasó el día del tiempo extra sin terminar de autorizarse.', haz: '<b>No cuenta</b> en el formato. Si alguien sí trabajó, agrégalo a mano en <b>Revisar</b>, con su motivo.' },
    'Cancelada': { significa: 'Se canceló (con un motivo).', haz: '<b>No cuenta</b> en el formato.' },
  },
  rh: {
    'Borrador': { significa: 'Alguien la guardó y todavía no la envía. Solo la ve quien la armó.', haz: 'Nada. No la ves ni la puedes tocar hasta que la envíe.' },
    'En autorización (nivel 1)': { significa: 'Espera la firma del jefe de su área (Autorización 1).', haz: 'Nada. La ves en <b>Todas las solicitudes</b>; ahí también puedes cancelarla con un motivo.' },
    'En autorización (nivel 2)': { significa: 'Ya firmó el jefe de área. Espera la segunda firma.', haz: 'Puedes firmarla <b>«como RH»</b> en <b>Por autorizar</b> (menos lo que tú creaste) o esperar a Autorización 2.' },
    'Devuelta': { significa: 'Alguien pidió que se corrija; regresó a quien la capturó.', haz: 'Nada. Al reenviarla vuelve a empezar desde el nivel 1.' },
    'Autorizada': { significa: 'Tiene las firmas necesarias. Espera tu confirmación.', haz: 'Está en <b>Por enviar al proveedor</b>: <b>Confirmar</b>, <b>Devolver</b>, <b>Cancelar</b> o, si su fecha ya pasó, <b>Cerrar sin transporte</b>.' },
    'Confirmada por RH': { significa: 'La confirmaste: se creó su solicitud de transporte (si había empleados con transporte).', haz: 'Baja el <b>Formato de rutas</b> del día y mándalo al proveedor. Puedes cancelarla con un motivo desde <b>Todas las solicitudes</b>.' },
    'Vencida': { significa: 'Pasó el día del tiempo extra sin terminar de autorizarse.', haz: 'Nada. Solo Autorización 2 puede autorizarla fuera de tiempo.' },
    'Cancelada': { significa: 'Se canceló (con un motivo). Ya no se puede usar.', haz: 'Nada.' },
  },
  'autorizador-2': {
    'Borrador': { significa: 'Alguien la guardó y todavía no la envía. Solo la ve quien la armó (tú ves solo tus propios borradores).', haz: 'Si es tuyo: <b>Continuar</b> para enviarla. Si es de otra persona, no la ves ni la puedes firmar.' },
    'En autorización (nivel 1)': { significa: 'Espera la firma del jefe de su área (Autorización 1).', haz: 'Nada. Solo la ves en <b>Todas las solicitudes</b>. Si ya venció, pasa a <b>Vencidas</b> y tú puedes autorizarla fuera de tiempo.' },
    'En autorización (nivel 2)': { significa: 'Ya la firmó el jefe de área. Espera tu firma.', haz: 'Está en <b>Por autorizar</b>: <b>Autorizar</b> o <b>Devolver</b>.' },
    'Devuelta': { significa: 'Alguien pidió que se corrija; regresó a quien la capturó.', haz: 'Nada. Avisa a quien la capturó. Al reenviarla vuelve a empezar desde el nivel 1.' },
    'Autorizada': { significa: 'Tiene las firmas necesarias. Recursos Humanos la confirmará y pedirá el transporte.', haz: 'Nada. Si fue un error, pide a Recursos Humanos que la devuelva o la cancele antes de confirmarla.' },
    'Confirmada por RH': { significa: 'Recursos Humanos ya la confirmó y generó su solicitud de transporte.', haz: 'Nada.' },
    'Vencida': { significa: 'Pasó el día del tiempo extra sin terminar de autorizarse.', haz: 'En <b>Vencidas</b>: <b>Autorizar fuera de tiempo</b> con un motivo, si de verdad se trabajó. Las borradores y devueltas vencidas no: se duplican con otra fecha.' },
    'Cancelada': { significa: 'Se canceló (con un motivo). Ya no se puede usar.', haz: 'Nada.' },
  },
};
