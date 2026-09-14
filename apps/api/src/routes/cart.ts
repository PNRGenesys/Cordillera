import type { FastifyInstance } from 'fastify'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { availableUnits } from '../db/queries.js'
import { cartItems, carts, inventoryItems, productImages, productVariants, products } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { overridesFor, type Locale } from '../i18n.js'
import { routeDoc } from '../openapi.js'
import { cartItemRemovalSchema, cartItemSchema, cartItemUpdateSchema, localeQuerySchema, sessionSchema } from '../schemas.js'
import { config } from '../config.js'

export type CartLine = {
  variantId: string
  sku: string
  productName: string
  productSlug: string
  variantName: string
  color: string | null
  size: string | null
  unitPriceCents: number
  quantity: number
  availableUnits: number
  imageUrl: string | null
}

export type CartView = { sessionId: string; currency: string; items: CartLine[]; itemCount: number; subtotalCents: number }

export async function readCart(sessionId: string, locale: Locale): Promise<CartView> {
  const rows = await db.select({
    variantId: productVariants.id,
    sku: productVariants.sku,
    productName: products.name,
    productSlug: products.slug,
    productTranslations: products.translations,
    variantName: productVariants.name,
    color: productVariants.color,
    size: productVariants.size,
    variantTranslations: productVariants.translations,
    unitPriceCents: productVariants.priceCents,
    quantity: cartItems.quantity,
    availableUnits: sql<number>`coalesce(${availableUnits}, 0)::int`,
    imageUrl: sql<string | null>`(select ${productImages.url} from ${productImages} where ${productImages.productId} = ${products.id} order by ${productImages.position} limit 1)`,
  })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(inventoryItems, eq(inventoryItems.variantId, productVariants.id))
    .where(eq(carts.sessionId, sessionId))
    .orderBy(asc(products.name), asc(productVariants.size))

  const items = rows.map(({ productTranslations, variantTranslations, ...item }) => {
    const product = overridesFor(productTranslations, locale)
    const variant = overridesFor(variantTranslations, locale)
    return {
      ...item,
      productName: product.name ?? item.productName,
      variantName: variant.name ?? item.variantName,
      color: variant.color ?? item.color,
      size: variant.size ?? item.size,
    }
  })

  return {
    sessionId,
    currency: config.currency,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalCents: items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0),
  }
}

async function assertVariantHasStock(variantId: string, requestedQuantity: number): Promise<void> {
  const [stock] = await db.select({ sku: productVariants.sku, units: sql<number>`coalesce(${availableUnits}, 0)::int` })
    .from(productVariants).leftJoin(inventoryItems, eq(inventoryItems.variantId, productVariants.id)).where(eq(productVariants.id, variantId))
  if (!stock) throw new DomainError('variant_not_found', 'Variant not found', { variantId })
  if (stock.units < requestedQuantity) throw new DomainError('out_of_stock', 'Not enough stock available', { sku: stock.sku, available: String(stock.units) })
}

export function registerCartRoutes(app: FastifyInstance): void {
  app.get('/api/cart/:sessionId', { schema: routeDoc({ tags: ['cart'], summary: 'Read the session cart', params: sessionSchema, querystring: localeQuerySchema }) }, async (request) => readCart(sessionSchema.parse(request.params).sessionId, localeQuerySchema.parse(request.query).lang))

  app.post('/api/cart/items', { schema: routeDoc({ tags: ['cart'], summary: 'Add an item to the cart', body: cartItemSchema }) }, async (request, reply) => {
    const input = cartItemSchema.parse(request.body)
    const [cart] = await db.insert(carts).values({ sessionId: input.sessionId, currency: config.currency })
      .onConflictDoUpdate({ target: carts.sessionId, set: { updatedAt: new Date() } }).returning()
    if (!cart) throw new Error(`Upsert of cart ${input.sessionId} returned no row`)
    const [existing] = await db.select({ quantity: cartItems.quantity }).from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, input.variantId)))
    const nextQuantity = Math.min((existing?.quantity ?? 0) + input.quantity, config.cartMaxQuantityPerItem)
    await assertVariantHasStock(input.variantId, nextQuantity)
    await db.insert(cartItems).values({ cartId: cart.id, variantId: input.variantId, quantity: nextQuantity })
      .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: nextQuantity, updatedAt: new Date() } })
    return reply.code(201).send(await readCart(input.sessionId, localeQuerySchema.parse(request.query).lang))
  })

  app.patch('/api/cart/items', { schema: routeDoc({ tags: ['cart'], summary: 'Update an item quantity (0 removes it)', body: cartItemUpdateSchema }) }, async (request) => {
    const input = cartItemUpdateSchema.parse(request.body)
    const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.sessionId, input.sessionId))
    if (!cart) throw new DomainError('cart_not_found', 'Cart not found', { sessionId: input.sessionId })
    if (input.quantity === 0) {
      await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, input.variantId)))
      return readCart(input.sessionId, localeQuerySchema.parse(request.query).lang)
    }
    await assertVariantHasStock(input.variantId, input.quantity)
    const updated = await db.update(cartItems).set({ quantity: input.quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, input.variantId))).returning({ id: cartItems.id })
    if (!updated.length) throw new DomainError('cart_item_not_found', 'Cart item not found', { variantId: input.variantId })
    return readCart(input.sessionId, localeQuerySchema.parse(request.query).lang)
  })

  app.delete('/api/cart/items', { schema: routeDoc({ tags: ['cart'], summary: 'Remove an item from the cart', querystring: cartItemRemovalSchema }) }, async (request) => {
    const input = cartItemRemovalSchema.parse(request.query)
    const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.sessionId, input.sessionId))
    if (!cart) throw new DomainError('cart_not_found', 'Cart not found', { sessionId: input.sessionId })
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, input.variantId)))
    return readCart(input.sessionId, localeQuerySchema.parse(request.query).lang)
  })
}
