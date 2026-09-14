# Registro de cambios

Este archivo registra los cambios incluidos en cada commit solicitado. Las entradas se agregan antes de crear el commit.

## Alta de productos y colecciones desde el panel, y miniaturas que no se veian

- `/admin` gana el formulario "Nuevo producto", que faltaba: `POST /api/admin/products` existia desde el principio pero no habia pantalla, asi que las secciones vacias no se podian llenar sin tocar la API. Pide nombre, slug, descripcion, composicion, categoria, coleccion, lanzamiento, imagen y una o mas variantes con SKU, color, talla, precio en pesos y stock inicial. El slug se deriva del nombre (sin tildes, un guion por separador) hasta que el administrador escribe el suyo, y cada variante toma su nombre del producto mas lo que la distingue.
- El producto se crea como borrador, igual que antes por API, asi que no aparece en la tienda hasta que alguien lo pasa a activo desde su ficha.
- El formulario abre con un boton "¿Como creo un producto?" que despliega el paso a paso para quien nunca ha cargado uno: que es el slug, que decide la categoria, por que la foto va vertical, cuando hace falta mas de una variante, como se escribe el precio y que hay que pasarlo a activo para publicarlo, mas los dos errores mas comunes (slug o SKU repetido, y una foto que el navegador no puede leer).
- El panel tambien crea colecciones (`POST /api/admin/collections`, formulario "Nueva coleccion" junto al de productos): nombre, slug, frase corta, descripcion, portada y si se destaca en el inicio. Se guarda con la fecha del momento, porque el listado ordena por destacada y luego por fecha. Al crearla aparece de inmediato en el desplegable de coleccion del formulario de producto, sin recargar, porque las dos vistas comparten la misma etiqueta de cache.
- La imagen viaja como data URL y se guarda en la base, como ya se hace con la foto de perfil y con las del diseno personalizado: el navegador no puede escribir en el disco del contenedor y la tienda todavia no tiene almacenamiento de archivos. El navegador la reduce a 1200px antes de enviarla y `CATALOG_IMAGE_MAX_CHARACTERS` limita el texto en la API. Los cuatro esquemas de imagen (avatar, diseno, producto y portada de coleccion) pasan a compartir un solo validador, que solo cambia de tope.
- `toThumbUrl` no le inventa un `-thumb` a una imagen guardada en la base, y el `srcSet` de dos tamanos solo se emite cuando existe el archivo pequeno; antes las tres vistas repetian esa cadena.
- Bug: al abrir el panel de administracion no se veian las imagenes. Los productos de seeds antiguos apuntan a `/placeholders/*.svg`, archivos que nunca se publicaron, asi que cada ficha mostraba el icono de imagen rota. Ahora una imagen que no carga, o un producto sin imagen, muestran un recuadro neutro; de paso eso arregla que un producto sin foto dejaba el formulario aplastado en los 84px reservados para la miniatura.

## Termo Kemono en el catalogo y la ficha de linea en el Hero

- Llegaron dos fichas de diseno nuevas. La del termo Kemono es la ficha de un producto, asi que entra al catalogo: termo de acero inoxidable de 750 ml, cuatro colores (negro, blanco hueso, azul noche y verde olivo), en accesorios dentro de Wildspirit. Su imagen sale recortada de esa misma ficha, centrada sobre lienzo vertical 4:5 y servida en 1200px y 480px como el resto.
- La otra es la ficha de la linea completa: una sola pieza de presentacion, no articulos sueltos. Abre la rotacion del Hero y nada mas; no se convierte en productos.
- El Hero acepta ahora dos tipos de diapositiva. Las fotos de producto siguen llenando el panel (`cover`) y se amplian y desplazan como antes; una pieza que hay que leer entera, como la ficha, se muestra completa (`contain`) y crece hacia su tamano real (0.95 a 1) en vez de ampliarse por encima de el, que recortaria justo lo que esta ahi para mostrar, y no se desplaza, porque de la forma del panel depende hacia donde habria sitio. El zoom paso a variables CSS para que las dos compartan la misma animacion.
- Las categorias pasan a seguir las secciones de la ficha, en su mismo orden: Camisetas, Sudaderas, Abrigos, Pantalones, Accesorios, Collares y Otros. Las que ya tenian productos se quedan como estaban; las que faltaban ("Sudaderas", "Collares" y "Otros") se abren vacias a proposito, para que un administrador les cargue lo que va dentro. Los busos que hoy existen siguen en "Abrigos": el seed no mueve productos ya creados.
- Las fichas originales quedan versionadas en `apps/web/src/assets/sheets/`, igual que el banner de marca, como fuente para volver a recortar.
- El precio del termo no esta en la ficha: es un marcador en el rango del resto del catalogo, anotado en `docs/pending-work.md`.
- Bug visual en los filtros de `/shop`: al activar uno, su marcador `(1)` caia a un renglon propio y empujaba ese desplegable por debajo de los otros tres, desalineando la fila. Cada etiqueta es un contenedor de filtro (`Field`) en columna y cada elemento de adentro es un renglon suyo, asi que el marcador se agrupa ahora con el texto en un solo elemento y queda a su lado: "CATEGORIA (1)".

