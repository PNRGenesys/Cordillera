import type { FastifyInstance } from 'fastify'
import { and, desc, eq } from 'drizzle-orm'
import { requireSessionCustomer } from '../auth/session.js'
import { db } from '../db/client.js'
import { notifications } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { idParamSchema } from '../schemas.js'

export function registerNotificationRoutes(app: FastifyInstance): void {
  app.get('/api/notifications', { schema: routeDoc({ tags: ['notifications'], summary: 'List the current account notifications' }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    return db.select({
      id: notifications.id, kind: notifications.kind, relatedRequestId: notifications.relatedRequestId,
      payload: notifications.payload, readAt: notifications.readAt, createdAt: notifications.createdAt,
    }).from(notifications).where(eq(notifications.customerId, account.id)).orderBy(desc(notifications.createdAt))
  })

  app.post('/api/notifications/:id/read', { schema: routeDoc({ tags: ['notifications'], summary: 'Mark a notification as read', params: idParamSchema }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    const { id } = idParamSchema.parse(request.params)
    const [updated] = await db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.customerId, account.id)))
      .returning({ id: notifications.id, readAt: notifications.readAt })
    if (!updated) throw new DomainError('notification_not_found', 'Notification not found', { id })
    return updated
  })
}
