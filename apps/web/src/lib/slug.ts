/**
 * Turns a product name into the slug the API accepts (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Accents are
 * stripped rather than dropped, so "Camiseta Dálmata" becomes `camiseta-dalmata` instead of losing
 * the letter, and anything else that is not a letter or a digit becomes a single separator.
 */
export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