## Pie de pagina fijo abajo y correcciones del middleware

- El pie de pagina quedaba a mitad de pantalla en cualquier ruta mas corta que la ventana (bolsa vacia, cuenta, notificaciones, 404): hasta 370px de fondo vacio debajo. `Layout` era un bloque con `min-height: 100vh` y nada que ocupara el espacio sobrante. Ahora es una columna flexible y el `Outlet` va dentro de un `main` que crece, lo que ademas le da a la pagina el punto de referencia `main` que le faltaba.
- Seguridad: el middleware compartia un solo cliente `httpx` entre todas las visitas, y su tarro de cookies guardaba el `Set-Cookie` de sesion que devolvia la API y lo reenviaba en la siguiente peticion de cualquier otra persona. Bastaba con que un administrador iniciara sesion para que un visitante sin cookie recibiera su cuenta en `GET /api/auth/me`. El cliente se construye ahora en un solo lugar (`build_api_client`) con un tarro que no guarda nada; las cookies solo viajan en la peticion a la que pertenecen.
- La compresion de respuestas se perdia en el grupo de contenedores: `httpx` descomprime todo lo que recibe, asi que el JSON que Fastify enviaba comprimido llegaba al navegador en claro (5.970 bytes en vez de ~1.300 en `/api/products`), justo lo contrario de lo que busca `@fastify/compress` en redes moviles lentas. nginx comprime ahora en el borde y el middleware pide el cuerpo con `Accept-Encoding: identity` para no comprimir e inflar los mismos bytes.
- `docker compose` fallaba en un clon limpio porque el servicio `middleware` exigia `apps/middleware/.env`, que esta en `.gitignore` (solo se versiona `.env.example`). Se marca como opcional: todos los valores tienen predeterminado y los dos que importan ya se definen en el propio compose.
- `db:up` (`docker compose up -d`) levanta el grupo completo, no solo PostgreSQL; la documentacion decia lo contrario y ya lo refleja.
- `apps/middleware` no tenia pruebas. Se agregan cuatro con pytest sobre la aplicacion FastAPI en proceso y la API simulada, que cubren el aislamiento de sesiones entre visitas y las cabeceras que se reenvian, mas `npm run test:middleware` para ejecutarlas dentro de Docker.
- Repaso completo de la documentacion, que se habia quedado atras respecto al middleware y al grupo de contenedores: el `README.md` separa el flujo de desarrollo (solo la base en Docker) del grupo completo y ya no dice que el middleware "solo expone `/health`"; `docs/api.md` documenta `POST /api/admin/products/:id/discount`, que faltaba, y corrige las bases de la API y el atributo `secure` de la cookie; `docs/development.md` deja de decir que Playwright no es dependencia del repositorio y que el rol solo se otorga por consola; `docs/pending-work.md` reescribe el punto de despliegue (el empaquetado ya existe, falta el servidor) y suma un punto para el middleware y MercadoPago.

## Sin commit - Override de desarrollo: API directa y Swagger en el grupo

- Se agrego `docker-compose.override.yml` (Compose lo aplica solo en local, no en un despliegue real). Republica el puerto de la API en `http://localhost:3000` para depurarla directo (Postman, curl) sin pasar por el middleware, y activa `ENABLE_API_DOCS=true` para que el Swagger UI (`/api/docs`) este disponible en el grupo pese a que la API corre con `NODE_ENV=production`.
- Motivo: el grupo de contenedores es el entorno de desarrollo, pero la API corria como produccion, asi que el Swagger que documentabamos quedaba apagado (404) y no habia forma comoda de listar/probar endpoints. En produccion (solo el archivo base) la API sigue sin puerto publico y el Swagger apagado.
- `docker compose up` (dev) aplica el override; `docker compose -f docker-compose.yml up` levanta el grupo cerrado como en produccion. Documentado en el README.

## Sin commit - La cookie de sesion respeta HTTP/HTTPS en vez del build

- El atributo `Secure` de la cookie de sesion dependia de `NODE_ENV === 'production'`. Como el grupo de contenedores corre la API en modo produccion pero se sirve por HTTP plano, la cookie salia `Secure` y el navegador no la reenviaba: el login parecia funcionar (201 al registrarse) pero `GET /api/auth/me` respondia sin cuenta. Se detecto al poner el middleware en el camino critico, pero el fallo era de la API, no del proxy (se reproducia tambien golpeando la API directamente).
- Se agrego `SESSION_COOKIE_SECURE` (en `config.ts`, leida por `session.ts`): controla el flag `Secure` de forma independiente al build. Por defecto sigue a produccion, asi que los entornos que no la definen no cambian de comportamiento (los tests con `NODE_ENV=test` siguen sin `Secure`). El `docker-compose.yml` la pone en `false` para el grupo local (HTTP); detras de HTTPS real debe ir en `true`.
- Verificado de punta a punta por el grupo (`web` -> nginx -> middleware -> API): registro y `GET /api/auth/me` ya devuelven la cuenta con la cookie de sesion, confirmando de paso que el proxy propaga bien `Cookie`/`Set-Cookie`. Los 61 tests de la API pasan.

