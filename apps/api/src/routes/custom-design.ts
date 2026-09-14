import type { FastifyInstance } from 'fastify'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { requireSessionCustomer } from '../auth/session.js'
import { isCustomDesignWindowOpen } from '../business-hours.js'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { nextOrderNumber } from '../db/queries.js'
import { customDesignRequests, customers, inventoryItems, inventoryMovements, inventoryReservations, notifications, orderItems, orders, productVariants } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { customDesignRequestSchema, idParamSchema, requestChangesSchema } from '../schemas.js'

type ArtistCandidate = { id: string; firstName: string | null; lastName: string | null; pendingCount: number }

/** Artists that currently accept new requests, ordered by their shortest queue first (the "fastest" one). */
async function findAvailableArtists(): Promise<ArtistCandidate[]> {
  return db.select({
    id: customers.id,
    firstName: customers.firstName,
    lastName: customers.lastName,
    pendingCount: sql<number>`count(${customDesignRequests.id})::int`,
  })
    .from(customers)
    .leftJoin(customDesignRequests, and(eq(customDesignRequests.artistId, customers.id), inArray(customDesignRequests.status, ['pending', 'changes_requested'])))
    .where(and(eq(customers.role, 'artist'), eq(customers.acceptingRequests, true)))
    .groupBy(customers.id)
    .orderBy(asc(sql`count(${customDesignRequests.id})`))
}

/** Resolves `'fastest'` to whoever has the shortest queue, or validates a specific artist is still open to requests. */
async function resolveArtist(artistId: string): Promise<ArtistCandidate> {
  if (artistId === 'fastest') {
    const [fastest] = await findAvailableArtists()
    if (!fastest) throw new DomainError('no_artists_available', 'No artist is accepting requests right now')
    return fastest
  }
  const [artist] = await findAvailableArtists()
    .then((artists) => artists.filter((candidate) => candidate.id === artistId))
  if (!artist) throw new DomainError('artist_unavailable', 'This artist is not accepting requests right now', { artistId })
  return artist
}

function artistName(artist: Pick<ArtistCandidate, 'firstName' | 'lastName'>): string {
  return [artist.firstName, artist.lastName].filter(Boolean).join(' ') || 'Artist'
}

