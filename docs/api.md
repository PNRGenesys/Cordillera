# API

Base local: en desarrollo (`npm run dev`) la API responde directo en `http://localhost:3000`. En el grupo de contenedores todo el trafico pasa por el middleware: el navegador la alcanza en el mismo origen de la tienda (`http://localhost:8080/api`) y tambien directo en el middleware (`http://localhost:8000/api`). En el archivo base la API no publica puerto; `docker-compose.override.yml`, que Compose aplica en desarrollo, la reexpone en `http://localhost:3000` para depurarla sin pasar por el middleware. Todas las solicitudes y respuestas usan JSON. Las validaciones de cada ruta viven en `apps/api/src/schemas.ts` (Zod).

Hay documentación OpenAPI interactiva (Swagger UI) en `/api/docs` (en desarrollo `http://localhost:3000/api/docs`; en el grupo de contenedores `http://localhost:8000/api/docs`, a través del middleware), con la especificación en `/api/docs/json`. Se genera a partir de los mismos esquemas Zod (ver `apps/api/src/openapi.ts`), asi que la doc no se desincroniza de la validación. Está habilitada fuera de producción; en un contenedor con `NODE_ENV=production` se activa con `ENABLE_API_DOCS=true`. Nota: los esquemas Zod se adjuntan solo para documentar; la validación real sigue en el `.parse()` de cada ruta.

