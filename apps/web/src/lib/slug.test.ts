import { describe, expect, it } from 'vitest'
import { toSlug } from './slug'

describe('toSlug', () => {
  it('strips the accents instead of dropping the letter', () => {
    expect(toSlug('Camiseta Dálmata')).toBe('camiseta-dalmata')
  })

  it('collapses anything that is not a letter or a digit into one separator', () => {
    expect(toSlug('Termo  Kemono 750 ml')).toBe('termo-kemono-750-ml')
    expect(toSlug('Niño & Niña')).toBe('nino-nina')
  })

  it('never starts or ends with a separator, which the API would reject', () => {
    expect(toSlug('  ¡Gorra! ')).toBe('gorra')
  })

  it('returns an empty string when there is nothing usable, so the form can ask for a slug', () => {
    expect(toSlug('¿?')).toBe('')
  })
})