export function registerCustomDesignRoutes(app: FastifyInstance): void {
  app.get('/api/custom-design/artists', { schema: routeDoc({ tags: ['custom-design'], summary: 'Available artists and the surcharge' }) }, async (request) => {
    await requireSessionCustomer(request)
    const artists = await findAvailableArtists()
    return {
      surchargePercent: config.customDesignSurchargePercent,
      artists: artists.map((artist) => ({ id: artist.id, name: artistName(artist), pendingCount: artist.pendingCount })),
    }
  })

  app.post('/api/custom-design/requests', { schema: routeDoc({ tags: ['custom-design'], summary: 'Create a custom design request and its order', body: customDesignRequestSchema }) }, async (request, reply) => {
    const account = await requireSessionCustomer(request)
    const input = customDesignRequestSchema.parse(request.body)
    if (!isCustomDesignWindowOpen()) throw new DomainError('outside_business_hours', 'Custom design requests are only open from 9am to 6pm (Colombia time)')

    const artist = await resolveArtist(input.artistId)

    const [variant] = await db.select({ id: productVariants.id, sku: productVariants.sku, name: productVariants.name, priceCents: productVariants.priceCents })
      .from(productVariants).where(eq(productVariants.id, input.baseVariantId))
    if (!variant) throw new DomainError('variant_not_found', 'Variant not found', { variantId: input.baseVariantId })

    const unitPriceCents = Math.round(variant.priceCents * (100 + config.customDesignSurchargePercent) / 100)

    const request_ = await db.transaction(async (tx) => {
      const [created] = await tx.insert(orders).values({
        number: nextOrderNumber, customerId: account.id, currency: config.currency, subtotalCents: unitPriceCents, totalCents: unitPriceCents, shippingAddress: input.shippingAddress,
      }).returning()
      if (!created) throw new Error('Order insert returned no row')

      const [stock] = await tx.update(inventoryItems).set({ reserved: sql`${inventoryItems.reserved} + 1`, updatedAt: new Date() })
        .where(and(eq(inventoryItems.variantId, variant.id), sql`${inventoryItems.onHand} - ${inventoryItems.reserved} >= 1`)).returning()
      if (!stock) throw new DomainError('out_of_stock', 'Not enough stock available', { sku: variant.sku })

      await tx.insert(orderItems).values({ orderId: created.id, variantId: variant.id, sku: variant.sku, name: variant.name, unitPriceCents, quantity: 1 })
      const expiresAt = new Date(created.createdAt.getTime() + config.reservationTtlMs)
      await tx.insert(inventoryReservations).values({ inventoryItemId: stock.id, orderId: created.id, quantity: 1, expiresAt })
      await tx.insert(inventoryMovements).values({ inventoryItemId: stock.id, type: 'reservation', quantity: -1, reference: created.number })

      const [createdRequest] = await tx.insert(customDesignRequests).values({
        customerId: account.id, artistId: artist.id, baseVariantId: variant.id, orderId: created.id,
        characterDescription: input.characterDescription, referenceImageUrl: input.referenceImage,
      }).returning()
      if (!createdRequest) throw new Error('Custom design request insert returned no row')

      return { order: created, garmentName: variant.name, requestId: createdRequest.id }
    })

    return reply.code(201).send({
      requestId: request_.requestId,
      orderNumber: request_.order.number,
      totalCents: request_.order.totalCents,
      currency: request_.order.currency,
      artistName: artistName(artist),
    })
  })

  app.get('/api/custom-design/requests/:id', { schema: routeDoc({ tags: ['custom-design'], summary: 'Custom design request detail', params: idParamSchema }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    const { id } = idParamSchema.parse(request.params)
    const [found] = await db.select({
      id: customDesignRequests.id, customerId: customDesignRequests.customerId, artistId: customDesignRequests.artistId,
      characterDescription: customDesignRequests.characterDescription, referenceImageUrl: customDesignRequests.referenceImageUrl,
      finalDesignImageUrl: customDesignRequests.finalDesignImageUrl, estimatedDays: customDesignRequests.estimatedDays,
      revisionNote: customDesignRequests.revisionNote, status: customDesignRequests.status, createdAt: customDesignRequests.createdAt,
      garmentName: productVariants.name,
    }).from(customDesignRequests)
      .innerJoin(productVariants, eq(productVariants.id, customDesignRequests.baseVariantId))
      .where(eq(customDesignRequests.id, id))
    if (!found || found.customerId !== account.id) throw new DomainError('custom_design_request_not_found', 'Request not found', { id })
    return found
  })

  app.post('/api/custom-design/requests/:id/approve', { schema: routeDoc({ tags: ['custom-design'], summary: 'Approve a delivered design', params: idParamSchema }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    const { id } = idParamSchema.parse(request.params)
    const [found] = await db.select().from(customDesignRequests).where(eq(customDesignRequests.id, id))
    if (!found || found.customerId !== account.id) throw new DomainError('custom_design_request_not_found', 'Request not found', { id })
    if (found.status !== 'delivered') throw new DomainError('invalid_status_change', 'Only a delivered design can be approved', { status: found.status })

    const [updated] = await db.update(customDesignRequests).set({ status: 'approved', updatedAt: new Date() })
      .where(and(eq(customDesignRequests.id, id), eq(customDesignRequests.customerId, account.id))).returning()
    const [variant] = await db.select({ name: productVariants.name }).from(productVariants).where(eq(productVariants.id, found.baseVariantId))
    await db.insert(notifications).values({
      customerId: found.artistId, kind: 'design_approved', relatedRequestId: id,
      payload: { customerName: [account.firstName, account.lastName].filter(Boolean).join(' ') || account.email, garmentName: variant?.name ?? '' },
    })
    return updated
  })

  app.post('/api/custom-design/requests/:id/request-changes', { schema: routeDoc({ tags: ['custom-design'], summary: 'Request changes on a delivered design', params: idParamSchema, body: requestChangesSchema }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    const { id } = idParamSchema.parse(request.params)
    const input = requestChangesSchema.parse(request.body)
    const [found] = await db.select().from(customDesignRequests).where(eq(customDesignRequests.id, id))
    if (!found || found.customerId !== account.id) throw new DomainError('custom_design_request_not_found', 'Request not found', { id })
    if (found.status !== 'delivered') throw new DomainError('invalid_status_change', 'Changes can only be requested on a delivered design', { status: found.status })

    const [updated] = await db.update(customDesignRequests).set({ status: 'changes_requested', revisionNote: input.comment, updatedAt: new Date() })
      .where(and(eq(customDesignRequests.id, id), eq(customDesignRequests.customerId, account.id))).returning()
    const [variant] = await db.select({ name: productVariants.name }).from(productVariants).where(eq(productVariants.id, found.baseVariantId))
    await db.insert(notifications).values({
      customerId: found.artistId, kind: 'changes_requested', relatedRequestId: id,
      payload: { customerName: [account.firstName, account.lastName].filter(Boolean).join(' ') || account.email, garmentName: variant?.name ?? '' },
    })
    return updated
  })
}
