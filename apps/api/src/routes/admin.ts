import type { FastifyInstance, FastifyRequest } from 'fastify'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { requireAdmin } from '../auth/session.js'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { availableUnits } from '../db/queries.js'
import { categories, collections, customers, inventoryItems, inventoryMovements, inventoryReservations, orderItems, orders, productImages, productVariants, products } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { customerRoleUpdateSchema, idParamSchema, inventoryAdjustmentSchema, orderUpdateSchema, productCreateSchema, productDiscountSchema, productUpdateSchema, variantUpdateSchema } from '../schemas.js'

type OrderStatus = (typeof orders.$inferSelect)['status']

/** Once an order is cancelled or refunded its stock went back to the shelf, so it cannot be revived. */
const CLOSED_STATUSES: OrderStatus[] = ['cancelled', 'refunded']

/** Fastify hooks must not resolve to a value, so the account resolved by the guard is dropped here. */
async function guard(request: FastifyRequest): Promise<void> {
  await requireAdmin(request)
}

async function findAdminProducts() {
  const rows = await db.select({
    id: products.id,
    slug: products.slug,
    name: products.name,
    description: products.description,
    composition: products.composition,
    status: products.status,
    release: products.release,
    categoryId: products.categoryId,
    categoryName: categories.name,
    collectionId: products.collectionId,
    collectionName: collections.name,
  }).from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(collections, eq(collections.id, products.collectionId))
    .orderBy(asc(products.name))

  const productIds = rows.map((row) => row.id)
  if (!productIds.length) return []

  const variants = await db.select({
    id: productVariants.id,
    productId: productVariants.productId,
    sku: productVariants.sku,
    name: productVariants.name,
    color: productVariants.color,
    size: productVariants.size,
    priceCents: productVariants.priceCents,
    compareAtPriceCents: productVariants.compareAtPriceCents,
    onHand: sql<number>`coalesce(${inventoryItems.onHand}, 0)::int`,
    reserved: sql<number>`coalesce(${inventoryItems.reserved}, 0)::int`,
    availableUnits: sql<number>`coalesce(${availableUnits}, 0)::int`,
    lowStock: sql<boolean>`coalesce(${availableUnits}, 0) <= greatest(coalesce(${inventoryItems.reorderPoint}, 0), ${config.lowStockThreshold})`,
  }).from(productVariants).leftJoin(inventoryItems, eq(inventoryItems.variantId, productVariants.id))
    .where(inArray(productVariants.productId, productIds)).orderBy(asc(productVariants.sku))

  const images = await db.select({ productId: productImages.productId, url: productImages.url })
    .from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.position))

  return rows.map((row) => ({
    ...row,
    imageUrl: images.find((image) => image.productId === row.id)?.url ?? null,
    variants: variants.filter((variant) => variant.productId === row.id),
  }))
}

async function findAdminOrders() {
  const rows = await db.select({
    id: orders.id,
    number: orders.number,
    status: orders.status,
    currency: orders.currency,
    totalCents: orders.totalCents,
    shippingAddress: orders.shippingAddress,
    carrier: orders.carrier,
    trackingNumber: orders.trackingNumber,
    createdAt: orders.createdAt,
    customerEmail: customers.email,
    customerFirstName: customers.firstName,
    customerLastName: customers.lastName,
    customerPhone: customers.phone,
  }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).orderBy(desc(orders.createdAt))

  const orderIds = rows.map((row) => row.id)
  if (!orderIds.length) return []

  const lines = await db.select({ orderId: orderItems.orderId, sku: orderItems.sku, name: orderItems.name, quantity: orderItems.quantity, unitPriceCents: orderItems.unitPriceCents })
    .from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.sku))

  return rows.map((row) => ({ ...row, items: lines.filter((line) => line.orderId === row.id) }))
}

/**
 * Moving an order to `paid` turns its reservations into real sales, and cancelling it puts the units back.
 * Without this the scheduled release job would give away stock that was already sold.
 */
