import { describe, expect, it } from 'vitest'
import type { CatalogProductSummary } from '../store/catalog-api'
import { buildHeroSlides, driftFor, HERO_PRESENTATION_URL, HERO_SLIDE_COUNT, type HeroSlide } from './hero-slides'

function product(slug: string, imageUrl: string | null): CatalogProductSummary {
  return {
    id: slug,
    slug,
    name: `Producto ${slug}`,
    release: 'available',
    availableAt: null,
    categorySlug: null,
    collectionSlug: null,
    collectionName: null,
    minPriceCents: 100,
    maxPriceCents: 100,
    compareAtPriceCents: null,
    colors: [],
    sizes: [],
    availableUnits: 1,
    imageUrl,
  }
}

describe('buildHeroSlides', () => {
  const ALT = 'Ficha de la linea'

  it('returns the number of slides the keyframes expect', () => {
    const slides = buildHeroSlides([product('a', '/a.jpg'), product('b', '/b.jpg')], ALT)
    expect(slides).toHaveLength(HERO_SLIDE_COUNT)
  })

  it('opens with the line sheet and then keeps the order the catalog returned', () => {
    const slides = buildHeroSlides([product('a', '/a.jpg'), product('b', '/b.jpg'), product('c', '/c.jpg'), product('d', '/d.jpg')], ALT)
    expect(slides.map((slide) => slide.url)).toEqual([HERO_PRESENTATION_URL, '/a.jpg', '/b.jpg', '/c.jpg'])
  })

  it('cycles what it has when there are fewer images than slides', () => {
    const slides = buildHeroSlides([product('a', '/a.jpg')], ALT)
    expect(slides.map((slide) => slide.url)).toEqual([HERO_PRESENTATION_URL, '/a.jpg', HERO_PRESENTATION_URL, '/a.jpg'])
  })

  it('uses the product name as the alternative text', () => {
    expect(buildHeroSlides([product('a', '/a.jpg')], ALT)[1]).toEqual({ url: '/a.jpg', alt: 'Producto a', fit: 'cover' })
  })

  it('skips products without an image instead of leaving a gap', () => {
    const slides = buildHeroSlides([product('a', null), product('b', '/b.jpg')], ALT)
    expect(slides.map((slide) => slide.url)).toEqual([HERO_PRESENTATION_URL, '/b.jpg', HERO_PRESENTATION_URL, '/b.jpg'])
  })

  it('leaves the line sheet on screen when no product has an image', () => {
    const slides = buildHeroSlides([product('a', null)], ALT)
    expect(slides).toEqual(Array.from({ length: HERO_SLIDE_COUNT }, () => ({ url: HERO_PRESENTATION_URL, alt: ALT, fit: 'contain' })))
  })
})

describe('driftFor', () => {
  function slide(url: string): HeroSlide {
    return { url, alt: url, fit: 'cover' }
  }

  function amounts(url: string, index: number): number[] {
    const drift = driftFor(slide(url), index)
    return [drift.fromX, drift.fromY, drift.toX, drift.toY].map((value) => Number.parseFloat(value))
  }

  it('gives the same slide the same direction every time, so a re-render never makes it jump', () => {
    expect(driftFor(slide('/a.jpg'), 0)).toEqual(driftFor(slide('/a.jpg'), 0))
  })

  it('starts part way through the travel instead of at rest', () => {
    const [fromX, fromY, toX, toY] = amounts('/a.jpg', 0)
    expect(Math.abs(fromX ?? 0) + Math.abs(fromY ?? 0)).toBeGreaterThan(0)
    expect(Math.abs(fromX ?? 0)).toBeLessThan(Math.abs(toX ?? 0) || Infinity)
    expect(Math.abs(fromY ?? 0)).toBeLessThan(Math.abs(toY ?? 0) || Infinity)
  })

  it('keeps the travel small enough for the zoom to cover it', () => {
    for (const [index, url] of ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg'].entries()) {
      for (const amount of amounts(url, index)) expect(Math.abs(amount)).toBeLessThanOrEqual(2)
    }
  })

  it('spreads slides over different directions instead of moving them all the same way', () => {
    const directions = new Set(['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg', '/f.jpg', '/g.jpg', '/h.jpg'].map((url, index) => {
      const drift = driftFor(slide(url), index)
      return `${drift.toX}|${drift.toY}`
    }))
    expect(directions.size).toBeGreaterThan(2)
  })
})

describe('driftFor on a slide shown whole', () => {
  it('grows the line sheet into place without ever cropping it', () => {
    const drift = driftFor({ url: HERO_PRESENTATION_URL, alt: 'ficha', fit: 'contain' }, 0)

    expect(drift).toEqual({ fromX: '0%', fromY: '0%', toX: '0%', toY: '0%', scaleFrom: '0.95', scaleTo: '1' })
  })
})
