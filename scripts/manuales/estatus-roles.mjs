// «Qué significa cada estatus» visto desde cada rol: lo que cambia es la columna «Qué haces tú» (y a veces el significado). Las etiquetas son las de la aplicación.
export const ESTATUS_ROL = {
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
