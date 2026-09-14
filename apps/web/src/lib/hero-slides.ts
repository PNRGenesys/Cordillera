import type { CatalogProductSummary } from '../store/catalog-api'

/** The crossfade keyframes in `HeroSlideshow` are written for exactly this many slides. */
export const HERO_SLIDE_COUNT = 4

/** Seconds each slide owns; the whole cycle lasts `HERO_SLIDE_COUNT * HERO_SLIDE_SECONDS`. */
export const HERO_SLIDE_SECONDS = 5

/**
 * `contain` is for an image that has to be read whole, such as the line sheet: the panel shows all of it
 * instead of filling itself with the middle. Product photography fills the panel with `cover`.
 */
export type HeroSlide = { url: string; alt: string; fit: 'cover' | 'contain' }

/** How far a slide travels, as a percentage of its own size, by the time it leaves. */
const DRIFT_DISTANCE_PERCENT = 2

/**
 * Portion of the travel already done when the slide appears. Without it a slide would enter with the
 * effect still at zero next to the one leaving, which is fully drifted, and the swap would show.
 */
const DRIFT_HEAD_START = 0.4

/** Sideways, up, down and the four diagonals. */
const DRIFT_DIRECTIONS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
] as const

/** How much the slide is zoomed when it appears and when it leaves. */
const ZOOM_FROM = '1.04'
const ZOOM_TO = '1.09'

export type HeroDrift = { fromX: string; fromY: string; toX: string; toY: string; scaleFrom: string; scaleTo: string }

/**
 * A slide that has to be read whole grows into place instead: it cannot be zoomed past its own size,
 * because the panel would crop the very thing it is there to show. It does not travel either, since
 * which side has room to move into depends on the shape of the panel.
 */
const CONTAIN_DRIFT: HeroDrift = { fromX: '0%', fromY: '0%', toX: '0%', toY: '0%', scaleFrom: '0.95', scaleTo: '1' }

/** Stable hash of the slide, so the direction looks random but never changes between renders. */
function hashOf(url: string, index: number): number {
  let hash = index + 1
  for (const character of url) hash = (hash * 31 + character.charCodeAt(0)) % 100_000
  return hash
}

function percent(direction: number, ratio: number): string {
  return `${(direction * DRIFT_DISTANCE_PERCENT * ratio).toFixed(2)}%`
}

/**
 * Picks the direction each slide drifts towards. Two slides in a row rarely move the same way, and the
 * same slide always moves the same way, so nothing jumps when React re-renders the hero.
 */
export function driftFor(slide: HeroSlide, index: number): HeroDrift {
  if (slide.fit === 'contain') return CONTAIN_DRIFT
  const direction = DRIFT_DIRECTIONS[hashOf(slide.url, index) % DRIFT_DIRECTIONS.length] ?? DRIFT_DIRECTIONS[0]
  return {
    fromX: percent(direction.x, DRIFT_HEAD_START),
    fromY: percent(direction.y, DRIFT_HEAD_START),
    toX: percent(direction.x, 1),
    toY: percent(direction.y, 1),
    scaleFrom: ZOOM_FROM,
    scaleTo: ZOOM_TO,
  }
}

/** The line sheet, shown whole: it presents the range before the rotation moves on to the latest pieces. */
export const HERO_PRESENTATION_URL = '/hero/cordillera-line.jpg'

/**
 * Builds a fixed length list: the line sheet first, then the latest products that have an image. Shorter
 * lists are padded by cycling what is available, so the keyframes always find a slide and an empty catalog
 * simply leaves the sheet on screen.
 */
export function buildHeroSlides(products: CatalogProductSummary[], presentationAlt: string): HeroSlide[] {
  const presentation: HeroSlide = { url: HERO_PRESENTATION_URL, alt: presentationAlt, fit: 'contain' }
  const available: HeroSlide[] = [
    presentation,
    ...products.flatMap((product) => (product.imageUrl ? [{ url: product.imageUrl, alt: product.name, fit: 'cover' as const }] : [])),
  ]
  return Array.from({ length: HERO_SLIDE_COUNT }, (_, index) => available[index % available.length] ?? presentation)
}
