import 'dotenv/config'
import { eq, notInArray, sql } from 'drizzle-orm'
import { db } from './client.js'
import { categories, collections, inventoryItems, inventoryMovements, productImages, productVariants, products, sizeGuides } from './schema.js'

/**
 * Demo dataset built from the Kemono design sheets stored in `apps/web/public`.
 * The columns hold the English copy and `translations.es` the Spanish one, which is what the store shows by default.
 */
type VariantSeed = { color: string; size: string; stock: number }
type SpanishCopy = { name: string; description: string; composition: string }
type ProductSeed = {
  slug: string
  name: string
  description: string
  composition: string
  es: SpanishCopy
  categorySlug: string
  collectionSlug: string
  release: 'available' | 'preorder' | 'coming_soon'
  priceCents: number
  colors: string[]
  sizes: string[]
  stockPerVariant: number
}

const PRODUCT_IMAGE_BASE = '/products'
const COLLECTION_IMAGE_BASE = '/collections'

const APPAREL_SIZES = ['S', 'M', 'L', 'XL']
const TEE_SIZES = ['S', 'M', 'L', 'XL', 'XXL']
const ONE_SIZE = ['One size']

/** Letter sizes read the same in both languages, so only the named ones need a translation. */
const SIZE_ES: Record<string, string> = { 'One size': 'Talla única' }

const COLOR_ES: Record<string, string> = {
  'Washed Black': 'Negro lavado',
  'Black Purple': 'Negro y morado',
  'Grey Orange': 'Gris y naranja',
  'Cream Blue': 'Crema y azul',
  'Heather Grey': 'Gris jaspeado',
  Yellow: 'Amarillo',
  Cream: 'Crema',
  // Colours of the Kemono bottle sheet.
  Black: 'Negro',
  'Bone White': 'Blanco hueso',
  Navy: 'Azul noche',
  'Olive Green': 'Verde olivo',
}

const sizeGuideSeeds = [
  {
    // Measurements taken from the Furry Casual Tee sheet.
    slug: 'tops', name: 'Tops', measurementUnit: 'cm',
    columns: ['Size', 'Length', 'Width'],
    rows: [
      { Size: 'S', Length: '68', Width: '54' },
      { Size: 'M', Length: '72', Width: '58' },
      { Size: 'L', Length: '76', Width: '62' },
      { Size: 'XL', Length: '80', Width: '66' },
      { Size: 'XXL', Length: '82', Width: '70' },
    ],
    translations: {
      es: {
        name: 'Camisetas y busos',
        columns: ['Talla', 'Largo', 'Ancho'],
        rows: [
          { Talla: 'S', Largo: '68', Ancho: '54' },
          { Talla: 'M', Largo: '72', Ancho: '58' },
          { Talla: 'L', Largo: '76', Ancho: '62' },
          { Talla: 'XL', Largo: '80', Ancho: '66' },
          { Talla: 'XXL', Largo: '82', Ancho: '70' },
        ],
      },
    },
  },
  {
    slug: 'outerwear', name: 'Outerwear', measurementUnit: 'cm',
    columns: ['Size', 'Chest', 'Length', 'Shoulder'],
    rows: [
      { Size: 'S', Chest: '104', Length: '70', Shoulder: '46' },
      { Size: 'M', Chest: '112', Length: '73', Shoulder: '48' },
      { Size: 'L', Chest: '120', Length: '76', Shoulder: '50' },
      { Size: 'XL', Chest: '128', Length: '79', Shoulder: '52' },
    ],
    translations: {
      es: {
        name: 'Chaquetas y abrigos',
        columns: ['Talla', 'Pecho', 'Largo', 'Hombro'],
        rows: [
          { Talla: 'S', Pecho: '104', Largo: '70', Hombro: '46' },
          { Talla: 'M', Pecho: '112', Largo: '73', Hombro: '48' },
          { Talla: 'L', Pecho: '120', Largo: '76', Hombro: '50' },
          { Talla: 'XL', Pecho: '128', Largo: '79', Hombro: '52' },
        ],
      },
    },
  },
]

/**
 * One per section of the line sheet, in its order. The ones without products are opened empty on
 * purpose: the seed only creates the section and an administrator loads what goes inside.
 */
