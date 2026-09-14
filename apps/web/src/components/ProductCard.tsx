import { styled } from '@linaria/react'
import { Link } from 'react-router-dom'
import { toSrcSet } from '../lib/image'
import { useTranslation } from '../lib/use-translation'
import type { CatalogProductSummary } from '../store/catalog-api'
import { Price } from './Price'

const LAST_STOCK_THRESHOLD = 3

const Card = styled.article`
  min-width: 0;
`
const Visual = styled(Link)`
  aspect-ratio: 0.82;
  background: var(--color-surface);
  display: block;
  margin-bottom: 0.9rem;
  overflow: hidden;
  position: relative;

  img {
    height: 100%;
    object-fit: cover;
    transition: transform 200ms ease;
    width: 100%;
  }

  &:hover img,
  &:focus-visible img {
    transform: scale(1.04);
  }

  @media (prefers-reduced-motion: reduce) {
    img {
      transition: none;
    }
  }
`
const Placeholder = styled.div`
  align-items: center;
  color: var(--color-accent);
  display: flex;
  font-family: var(--font-display);
  font-size: 1.4rem;
  height: 100%;
  justify-content: center;
  text-align: center;
`
const Badge = styled.span`
  background: var(--color-ink);
  color: var(--color-background);
  font-size: 0.68rem;
  font-weight: 800;
  left: 0.6rem;
  letter-spacing: 0.06em;
  padding: 0.3rem 0.5rem;
  position: absolute;
  text-transform: uppercase;
  top: 0.6rem;
`
const Name = styled.h3`
  font-size: 0.84rem;
  letter-spacing: 0.04em;
  margin: 0 0 0.4rem;
  text-transform: uppercase;
`
const ProductPrice = styled.p`
  font-size: 0.9rem;
  margin: 0 0 0.4rem;
`
const ColorCount = styled.p`
  color: var(--color-accent);
  font-size: 0.72rem;
  margin: 0 0 0.4rem;
`
export type ProductCardProps = {
  product: CatalogProductSummary
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation()
  const isOutOfStock = product.availableUnits <= 0
  const isLastStock = !isOutOfStock && product.availableUnits <= LAST_STOCK_THRESHOLD

  function statusBadge(): string | undefined {
    if (product.release === 'preorder') return t('product.preorder')
    if (product.release === 'coming_soon') return t('product.comingSoon')
    if (isOutOfStock) return t('product.soldOut')
    if (isLastStock) return t('product.lastStock')
    return undefined
  }

  const badge = statusBadge()

  return (
    <Card>
      <Visual to={`/product/${product.slug}`} aria-label={product.name}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            srcSet={toSrcSet(product.imageUrl)}
            sizes="(max-width: 900px) 45vw, 22vw"
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Placeholder>{product.colors[0]?.label ?? 'Cordillera'}</Placeholder>
        )}
        {badge && <Badge>{badge}</Badge>}
      </Visual>
      <Name>{product.name}</Name>
      <ProductPrice>
        <Price minCents={product.minPriceCents} maxCents={product.maxPriceCents} compareAtCents={product.compareAtPriceCents} />
      </ProductPrice>
      {product.colors.length > 1 && <ColorCount>{t('product.colorsAvailable', { count: product.colors.length })}</ColorCount>}
    </Card>
  )
}
