# Trabajo pendiente

Corte: 2026-09-14, rama `dev`. Solo se listan tareas abiertas; lo terminado vive en `docs/changelog.md`.

## 1. Cuentas de cliente

El inicio de sesion y el rol de administrador ya funcionan, pero queda por hacer:

- Verificacion de correo y recuperacion de contrasena. Hoy cualquiera que conozca el correo de una compra de invitado puede reclamar esa cuenta.
- Limitacion de intentos en `POST /api/auth/login`.
- Historial de pedidos del propio cliente: `/api/admin/orders` los lista para el administrador, pero el comprador no puede ver los suyos.
- El checkout de invitado sigue sobrescribiendo nombre y telefono de un cliente registrado si usa su correo.
- Cambiar el correo de la cuenta solo exige la sesion, no la contrasena actual. Conviene pedirla junto con la verificacion de correo.
- La foto de perfil vive en la base como data URL. Cuando exista almacenamiento de archivos hay que moverla y dejar solo la URL.
- Las sesiones vencidas se ignoran al leerlas, pero nadie las borra; conviene sumarlas al job `inventory:release-expired`.

## 2. Panel administrativo

Funciona sobre el catalogo, el inventario y los pedidos, pero le falta:

- Editar la imagen, la categoria y la coleccion de un producto ya creado, y agregar o eliminar variantes: el formulario de alta las define una sola vez y despues la ficha solo deja cambiar nombre, estado, lanzamiento, precio y stock.
- Registro de quien hizo cada cambio; hoy solo los ajustes de inventario dejan rastro con nota.
- Paginacion y busqueda: la pagina carga el catalogo y los pedidos completos de una sola vez.
- Reembolsar un pedido ya cobrado no devuelve unidades al inventario, porque su reserva ya se consumio.
- No permite editar las traducciones: al cambiar un nombre o una descripcion solo se modifica la copia base, y la version en espanol sigue viniendo del seed.

## 3. Ampliar a otro pais

La tienda asume Colombia (ver `docs/architecture.md`). Para vender fuera habria que volver a mostrar el campo de pais, servir la lista de regiones desde la API en vez de tenerla en el frontend, revisar la moneda y la zona horaria, y decidir el formato de codigo postal.

## 4. Idiomas

La tienda funciona en español e ingles, pero:

- El checkout y las rutas administrativas no traducen sus respuestas; solo catalogo y carrito aceptan `lang`.
- Los nombres de coleccion `Wildspirit` y de producto en ingles se dejaron sin traducir a proposito por ser nombres de marca; conviene confirmarlo con el negocio.
- No hay forma de cargar traducciones fuera del seed (ver el punto anterior sobre el panel).

## 5. Facetas del catalogo

Los desplegables de color y talla en `/shop` se arman con los productos de la pagina visible, asi que al filtrar por un color el desplegable deja de ofrecer los demas (hay que volver a "Todas" para cambiar). Solucion adecuada: un endpoint de facetas que devuelva colores y tallas del catalogo completo segun coleccion y categoria.

## 6. Imagenes y assets

- Las imagenes del catalogo son fichas de diseno generadas con IA, cargadas solo para probar la tienda. Hay que reemplazarlas por fotografia real de producto, en formato vertical, porque la tarjeta las recorta al centro con `object-fit: cover`.
- La ficha de la linea completa (`apps/web/src/assets/sheets/cordillera-line-sheet.jpg`) es una pieza de presentacion, no un catalogo de articulos: hoy solo abre la rotacion del Hero. Los productos que muestra (camisetas Zorro, Lobo, Tigre y Lince, sudaderas, rompevientos, cargo y accesorios) no estan en el catalogo y habria que darlos de alta con fotografia y precios propios.
- El precio del termo Kemono no esta en su ficha: es un marcador puesto en el rango del resto del catalogo y hay que confirmarlo con el negocio.
- Quedan dos colecciones vacias de seeds anteriores (`terrain-01` y `basecamp`), sin productos activos, y `terrain-01` sigue marcada como destacada. El seed archiva productos que ya no estan en el, pero nunca borra ni actualiza colecciones, asi que tampoco propaga un cambio de coleccion a un producto que ya existe.
- No se sirven varios tamanos ni formatos modernos de imagen.
- `collections.heroImageUrl` sigue guardandose y devolviendose, pero ya no se muestra en ninguna parte desde que el hero del inicio pasa a ser el banner de marca. Su lugar natural seria la cabecera de `/shop/:collection`.
- Falta renombrar la carpeta local del proyecto y el repositorio en GitHub, que siguen como `Coordillera`. De la carpeta sale ademas el nombre del contenedor (`coordillera-database-1`).

## 7. Despliegue

El proyecto ya esta empaquetado: `docker-compose.yml` arma el grupo completo (base de datos, API, frontend con nginx y middleware) con imagenes propias y healthchecks encadenados, y la API aplica sus migraciones al arrancar. Lo que falta es llevarlo a un servidor:

- Decidir donde vive y montar el despliegue continuo.
- TLS. El grupo se sirve hoy por HTTP plano y por eso `SESSION_COOKIE_SECURE=false`; detras de HTTPS hay que volver a `true`.
- Secretos reales fuera del repositorio: la contrasena de PostgreSQL esta escrita en `docker-compose.yml` y las credenciales de MercadoPago viven en un `.env` local.
- El volumen `postgres_data` no tiene copias de seguridad.
- El middleware es un punto unico de fallo del grupo: si cae, la tienda se queda sin API.

Opciones razonables para el tamano actual, de menos a mas operacion:

| Opcion | Encaje |
| --- | --- |
| Railway, Render o Fly.io | Despliegan la API y la base gestionada desde el repositorio, con poca configuracion. Lo mas directo para empezar. |
| Cloud Run o App Runner con una base gestionada | Contenedor sin servidor, escala a cero y cobra por uso. Mas piezas que armar. |
| Kubernetes | No hace falta. Orquesta contenedores en varios nodos y aqui hay cuatro que caben en una sola maquina; solo se justificaria con varias replicas, autoescalado fino o despliegues sin caida. |

El frontend es estatico (`npm run build` deja `apps/web/dist`), asi que puede ir en cualquier CDN. Antes de publicar hacen falta los pendientes de seguridad de `docs/architecture.md`: gestion de secretos, limitacion de tasa, observabilidad y copias de seguridad.

## 8. Vulnerabilidades de dependencias

`npm audit` reporta 4 moderadas, todas heredadas de `esbuild` via `drizzle-kit`. `npm audit fix --force` implica un downgrade incompatible de `drizzle-kit`; no se aplico.

## 9. Producto todavia no empezado

Pasarela de pago, envios y costos, correos transaccionales y contenido editorial real (textos y colecciones definitivas).

## 10. Diseno personalizado (fursona)

- El recargo sobre el precio normal de la prenda esta fijo en 50% (`CUSTOM_DESIGN_SURCHARGE_PERCENT`) como placeholder. Falta reunirse con artistas y administracion para acordar el porcentaje definitivo.
- El pago se cobra completo al solicitar el diseno, pero sigue el mismo modelo placeholder que el resto del checkout (ver punto 9): la orden queda en `pending_payment` y un administrador la pasa a `paid` a mano. Cuando exista una pasarela real, debe cubrir tambien este flujo.
- El panel de administrador no tiene vista de las solicitudes de diseno personalizado; el admin solo asigna el rol de artista desde la nueva seccion de clientes. Si el negocio lo necesita, es una seccion nueva por construir.
- No esta definido que pasa operativamente despues de "approved": hoy la orden sigue el ciclo de estados normal (`pending_payment` -> `paid` -> ...) sin un paso especial de "enviar a producir/imprimir" el diseno aprobado sobre la prenda.
- La foto de referencia y el diseno final se guardan como data URL en la base de datos, igual que la foto de perfil (ver punto 1) y por la misma razon: no hay almacenamiento de archivos todavia.

## 11. Pruebas end-to-end (Playwright)

La infraestructura ya esta lista en `apps/e2e` (nuevo workspace `@cordillera/e2e`), pero todavia no hay una suite real, solo una prueba de humo (`apps/e2e/tests/smoke.spec.ts`) que confirma que la portada carga:

- `npm run test:e2e:install` descarga el navegador Chromium (una sola vez, requiere red).
- `npm run test:e2e` corre la suite: `playwright.config.ts` levanta la API y el frontend (`npm run dev:api`/`dev:web`) contra el Postgres de `docker-compose.yml`, asi que hace falta la base de datos arriba (`docker compose up -d database`).
- Falta escribir la suite real: registro/login, compra completa (carrito -> checkout -> pedido), y el flujo de diseno personalizado (solicitud -> panel del artista -> notificacion -> aprobar/pedir cambios) descrito en el punto 10. Esos recorridos ya se verificaron a mano con Playwright, pero no quedaron como pruebas del repositorio.
- Todavia no hay CI (ver punto 7 de despliegue), asi que falta decidir donde y cuando correr esta suite ademas de en local.

## 12. Middleware y pasarela de pagos

El middleware ya es el unico punto de entrada y reenvia todo `/api/*` a la API, pero sigue siendo solo eso:

- La pasarela MercadoPago no esta integrada: `app/config.py` declara las credenciales (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`) como marcadores vacios y no hay ni creacion de preferencias ni recepcion de webhooks. Cuando exista, el webhook validado debe pedirle a la API el cambio de pedido a `paid`, sin escribir en la base directamente.
- No hay limitacion de tasa ni control de borde, que es la otra razon de tener un unico punto de entrada.
- El proxy carga cada cuerpo entero en memoria en vez de transmitirlo; alcanza para los tamanos actuales (las imagenes van como data URL por debajo del limite de 1 MB de Fastify), pero habria que revisarlo si aparecen subidas de archivos reales.
- No hay registro de peticiones ni trazas en el middleware, asi que un fallo de borde no deja rastro propio.