const categorySeeds = [
  { slug: 't-shirts', name: 'T-shirts', es: 'Camisetas', position: 1, sizeGuideSlug: 'tops' },
  // Hoodies share the outerwear measurements; today's hooded pieces still sit under `outerwear`.
  { slug: 'hoodies', name: 'Hoodies', es: 'Sudaderas', position: 2, sizeGuideSlug: 'outerwear' },
  { slug: 'outerwear', name: 'Outerwear', es: 'Abrigos', position: 3, sizeGuideSlug: 'outerwear' },
  // Pants and accessories have no measurement sheet yet, so they ship without a size guide.
  { slug: 'pants', name: 'Pants', es: 'Pantalones', position: 4, sizeGuideSlug: undefined },
  { slug: 'accessories', name: 'Accessories', es: 'Accesorios', position: 5, sizeGuideSlug: undefined },
  { slug: 'collars', name: 'Collars', es: 'Collares', position: 6, sizeGuideSlug: undefined },
  { slug: 'other', name: 'Other', es: 'Otros', position: 7, sizeGuideSlug: undefined },
]

const collectionSeeds = [
  {
    slug: 'wildspirit', name: 'Wildspirit', tagline: 'Furry streetwear for every day.', description: 'Denim, fleece and synthetic fur with embroidered paws, claws and kemono patches.',
    es: { tagline: 'Streetwear furry para todos los días.', description: 'Denim, polar y pelaje sintético con huellas, garras y parches kemono bordados.' },
    featured: true, releasedDaysAgo: 14, heroImageUrl: `${COLLECTION_IMAGE_BASE}/wildspirit.jpg`,
  },
  {
    slug: 'fauna-series', name: 'Fauna Series', tagline: 'One animal, one tee.', description: 'Tees that turn an animal coat into a print. Neutral colours, unisex regular fit.',
    es: { name: 'Serie Fauna', tagline: 'Un animal, una camiseta.', description: 'Camisetas que convierten el pelaje de un animal en estampado. Colores neutros, corte regular unisex.' },
    featured: false, releasedDaysAgo: 40, heroImageUrl: `${PRODUCT_IMAGE_BASE}/dalma-spots-tee.jpg`,
  },
]