## Publica

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/health` | Confirma que la API responde. |
| POST | `/api/auth/register` | Crea una cuenta de cliente y abre sesión. |
| POST | `/api/auth/login` | Inicia sesión con correo y contraseña. |
| POST | `/api/auth/logout` | Cierra la sesión activa. |
| GET | `/api/auth/me` | Devuelve la cuenta de la sesión, o vacío si es un invitado. |
| PATCH | `/api/auth/me` | Actualiza el perfil: nombre, correo, teléfono, foto y dirección de envío. |
| GET | `/api/collections` | Lista colecciones (para navegación editorial e inicio). |
| GET | `/api/categories` | Lista categorías con su guía de tallas asociada. |
| GET | `/api/products` | Catálogo paginado con filtros de colección, categoría, color, talla y disponibilidad. |
| GET | `/api/products/:slug` | Detalle de un producto activo: variantes, imágenes y guía de tallas. |
| GET | `/api/cart/:sessionId` | Obtiene el carrito de una sesión. |
| POST | `/api/cart/items` | Agrega unidades al carrito de una sesión (valida stock). |
| PATCH | `/api/cart/items` | Actualiza la cantidad de una línea (`quantity: 0` la elimina). |
| DELETE | `/api/cart/items` | Elimina una línea del carrito (`sessionId` y `variantId` como query params). |
| POST | `/api/checkout` | Crea un pedido `pending_payment` y reserva existencias de forma atómica. |
| POST | `/api/restock-requests` | Registra un correo para avisar cuando una variante vuelva a tener stock. |

### Cuentas de cliente

La sesión viaja en la cookie `cordillera_session` (`httpOnly`, `sameSite=lax`). El atributo `secure` sale de `SESSION_COOKIE_SECURE`, que por defecto sigue a produccion: debe reflejar si se sirve por HTTPS, no si es un build de produccion, porque una cookie `Secure` sobre HTTP plano nunca vuelve al servidor. La API guarda solo el hash SHA-256 del token y la contraseña con `scrypt`. Su duración sale de `SESSION_TTL_DAYS`.

```
POST /api/auth/register  { "email": "...", "password": "...", "firstName": "...", "lastName": "...", "phone": "..." }  -> 201 AccountProfile
POST /api/auth/login     { "email": "...", "password": "..." }                                                        -> 200 AccountProfile
POST /api/auth/logout                                                                                                 -> 204
GET  /api/auth/me                                                                                                     -> 200 { "account": AccountProfile | ausente }
PATCH /api/auth/me       { "email"?, "firstName"?, "lastName"?, "phone"?, "avatar"?, "shippingAddress"? }              -> 200 AccountProfile
```

`AccountProfile = { id, email, firstName, lastName, phone, role, avatar, shippingAddress, acceptingRequests }`, con `role` igual a `customer`, `admin` o `artist`. `acceptingRequests` solo importa para `role: artist` (ver [Artista](#artista)). La contraseña nunca sale en una respuesta.

La dirección omite `country`: la API lo completa con `STORE_COUNTRY` (`CO`), porque la tienda envía a un solo país. Enviarlo explícitamente sigue siendo válido.

En `PATCH` todos los campos son opcionales y solo se cambia lo que llega. Un `phone` vacío borra el teléfono en vez de fallar por longitud mínima. `avatar` es una imagen PNG, JPEG o WebP en forma de data URL, limitada por `AVATAR_MAX_CHARACTERS`; `shippingAddress` usa la misma forma que el checkout. Enviar `null` en cualquiera de los dos los borra. Cambiar el correo a uno que ya tiene cuenta responde `409 email_taken`.

Registrar un correo que ya usó un invitado en el checkout reclama ese cliente en vez de duplicarlo. Si el correo ya tiene contraseña, responde `409 email_taken`. Un correo desconocido y una contraseña incorrecta devuelven el mismo `401 invalid_credentials`, para no revelar qué cuentas existen.

### Idioma del contenido

Las rutas de catálogo y carrito aceptan `lang=es|en` (por defecto `es`). Las columnas guardan la copia en inglés y `translations` los reemplazos por idioma; si falta la traducción de un campo, responde con la copia base en vez de dejarlo vacío. Un idioma no soportado devuelve `400 invalid_request`.

Los colores y las tallas viajan como `{ value, label }`: `value` es el texto almacenado, que es con el que se filtra, y `label` el texto traducido que se muestra.

Los ejemplos de abajo muestran la copia base (`lang=en`); con `lang=es` los mismos campos llegan traducidos.

### Catálogo paginado

```
GET /api/products?lang=&collection=&category=&color=&size=&availability=all|in_stock&page=&pageSize=
```

```json
{
  "page": 1,
  "pageSize": 24,
  "total": 11,
  "items": [
    {
      "id": "uuid", "slug": "furry-casual-tee", "name": "Furry Casual Tee",
      "release": "available", "availableAt": null,
      "categorySlug": "t-shirts", "collectionSlug": "wildspirit", "collectionName": "Wildspirit",
      "minPriceCents": 18900000, "maxPriceCents": 18900000,
      "colors": [{ "value": "Black Purple", "label": "Negro y morado" }], "sizes": [{ "value": "S", "label": "S" }],
      "availableUnits": 90, "imageUrl": "/products/furry-casual-tee.jpg"
    }
  ]
}
```

### Detalle de producto

```json
{
  "id": "uuid", "name": "Furry Casual Tee", "slug": "furry-casual-tee",
  "description": "...", "composition": "100% cotton, 220-240 gsm, synthetic fur details",
  "release": "available", "availableAt": null,
  "categoryName": "T-shirts", "categorySlug": "t-shirts",
  "collectionName": "Wildspirit", "collectionSlug": "wildspirit",
  "sizeGuideName": "Tops", "sizeGuideUnit": "cm",
  "sizeGuideColumns": ["Size", "Length", "Width"],
  "sizeGuideRows": [{ "Size": "M", "Length": "72", "Width": "58" }],
  "images": [{ "url": "/products/furry-casual-tee.jpg", "alt": "Furry Casual Tee", "position": 0 }],
  "variants": [
    { "id": "uuid", "sku": "FURR-BLAC-M", "name": "Furry Casual Tee Black Purple M", "color": "Black Purple", "size": "M",
      "priceCents": 18900000, "compareAtPriceCents": null, "availableUnits": 6 }
  ]
}
```

### Carrito

```
GET /api/cart/:sessionId?lang=
```

```json
{
  "sessionId": "uuid", "currency": "COP", "itemCount": 2, "subtotalCents": 37800000,
  "items": [
    { "variantId": "uuid", "sku": "FURR-BLAC-M", "productName": "Furry Casual Tee", "productSlug": "furry-casual-tee",
      "variantName": "Furry Casual Tee Black Purple M", "color": "Black Purple", "size": "M",
      "unitPriceCents": 18900000, "quantity": 2, "availableUnits": 6, "imageUrl": "/products/furry-casual-tee.jpg" }
  ]
}
```

```
POST /api/cart/items?lang=    { "sessionId": "uuid", "variantId": "uuid", "quantity": 1 }   -> 201 CartView
PATCH /api/cart/items?lang=   { "sessionId": "uuid", "variantId": "uuid", "quantity": 2 }   -> CartView
DELETE /api/cart/items?sessionId=uuid&variantId=uuid&lang=                                   -> CartView
```

### Checkout

```json
{
  "sessionId": "uuid",
  "email": "cliente@ejemplo.com",
  "firstName": "Nombre",
  "lastName": "Apellido",
  "phone": "3000000000",
  "shippingAddress": {
    "line1": "Calle 1 # 2-3",
    "line2": "Apto 4",
    "city": "Bogota",
    "region": "Bogota D.C.",
    "postalCode": "110111",
    "country": "CO"
  }
}
```

Respuesta `201`:

```json
{ "number": "ORD-001000", "status": "pending_payment", "totalCents": 37800000, "currency": "COP", "reservationExpiresInMinutes": 20 }
```

### Reposición

```
POST /api/restock-requests   { "variantId": "uuid", "email": "cliente@ejemplo.com" }   -> 202 { "status": "registered" }
```

Con sesión iniciada el correo sobra: se toma el de la cuenta. Sin sesión y sin correo responde `400 email_required`.

## Diseño personalizado

Rutas de sesión (`requireSessionCustomer`, igual que `PATCH /api/auth/me`): sin cookie de sesión responden `401 unauthenticated`.

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/custom-design/artists` | Lista artistas disponibles con su cola (`pendingCount`) y el recargo vigente. |
| POST | `/api/custom-design/requests` | Crea la solicitud: paga de una vez y reserva existencias, igual que el checkout normal. |
| GET | `/api/custom-design/requests/:id` | Detalle de una solicitud propia. |
| POST | `/api/custom-design/requests/:id/approve` | El cliente aprueba el diseño entregado. |
| POST | `/api/custom-design/requests/:id/request-changes` | El cliente pide cambios con un comentario; la solicitud vuelve a la cola del artista. |