## Sin commit - El middleware pasa a ser el unico punto de entrada de la API

- El navegador ya no habla directamente con la API: todo el trafico `/api/*` pasa por el middleware, que lo reenvia a Fastify. El nginx del `web` ahora hace proxy de `/api` al middleware (`http://middleware:8000`) en vez de a la API.
- El middleware suma un proxy inverso transparente (`apps/middleware/app/proxy.py`, con `httpx`): reenvia metodo, ruta, query, cabeceras, cookies (`Cookie`/`Set-Cookie`) y cuerpo en ambos sentidos, y responde `502` si la API no esta disponible. Usa un cliente `httpx` compartido creado en el `lifespan` de FastAPI. El frontend no cambia: sigue usando la ruta relativa `/api` y el mismo origen conserva la cookie de sesion sin CORS.
- La API deja de publicar su puerto en `docker-compose.yml` (`ports` -> `expose`): pasa a ser un servicio interno del grupo, solo alcanzable por el middleware. Se puede re-exponer temporalmente para depurar en aislamiento.
- El orden de arranque queda `database` -> `api` -> `middleware` -> `web` (el `web` ahora depende del middleware sano).
- La documentacion OpenAPI (Swagger) queda accesible a traves del middleware (`/api/docs`), util en desarrollo.
- Compromiso asumido: el middleware entra al camino critico, asi que agrega un salto de red y el sobrecosto de Python a cada peticion, y es un punto unico de fallo; a cambio, la API no queda expuesta y hay un unico borde donde colgar limitacion de tasa y autenticacion. Pendiente: esos controles de borde y la integracion de MercadoPago.

## Sin commit - Documentacion OpenAPI (Swagger) de la API

- La API Fastify expone documentacion interactiva (Swagger UI) en `/api/docs`, con la especificacion OpenAPI en `/api/docs/json`. Se agregaron `@fastify/swagger` y `@fastify/swagger-ui` (versiones fijadas).
- La doc se genera a partir de los mismos esquemas Zod que ya validan cada ruta (`apps/api/src/schemas.ts`), convertidos a JSON Schema en un helper nuevo (`apps/api/src/openapi.ts`) con `z.toJSONSchema`. No se duplica la definicion de esquemas.
- Decision de diseno para no cambiar comportamiento: los esquemas se adjuntan a las rutas solo para documentar. `buildApp` instala un `validatorCompiler` no-op, de modo que Fastify no revalida con esos esquemas y la validacion real sigue en el `.parse()` de cada ruta. Asi los codigos y mensajes de error (`invalid_request`, `email_taken`, etc.) y las pruebas existentes no cambian.
- Las ~27 rutas quedaron etiquetadas por area (auth, catalog, cart, checkout, admin, custom-design, artist, notifications, system) con un resumen cada una.
- Swagger UI se sirve fuera de produccion; en un contenedor con `NODE_ENV=production` se habilita con `ENABLE_API_DOCS=true`, para no exponer la superficie completa de la API por defecto.

## Sin commit - Grupo de contenedores completo y middleware de plano de control (FastAPI)

