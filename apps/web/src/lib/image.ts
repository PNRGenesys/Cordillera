/**
 * The seed writes one canonical image URL per product (`/products/<slug>.jpg`), and a matching
 * `-thumb.jpg` (480px wide) is generated alongside it on disk. This derives the thumbnail URL by
 * convention instead of the API returning multiple sizes, to avoid a schema change for one field.
 */
export function toThumbUrl(url: string): string {
  // A picture created from the admin panel is stored in the database and travels inline as a data
  // URL, so there is no second file beside it to point at.
  if (url.startsWith('data:')) return url
  return url.replace(/(\.[a-z0-9]+)$/i, '-thumb$1')
}

/** The two widths the browser can pick from, or nothing when the picture has no separate thumbnail. */
export function toSrcSet(url: string): string | undefined {
  const thumb = toThumbUrl(url)
  return thumb === url ? undefined : `${thumb} 480w, ${url} 1200w`
}