async function settleReservations(orderId: string, status: OrderStatus): Promise<void> {
  const settlesStock = status === 'paid'
  const releasesStock = status === 'cancelled' || status === 'refunded'
  if (!settlesStock && !releasesStock) return

  await db.transaction(async (tx) => {
    const reservations = await tx.select().from(inventoryReservations)
      .where(and(eq(inventoryReservations.orderId, orderId), isNull(inventoryReservations.releasedAt)))

    for (const reservation of reservations) {
      const soldUnits = settlesStock ? { onHand: sql`${inventoryItems.onHand} - ${reservation.quantity}` } : {}
      await tx.update(inventoryItems).set({
        ...soldUnits,
        reserved: sql`${inventoryItems.reserved} - ${reservation.quantity}`,
        updatedAt: new Date(),
      }).where(eq(inventoryItems.id, reservation.inventoryItemId))
      await tx.update(inventoryReservations).set({ releasedAt: new Date() }).where(eq(inventoryReservations.id, reservation.id))
      await tx.insert(inventoryMovements).values({
        inventoryItemId: reservation.inventoryItemId,
        type: settlesStock ? 'sale' : 'release',
        quantity: settlesStock ? -reservation.quantity : reservation.quantity,
        reference: orderId,
        note: `Order marked as ${status}`,
      })
    }
  })
}

