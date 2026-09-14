import { styled } from '@linaria/react'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { ProductGrid, Section, SectionHeader, SectionTitle } from '../components/primitives'
import { ProductCardSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { useTranslation } from '../lib/use-translation'
import { type CatalogAvailability, type CatalogFacet, type CatalogFilters, useGetCategoriesQuery, useGetCollectionsQuery, useGetProductsQuery } from '../store/catalog-api'

const Filters = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2rem;
`
const Field = styled.label`
  display: flex;
  flex-direction: column;
  font-size: 0.72rem;
  font-weight: 700;
  gap: 0.35rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`
const Select = styled.select`
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
  padding: 0.5rem 0.6rem;
`
const Pagination = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 2.5rem;
`
const PageButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-ink);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.5rem 0.9rem;

  &:disabled {
    border-color: var(--color-border);
    color: var(--color-border);
    cursor: not-allowed;
  }
`
const PageNumberButton = styled(PageButton)<{ $active: boolean }>`
  background: ${(props) => (props.$active ? 'var(--color-ink)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-background)' : 'inherit')};
`
const ClearFiltersButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-decoration: underline;
  text-transform: uppercase;
`
const ActiveCount = styled.span`
  color: var(--color-accent);
`

const SKELETON_CARD_COUNT = 8

/**
 * Name of a filter and its active marker, on one line. `Field` is a column, and every element inside it
 * is a flex item of its own: an `ActiveCount` placed next to the bare label text dropped to a second
 * line and pushed that dropdown below the rest of the row. Wrapping both keeps them in a single item.
 */
function FilterLabel({ text, active }: { text: string; active: boolean }) {
  return <span>{text}{active && <ActiveCount> (1)</ActiveCount>}</span>
}

function readAvailability(value: string | null): CatalogAvailability {
  return value === 'in_stock' ? 'in_stock' : 'all'
}

/** The dropdowns list every attribute of the visible page once, sorted by the text the customer reads. */
function uniqueFacets(facets: CatalogFacet[] | undefined): CatalogFacet[] {
  const byValue = new Map((facets ?? []).map((facet) => [facet.value, facet]))
  return [...byValue.values()].sort((left, right) => left.label.localeCompare(right.label))
}

export function ShopPage() {
  const { t, language } = useTranslation()
  const { collection } = useParams<{ collection?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: categories } = useGetCategoriesQuery(language)
  const { data: collections } = useGetCollectionsQuery(language, { skip: !collection })

  const filters: CatalogFilters = {
    lang: language,
    collection,
    category: searchParams.get('category') ?? undefined,
    color: searchParams.get('color') ?? undefined,
    size: searchParams.get('size') ?? undefined,
    availability: readAvailability(searchParams.get('availability')),
    page: Number(searchParams.get('page') ?? '1'),
  }

  const { data, isLoading, isError } = useGetProductsQuery(filters)

  const colorOptions = useMemo(() => uniqueFacets(data?.items.flatMap((item) => item.colors)), [data])
  const sizeOptions = useMemo(() => uniqueFacets(data?.items.flatMap((item) => item.sizes)), [data])

  function updateFilter(key: string, value: string): void {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  function clearFilters(): void {
    const next = new URLSearchParams(searchParams)
    for (const key of ['category', 'color', 'size', 'availability', 'page']) next.delete(key)
    setSearchParams(next)
  }

  function goToPage(page: number): void {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const collectionName = collection ? (collections?.find((entry) => entry.slug === collection)?.name ?? collection) : undefined
  const currentPage = filters.page ?? 1
  const hasActiveFilters = Boolean(searchParams.get('category') || searchParams.get('color') || searchParams.get('size') || searchParams.get('availability'))
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>{collectionName ?? t('shop.title')}</SectionTitle>
        {hasActiveFilters && <ClearFiltersButton type="button" onClick={clearFilters}>{t('shop.clearFilters')}</ClearFiltersButton>}
      </SectionHeader>
      <Filters onSubmit={(event) => event.preventDefault()}>
        <Field>
          <FilterLabel text={t('shop.category')} active={Boolean(searchParams.get('category'))} />
          <Select value={searchParams.get('category') ?? ''} onChange={(event) => updateFilter('category', event.target.value)}>
            <option value="">{t('shop.all')}</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FilterLabel text={t('shop.color')} active={Boolean(searchParams.get('color'))} />
          <Select value={searchParams.get('color') ?? ''} onChange={(event) => updateFilter('color', event.target.value)}>
            <option value="">{t('shop.all')}</option>
            {colorOptions.map((color) => (
              <option key={color.value} value={color.value}>
                {color.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FilterLabel text={t('shop.size')} active={Boolean(searchParams.get('size'))} />
          <Select value={searchParams.get('size') ?? ''} onChange={(event) => updateFilter('size', event.target.value)}>
            <option value="">{t('shop.all')}</option>
            {sizeOptions.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FilterLabel text={t('shop.availability')} active={searchParams.get('availability') === 'in_stock'} />
          <Select value={searchParams.get('availability') ?? 'all'} onChange={(event) => updateFilter('availability', event.target.value)}>
            <option value="all">{t('shop.all')}</option>
            <option value="in_stock">{t('shop.inStock')}</option>
          </Select>
        </Field>
      </Filters>
      <ProductGrid>
        {isLoading && Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => <ProductCardSkeleton key={index} />)}
        {isError && <StateMessage kind="error">{t('catalog.error')}</StateMessage>}
        {!isLoading && !isError && data?.items.length === 0 && <StateMessage kind="empty">{t('shop.empty')}</StateMessage>}
        {data?.items.map((product) => <ProductCard key={product.id} product={product} />)}
      </ProductGrid>
      {data && data.total > 0 && totalPages > 1 && (
        <Pagination>
          <PageButton type="button" aria-label={t('shop.previous')} disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
            ‹
          </PageButton>
          {pageNumbers.map((page) => (
            <PageNumberButton
              key={page}
              type="button"
              $active={page === currentPage}
              aria-label={t('shop.pageNumberLabel', { page })}
              aria-current={page === currentPage ? 'page' : undefined}
              onClick={() => goToPage(page)}
            >
              {page}
            </PageNumberButton>
          ))}
          <PageButton type="button" aria-label={t('shop.next')} disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
            ›
          </PageButton>
        </Pagination>
      )}
    </Section>
  )
}
