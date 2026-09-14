import type { FastifyInstance } from 'fastify'
import { and, eq, sql } from 'drizzle-orm'
import { findSessionCustomer } from '../auth/session.js'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { nextOrderNumber } from '../db/queries.js'
import { cartItems, carts, customers, inventoryItems, inventoryMovements, inventoryReservations, orderItems, orders, productVariants, restockRequests } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { checkoutSchema, restockRequestSchema } from '../schemas.js'

export function registerCheckoutRoutes(app: FastifyInstance): void {
  app.post('/api/checkout', { schema: routeDoc({ tags: ['checkout'], summary: 'Place an order (atomic inventory reservation)', body: checkoutSchema }) }, async (request, reply) => {
    const input = checkoutSchema.parse(request.body)
    const order = await db.transaction(async (tx) => {
      const [cart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.sessionId, input.sessionId))
      if (!cart) throw new DomainError('cart_not_found', 'Cart not found', { sessionId: input.sessionId })
      const lines = await tx.select({ quantity: cartItems.quantity, variantId: productVariants.id, sku: productVariants.sku, name: productVariants.name, priceCents: productVariants.priceCents })
        .from(cartItems).innerJoin(productVariants, eq(productVariants.id, cartItems.variantId)).where(eq(cartItems.cartId, cart.id))
      if (!lines.length) throw new DomainError('cart_empty', 'The cart has no items')

      const [customer] = await tx.insert(customers).values({ email: input.email, firstName: input.firstName, lastName: input.lastName, phone: input.phone })
        .onConflictDoUpdate({ target: customers.email, set: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, updatedAt: new Date() } }).returning()
      if (!customer) throw new Error(`Upsert of customer ${input.email} returned no row`)

      const subtotalCents = lines.reduce((total, line) => total + line.priceCents * line.quantity, 0)
      const [created] = await tx.insert(orders).values({
        number: nextOrderNumber, customerId: customer.id, currency: config.currency, subtotalCents, totalCents: subtotalCents, shippingAddress: input.shippingAddress,
      }).returning()
      if (!created) throw new Error('Order insert returned no row')

      const expiresAt = new Date(created.createdAt.getTime() + config.reservationTtlMs)
      for (const line of lines) {
        const [stock] = await tx.update(inventoryItems).set({ reserved: sql`${inventoryItems.reserved} + ${line.quantity}`, updatedAt: new Date() })
          .where(and(eq(inventoryItems.variantId, line.variantId), sql`${inventoryItems.onHand} - ${inventoryItems.reserved} >= ${line.quantity}`)).returning()
        if (!stock) throw new DomainError('out_of_stock', 'Not enough stock available', { sku: line.sku })
        await tx.insert(orderItems).values({ orderId: created.id, variantId: line.variantId, sku: line.sku, name: line.name, unitPriceCents: line.priceCents, quantity: line.quantity })
        await tx.insert(inventoryReservations).values({ inventoryItemId: stock.id, orderId: created.id, quantity: line.quantity, expiresAt })
        await tx.insert(inventoryMovements).values({ inventoryItemId: stock.id, type: 'reservation', quantity: -line.quantity, reference: created.number })
      }
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
      return created
    })
    return reply.code(201).send({ number: order.number, status: order.status, totalCents: order.totalCents, currency: order.currency, reservationExpiresInMinutes: config.reservationTtlMs / 60_000 })
  })

  app.post('/api/restock-requests', { schema: routeDoc({ tags: ['checkout'], summary: 'Join the restock list for a variant', body: restockRequestSchema }) }, async (request, reply) => {
    const input = restockRequestSchema.parse(request.body)
    // A signed in customer is already identified by their email, so the form does not ask for it again.
    const account = await findSessionCustomer(request)
    const email = input.email ?? account?.email
    if (!email) throw new DomainError('email_required', 'Sign in or leave an email to join the restock list')

    const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, input.variantId))
    if (!variant) throw new DomainError('variant_not_found', 'Variant not found', { variantId: input.variantId })
    await db.insert(restockRequests).values({ variantId: input.variantId, email }).onConflictDoNothing()
    return reply.code(202).send({ status: 'registered' })
  })
}