async function findAdminCustomers() {
  return db.select({ id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName, role: customers.role, acceptingRequests: customers.acceptingRequests })
    .from(customers).orderBy(asc(customers.email))
}

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get('/api/admin/products', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'List products with stock for the admin panel' }) }, async () => findAdminProducts())

  app.get('/api/admin/customers', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'List customers with their roles' }) }, async () => findAdminCustomers())

  /** The only way to grant the `artist` role today; `admin` can still also be granted via `npm run admin:grant`. */
  app.patch('/api/admin/customers/:id/role', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Change a customer role', params: idParamSchema, body: customerRoleUpdateSchema }) }, async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const input = customerRoleUpdateSchema.parse(request.body)
    const [updated] = await db.update(customers).set({ role: input.role, updatedAt: new Date() }).where(eq(customers.id, id))
      .returning({ id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName, role: customers.role, acceptingRequests: customers.acceptingRequests })
    if (!updated) throw new DomainError('customer_not_found', 'Customer not found', { id })
    return updated
  })

  app.patch('/api/admin/products/:id', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Update a product', params: idParamSchema, body: productUpdateSchema }) }, async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const input = productUpdateSchema.parse(request.body)
    const [updated] = await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id)).returning()
    if (!updated) throw new DomainError('product_not_found', 'Product not found', { id })
    return updated
  })

  app.patch('/api/admin/variants/:id', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Update a variant (price, color, size)', params: idParamSchema, body: variantUpdateSchema }) }, async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const input = variantUpdateSchema.parse(request.body)
    const [updated] = await db.update(productVariants).set({ ...input, updatedAt: new Date() }).where(eq(productVariants.id, id)).returning()
    if (!updated) throw new DomainError('variant_not_found', 'Variant not found', { id })
    return updated
  })

  /**
   * Applies a single discount percentage to every variant of a product. Each variant keeps its own
   * regular price as the baseline (`compareAtPriceCents` if a discount is already active, its own
   * `priceCents` otherwise), so re-applying a discount never compounds on top of a previous one.
   * `discountPercent: 0` restores the regular price and clears the discount.
   */
  app.post('/api/admin/products/:id/discount', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Set or clear a product discount', params: idParamSchema, body: productDiscountSchema }) }, async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const input = productDiscountSchema.parse(request.body)

    const updated = await db.transaction(async (tx) => {
      const variants = await tx.select({ id: productVariants.id, priceCents: productVariants.priceCents, compareAtPriceCents: productVariants.compareAtPriceCents })
        .from(productVariants).where(eq(productVariants.productId, id))
      if (!variants.length) throw new DomainError('product_not_found', 'Product not found', { id })

      const rows = []
      for (const variant of variants) {
        const baseline = variant.compareAtPriceCents ?? variant.priceCents
        const priceCents = Math.round((baseline * (100 - input.discountPercent)) / 100)
        const compareAtPriceCents = input.discountPercent > 0 ? baseline : null
        const [row] = await tx.update(productVariants).set({ priceCents, compareAtPriceCents, updatedAt: new Date() })
          .where(eq(productVariants.id, variant.id)).returning()
        if (!row) throw new Error(`Variant ${variant.id} update returned no row`)
        rows.push(row)
      }
      return rows
    })

    return updated
  })

  app.post('/api/admin/inventory/adjustments', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Adjust stock with a note', body: inventoryAdjustmentSchema }) }, async (request) => {
    const input = inventoryAdjustmentSchema.parse(request.body)
    const [stock] = await db.update(inventoryItems).set({ onHand: sql`${inventoryItems.onHand} + ${input.quantity}`, updatedAt: new Date() })
      .where(and(eq(inventoryItems.variantId, input.variantId), sql`${inventoryItems.onHand} + ${input.quantity} >= ${inventoryItems.reserved}`)).returning()
    if (!stock) throw new DomainError('invalid_adjustment', 'Adjustment would leave less stock than already reserved, or the variant has no inventory record', { variantId: input.variantId })
    await db.insert(inventoryMovements).values({ inventoryItemId: stock.id, type: 'adjustment', quantity: input.quantity, note: input.note })
    return stock
  })

  app.post('/api/admin/products', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Create a product with variants', body: productCreateSchema }) }, async (request, reply) => {
    const input = productCreateSchema.parse(request.body)
    const product = await db.transaction(async (tx) => {
      const [created] = await tx.insert(products).values({
        name: input.name, slug: input.slug, description: input.description, composition: input.composition,
        categoryId: input.categoryId, collectionId: input.collectionId, release: input.release, status: 'draft',
      }).returning()
      if (!created) throw new Error('Product insert returned no row')
      for (const variant of input.variants) {
        const [createdVariant] = await tx.insert(productVariants).values({ productId: created.id, sku: variant.sku, name: variant.name, priceCents: variant.priceCents, color: variant.color, size: variant.size }).returning()
        if (!createdVariant) throw new Error(`Variant insert for SKU ${variant.sku} returned no row`)
        const [stock] = await tx.insert(inventoryItems).values({ variantId: createdVariant.id, onHand: variant.initialStock }).returning()
        if (!stock) throw new Error(`Inventory item insert for SKU ${variant.sku} returned no row`)
        if (variant.initialStock) await tx.insert(inventoryMovements).values({ inventoryItemId: stock.id, type: 'restock', quantity: variant.initialStock, note: 'Initial stock' })
      }
      return created
    })
    return reply.code(201).send(product)
  })

  app.get('/api/admin/orders', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'List orders' }) }, async () => findAdminOrders())

  app.patch('/api/admin/orders/:id', { preHandler: guard, schema: routeDoc({ tags: ['admin'], summary: 'Update an order status, carrier or tracking', params: idParamSchema, body: orderUpdateSchema }) }, async (request) => {
    const { id } = idParamSchema.parse(request.params)
    const input = orderUpdateSchema.parse(request.body)

    const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id))
    if (!current) throw new DomainError('order_not_found', 'Order not found', { id })
    if (input.status && input.status !== current.status && CLOSED_STATUSES.includes(current.status)) {
      throw new DomainError('invalid_status_change', 'A cancelled or refunded order cannot change status', { status: current.status })
    }

    const [updated] = await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, id)).returning()
    if (input.status && input.status !== current.status) await settleReservations(id, input.status)
    return updated
  })
}
