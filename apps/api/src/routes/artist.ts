import type { FastifyInstance, FastifyRequest } from 'fastify'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { requireArtist } from '../auth/session.js'
import { db } from '../db/client.js'
import { customDesignRequests, customers, notifications, productVariants } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { artistStatusSchema, deliverDesignSchema, estimateSchema, idParamSchema } from '../schemas.js'

/** Requests still "alive" for the artist: waiting on them, or delivered and waiting on the customer. */
const ACTIVE_STATUSES = ['pending', 'changes_requested', 'delivered'] as const

/** Fastify hooks must not resolve to a value, so the account resolved by the guard is dropped here. */
async function guard(request: FastifyRequest): Promise<void> {
  await requireArtist(request)
}

export function registerArtistRoutes(app: FastifyInstance): void {
  app.get('/api/artist/status', { preHandler: guard, schema: routeDoc({ tags: ['artist'], summary: 'Artist availability status' }) }, async (request) => {
    const account = await requireArtist(request)
    return { acceptingRequests: account.acceptingRequests }
  })

  app.patch('/api/artist/status', { preHandler: guard, schema: routeDoc({ tags: ['artist'], summary: 'Set artist availability', body: artistStatusSchema }) }, async (request) => {
    const account = await requireArtist(request)
    const input = artistStatusSchema.parse(request.body)
    const [updated] = await db.update(customers).set({ acceptingRequests: input.acceptingRequests, updatedAt: new Date() })
      .where(eq(customers.id, account.id)).returning({ acceptingRequests: customers.acceptingRequests })
    return updated
  })

  /**
   * "Pedidos del día": every request still active for this artist, oldest first, so they see when each
   * one arrived. Going unavailable only stops new requests from being assigned — it does not hide these.
   */
  app.get('/api/artist/requests', { preHandler: guard, schema: routeDoc({ tags: ['artist'], summary: 'Active requests for this artist' }) }, async (request) => {
    const account = await requireArtist(request)
    return db.select({
      id: customDesignRequests.id, status: customDesignRequests.status, createdAt: customDesignRequests.createdAt,
      characterDescription: customDesignRequests.characterDescription, referenceImageUrl: customDesignRequests.referenceImageUrl,
      finalDesignImageUrl: customDesignRequests.finalDesignImageUrl, estimatedDays: customDesignRequests.estimatedDays,
      revisionNote: customDesignRequests.revisionNote, garmentName: productVariants.name,
      customerFirstName: customers.firstName, customerLastName: customers.lastName, customerEmail: customers.email,
    }).from(customDesignRequests)
      .innerJoin(productVariants, eq(productVariants.id, customDesignRequests.baseVariantId))
      .innerJoin(customers, eq(customers.id, customDesignRequests.customerId))
      .where(and(eq(customDesignRequests.artistId, account.id), inArray(customDesignRequests.status, ACTIVE_STATUSES)))
      .orderBy(asc(customDesignRequests.createdAt))
  })

  app.patch('/api/artist/requests/:id/estimate', { preHandler: guard, schema: routeDoc({ tags: ['artist'], summary: 'Set the estimated days for a request', params: idParamSchema, body: estimateSchema }) }, async (request) => {
    const account = await requireArtist(request)
    const { id } = idParamSchema.parse(request.params)
    const input = estimateSchema.parse(request.body)
    const [updated] = await db.update(customDesignRequests).set({ estimatedDays: input.estimatedDays, updatedAt: new Date() })
      .where(and(eq(customDesignRequests.id, id), eq(customDesignRequests.artistId, account.id))).returning()
    if (!updated) throw new DomainError('custom_design_request_not_found', 'Request not found', { id })
    return updated
  })

  app.post('/api/artist/requests/:id/deliver', { preHandler: guard, schema: routeDoc({ tags: ['artist'], summary: 'Deliver the final design', params: idParamSchema, body: deliverDesignSchema }) }, async (request) => {
    const account = await requireArtist(request)
    const { id } = idParamSchema.parse(request.params)
    const input = deliverDesignSchema.parse(request.body)

    const [found] = await db.select().from(customDesignRequests).where(and(eq(customDesignRequests.id, id), eq(customDesignRequests.artistId, account.id)))
    if (!found) throw new DomainError('custom_design_request_not_found', 'Request not found', { id })
    if (found.status !== 'pending' && found.status !== 'changes_requested') {
      throw new DomainError('invalid_status_change', 'Only a pending or changes-requested request can be delivered', { status: found.status })
    }

    const [updated] = await db.update(customDesignRequests).set({ finalDesignImageUrl: input.finalDesignImage, status: 'delivered', updatedAt: new Date() })
      .where(and(eq(customDesignRequests.id, id), eq(customDesignRequests.artistId, account.id))).returning()
    const [variant] = await db.select({ name: productVariants.name }).from(productVariants).where(eq(productVariants.id, found.baseVariantId))
    await db.insert(notifications).values({ customerId: found.customerId, kind: 'design_delivered', relatedRequestId: id, payload: { garmentName: variant?.name ?? '' } })
    return updated
  })
}