const productSeeds: ProductSeed[] = [
  {
    slug: 'furry-denim-jacket', name: 'Furry Denim Jacket', description: 'Washed black denim jacket lined in synthetic fur, with integrated ears on the collar, a spine of triangular tufts and a short heart shaped tail.', composition: '100% cotton denim, synthetic fur lining',
    es: { name: 'Chaqueta Denim Furry', description: 'Chaqueta de denim negro lavado forrada en peluche, con orejas integradas en el cuello, espina dorsal de mechones triangulares y cola corta en forma de corazón.', composition: 'Denim 100% algodón, forro de peluche sintético' },
    categorySlug: 'outerwear', collectionSlug: 'wildspirit', release: 'available', priceCents: 45900000, colors: ['Washed Black'], sizes: APPAREL_SIZES, stockPerVariant: 4,
  },
  {
    slug: 'furry-denim-pants', name: 'Furry Denim Pants', description: 'Relaxed denim pants with cargo pockets, embroidered patches and adjustable fur cuffs at the ankle.', composition: '100% cotton denim, synthetic fur trims',
    es: { name: 'Pantalón Denim Furry', description: 'Pantalón de denim con fit relajado, bolsillos cargo, parches bordados y peluche ajustable en los tobillos.', composition: 'Denim 100% algodón, detalles en peluche sintético' },
    categorySlug: 'pants', collectionSlug: 'wildspirit', release: 'available', priceCents: 32900000, colors: ['Washed Black'], sizes: APPAREL_SIZES, stockPerVariant: 5,
  },
  {
    slug: 'furry-casual-tee', name: 'Furry Casual Tee', description: 'Oversize tee with a fur trimmed hood, 3D ears held by a flexible wire and a high density back print.', composition: '100% cotton, 220-240 gsm, synthetic fur details',
    es: { name: 'Camiseta Casual Furry', description: 'Camiseta oversize con capucha rematada en peluche, orejas 3D con alambre flexible y estampado trasero de alta densidad.', composition: 'Algodón 100%, 220-240 g/m², detalles en peluche sintético' },
    categorySlug: 't-shirts', collectionSlug: 'wildspirit', release: 'available', priceCents: 18900000, colors: ['Black Purple', 'Grey Orange', 'Cream Blue'], sizes: TEE_SIZES, stockPerVariant: 6,
  },
  {
    slug: 'furry-hoodie', name: 'Furry Hoodie', description: 'Heavyweight hoodie with a fur lined hood, integrated ears and embroidered claw and paw graphics.', composition: '100% cotton, 320 gsm, synthetic fur lining',
    es: { name: 'Buso Furry', description: 'Buso pesado con capucha forrada en peluche, orejas integradas y bordados de garras y huellas.', composition: 'Algodón 100%, 320 g/m², forro de peluche sintético' },
    categorySlug: 'outerwear', collectionSlug: 'wildspirit', release: 'available', priceCents: 28900000, colors: ['Yellow'], sizes: APPAREL_SIZES, stockPerVariant: 8,
  },
  {
    slug: 'furry-socks', name: 'Furry Socks', description: 'Crew socks with embroidered graphics, light arch compression and a padded paw print sole.', composition: 'Combed cotton with spandex',
    es: { name: 'Medias Furry', description: 'Medias urbanas con gráficos bordados, compresión ligera en el arco del pie y planta acolchada con huella canina.', composition: 'Algodón peinado con spandex' },
    categorySlug: 'accessories', collectionSlug: 'wildspirit', release: 'available', priceCents: 4900000, colors: ['Yellow'], sizes: ONE_SIZE, stockPerVariant: 30,
  },
  {
    slug: 'furry-gloves', name: 'Furry Gloves', description: 'Breathable gloves with flexible 3D printed claws, a fur cuff and a padded non slip paw palm.', composition: 'Nylon and spandex, synthetic microfibre, TPU claws',
    es: { name: 'Guantes Furry', description: 'Guantes transpirables con garras 3D flexibles, puño de peluche y palma acolchada antideslizante con forma de huella.', composition: 'Nylon y spandex, microfibra sintética, garras en TPU' },
    categorySlug: 'accessories', collectionSlug: 'wildspirit', release: 'available', priceCents: 11900000, colors: ['Yellow'], sizes: APPAREL_SIZES, stockPerVariant: 10,
  },
  {
    slug: 'furry-cap', name: 'Furry Cap', description: 'Adjustable cap with removable ears, a 3D silicone nose and nylon whiskers on the crown.', composition: '100% premium cotton twill',
    es: { name: 'Gorra Furry', description: 'Gorra ajustable con orejas removibles, nariz 3D de silicona y bigotes de nylon en la parte rígida.', composition: 'Sarga de algodón 100% premium' },
    categorySlug: 'accessories', collectionSlug: 'wildspirit', release: 'available', priceCents: 9900000, colors: ['Yellow'], sizes: ONE_SIZE, stockPerVariant: 15,
  },
  {
    slug: 'furry-beanie', name: 'Furry Beanie', description: 'Two in one wool beanie: fold the muzzle up to wear it as a beanie or pull it down to wear it as a mask. Padded paw ear flaps.', composition: 'Premium acrylic wool, thermal fleece lining',
    es: { name: 'Gorro Furry', description: 'Gorro de lana 2 en 1: dobla la nariz hacia arriba para usarlo como gorro o bájala para usarlo como máscara. Orejeras acolchadas en forma de patita.', composition: 'Lana acrílica premium, forro polar térmico' },
    categorySlug: 'accessories', collectionSlug: 'wildspirit', release: 'available', priceCents: 8900000, colors: ['Yellow'], sizes: ONE_SIZE, stockPerVariant: 0,
  },
  {
    slug: 'dalma-spots-tee', name: 'Dalma Spots Tee', description: 'Regular fit tee with an all over cartoon spot print, a sky blue rib collar and an embroidered paw on the chest.', composition: '100% premium cotton, pre shrunk',
    es: { name: 'Camiseta Dalma Manchas', description: 'Camiseta de corte regular con manchas estilo cartoon en toda la prenda, cuello rib azul cielo y huella bordada en el pecho.', composition: 'Algodón 100% premium, preencogido' },
    categorySlug: 't-shirts', collectionSlug: 'fauna-series', release: 'available', priceCents: 15900000, colors: ['Cream'], sizes: TEE_SIZES, stockPerVariant: 10,
  },
  {
    slug: 'dalma-coat-tee', name: 'Dalma Coat Tee', description: 'Regular fit tee printed with a stylised coat texture on the chest and a sky blue rib collar.', composition: '100% premium cotton, pre shrunk',
    es: { name: 'Camiseta Dalma Pelaje', description: 'Camiseta de corte regular con textura de pelaje estilizado en el frente y cuello rib azul cielo.', composition: 'Algodón 100% premium, preencogido' },
    categorySlug: 't-shirts', collectionSlug: 'fauna-series', release: 'available', priceCents: 15900000, colors: ['Heather Grey'], sizes: TEE_SIZES, stockPerVariant: 10,
  },
  {
    slug: 'dalmata-rainbow-tee', name: 'Dalmata Rainbow Tee', description: 'Regular fit tee with a rainbow rib collar, blue ear inspired sleeve stripes and a coat texture print front and back.', composition: '100% premium cotton, pre shrunk',
    es: { name: 'Camiseta Dálmata Arcoíris', description: 'Camiseta de corte regular con cuello rib en degradado arcoíris, franjas azules en las mangas inspiradas en las orejas y textura de pelaje al frente y atrás.', composition: 'Algodón 100% premium, preencogido' },
    categorySlug: 't-shirts', collectionSlug: 'fauna-series', release: 'preorder', priceCents: 16900000, colors: ['Heather Grey'], sizes: TEE_SIZES, stockPerVariant: 6,
  },
  {
    // Its own sheet: `apps/web/src/assets/sheets/kemono-bottle-sheet.jpg`.
    slug: 'kemono-bottle', name: 'Kemono Thermal Bottle', description: '750 ml stainless steel bottle with a double insulating wall, a leak proof screw cap with integrated ears and a laser engraved coat design. The strap carries the Kemono name.', composition: 'High grade stainless steel, silicone seal',
    es: { name: 'Termo Kemono', description: 'Termo de acero inoxidable de 750 ml con doble pared aislante, tapa de rosca a prueba de fugas con orejas integradas y diseño de pelaje en grabado láser. La correa lleva el nombre Kemono.', composition: 'Acero inoxidable de alta calidad, sello de silicona' },
    categorySlug: 'accessories', collectionSlug: 'wildspirit', release: 'available', priceCents: 13900000, colors: ['Black', 'Bone White', 'Navy', 'Olive Green'], sizes: ONE_SIZE, stockPerVariant: 15,
  },
]