```
GET  /api/custom-design/artists                                                                          -> 200 { surchargePercent, artists: [{ id, name, pendingCount }] }
POST /api/custom-design/requests  { baseVariantId, characterDescription?, referenceImage, artistId: uuid | "fastest", shippingAddress }  -> 201 { id, orderNumber, totalCents, currency }
```

`referenceImage` es una imagen en forma de data URL (mismo formato que `avatar`), limitada por `CUSTOM_DESIGN_IMAGE_MAX_CHARACTERS`. El precio es `priceCents * (1 + CUSTOM_DESIGN_SURCHARGE_PERCENT / 100)` (hoy 50%, placeholder). Fuera de las 9am-6pm hora Colombia responde `409 outside_business_hours`; un artista sin disponibilidad o un `artistId` que no existe responde `409 artist_unavailable`, y si no hay ningún artista disponible para `"fastest"`, `409 no_artists_available`.

## Artista

Toda ruta exige la cookie de sesión de una cuenta con `role = artist`. Sin sesión responde `401 unauthenticated`; con una cuenta que no es artista, `403 forbidden`. El rol lo otorga un administrador desde `/admin` (ver [Administracion](#administracion)).

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/artist/status` | Devuelve si el artista acepta pedidos nuevos. |
| PATCH | `/api/artist/status` | Cambia la disponibilidad (`{ acceptingRequests }`); no afecta la cola ya asignada. |
| GET | `/api/artist/requests` | Cola de solicitudes activas (`pending`, `changes_requested`, `delivered`), ordenada por fecha de solicitud. |
| PATCH | `/api/artist/requests/:id/estimate` | Guarda el estimado de días (`{ estimatedDays }`). |
| POST | `/api/artist/requests/:id/deliver` | Sube el diseño final (`{ finalDesignImage }`) y notifica al cliente. |

## Notificaciones

Rutas de sesión (cualquier rol).

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/notifications` | Notificaciones propias, mas recientes primero. |
| POST | `/api/notifications/:id/read` | Marca una notificación propia como leída. |

## Errores

Toda respuesta de error tiene la forma `{ code, message, details }`. Códigos actuales: `cart_not_found`, `cart_empty`, `cart_item_not_found`, `product_not_found`, `variant_not_found`, `collection_not_found`, `out_of_stock`, `invalid_adjustment`, `email_taken`, `invalid_credentials`, `unauthenticated`, `forbidden`, `order_not_found`, `invalid_status_change`, `email_required`, `outside_business_hours`, `artist_unavailable`, `no_artists_available`, `custom_design_request_not_found`, `customer_not_found`, `notification_not_found`, `invalid_request` (payload inválido según Zod), `internal_error`.

## Administracion

Toda ruta administrativa exige la cookie de sesión de una cuenta con `role = admin`. Sin sesión responde `401 unauthenticated`; con una cuenta normal, `403 forbidden`. El primer administrador se otorga con `npm.cmd run admin:grant --workspace=@cordillera/api -- <correo>`; a partir de ahí, un administrador puede dar el rol `admin` o `artist` a cualquier cuenta desde `/admin` (o `PATCH /api/admin/customers/:id/role`).

| Metodo | Ruta | Funcion |
| --- | --- | --- |
| GET | `/api/admin/products` | Lista todos los productos (incluidos borradores y archivados) con sus variantes, precios y existencias. |
| PATCH | `/api/admin/products/:id` | Cambia nombre, descripción, composición, estado, lanzamiento, categoría o colección. |
| PATCH | `/api/admin/variants/:id` | Cambia nombre, color, talla o precio de una variante. |
| POST | `/api/admin/products` | Crea un producto en borrador, sus variantes e inventario inicial. |
| POST | `/api/admin/products/:id/discount` | Aplica o retira un descuento sobre todas las variantes del producto. |
| POST | `/api/admin/inventory/adjustments` | Ajusta el stock de una variante y deja trazabilidad (`inventory_movements`). |
| GET | `/api/admin/orders` | Lista los pedidos con cliente, dirección, líneas y datos de envío. |
| PATCH | `/api/admin/orders/:id` | Cambia el estado del pedido y registra transportadora y número de guía. |
| GET | `/api/admin/customers` | Lista todas las cuentas con su rol. |
| PATCH | `/api/admin/customers/:id/role` | Cambia el rol de una cuenta (`customer`, `admin` o `artist`). |

Todas las actualizaciones son parciales y rechazan un cuerpo vacío (`400 invalid_request`).

El descuento se calcula siempre sobre el precio regular de la variante (`compareAtPriceCents` si ya hay descuento, `priceCents` si no), así que volver a aplicarlo no se acumula sobre el anterior; `discountPercent: 0` restaura el precio regular y borra el descuento.

Cambiar un pedido a `paid` convierte sus reservas en venta (descuenta `on_hand` y libera `reserved`); pasarlo a `cancelled` o `refunded` devuelve las unidades. Un pedido cancelado o reembolsado ya no puede cambiar de estado (`409 invalid_status_change`).

La interfaz vive en `/admin` y solo se muestra a las cuentas con rol de administrador.
