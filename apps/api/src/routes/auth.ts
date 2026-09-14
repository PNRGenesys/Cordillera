import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { closeSession, findSessionCustomer, openSession, requireSessionCustomer, type AccountProfile } from '../auth/session.js'
import { db } from '../db/client.js'
import { customers } from '../db/schema.js'
import { DomainError } from '../errors.js'
import { routeDoc } from '../openapi.js'
import { loginSchema, profileUpdateSchema, registerSchema } from '../schemas.js'

const profileColumns = {
  id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName,
  phone: customers.phone, role: customers.role, avatar: customers.avatar, shippingAddress: customers.shippingAddress,
  acceptingRequests: customers.acceptingRequests,
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/api/auth/register', { schema: routeDoc({ tags: ['auth'], summary: 'Register an account and open a session', body: registerSchema }) }, async (request, reply) => {
    const input = registerSchema.parse(request.body)
    const passwordHash = await hashPassword(input.password)

    const [existing] = await db.select({ id: customers.id, passwordHash: customers.passwordHash }).from(customers).where(eq(customers.email, input.email))
    if (existing?.passwordHash) throw new DomainError('email_taken', 'That email already has an account', { email: input.email })

    // A guest checkout may have already created the customer, so registering claims that row instead of duplicating it.
    const [account] = existing
      ? await db.update(customers).set({ passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone, updatedAt: new Date() })
        .where(eq(customers.id, existing.id)).returning(profileColumns)
      : await db.insert(customers).values({ email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone }).returning(profileColumns)
    if (!account) throw new Error(`Register upsert for ${input.email} returned no row`)

    await openSession(account.id, reply)
    return reply.code(201).send(toProfile(account))
  })

  app.post('/api/auth/login', { schema: routeDoc({ tags: ['auth'], summary: 'Log in and open a session', body: loginSchema }) }, async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const [account] = await db.select({ ...profileColumns, passwordHash: customers.passwordHash }).from(customers).where(eq(customers.email, input.email))
    // The same error covers unknown emails and wrong passwords, so the response does not reveal which accounts exist.
    if (!account || !account.passwordHash || !(await verifyPassword(input.password, account.passwordHash))) {
      throw new DomainError('invalid_credentials', 'Email or password is incorrect')
    }

    await openSession(account.id, reply)
    return toProfile(account)
  })

  app.post('/api/auth/logout', { schema: routeDoc({ tags: ['auth'], summary: 'Log out and close the session' }) }, async (request, reply) => {
    await closeSession(request, reply)
    return reply.code(204).send()
  })

  // Browsing as a guest is a normal state, not an error, so this answers 200 with an empty account.
  app.get('/api/auth/me', { schema: routeDoc({ tags: ['auth'], summary: 'Current account (empty for a guest)' }) }, async (request) => {
    const account = await findSessionCustomer(request)
    return { account: account ? toProfile(account) : undefined }
  })

  /** Every field is optional: the account page sends what it has, and `null` clears the picture or the address. */
  app.patch('/api/auth/me', { schema: routeDoc({ tags: ['auth'], summary: 'Update the current account', body: profileUpdateSchema }) }, async (request) => {
    const account = await requireSessionCustomer(request)
    const input = profileUpdateSchema.parse(request.body)

    if (input.email && input.email !== account.email) {
      const [taken] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, input.email))
      if (taken) throw new DomainError('email_taken', 'That email already has an account', { email: input.email })
    }

    const [updated] = await db.update(customers).set({ ...input, updatedAt: new Date() })
      .where(eq(customers.id, account.id)).returning(profileColumns)
    if (!updated) throw new Error(`Profile update for ${account.id} returned no row`)
    return toProfile(updated)
  })
}

function toProfile(account: AccountProfile): AccountProfile {
  return {
    id: account.id, email: account.email, firstName: account.firstName, lastName: account.lastName,
    phone: account.phone, role: account.role, avatar: account.avatar, shippingAddress: account.shippingAddress,
    acceptingRequests: account.acceptingRequests,
  }
}
