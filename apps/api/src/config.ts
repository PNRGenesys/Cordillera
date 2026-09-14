const MINUTE_IN_MS = 60 * 1000
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Reads a boolean env var: accepts `true`/`false` (case-insensitive); anything unset uses the fallback. */
function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  return raw.toLowerCase() === 'true'
}

export const config = {
  currency: process.env.STORE_CURRENCY ?? 'COP',
  /** The store only ships inside one country for now, so addresses take it by default. */
  country: process.env.STORE_COUNTRY ?? 'CO',
  reservationTtlMs: readNumber('RESERVATION_TTL_MINUTES', 20) * MINUTE_IN_MS,
  catalogPageSize: readNumber('CATALOG_PAGE_SIZE', 24),
  catalogMaxPageSize: readNumber('CATALOG_MAX_PAGE_SIZE', 60),
  cartMaxQuantityPerItem: readNumber('CART_MAX_QUANTITY_PER_ITEM', 20),
  lowStockThreshold: readNumber('LOW_STOCK_THRESHOLD', 5),
  sessionTtlMs: readNumber('SESSION_TTL_DAYS', 30) * DAY_IN_MS,
  passwordMinLength: readNumber('PASSWORD_MIN_LENGTH', 8),
  /** Longest data URL accepted for a profile picture; the web app shrinks the file before sending it. */
  avatarMaxCharacters: readNumber('AVATAR_MAX_CHARACTERS', 200_000),
  /**
   * How much a custom design (fursona) request costs on top of the base garment's normal price.
   * Placeholder until artists and administration agree on a final figure (see docs/pending-work.md).
   */
  customDesignSurchargePercent: readNumber('CUSTOM_DESIGN_SURCHARGE_PERCENT', 50),
  /** Longest data URL accepted for a fursona reference photo or a finished design; not square-cropped like an avatar, so it allows more room. */
  customDesignImageMaxCharacters: readNumber('CUSTOM_DESIGN_IMAGE_MAX_CHARACTERS', 600_000),
  isProduction: process.env.NODE_ENV === 'production',
  /**
   * Whether the session cookie carries the `Secure` flag. It must track "am I served over
   * HTTPS?", not "is this a production build": a production container served over plain HTTP
   * (e.g. the local container group, or behind a TLS-terminating proxy that forwards HTTP)
   * would otherwise emit a Secure cookie the browser refuses to send back, breaking login.
   * Defaults to `isProduction` when unset, so existing environments keep their current behaviour.
   */
  sessionCookieSecure: readBoolean('SESSION_COOKIE_SECURE', process.env.NODE_ENV === 'production'),
}