const DAY_IN_MS = 24 * 60 * 60 * 1000

function buildVariants(product: ProductSeed): VariantSeed[] {
  return product.colors.flatMap((color) => product.sizes.map((size) => ({ color, size, stock: product.stockPerVariant })))
}

/** Slug initials keep the code short while staying unique between products such as `furry-cap` and `furry-casual-tee`. */
function buildSku(product: ProductSeed, variant: VariantSeed): string {
  const initials = product.slug.split('-').map((word) => word[0]).join('').toUpperCase()
  const code = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
  return `${initials}-${code(variant.color)}-${code(variant.size)}`
}

function variantTranslations(product: ProductSeed, variant: VariantSeed) {
  const color = COLOR_ES[variant.color] ?? variant.color
  const size = SIZE_ES[variant.size] ?? variant.size
  return { es: { name: `${product.es.name} ${color} ${size}`, color, size } }
}

/** A repeated SKU would be skipped on insert and leave a product without variants, so it stops the seed. */
function assertUniqueSkus(): void {
  const skus = productSeeds.flatMap((product) => buildVariants(product).map((variant) => buildSku(product, variant)))
  const duplicates = skus.filter((sku, index) => skus.indexOf(sku) !== index)
  if (duplicates.length) throw new Error(`Duplicated SKUs in the seed: ${[...new Set(duplicates)].join(', ')}`)
}

