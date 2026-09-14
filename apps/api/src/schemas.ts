import { z } from 'zod'
import { config } from './config.js'
import { LOCALES } from './i18n.js'

export const sessionSchema = z.object({ sessionId: z.string().uuid() })
export const slugSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) })

/** Every read of catalog copy accepts the language of the interface. */
export const localeQuerySchema = z.object({ lang: z.enum(LOCALES).default('es') })

export const catalogQuerySchema = localeQuerySchema.extend({
  collection: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  availability: z.enum(['all', 'in_stock']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(config.catalogMaxPageSize).default(config.catalogPageSize),
})

export const cartItemSchema = sessionSchema.extend({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(config.cartMaxQuantityPerItem),
})
export const cartItemUpdateSchema = cartItemSchema.extend({ quantity: z.number().int().min(0).max(config.cartMaxQuantityPerItem) })
export const cartItemRemovalSchema = sessionSchema.extend({ variantId: z.string().uuid() })

/**
 * Shared by the checkout and by the address a customer keeps on file. The country is not asked for
 * while the store ships to a single one, so it defaults to `STORE_COUNTRY` instead of being required.
 */
export const shippingAddressSchema = z.object({
  line1: z.string().min(3).max(180),
  line2: z.string().max(180).optional(),
  city: z.string().min(2).max(120),
  region: z.string().min(2).max(120),
  postalCode: z.string().min(2).max(20),
  country: z.string().length(2).default(config.country),
})

export const checkoutSchema = sessionSchema.extend({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(40),
  shippingAddress: shippingAddressSchema,
})

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(config.passwordMinLength).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(40).optional(),
})
export const loginSchema = z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) })

/**
 * Every picture travels as a data URL, so the limit is on the encoded text rather than on the file.
 * Each caller passes its own ceiling: an avatar is square-cropped and small, while a design, a
 * product or a collection picture keeps its whole frame and needs more room.
 */
function dataUrlImage(maxCharacters: number) {
  return z.string()
    .max(maxCharacters)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/, { message: 'The picture must be a PNG, JPEG or WebP data URL' })
}

const avatarSchema = dataUrlImage(config.avatarMaxCharacters)

/**
 * A field left empty in the form means the customer removed what was there, so it clears the column
 * instead of failing the minimum length.
 */
function clearable(schema: z.ZodString) {
  return z.union([schema, z.literal('')]).transform((value) => value || null).optional()
}

/** Every field is optional so the account page can save only what changed; `null` clears the picture. */
export const profileUpdateSchema = z.object({
  email: z.string().email().max(320).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: clearable(z.string().min(7).max(40)),
  avatar: avatarSchema.nullable().optional(),
  shippingAddress: shippingAddressSchema.nullable().optional(),
})

/** A signed in customer joins the restock list with the address of their account, so the email is optional. */
export const restockRequestSchema = z.object({ variantId: z.string().uuid(), email: z.string().email().optional() })

export const ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'] as const

export const idParamSchema = z.object({ id: z.string().uuid() })

/** Every admin update is partial, but an empty body would be a silent no-op. */
function requireAtLeastOneField<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  return schema.refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' })
}

export const productUpdateSchema = requireAtLeastOneField(z.object({
  name: z.string().min(2).max(180).optional(),
  description: z.string().max(10_000).optional(),
  composition: z.string().max(240).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  release: z.enum(['available', 'preorder', 'coming_soon']).optional(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
}))

export const variantUpdateSchema = requireAtLeastOneField(z.object({
  name: z.string().min(1).max(180).optional(),
  color: z.string().max(60).optional(),
  size: z.string().max(30).optional(),
  priceCents: z.number().int().positive().optional(),
  compareAtPriceCents: z.number().int().positive().optional(),
}))

/** Business rule from the store owner: a product discount never exceeds 30%. */
export const MAX_DISCOUNT_PERCENT = 30

export const productDiscountSchema = z.object({
  discountPercent: z.number().int().min(0).max(MAX_DISCOUNT_PERCENT),
})

export const orderUpdateSchema = requireAtLeastOneField(z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  carrier: z.string().max(120).optional(),
  trackingNumber: z.string().max(120).optional(),
}))

export const inventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().refine((value) => value !== 0, { message: 'Quantity must not be zero' }),
  note: z.string().min(3).max(500),
})

export const CUSTOMER_ROLES = ['customer', 'admin', 'artist'] as const

export const customerRoleUpdateSchema = z.object({ role: z.enum(CUSTOMER_ROLES) })

const designImageSchema = dataUrlImage(config.customDesignImageMaxCharacters)

/** `artistId` is either a specific artist or the literal `'fastest'`, resolved server-side to whoever has the shortest queue. */
export const customDesignRequestSchema = z.object({
  baseVariantId: z.string().uuid(),
  characterDescription: z.string().max(2_000).optional(),
  referenceImage: designImageSchema,
  artistId: z.union([z.string().uuid(), z.literal('fastest')]),
  shippingAddress: shippingAddressSchema,
})

export const requestChangesSchema = z.object({ comment: z.string().min(1).max(1_000) })

export const deliverDesignSchema = z.object({ finalDesignImage: designImageSchema })

export const estimateSchema = z.object({ estimatedDays: z.number().int().min(1).max(60) })

export const artistStatusSchema = z.object({ acceptingRequests: z.boolean() })

export const productCreateSchema = z.object({
  name: z.string().min(2).max(180),
  slug: slugSchema.shape.slug,
  description: z.string().max(10_000).optional(),
  composition: z.string().max(240).optional(),
  /**
   * The picture of a product created from the panel, as a data URL. The catalogue images that come
   * from the seed are static files under `/products`, but the browser cannot write one, and the store
   * has no file storage yet, so it is kept in the database like the avatar and the design pictures.
   */
  image: dataUrlImage(config.catalogImageMaxCharacters).optional(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  release: z.enum(['available', 'preorder', 'coming_soon']).default('available'),
  variants: z.array(z.object({
    sku: z.string().min(1).max(80),
    name: z.string().min(1).max(180),
    priceCents: z.number().int().positive(),
    color: z.string().max(60).optional(),
    size: z.string().max(30).optional(),
    initialStock: z.number().int().min(0).default(0),
  })).min(1),
})

/**
 * A collection groups a release. `featured` is what the home page leads with, and `heroImage` is the
 * same data URL story as a product picture: there is no file storage yet, so it lives in the database.
 */
export const collectionCreateSchema = z.object({
  name: z.string().min(2).max(140),
  slug: slugSchema.shape.slug,
  tagline: z.string().max(240).optional(),
  description: z.string().max(10_000).optional(),
  featured: z.boolean().default(false),
  heroImage: dataUrlImage(config.catalogImageMaxCharacters).optional(),
})
