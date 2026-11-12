# Margen de expresiones de las reglas de tiempo extra

Cada petición a Firestore puede evaluar hasta **1000 expresiones** de reglas; al pasarse, la regla niega. Aquí, cuántas **sobran** en cada camino pesado (mientras más, mejor). Medido con `firestore.rules`; se vuelve a generar con `npm run test:margen` y esa prueba falla si algún camino baja de 150.

| Camino | Expresiones libres | Usadas |
|---|---:|---:|
| Crear el borrador | 210 | 790 |
| Guardar el borrador (150 empleados, 5 motivos) | 365 | 635 |
| Enviar (Diana: 4 empleados, 2 motivos, 2 rutas) | 445 | 555 |
| Enviar, 150 empleados y 5 motivos | 445 | 555 |
| Enviar, el contador del folio (misma transacción) | 835 | 165 |
| Enviar, la entrada del historial (misma transacción) | 755 | 245 |
| Enviar como Aut. 1 del área (directo a Aut. 2) | 460 | 540 |
| Enviar como Aut. 2 (queda autorizada) | 320 | 680 |
| Enviar como admin (queda autorizada) | 395 | 605 |
| Reenviar tras devolución | 435 | 565 |
| Autorizar nivel 1 | 700 | 300 |
| Autorizar nivel 2 | 580 | 420 |
| Autorización múltiple (cada una en su transacción) | 580 | 420 |
| Autorizar fuera de tiempo | 375 | 625 |
