import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { Language } from '../lib/translations'

export type ProductRelease = 'available' | 'preorder' | 'coming_soon'

export type Collection = {
  id: string
  name: string
  slug: string
  tagline: string | null
  heroImageUrl: string | null
  releasedAt: string | null
  featured: boolean
}

export type Category = {
  id: string
  name: string
  slug: string
  position: number
}

/** `value` is the stored text used to filter; `label` is the same attribute in the language of the interface. */
export type CatalogFacet = { value: string; label: string }

export type CatalogProductSummary = {
  id: string
  slug: string
  name: string
  release: ProductRelease
  availableAt: string | null
  categorySlug: string | null
  collectionSlug: string | null
  collectionName: string | null
  minPriceCents: number
  maxPriceCents: number
  compareAtPriceCents: number | null
  colors: CatalogFacet[]
  sizes: CatalogFacet[]
  availableUnits: number
  imageUrl: string | null
}

export type CatalogPage = {
  page: number
  pageSize: number
  total: number
  items: CatalogProductSummary[]
}

export type CatalogAvailability = 'all' | 'in_stock'

/** `lang` travels in every catalog request: it is part of the cache key, so switching language refetches the copy. */
export type CatalogFilters = {
  lang: Language
  collection?: string
  category?: string
  color?: string
  size?: string
  availability?: CatalogAvailability
  page?: number
  pageSize?: number
}

export type ProductImage = { url: string; alt: string | null; position: number }

export type ProductVariant = {
  id: string
  sku: string
  name: string
  color: string | null
  size: string | null
  priceCents: number
  compareAtPriceCents: number | null
  availableUnits: number
}

export type ProductDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  composition: string | null
  release: ProductRelease
  availableAt: string | null
  categoryName: string | null
  categorySlug: string | null
  collectionName: string | null
  collectionSlug: string | null
  sizeGuideName: string | null
  sizeGuideUnit: string | null
  sizeGuideColumns: string[] | null
  sizeGuideRows: Record<string, string>[] | null
  images: ProductImage[]
  variants: ProductVariant[]
}

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

export type CartView = {
  sessionId: string
  currency: string
  items: CartLine[]
  itemCount: number
  subtotalCents: number
}

export type ShippingAddress = {
  line1: string
  line2?: string
  city: string
  region: string
  postalCode: string
  /** Filled in by the API while the store ships to a single country, so the forms never send it. */
  country?: string
}

export type AvailableArtist = { id: string; name: string; pendingCount: number }
export type AvailableArtistsResponse = { surchargePercent: number; artists: AvailableArtist[] }

export type CustomDesignRequestInput = {
  baseVariantId: string
  characterDescription?: string
  referenceImage: string
  artistId: string
  shippingAddress: ShippingAddress
}
export type CustomDesignRequestCreated = { requestId: string; orderNumber: string; totalCents: number; currency: string; artistName: string }
export type CustomDesignRequestStatus = 'pending' | 'delivered' | 'changes_requested' | 'approved'
export type CustomDesignRequestDetail = {
  id: string
  characterDescription: string | null
  referenceImageUrl: string
  finalDesignImageUrl: string | null
  estimatedDays: number | null
  revisionNote: string | null
  status: CustomDesignRequestStatus
  createdAt: string
  garmentName: string
}

export type ArtistQueueRequest = {
  id: string
  status: CustomDesignRequestStatus
  createdAt: string
  characterDescription: string | null
  referenceImageUrl: string
  finalDesignImageUrl: string | null
  estimatedDays: number | null
  revisionNote: string | null
  garmentName: string
  customerFirstName: string | null
  customerLastName: string | null
  customerEmail: string
}
export type ArtistStatus = { acceptingRequests: boolean }

export type NotificationKind = 'design_delivered' | 'changes_requested' | 'design_approved'
export type Notification = {
  id: string
  kind: NotificationKind
  relatedRequestId: string
  payload: Record<string, string>
  readAt: string | null
  createdAt: string
}

export type CheckoutInput = {
  sessionId: string
  email: string
  firstName: string
  lastName: string
  phone: string
  shippingAddress: ShippingAddress
}

export type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'fulfilled' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export type CustomerRole = 'customer' | 'admin' | 'artist'