- `docker-compose.yml` pasa de levantar solo PostgreSQL a un grupo de cuatro servicios: `database`, `api`, `web` y `middleware`, encadenados por healthchecks para que arranquen en orden (`database` sana -> `api` sana -> `web` y `middleware`).
- Se agrego `apps/middleware`, un servicio FastAPI + uvicorn pensado como plano de control y punto de entrada de la futura pasarela MercadoPago. Hoy es andamiaje: expone `GET /health` (y `GET /` de identidad); no toca todavia catalogo, carrito ni la logica de negocio de la API Fastify, que se mantiene intacta. Dentro del grupo apunta a la API en `http://api:3000`.
- La configuracion del middleware se lee de variables de entorno (`app/config.py` con `pydantic-settings`): `PORT`, `API_BASE_URL` y los placeholders de MercadoPago (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`), sin valores hardcoded. Se agrego `.env.example` versionado y un `.env` local ignorado por git. Dependencias fijadas en `pyproject.toml` con cota superior explicita (FastAPI 0.115.x, uvicorn[standard] 0.34.x, pydantic-settings 2.7.x, httpx 0.28.x).
- `apps/api` se contenerizo (`apps/api/Dockerfile`, multi-stage `node:22-slim`, construido desde la raiz del repo por los workspaces de npm). Al arrancar aplica las migraciones (`docker-entrypoint.sh` -> `drizzle-kit migrate`) y luego sirve; el seed de datos de demo queda como paso manual (`docker compose run --rm api npm run db:seed`). Healthcheck contra `/api/health`. `DATABASE_URL` y `CORS_ORIGIN` se inyectan por el compose.
- `apps/web` se contenerizo (`apps/web/Dockerfile`, multi-stage): Vite compila el sitio y nginx lo sirve en el puerto 8080, haciendo de proxy inverso de `/api` al servicio `api`. Mantener el mismo origen evita tocar el frontend (usa la ruta relativa `/api/`) y conserva la cookie de sesion sin CORS.
- Los cuatro servicios exponen un endpoint de salud medible: `/api/health` (api), `/` (web) y `/health` (middleware); la base usa `pg_isready`.
- Se agregaron `.dockerignore` (raiz y por app) para no enviar `node_modules`, `dist`, `.git` ni `.env` al contexto de build.
- El flujo de desarrollo `npm run dev` (Vite y Fastify en el host, base en Docker) no cambia; el grupo de contenedores es una segunda forma de levantar todo.
- Pendiente fuera de este alcance: la integracion real de MercadoPago (creacion de preferencias, webhook con validacion de firma y endpoint interno en Fastify para marcar el pedido `paid`) y el rate limiting de borde.

## Correcciones al flujo de diseno personalizado

- `CustomDesignRequestPage` pedia `pageSize: 100` al catalogo, pero la API lo limita a `config.catalogMaxPageSize` (60) y respondia 400: el desplegable de prenda quedaba siempre vacio y no se podia enviar ninguna solicitud. Ahora usa una constante que refleja ese tope.
- Los 11 tests de `apps/api/src/routes/custom-design.test.ts` congelaban el reloj con `vi.useFakeTimers()` sin argumentos, lo que tambien congela los temporizadores que usa `postgres` para sus conexiones: 10 de ellos fallaban por timeout de 5s. Se limita el fake a `Date`.
- `apps/e2e/playwright.config.ts` esperaba a que la API estuviera lista consultando su raiz, que no tiene ruta y responde 404, asi que `npm run test:e2e` siempre agotaba el tiempo antes de correr. Ahora espera en `/api/health`.
- `apps/e2e` excluia los tipos de Node de su `tsconfig.json`, dejando cuatro errores de `process` en su propia configuracion, y no tenia script `typecheck`, por lo que `npm run typecheck` no lo revisaba. Se agregan ambos.

## Diseno de estilo personalizado (fursona), rol de artista y notificaciones

- Nuevo rol `artist`, asignable solo por un administrador. `/admin` gana una tercera seccion, "Clientes", que lista todas las cuentas con un selector de rol (`GET /api/admin/customers`, `PATCH /api/admin/customers/:id/role`); antes la unica forma de dar un rol era el script `npm run admin:grant`, que solo cubria `admin`.
- En cualquier ficha de producto, el boton "¿Quieres tu estilo personalizado?" lleva a `/custom-design/new`. Sin sesion, pasa primero por `/account?next=...` y vuelve ahi despues de iniciar sesion o registrarse. Fuera del horario de 9am a 6pm hora Colombia el boton queda deshabilitado con el aviso correspondiente; la API rechaza la solicitud igual si se salta ese control (`outside_business_hours`).
- La solicitud deja elegir categoria, prenda y variante del catalogo existente (no hay una prenda "en blanco" separada), describir la fursona, subir una foto de referencia (ajustada sin recorte, no como el avatar cuadrado) y escoger artista: uno especifico con su cola visible (cuantos pedidos tiene) o "artista mas rapido disponible", resuelto en el servidor. El pago se cobra de una vez: precio normal de la variante mas un recargo (hoy 50%, placeholder pendiente de definir con artistas y administracion), y crea una orden real con reserva de inventario igual que el checkout normal.
- El artista tiene su propio panel (`/artist`, visible solo con ese rol) con un interruptor de disponibilidad ("Disponible para pedidos" / "No disponible para pedidos", que solo afecta si le llegan pedidos nuevos, no a su cola actual) y su cola de pedidos activos ordenada por fecha de solicitud, con un estimado de dias por pedido y la subida del diseno final.
- Al entregar el diseno, el cliente recibe una notificacion (nueva seccion `/notifications`, con contador de no leidas en la cabecera) desde la que aprueba o pide cambios con un comentario; pedir cambios devuelve la solicitud a la cola del artista con ese comentario visible, y aprobar le avisa al artista.
- `apps/web/src/lib/avatar.ts` comparte ahora su carga de imagen (`URL.createObjectURL`) con el nuevo `lib/image-resize.ts`, que ademas agrega un ajuste sin recorte reutilizado por la foto de referencia y el diseno final.
- Base de datos: tablas nuevas `custom_design_requests` y `notifications`, columna `customers.accepting_requests`, e indices por artista y por cliente sobre `custom_design_requests` para las dos consultas de listado.

## Rendimiento en gama baja y correccion de layout mobile/tablet

- La imagen de producto ya navega directo a la ficha (antes solo el enlace "Ver" lo hacia), con resaltado al pasar el cursor o enfocar con teclado.
- `CartPage`: el stepper, el precio y "Quitar" ya no quedan apretados en la columna de 72px de la miniatura en mobile; ahora ocupan su propia fila.
- `FieldRow` (usado por checkout, cuenta y admin) colapsa a una columna bajo 480px en vez de forzar dos siempre.
- La guia de tallas desborda con scroll horizontal en vez de romper el ancho de la pagina cuando tiene muchas columnas.
- La paginacion numerada de `/shop` y el grupo de acciones de la cabecera ya envuelven (`flex-wrap`) en vez de desbordar en pantallas angostas o con nombres largos.
- `ProductGrid` suma un paso intermedio a 3 columnas entre 900 y 1100px, para que las tablets horizontales no queden con tarjetas de catalogo muy angostas.
- El titulo del hero del inicio tenia un tamano minimo de 60px que nunca bajaba; en un telefono de 320-375px quedaba desproporcionado. El minimo bajo a 44px.
- El hero rotativo del inicio y la imagen principal de la ficha de producto bajaban siempre la version de 1200px, aunque el telefono fuera angosto; ahora usan `srcSet`/`sizes` como ya hacia la tarjeta de producto.
- Subir foto de perfil codificaba el archivo completo a base64 con `FileReader` solo para decodificarlo de nuevo en una imagen; ahora usa `URL.createObjectURL`, que evita ese paso en fotos de varios MB tomadas con el celular.
- El build de `apps/web` separa el codigo de las librerias (React, Redux) en su propio chunk, para que el navegador lo reutilice entre despliegues en vez de descargarlo de nuevo con cada cambio de una sola ruta.
- La API agrega el paquete `@fastify/compress`: toda respuesta JSON viaja comprimida, lo que pesa mas en una red movil lenta que cualquier ajuste de consulta.
- `product_variants.product_id` y `product_images.product_id` no tenian indice pese a ser la columna mas consultada del catalogo (join de `/shop` y `/product/:slug`); se agrego el indice a ambas.
- `/api/products` hacia dos consultas casi identicas por pagina: la paginada y otra solo para el total. Ahora el total sale de la misma consulta con `count(*) over()`, salvo en la pagina vacia por desborde, donde se calcula aparte. De paso corrige un bug: el total ignoraba el filtro "en existencia" y contaba tambien los productos agotados.

## La tienda asume Colombia

- Los formularios dejan de pedir el pais. La API lo completa con `STORE_COUNTRY` (`CO` por defecto), asi que la direccion guardada lo sigue teniendo y volver a pedirlo es cambiar una variable.
- El departamento pasa de campo libre a lista con los 32 departamentos mas Bogota D.C. La API sigue aceptando cualquier texto, para no repetir la lista en los dos lados.
- El telefono muestra un movil colombiano como ejemplo, la ficha de la cuenta ya no repite el pais en cada direccion y las fechas de pedidos del panel se leen en `America/Bogota`.
- Se corrigio de paso un fallo del formulario de perfil: enviaba el telefono vacio y la API lo rechazaba por longitud minima. Ahora un campo vacio borra el dato.

## Perfil editable del cliente

- `/account` abre con los datos de la cuenta en modo lectura: foto, nombre, correo, telefono y direccion en una linea. El boton "Modificar perfil" lleva a `/account/edit`, que es donde vive el formulario; al guardar vuelve a la ficha, ya actualizada.
- El cliente edita nombre, apellido, correo, telefono, foto de perfil y direccion de envio, todo con `PATCH /api/auth/me`. Cambiar el correo a uno que ya tiene cuenta responde `409 email_taken`.
- La direccion queda guardada en `customers.shipping_address` y prellena el checkout; cada pedido sigue copiando la suya, asi que cambiarla despues no altera pedidos ya hechos.
- La foto se guarda en `customers.avatar` como data URL, porque el proyecto no tiene almacenamiento de archivos todavia. El navegador la recorta en cuadrado y la reduce a 256 px antes de enviarla, y la API limita el texto con `AVATAR_MAX_CHARACTERS`. Aparece en la cabecera junto al nombre.
- Un cliente con sesion ya no escribe su correo para entrar a la lista de reposicion: se toma el de su cuenta. Un invitado lo sigue escribiendo, y sin ninguno de los dos la API responde `400 email_required`.
- Pruebas nuevas: 8 de la API (perfil, correo repetido, borrado de foto y direccion, foto invalida, sesion, y la reposicion con y sin sesion) y 3 del frontend (recorte cuadrado de la foto).

## Hero rotativo y estetica alineada al logo

- El hero del inicio deja de mostrar el banner y rota las imagenes de los ultimos productos con un fundido cruzado lento: cinco segundos por imagen y dos de transicion, hechos solo con CSS (una animacion compartida y un `animation-delay` negativo por diapositiva), sin temporizadores en JavaScript. Se respeta `prefers-reduced-motion`, que deja el hero fijo en la primera imagen.
- Cada imagen ademas se acerca y se desplaza mientras esta en pantalla (de escala 1.04 a 1.09), y llega a su punto maximo justo cuando empieza a desvanecerse. Va en una segunda animacion que comparte duracion y retardo con el fundido, asi que ambas van en fase; la escala siempre supera al desplazamiento, de modo que el panel nunca deja ver un borde.
- La direccion del desplazamiento (lateral, arriba, abajo o diagonal) sale de un hash del propio archivo, asi que parece aleatoria pero es la misma en cada render y nada salta cuando React vuelve a dibujar el hero.
- La imagen que entra ya llega con parte del recorrido hecho, en vez de empezar quieta junto a la que sale. Antes se notaba el salto en cada transicion porque una de las dos imagenes estaba sin efecto.
- La tarjeta de producto pierde el enlace "Ver": desde que la imagen lleva al producto, repetia el mismo destino. Se elimino tambien su texto de las traducciones.
- El selector de variantes se divide en dos grupos con su etiqueta visible, "Color" y "Talla". Antes cada boton combinaba ambos ("Crema / S"), asi que el nombre del color se repetia en cada talla y no decia nada en las prendas de un solo color. Ahora los botones de talla muestran solo la talla, el grupo de color aparece unicamente cuando hay mas de uno, y cambiar de color conserva la talla elegida si esa combinacion existe.
- El selector de cantidad del detalle de producto ya no se estira a todo el ancho de la columna. Era `inline-flex`, pero como elemento de un contenedor flexible en columna lo estiraba el `align-items: stretch` por defecto; ahora fija su ancho al contenido. En el carrito conserva su alineacion vertical.
- Las imagenes llenan el panel con `object-fit: cover`, asi que ya no quedan bandas vacias a los lados.
- `lib/hero-slides.ts` arma la lista con un largo fijo, repitiendo lo disponible cuando hay menos imagenes que diapositivas, para que los fotogramas clave siempre encuentren contenido. Con pruebas.
- El banner pasa a ser solo la referencia de marca. De el salen la nueva paleta monocroma (negro #121212 sobre gris claro, grises neutros en lugar del beige y verde anteriores) y los titulos en tipografia de palo seco, en negrita y con el tracking cerrado del logotipo. La marca de la cabecera va en mayusculas, como en el banner.

## Sin commit - Finales de linea consistentes

- `.gitattributes` pasa de `* text=auto` a `* text=auto eol=lf`: el repositorio guarda LF y ahora tambien se descarga LF en Windows, en vez de convertirse a CRLF. Eso es lo que provocaba el aviso del editor.
- Se marcaron como binarias las imagenes (`png`, `jpg`, `jpeg`, `ico`, `webp`) para que la conversion nunca las toque.
- Se normalizaron a LF cuatro archivos que habian quedado con finales mezclados o CRLF: `apps/api/.env.example`, `apps/api/src/routes/cart.ts`, `apps/web/src/lib/format-price.test.ts` y `docs/api.md`.

## Sin commit - Carpeta de banners, nota de despliegue y repaso de la documentacion

- El banner de marca se movio a `apps/web/src/assets/Banners/`, su propia carpeta para las proximas piezas.
- `docs/pending-work.md` suma la seccion de despliegue con las opciones evaluadas y por que Kubernetes no hace falta en este tamano.
- Se reviso toda la documentacion contra el codigo actual:
  - `README.md`: arranque completo con copia de `.env` y seed, resumen real de funcionalidades, seccion de administracion, comandos y Node 22.12 como minimo.
  - `docs/README.md`: el indice incluye `pending-work.md`, que faltaba.
  - `docs/inventory.md`: se documentaron los ajustes manuales y el efecto de los cambios de estado de un pedido sobre el inventario; el flujo de pagos queda marcado como pendiente.
  - `docs/development.md`: el minimo de Node pasa a 22.12 y las pruebas visuales describen la instalacion real de Playwright en vez de los MCP de Codex.
  - `docs/api.md`: `lang` en los ejemplos de carrito, aclaracion de que los ejemplos usan la copia base y correccion del numero de pedido (`ORD-001000`).
  - `docs/architecture.md`: el objetivo menciona cuentas, administracion e idiomas, y la lista de estados incluye lanzamiento y rol de cliente.
- Al verificar los comandos documentados se encontro que `inventory:release-expired` nunca terminaba: la conexion a la base mantenia vivo el proceso. Ahora cierra al final, que es lo que necesita para poder programarse.

## Sin commit - La marca pasa de "Coordillera" a "Cordillera"

- Se corrigio el nombre en todo el repositorio: interfaz, documentacion, paquetes (`@cordillera/api`, `@cordillera/web`), `docker-compose.yml` y datos de prueba.
- La base de datos y su rol se renombraron en caliente (`ALTER DATABASE` / `ALTER ROLE`), sin perder clientes, productos ni pedidos.
- Cambian dos identificadores del navegador: la cookie de sesion (`cordillera_session`) y la clave del carrito en `localStorage`, asi que las sesiones y los carritos abiertos se reinician una vez.
- Pendiente fuera del alcance del repositorio: renombrar la carpeta local del proyecto y el repositorio en GitHub, de donde sale tambien el nombre del contenedor de PostgreSQL.

## Sin commit - Banner de marca e icono del sitio

- Se agrego `apps/web/public/favicon.ico` y su enlace en `index.html`.
- El hero del inicio pasa a mostrar el banner de marca (`apps/web/src/assets/brand-banner.jpg`), completo y sin recortar sobre un fondo oscuro (`--color-brand-canvas`).
- Se elimino `hero-collection.png`: el bundle baja de 2,09 MB a 106 KB de imagen.
- La cabecera se envuelve en pantallas angostas; con los enlaces de cuenta y administracion ya no cabia en una sola linea en movil.

## Sin commit - Traduccion del contenido del catalogo

- Se detecto con Playwright que el selector ES/EN solo cambiaba la interfaz: categorias, coleccion, nombres, descripciones, colores, tallas y guia de tallas venian de la base en un solo idioma.
- Se agrego una columna `translations` (jsonb) en `products`, `product_variants`, `categories`, `collections` y `size_guides`. Las columnas guardan la copia base y el jsonb los reemplazos por idioma, con respaldo a la copia base cuando falta una traduccion.
- Las rutas de catalogo y carrito aceptan `lang=es|en`; un idioma no soportado responde `400`. En el frontend `lang` es parte de los argumentos de cada consulta, de modo que cambiar de idioma invalida la cache y vuelve a pedir el contenido.
- Los colores y las tallas se devuelven como `{ value, label }`: se filtra por el valor almacenado y se muestra el traducido, asi que los filtros siguen funcionando en ambos idiomas.
- El seed carga la version en espanol de las 11 fichas y refresca solo las traducciones al reejecutarse, para no pisar lo que se edite desde el panel.
- Se tradujeron los ultimos textos fijos de la interfaz: etiquetas de accesibilidad de la navegacion y la bolsa, y el marcador del correo de reposicion.
- Pruebas nuevas: 4 de la API sobre idioma, respaldo de traduccion y filtrado por facetas.

## Sin commit - Rol de administrador y panel de gestion

- `customers.role` distingue `customer` de `admin`. Las rutas `/api/admin/*` pasaron del encabezado `x-admin-key` a la sesion del cliente: `401` sin sesion, `403` sin rol. Se elimino `ADMIN_API_KEY`.
- Script `admin:grant` para otorgar el rol por linea de comandos; no se puede ascender una cuenta desde la interfaz.
- Rutas nuevas: `GET /api/admin/products`, `PATCH /api/admin/products/:id`, `PATCH /api/admin/variants/:id`, `GET /api/admin/orders` y `PATCH /api/admin/orders/:id`. `GET /api/admin/inventory` se elimino porque el listado de productos ya trae existencias.
- Los pedidos guardan transportadora y numero de guia. Marcar `paid` convierte las reservas en venta y `cancelled`/`refunded` devuelve las unidades; un pedido cerrado ya no cambia de estado.
- Panel `/admin` con las fichas de producto plegables (nombre, estado, lanzamiento, precio por variante y ajustes de stock con nota) y la lista de pedidos con cliente, direccion, lineas, estado y envio.
- Se extrajeron a `components/primitives.ts` los campos de formulario que duplicaban checkout y cuenta, y a `lib/order-status.ts` las etiquetas de estado de pedido.
- Pruebas nuevas: 12 de la API (control de acceso, catalogo, ajustes de stock y pedidos) y 3 del frontend (conversion de precios).

## Sin commit - Inicio de sesion de clientes

- Se agregaron `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me`.
- Las contrasenas se guardan con `scrypt` de `node:crypto` (sin dependencias nuevas de cifrado) y la sesion viaja en una cookie `httpOnly`; la base solo guarda el hash del token (tabla `customer_sessions`).
- Registrarse con el correo de una compra de invitado reclama ese cliente en vez de duplicarlo. Correo desconocido y contrasena incorrecta comparten el mismo error, para no revelar que cuentas existen.
- Frontend: pagina `/account` con inicio de sesion y registro, enlace en la cabecera con el nombre del cliente y checkout prellenado con los datos de la cuenta (solo en los campos vacios).
- Pruebas nuevas: 10 de la API (registro, correo repetido, hash almacenado, credenciales, sesion y cierre de sesion) y 5 del frontend (mensajes de error y nombre visible).
- Se agrego `@fastify/cookie` y las variables `SESSION_TTL_DAYS` y `PASSWORD_MIN_LENGTH`.

## Sin commit - Catalogo de prueba con las fichas de diseno Kemono

- Se cargaron las 12 fichas de diseno generadas con IA como imagenes de prueba del sitio: 11 productos en `apps/web/public/products/` y el hero de coleccion en `apps/web/public/collections/`. Se convirtieron de PNG a JPEG (25 MB a 3,4 MB) y se eliminaron los SVG de `public/placeholders/`.
- El seed pasa a las colecciones `wildspirit` y `fauna-series` con 11 productos (uno agotado y uno en preventa), la categoria `pants` y la guia de tallas de tops con las medidas reales de la ficha.
- El seed archiva los productos que ya no estan en el conjunto de datos, en vez de dejarlos activos, y actualiza guias y colecciones existentes al volver a ejecutarse.
- Se corrigio el generador de SKU del seed: recortaba el slug a cuatro letras, de modo que `furry-cap` y `furry-casual-tee` chocaban y cinco productos quedaban sin variantes ni stock. Ahora usa las iniciales del slug y el seed falla si detecta un SKU repetido.
- El orden de variantes agrupa por color y, sin guia de tallas, usa el orden estandar (XS a XXXL) en vez del alfabetico.
- La cuadricula de categorias del inicio se ajusta al numero de categorias en lugar de fijar tres columnas.

## Sin commit - Correccion de Linaria (pagina en blanco) y revision visual con Playwright

- Se reemplazo `@linaria/vite@5` por `@wyw-in-js/vite`: el plugin antiguo no es compatible con Linaria 8, no transformaba nada y el tag `css` lanzaba en tiempo de ejecucion, dejando la pagina en blanco y el build sin CSS. El build ahora emite la hoja de estilos.
- Revision visual con Playwright (escritorio 1440 y movil 390) de inicio, catalogo, coleccion, detalle, agotado, carrito y checkout: sin errores de consola.
- El enlace de navegacion a la tienda ya no se oculta en movil; la marca escala con el ancho.
- Las variantes se ordenan segun la guia de tallas (S, M, L, XL) en vez de alfabeticamente (`lib/variant-order.ts`, con pruebas).
- El seed ya no asigna la guia de tallas de tops a los accesorios y ahora actualiza las categorias existentes.
- Las pruebas de la API se limitan a `src/` (antes tambien corrian sobre `dist/`).

## Sin commit - Verificacion end to end y pruebas de integracion de la API

- Se verifico el flujo completo contra la API en ejecucion: catalogo, filtros, detalle con guia de tallas, carrito, checkout (`ORD-001000`), reposicion y rutas administrativas.
- Se agregaron pruebas de integracion de la API (`apps/api/src/routes/checkout.test.ts`): reserva atomica de la ultima unidad, rechazo `out_of_stock` del pedido competidor, carrito conservado tras el rechazo, `cart_not_found` y `cart_empty`.
- Se agrego el script `test` en la raiz y en `@cordillera/api`; el logger de Fastify se silencia bajo `NODE_ENV=test`.
- Se corrigio la fuga de DOM entre pruebas del frontend (`cleanup` de Testing Library en `test-setup.ts`), que hacia fallar la prueba de ultima existencia.
- Detalle de producto: la cantidad vuelve a 1 al cambiar de variante y se muestra el error cuando la API rechaza el agregado.
- Carrito: se muestran los errores de actualizar y quitar lineas.
- Catalogo por coleccion: el titulo usa el nombre real de la coleccion en vez del slug.
- Se movio el color de error a la variable `--color-danger` y se traslado al ingles el mensaje de `DATABASE_URL` faltante.

## Sin commit - Frontend alineado al contrato de API, router y traduccion ES/EN

- Se reescribio `store/catalog-api.ts` contra el contrato real de la API (catalogo paginado, carrito, checkout, reposicion).
- Se agrego `react-router-dom` con paginas de inicio, catalogo con filtros y paginacion, detalle de producto, carrito y checkout sin pago.
- Se extrajeron componentes compartidos con Linaria (`Layout`, `ProductCard`, `StateMessage`, `Price`, `VariantSelector`, `SizeGuideTable`, `QuantityStepper`) y tokens de color/tipografia en variables CSS globales.
- El carrito ahora guarda solo el `sessionId` en Redux; el conteo sale de `getCart` via RTK Query.
- Se agrego selector de idioma ES/EN (español por defecto, moneda COP sin cambios) mediante un diccionario propio, sin dependencias nuevas.
- Se configuro Vitest (`environment: 'jsdom'`, `setupFiles`) y se agregaron pruebas de `lib/session.ts`, `store/cart-slice.ts` y `ProductCard`.

## 664153c - Agregado el backend de tienda y el catalogo inicial del frontend

- Se reemplazo la landing temporal por una tienda editorial responsive.
- Se incorporaron Redux Toolkit, RTK Query y Linaria.
- Se agrego una imagen editorial generica local, sustituible por los assets definitivos.
- Se creo una prueba unitaria para el formato monetario y se elimino `unknown` del codigo de rutas.
- Se ampliaron catalogo, inventario y checkout: colecciones, guias de talla, paginacion/filtros, seed de datos de demostracion y reservas por orden.

## 0.1.0 - Configuracion inicial del entorno

- Se creo el monorepo con React, TypeScript, Vite, Fastify y PostgreSQL.
- Se implementaron catalogo, variantes, carrito, pedidos sin pago e inventario con reservas.
- Se anadio la documentacion inicial del proyecto.
- Se definieron las reglas obligatorias de trabajo del repositorio.
- Se definió `main` como rama de trabajo durante la etapa inicial.
- Se configuraron localmente los MCP de Playwright y Chrome DevTools para pruebas visuales.
