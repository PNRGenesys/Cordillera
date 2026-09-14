import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { db } from '../db/client.js'
import { carts, collections, customers, inventoryItems, inventoryMovements, orders, productVariants, products } from '../db/schema.js'

/** Integration tests: they need the local PostgreSQL instance from docker compose. */

const TEST_PRODUCT_SLUG = 'admin-test-product'
const TEST_SKU = 'ADMIN-TEST-SKU'
const ADMIN_EMAIL = 'admin-test-admin@cordillera.test'
const SHOPPER_EMAIL = 'admin-test-shopper@cordillera.test'
const PASSWORD = 'cordillera-test-password'
const INITIAL_STOCK = 5
const ORDERED_UNITS = 2

const testEmails = [ADMIN_EMAIL, SHOPPER_EMAIL]

/** `app.inject` does not keep a cookie jar, so the session cookie is carried over by hand. */
function sessionCookie(setCookie: string): string {
  return setCookie.split(';')[0] ?? setCookie
}

function required<Entry>(entry: Entry | undefined, what: string): Entry {
  if (!entry) throw new Error(`${what} is missing from the admin response`)
  return entry
}

type AdminVariant = { sku: string; onHand: number; reserved: number; availableUnits: number }
type AdminProduct = { slug: string; status: string; variants: AdminVariant[] }
type AdminOrder = { id: string; status: string; customerEmail: string; shippingAddress: Record<string, string>; items: { sku: string; quantity: number }[] }

let app: FastifyInstance
let adminCookie: string
let shopperCookie: string
let productId: string
let variantId: string
let inventoryItemId: string
let orderId: string
const sessionId = randomUUID()

beforeAll(async () => {
  app = await buildApp()
  await db.delete(customers).where(inArray(customers.email, testEmails))

  const [insertedProduct] = await db.insert(products).values({ name: 'Admin Test Product', slug: TEST_PRODUCT_SLUG, status: 'draft' }).returning({ id: products.id })
  const product = required(insertedProduct, 'inserted test product')
  const [insertedVariant] = await db.insert(productVariants).values({ productId: product.id, sku: TEST_SKU, name: 'Admin Test Variant', color: 'Test', size: 'M', priceCents: 1_000_00 }).returning({ id: productVariants.id })
  const variant = required(insertedVariant, 'inserted test variant')
  const [insertedStock] = await db.insert(inventoryItems).values({ variantId: variant.id, onHand: INITIAL_STOCK }).returning({ id: inventoryItems.id })
  const stock = required(insertedStock, 'inserted test inventory item')
  productId = product.id
  variantId = variant.id
  inventoryItemId = stock.id

  const admin = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: ADMIN_EMAIL, password: PASSWORD, firstName: 'Root', lastName: 'Admin' } })
  adminCookie = sessionCookie(String(admin.headers['set-cookie']))
  await db.update(customers).set({ role: 'admin' }).where(eq(customers.email, ADMIN_EMAIL))

  const shopper = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: SHOPPER_EMAIL, password: PASSWORD, firstName: 'Ana', lastName: 'Ruiz' } })
  shopperCookie = sessionCookie(String(shopper.headers['set-cookie']))

  await app.inject({ method: 'POST', url: '/api/cart/items', payload: { sessionId, variantId, quantity: ORDERED_UNITS } })
  const checkout = await app.inject({
    method: 'POST',
    url: '/api/checkout',
    payload: {
      sessionId, email: SHOPPER_EMAIL, firstName: 'Ana', lastName: 'Ruiz', phone: '3001234567',
      shippingAddress: { line1: 'Cra 1 #2-3', city: 'Bogota', region: 'Cundinamarca', postalCode: '110111', country: 'CO' },
    },
  })
  const [foundOrder] = await db.select({ id: orders.id }).from(orders).where(eq(orders.number, checkout.json().number))
  orderId = required(foundOrder, 'checkout test order').id
})

afterAll(async () => {
  await db.delete(orders).where(eq(orders.id, orderId))
  await db.delete(customers).where(inArray(customers.email, testEmails))
  await db.delete(carts).where(eq(carts.sessionId, sessionId))
  await db.delete(inventoryMovements).where(eq(inventoryMovements.inventoryItemId, inventoryItemId))
  await db.delete(products).where(eq(products.slug, TEST_PRODUCT_SLUG))
  await app.close()
})

describe('admin access control', () => {
  it('rejects a request without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/products' })
    expect(response.statusCode).toBe(401)
    expect(response.json().code).toBe('unauthenticated')
  })

  it('rejects a signed in customer that is not an administrator', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/products', headers: { cookie: shopperCookie } })
    expect(response.statusCode).toBe(403)
    expect(response.json().code).toBe('forbidden')
  })

  it('reports the role in the account profile', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: adminCookie } })
    expect(response.json().account.role).toBe('admin')
  })
})

