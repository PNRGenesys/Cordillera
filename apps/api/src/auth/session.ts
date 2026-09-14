import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { CookieSerializeOptions } from '@fastify/cookie'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
import { db } from '../db/client.js'
import { customerSessions, customers } from '../db/schema.js'
import { DomainError } from '../errors.js'

export const SESSION_COOKIE = 'cordillera_session'

const TOKEN_BYTES = 32

export type CustomerRole = 'customer' | 'admin' | 'artist'

export type AccountProfile = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: CustomerRole
  avatar: string | null
  shippingAddress: Record<string, string> | null
  /** Only meaningful for `role: 'artist'`: whether they currently show up for new custom design requests. */
  acceptingRequests: boolean
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function cookieOptions(expiresAt: Date): CookieSerializeOptions {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: config.sessionCookieSecure, expires: expiresAt }
}

/** Issues a new token, keeps only its hash and sends the token back as an httpOnly cookie. */
export async function openSession(customerId: string, reply: FastifyReply): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionTtlMs)
  await db.insert(customerSessions).values({ customerId, tokenHash: hashToken(token), expiresAt })
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
}

export async function closeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[SESSION_COOKIE]
  if (token) await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token)))
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}

/** Resolves the customer behind the cookie. Expired sessions are ignored instead of deleted, to keep reads cheap. */
export async function findSessionCustomer(request: FastifyRequest): Promise<AccountProfile | undefined> {
  const token = request.cookies[SESSION_COOKIE]
  if (!token) return undefined

  const [customer] = await db.select({
    id: customers.id, email: customers.email, firstName: customers.firstName, lastName: customers.lastName,
    phone: customers.phone, role: customers.role, avatar: customers.avatar, shippingAddress: customers.shippingAddress,
    acceptingRequests: customers.acceptingRequests,
  })
    .from(customerSessions).innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(and(eq(customerSessions.tokenHash, hashToken(token)), gt(customerSessions.expiresAt, new Date())))
  return customer
}

/** Guard for the routes a customer uses on their own account. */
export async function requireSessionCustomer(request: FastifyRequest): Promise<AccountProfile> {
  const account = await findSessionCustomer(request)
  if (!account) throw new DomainError('unauthenticated', 'Sign in to continue')
  return account
}

/** Guard for `/api/admin/*`: the session must exist and belong to an administrator. */
export async function requireAdmin(request: FastifyRequest): Promise<AccountProfile> {
  const account = await findSessionCustomer(request)
  if (!account) throw new DomainError('unauthenticated', 'Sign in to continue')
  if (account.role !== 'admin') throw new DomainError('forbidden', 'This account is not an administrator')
  return account
}

/** Guard for `/api/artist/*`: the session must exist and belong to an artist. */
export async function requireArtist(request: FastifyRequest): Promise<AccountProfile> {
  const account = await findSessionCustomer(request)
  if (!account) throw new DomainError('unauthenticated', 'Sign in to continue')
  if (account.role !== 'artist') throw new DomainError('forbidden', 'This account is not an artist')
  return account
}