async function seed(): Promise<void> {
  assertUniqueSkus()
  const now = new Date()

  for (const guide of sizeGuideSeeds) {
    await db.insert(sizeGuides).values(guide)
      .onConflictDoUpdate({ target: sizeGuides.slug, set: { name: guide.name, measurementUnit: guide.measurementUnit, columns: guide.columns, rows: guide.rows, translations: guide.translations, updatedAt: new Date() } })
  }
  const guideRows = await db.select({ id: sizeGuides.id, slug: sizeGuides.slug }).from(sizeGuides)
  const guideIdBySlug = new Map(guideRows.map((row) => [row.slug, row.id]))

  for (const category of categorySeeds) {
    const sizeGuideId = category.sizeGuideSlug ? guideIdBySlug.get(category.sizeGuideSlug) : undefined
    const translations = { es: { name: category.es } }
    await db.insert(categories).values({ name: category.name, slug: category.slug, position: category.position, sizeGuideId, translations })
      .onConflictDoUpdate({ target: categories.slug, set: { name: category.name, position: category.position, sizeGuideId: sizeGuideId ?? null, translations, updatedAt: new Date() } })
  }
  const categoryRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories)
  const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]))

  for (const collection of collectionSeeds) {
    const translations = { es: collection.es }
    await db.insert(collections).values({
      name: collection.name, slug: collection.slug, tagline: collection.tagline, description: collection.description, featured: collection.featured,
      heroImageUrl: collection.heroImageUrl, releasedAt: new Date(now.getTime() - collection.releasedDaysAgo * DAY_IN_MS), translations,
    }).onConflictDoUpdate({
      target: collections.slug,
      set: { name: collection.name, tagline: collection.tagline, description: collection.description, featured: collection.featured, heroImageUrl: collection.heroImageUrl, translations, updatedAt: new Date() },
    })
  }
  const collectionRows = await db.select({ id: collections.id, slug: collections.slug }).from(collections)
  const collectionIdBySlug = new Map(collectionRows.map((row) => [row.slug, row.id]))

  for (const product of productSeeds) {
    const translations = { es: product.es }
    // Products and variants are only created once, but their translations are refreshed on every run:
    // the admin panel can edit the base copy and must not have it overwritten by the seed.
    const [inserted] = await db.insert(products).values({
      name: product.name, slug: product.slug, description: product.description, composition: product.composition, status: 'active', release: product.release,
      categoryId: categoryIdBySlug.get(product.categorySlug), collectionId: collectionIdBySlug.get(product.collectionSlug),
      availableAt: product.release === 'available' ? undefined : new Date(now.getTime() + 21 * DAY_IN_MS), translations,
    }).onConflictDoNothing({ target: products.slug }).returning({ id: products.id })

    const [stored] = inserted ? [inserted] : await db.select({ id: products.id }).from(products).where(eq(products.slug, product.slug))
    if (!stored) throw new Error(`Product ${product.slug} was neither inserted nor found by slug`)
    if (inserted) await db.insert(productImages).values({ productId: stored.id, url: `${PRODUCT_IMAGE_BASE}/${product.slug}.jpg`, alt: product.name, position: 0 })
    else await db.update(products).set({ translations, updatedAt: new Date() }).where(eq(products.id, stored.id))

    for (const variant of buildVariants(product)) {
      const sku = buildSku(product, variant)
      const [createdVariant] = await db.insert(productVariants).values({
        productId: stored.id, sku, name: `${product.name} ${variant.color} ${variant.size}`,
        color: variant.color, size: variant.size, priceCents: product.priceCents, translations: variantTranslations(product, variant),
      }).onConflictDoNothing({ target: productVariants.sku }).returning({ id: productVariants.id })

      if (!createdVariant) {
        await db.update(productVariants).set({ translations: variantTranslations(product, variant), updatedAt: new Date() }).where(eq(productVariants.sku, sku))
        continue
      }
      const [stock] = await db.insert(inventoryItems).values({ variantId: createdVariant.id, onHand: variant.stock, reorderPoint: 3 }).returning({ id: inventoryItems.id })
      if (!stock) throw new Error(`Inventory item for SKU ${sku} was not created`)
      if (variant.stock) await db.insert(inventoryMovements).values({ inventoryItemId: stock.id, type: 'restock', quantity: variant.stock, note: 'Demo seed stock' })
    }
  }

  // Products from earlier seeds are archived instead of deleted, because orders may still reference them.
  await db.update(products).set({ status: 'archived', updatedAt: new Date() })
    .where(notInArray(products.slug, productSeeds.map((product) => product.slug)))

  const [summary] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(eq(products.status, 'active'))
  console.info(`Seed completed. Active products: ${summary?.total ?? 0}`)
}

await seed()
process.exit(0)