export type AccountProfile = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  role: CustomerRole
  /** Square picture kept as a data URL; the store has no file hosting yet. */
  avatar: string | null
  shippingAddress: ShippingAddress | null
  /** Only meaningful for `role: 'artist'`: whether they currently show up for new custom design requests. */
  acceptingRequests: boolean
}

/** Every field is optional: the account page sends what it has, and a null clears the picture or the address. */
export type ProfileUpdate = {
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
  avatar?: string | null
  shippingAddress?: ShippingAddress | null
}

export type RegisterInput = {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

export type LoginInput = { email: string; password: string }

/** `account` is absent while browsing as a guest. */
export type AccountSession = { account?: AccountProfile }

export type ProductStatus = 'draft' | 'active' | 'archived'

export type AdminVariant = {
  id: string
  sku: string
  name: string
  color: string | null
  size: string | null
  priceCents: number
  compareAtPriceCents: number | null
  onHand: number
  reserved: number
  availableUnits: number
  lowStock: boolean
}

export type AdminProduct = {
  id: string
  slug: string
  name: string
  description: string | null
  composition: string | null
  status: ProductStatus
  release: ProductRelease
  categoryName: string | null
  collectionName: string | null
  imageUrl: string | null
  variants: AdminVariant[]
}

export type AdminOrderItem = { sku: string; name: string; quantity: number; unitPriceCents: number }

export type AdminOrder = {
  id: string
  number: string
  status: OrderStatus
  currency: string
  totalCents: number
  shippingAddress: Record<string, string>
  carrier: string | null
  trackingNumber: string | null
  createdAt: string
  customerEmail: string
  customerFirstName: string | null
  customerLastName: string | null
  customerPhone: string | null
  items: AdminOrderItem[]
}

export type AdminCustomer = { id: string; email: string; firstName: string | null; lastName: string | null; role: CustomerRole; acceptingRequests: boolean }
export type CustomerRoleUpdate = { id: string; role: CustomerRole }

export type ProductUpdate = { name?: string; description?: string; composition?: string; status?: ProductStatus; release?: ProductRelease }
export type ProductVariantCreate = { sku: string; name: string; priceCents: number; color?: string; size?: string; initialStock: number }
/** `image` is a data URL; the store has no file storage yet, so the picture is kept in the database. */
export type ProductCreate = {
  name: string
  slug: string
  description?: string
  composition?: string
  categoryId?: string
  collectionId?: string
  release: ProductRelease
  image?: string
  variants: ProductVariantCreate[]
}
/** `heroImage` is a data URL, for the same reason as a product picture. */
export type CollectionCreate = {
  name: string
  slug: string
  tagline?: string
  description?: string
  featured: boolean
  heroImage?: string
}
export type ProductDiscount = { id: string; discountPercent: number }
export type DiscountedVariant = { id: string; priceCents: number; compareAtPriceCents: number | null }
export type VariantUpdate = { name?: string; color?: string; size?: string; priceCents?: number; compareAtPriceCents?: number }
export type OrderUpdate = { status?: OrderStatus; carrier?: string; trackingNumber?: string }
export type InventoryAdjustment = { variantId: string; quantity: number; note: string }

export type CheckoutConfirmation = {
  number: string
  status: OrderStatus
  totalCents: number
  currency: string
  reservationExpiresInMinutes: number
}

function withoutUndefinedFilters(filters: CatalogFilters): Partial<CatalogFilters> {
  const entries = Object.entries(filters) as [keyof CatalogFilters, CatalogFilters[keyof CatalogFilters]][]
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as Partial<CatalogFilters>
}

export const catalogApi = createApi({
  reducerPath: 'catalogApi',
  // `credentials` sends the session cookie when the web app runs on a different origin than the API.
  baseQuery: fetchBaseQuery({ baseUrl: '/api/', credentials: 'include' }),
  tagTypes: ['Catalog', 'Cart', 'Account', 'Admin', 'CustomDesign', 'Artist', 'Notifications'],
  endpoints: (build) => ({
    getCollections: build.query<Collection[], Language>({
      query: (lang) => ({ url: 'collections', params: { lang } }),
      providesTags: ['Catalog'],
    }),
    getCategories: build.query<Category[], Language>({
      query: (lang) => ({ url: 'categories', params: { lang } }),
      providesTags: ['Catalog'],
    }),
    getProducts: build.query<CatalogPage, CatalogFilters>({
      query: (filters) => ({ url: 'products', params: withoutUndefinedFilters({ ...filters }) }),
      providesTags: ['Catalog'],
    }),
    getProduct: build.query<ProductDetail, { slug: string; lang: Language }>({
      query: ({ slug, lang }) => ({ url: `products/${slug}`, params: { lang } }),
      providesTags: ['Catalog'],
    }),
    getCart: build.query<CartView, { sessionId: string; lang: Language }>({
      query: ({ sessionId, lang }) => ({ url: `cart/${sessionId}`, params: { lang } }),
      providesTags: ['Cart'],
    }),
    addCartItem: build.mutation<CartView, { sessionId: string; variantId: string; quantity: number; lang: Language }>({
      query: ({ lang, ...body }) => ({ url: 'cart/items', method: 'POST', body, params: { lang } }),
      invalidatesTags: ['Cart'],
    }),
    updateCartItem: build.mutation<CartView, { sessionId: string; variantId: string; quantity: number; lang: Language }>({
      query: ({ lang, ...body }) => ({ url: 'cart/items', method: 'PATCH', body, params: { lang } }),
      invalidatesTags: ['Cart'],
    }),
    removeCartItem: build.mutation<CartView, { sessionId: string; variantId: string; lang: Language }>({
      query: ({ sessionId, variantId, lang }) => ({ url: 'cart/items', method: 'DELETE', params: { sessionId, variantId, lang } }),
      invalidatesTags: ['Cart'],
    }),
    checkout: build.mutation<CheckoutConfirmation, CheckoutInput>({
      query: (body) => ({ url: 'checkout', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    requestRestock: build.mutation<{ status: string }, { variantId: string; email?: string }>({
      query: (body) => ({ url: 'restock-requests', method: 'POST', body }),
    }),
    getAccount: build.query<AccountSession, void>({
      query: () => 'auth/me',
      providesTags: ['Account'],
    }),
    register: build.mutation<AccountProfile, RegisterInput>({
      query: (body) => ({ url: 'auth/register', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
    login: build.mutation<AccountProfile, LoginInput>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      invalidatesTags: ['Account'],
    }),
    updateProfile: build.mutation<AccountProfile, ProfileUpdate>({
      query: (changes) => ({ url: 'auth/me', method: 'PATCH', body: changes }),
      invalidatesTags: ['Account'],
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      invalidatesTags: ['Account'],
    }),
    getAdminProducts: build.query<AdminProduct[], void>({
      query: () => 'admin/products',
      providesTags: ['Admin'],
    }),
    createAdminProduct: build.mutation<AdminProduct, ProductCreate>({
      query: (body) => ({ url: 'admin/products', method: 'POST', body }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    createAdminCollection: build.mutation<Collection, CollectionCreate>({
      query: (body) => ({ url: 'admin/collections', method: 'POST', body }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    updateAdminProduct: build.mutation<AdminProduct, { id: string; changes: ProductUpdate }>({
      query: ({ id, changes }) => ({ url: `admin/products/${id}`, method: 'PATCH', body: changes }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    updateAdminVariant: build.mutation<AdminVariant, { id: string; changes: VariantUpdate }>({
      query: ({ id, changes }) => ({ url: `admin/variants/${id}`, method: 'PATCH', body: changes }),
      invalidatesTags: ['Admin', 'Catalog', 'Cart'],
    }),
    applyProductDiscount: build.mutation<DiscountedVariant[], ProductDiscount>({
      query: ({ id, discountPercent }) => ({ url: `admin/products/${id}/discount`, method: 'POST', body: { discountPercent } }),
      invalidatesTags: ['Admin', 'Catalog', 'Cart'],
    }),
    adjustInventory: build.mutation<{ onHand: number; reserved: number }, InventoryAdjustment>({
      query: (body) => ({ url: 'admin/inventory/adjustments', method: 'POST', body }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    getAdminOrders: build.query<AdminOrder[], void>({
      query: () => 'admin/orders',
      providesTags: ['Admin'],
    }),
    updateAdminOrder: build.mutation<AdminOrder, { id: string; changes: OrderUpdate }>({
      query: ({ id, changes }) => ({ url: `admin/orders/${id}`, method: 'PATCH', body: changes }),
      invalidatesTags: ['Admin', 'Catalog'],
    }),
    getAdminCustomers: build.query<AdminCustomer[], void>({
      query: () => 'admin/customers',
      providesTags: ['Admin'],
    }),
    updateCustomerRole: build.mutation<AdminCustomer, CustomerRoleUpdate>({
      query: ({ id, role }) => ({ url: `admin/customers/${id}/role`, method: 'PATCH', body: { role } }),
      invalidatesTags: ['Admin'],
    }),
    getCustomDesignArtists: build.query<AvailableArtistsResponse, void>({
      query: () => 'custom-design/artists',
      providesTags: ['CustomDesign'],
    }),
    submitCustomDesignRequest: build.mutation<CustomDesignRequestCreated, CustomDesignRequestInput>({
      query: (body) => ({ url: 'custom-design/requests', method: 'POST', body }),
      invalidatesTags: ['CustomDesign'],
    }),
    getCustomDesignRequest: build.query<CustomDesignRequestDetail, string>({
      query: (id) => `custom-design/requests/${id}`,
      providesTags: ['CustomDesign'],
    }),
    approveCustomDesignRequest: build.mutation<CustomDesignRequestDetail, string>({
      query: (id) => ({ url: `custom-design/requests/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['CustomDesign', 'Notifications'],
    }),
    requestDesignChanges: build.mutation<CustomDesignRequestDetail, { id: string; comment: string }>({
      query: ({ id, comment }) => ({ url: `custom-design/requests/${id}/request-changes`, method: 'POST', body: { comment } }),
      invalidatesTags: ['CustomDesign', 'Notifications'],
    }),
    getArtistStatus: build.query<ArtistStatus, void>({
      query: () => 'artist/status',
      providesTags: ['Artist'],
    }),
    updateArtistStatus: build.mutation<ArtistStatus, boolean>({
      query: (acceptingRequests) => ({ url: 'artist/status', method: 'PATCH', body: { acceptingRequests } }),
      invalidatesTags: ['Artist', 'CustomDesign'],
    }),
    getArtistRequests: build.query<ArtistQueueRequest[], void>({
      query: () => 'artist/requests',
      providesTags: ['Artist'],
    }),
    updateArtistEstimate: build.mutation<ArtistQueueRequest, { id: string; estimatedDays: number }>({
      query: ({ id, estimatedDays }) => ({ url: `artist/requests/${id}/estimate`, method: 'PATCH', body: { estimatedDays } }),
      invalidatesTags: ['Artist'],
    }),
    deliverDesign: build.mutation<ArtistQueueRequest, { id: string; finalDesignImage: string }>({
      query: ({ id, finalDesignImage }) => ({ url: `artist/requests/${id}/deliver`, method: 'POST', body: { finalDesignImage } }),
      invalidatesTags: ['Artist', 'Notifications'],
    }),
    getNotifications: build.query<Notification[], void>({
      query: () => 'notifications',
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation<{ id: string; readAt: string }, string>({
      query: (id) => ({ url: `notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
})

export const {
  useGetCollectionsQuery,
  useGetCategoriesQuery,
  useGetProductsQuery,
  useGetProductQuery,
  useGetCartQuery,
  useAddCartItemMutation,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
  useCheckoutMutation,
  useRequestRestockMutation,
  useGetAccountQuery,
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useUpdateProfileMutation,
  useGetAdminProductsQuery,
  useCreateAdminCollectionMutation,
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useUpdateAdminVariantMutation,
  useApplyProductDiscountMutation,
  useAdjustInventoryMutation,
  useGetAdminOrdersQuery,
  useUpdateAdminOrderMutation,
  useGetAdminCustomersQuery,
  useUpdateCustomerRoleMutation,
  useGetCustomDesignArtistsQuery,
  useSubmitCustomDesignRequestMutation,
  useGetCustomDesignRequestQuery,
  useApproveCustomDesignRequestMutation,
  useRequestDesignChangesMutation,
  useGetArtistStatusQuery,
  useUpdateArtistStatusMutation,
  useGetArtistRequestsQuery,
  useUpdateArtistEstimateMutation,
  useDeliverDesignMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
} = catalogApi