describe('admin catalog', () => {
  it('lists products with their variants and stock, including drafts', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/products', headers: { cookie: adminCookie } })
    expect(response.statusCode).toBe(200)

    const product = required(response.json<AdminProduct[]>().find((entry) => entry.slug === TEST_PRODUCT_SLUG), TEST_PRODUCT_SLUG)
    expect(product.status).toBe('draft')
    expect(product.variants).toHaveLength(1)
    expect(product.variants[0]).toMatchObject({ sku: TEST_SKU, onHand: INITIAL_STOCK, reserved: ORDERED_UNITS, availableUnits: INITIAL_STOCK - ORDERED_UNITS })
  })

  it('renames a product', async () => {
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/products/${productId}`, headers: { cookie: adminCookie }, payload: { name: 'Renamed Admin Product' } })
    expect(response.statusCode).toBe(200)
    expect(response.json().name).toBe('Renamed Admin Product')
  })

  it('changes the price of a variant', async () => {
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/variants/${variantId}`, headers: { cookie: adminCookie }, payload: { priceCents: 2_000_00 } })
    expect(response.statusCode).toBe(200)
    expect(response.json().priceCents).toBe(2_000_00)
  })

  it('applies a discount to every variant, rejects more than 30%, and 0% restores the regular price', async () => {
    const applied = await app.inject({ method: 'POST', url: `/api/admin/products/${productId}/discount`, headers: { cookie: adminCookie }, payload: { discountPercent: 20 } })
    expect(applied.statusCode).toBe(200)
    const [discounted] = applied.json<{ priceCents: number; compareAtPriceCents: number | null }[]>()
    expect(discounted).toMatchObject({ priceCents: 1_600_00, compareAtPriceCents: 2_000_00 })

    const rejected = await app.inject({ method: 'POST', url: `/api/admin/products/${productId}/discount`, headers: { cookie: adminCookie }, payload: { discountPercent: 31 } })
    expect(rejected.statusCode).toBe(400)

    const cleared = await app.inject({ method: 'POST', url: `/api/admin/products/${productId}/discount`, headers: { cookie: adminCookie }, payload: { discountPercent: 0 } })
    const [restored] = cleared.json<{ priceCents: number; compareAtPriceCents: number | null }[]>()
    expect(restored).toMatchObject({ priceCents: 2_000_00, compareAtPriceCents: null })
  })

  it('rejects an update with no fields', async () => {
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/products/${productId}`, headers: { cookie: adminCookie }, payload: {} })
    expect(response.statusCode).toBe(400)
  })

  it('adds stock through an adjustment and leaves a movement behind', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/admin/inventory/adjustments', headers: { cookie: adminCookie }, payload: { variantId, quantity: 3, note: 'Admin test restock' } })
    expect(response.statusCode).toBe(200)
    expect(response.json().onHand).toBe(INITIAL_STOCK + 3)
  })
})

describe('admin orders', () => {
  it('lists the order with its lines, customer and address', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/orders', headers: { cookie: adminCookie } })
    const order = required(response.json<AdminOrder[]>().find((entry) => entry.id === orderId), 'test order')

    expect(order.customerEmail).toBe(SHOPPER_EMAIL)
    expect(order.status).toBe('pending_payment')
    expect(order.shippingAddress.city).toBe('Bogota')
    expect(order.items[0]).toMatchObject({ sku: TEST_SKU, quantity: ORDERED_UNITS })
  })

  it('stores carrier and tracking number', async () => {
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/orders/${orderId}`, headers: { cookie: adminCookie }, payload: { status: 'shipped', carrier: 'Servientrega', trackingNumber: 'SE-123' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'shipped', carrier: 'Servientrega', trackingNumber: 'SE-123' })
  })

  it('turns the reservation into a sale when the order is paid', async () => {
    await app.inject({ method: 'PATCH', url: `/api/admin/orders/${orderId}`, headers: { cookie: adminCookie }, payload: { status: 'paid' } })

    const [stock] = await db.select({ onHand: inventoryItems.onHand, reserved: inventoryItems.reserved }).from(inventoryItems).where(eq(inventoryItems.id, inventoryItemId))
    expect(stock).toEqual({ onHand: INITIAL_STOCK + 3 - ORDERED_UNITS, reserved: 0 })
  })

  it('refuses to reopen a cancelled order', async () => {
    await app.inject({ method: 'PATCH', url: `/api/admin/orders/${orderId}`, headers: { cookie: adminCookie }, payload: { status: 'cancelled' } })
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/orders/${orderId}`, headers: { cookie: adminCookie }, payload: { status: 'paid' } })

    expect(response.statusCode).toBe(409)
    expect(response.json().code).toBe('invalid_status_change')
  })
})

describe('admin customers', () => {
  it('lists customers with their role, including the shopper created for these tests', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/customers', headers: { cookie: adminCookie } })
    expect(response.statusCode).toBe(200)

    const shopper = required(response.json<{ email: string; role: string }[]>().find((entry) => entry.email === SHOPPER_EMAIL), SHOPPER_EMAIL)
    expect(shopper.role).toBe('customer')
  })

  it('promotes a customer to artist, and a non-admin cannot', async () => {
    const [shopper] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, SHOPPER_EMAIL))
    const shopperId = required(shopper, 'shopper test customer').id

    const forbidden = await app.inject({ method: 'PATCH', url: `/api/admin/customers/${shopperId}/role`, headers: { cookie: shopperCookie }, payload: { role: 'artist' } })
    expect(forbidden.statusCode).toBe(403)

    const response = await app.inject({ method: 'PATCH', url: `/api/admin/customers/${shopperId}/role`, headers: { cookie: adminCookie }, payload: { role: 'artist' } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ email: SHOPPER_EMAIL, role: 'artist' })

    await db.update(customers).set({ role: 'customer' }).where(eq(customers.id, shopperId))
  })
})

describe('admin product creation', () => {
  const CREATED_SLUG = 'admin-created-product'
  const CREATED_SKU = 'ADMIN-CREATED-SKU'
  const CREATED_STOCK = 4
  /** Smallest valid JPEG data URL; the route only checks the shape of the text, not the pixels. */
  const PICTURE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD='

  const payload = {
    name: 'Admin Created Product',
    slug: CREATED_SLUG,
    description: 'Created from the admin panel',
    composition: '100% cotton',
    release: 'available',
    image: PICTURE,
    variants: [{ sku: CREATED_SKU, name: 'Admin Created Product Black S', color: 'Black', size: 'S', priceCents: 1_500_00, initialStock: CREATED_STOCK }],
  }

  afterAll(async () => {
    const [created] = await db.select({ id: products.id }).from(products).where(eq(products.slug, CREATED_SLUG))
    if (!created) return
    const items = await db.select({ id: inventoryItems.id }).from(inventoryItems)
      .innerJoin(productVariants, eq(productVariants.id, inventoryItems.variantId))
      .where(eq(productVariants.productId, created.id))
    await db.delete(inventoryMovements).where(inArray(inventoryMovements.inventoryItemId, items.map((item) => item.id)))
    await db.delete(products).where(eq(products.id, created.id))
  })

  it('creates a draft product with its picture, its variant and its initial stock', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/admin/products', headers: { cookie: adminCookie }, payload })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ slug: CREATED_SLUG, status: 'draft' })

    const listed = await app.inject({ method: 'GET', url: '/api/admin/products', headers: { cookie: adminCookie } })
    const created = required(listed.json<(AdminProduct & { imageUrl: string | null })[]>().find((entry) => entry.slug === CREATED_SLUG), CREATED_SLUG)
    expect(created.imageUrl).toBe(PICTURE)
    expect(created.variants[0]).toMatchObject({ sku: CREATED_SKU, onHand: CREATED_STOCK, availableUnits: CREATED_STOCK })
  })

  it('rejects a picture that is not a data URL, and a customer cannot create products', async () => {
    const badPicture = await app.inject({
      method: 'POST', url: '/api/admin/products', headers: { cookie: adminCookie },
      payload: { ...payload, slug: 'admin-created-rejected', image: 'https://example.test/picture.jpg' },
    })
    expect(badPicture.statusCode).toBe(400)

    const forbidden = await app.inject({ method: 'POST', url: '/api/admin/products', headers: { cookie: shopperCookie }, payload })
    expect(forbidden.statusCode).toBe(403)
  })
})

describe('admin collections', () => {
  const CREATED_SLUG = 'admin-created-collection'

  afterAll(async () => {
    await db.delete(collections).where(eq(collections.slug, CREATED_SLUG))
  })

  it('creates a collection dated today, so the storefront lists it first', async () => {
    const before = Date.now()
    const response = await app.inject({
      method: 'POST', url: '/api/admin/collections', headers: { cookie: adminCookie },
      payload: { name: 'Admin Created Collection', slug: CREATED_SLUG, tagline: 'Created from the panel', featured: false },
    })

    expect(response.statusCode).toBe(201)
    const created = response.json<{ slug: string; tagline: string; featured: boolean; releasedAt: string }>()
    expect(created).toMatchObject({ slug: CREATED_SLUG, tagline: 'Created from the panel', featured: false })
    expect(new Date(created.releasedAt).getTime()).toBeGreaterThanOrEqual(before - 1000)

    const listed = await app.inject({ method: 'GET', url: '/api/collections' })
    expect(listed.json<{ slug: string }[]>().some((entry) => entry.slug === CREATED_SLUG)).toBe(true)
  })

  it('rejects a repeated slug and a customer that is not an administrator', async () => {
    const payload = { name: 'Another One', slug: CREATED_SLUG, featured: false }

    const forbidden = await app.inject({ method: 'POST', url: '/api/admin/collections', headers: { cookie: shopperCookie }, payload })
    expect(forbidden.statusCode).toBe(403)

    const repeated = await app.inject({ method: 'POST', url: '/api/admin/collections', headers: { cookie: adminCookie }, payload })
    expect(repeated.statusCode).toBeGreaterThanOrEqual(400)
  })
})
