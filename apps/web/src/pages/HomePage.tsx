import { styled } from '@linaria/react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HeroSlideshow } from '../components/HeroSlideshow'
import { ProductCard } from '../components/ProductCard'
import { Kicker, ProductGrid, Section, SectionHeader, SectionTitle, TextLink } from '../components/primitives'
import { ProductCardSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { buildHeroSlides } from '../lib/hero-slides'
import { useTranslation } from '../lib/use-translation'
import { useGetCategoriesQuery, useGetCollectionsQuery, useGetProductsQuery } from '../store/catalog-api'

const LATEST_PRODUCTS_COUNT = 4

const Hero = styled.section`
  background: var(--color-surface);
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  min-height: 620px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`
const HeroCopy = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(3rem, 8vw, 8rem) clamp(1.25rem, 6vw, 7rem);
`
const Title = styled.h1`
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 7.2vw, 7.5rem);
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
  line-height: 0.84;
  margin: 0;
  max-width: 700px;
`
const Lead = styled.p`
  font-size: 1.06rem;
  line-height: 1.6;
  margin: 2rem 0;
  max-width: 420px;
`
const Action = styled(Link)`
  background: var(--color-ink);
  border: 1px solid var(--color-ink);
  color: var(--color-background);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 1rem 1.35rem;
  text-decoration: none;
  text-transform: uppercase;
`
const Categories = styled.div`
  background: var(--color-border);
  display: grid;
  gap: 1px;
  /* The number of categories changes with the catalog, so the row fills itself instead of leaving gaps. */
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`
const Category = styled(Link)`
  background: var(--color-surface-alt);
  color: inherit;
  min-height: 190px;
  padding: 1.5rem;
  text-decoration: none;
  transition: background 160ms ease;

  &:hover {
    background: var(--color-surface-hover);
  }
`
const CategoryNumber = styled.span`
  color: var(--color-accent);
  font-size: 0.8rem;
  font-weight: 800;
`
const CategoryName = styled.h3`
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
  margin: 3.5rem 0 0;
`

export function HomePage() {
  const { t, language } = useTranslation()
  const { data: collections } = useGetCollectionsQuery(language)
  const { data: categories } = useGetCategoriesQuery(language)
  const { data: latest, isLoading, isError } = useGetProductsQuery({ lang: language, pageSize: LATEST_PRODUCTS_COUNT })
  const featuredCollection = collections?.find((collection) => collection.featured) ?? collections?.[0]
  // The hero opens with the line sheet and then reuses the products already fetched for the grid below,
  // so the rotation costs no extra request.
  const linePresentationAlt = t('home.linePresentationAlt')
  const heroSlides = useMemo(() => buildHeroSlides(latest?.items ?? [], linePresentationAlt), [latest, linePresentationAlt])

  return (
    <>
      <Hero>
        <HeroCopy>
          <Kicker>{featuredCollection ? featuredCollection.name : t('home.kickerFallback')}</Kicker>
          <Title>{t('home.title')}</Title>
          <Lead>{featuredCollection?.tagline ?? t('home.leadFallback')}</Lead>
          <Action to={featuredCollection ? `/shop/${featuredCollection.slug}` : '/shop'}>{t('home.exploreCollection')}</Action>
        </HeroCopy>
        <HeroSlideshow slides={heroSlides} />
      </Hero>
      <Section>
        <SectionHeader>
          <SectionTitle>{t('home.shopByForm')}</SectionTitle>
          <TextLink to="/shop">{t('home.viewAll')}</TextLink>
        </SectionHeader>
        <Categories>
          {categories?.map((category, index) => (
            <Category key={category.id} to={`/shop?category=${category.slug}`}>
              <CategoryNumber>{String(index + 1).padStart(2, '0')}</CategoryNumber>
              <CategoryName>{category.name}</CategoryName>
            </Category>
          ))}
        </Categories>
      </Section>
      <Section>
        <SectionHeader>
          <div>
            <Kicker>{t('home.latestDrop')}</Kicker>
            <SectionTitle>{t('home.currentPieces')}</SectionTitle>
          </div>
          <TextLink to="/shop">{t('home.filterCollection')}</TextLink>
        </SectionHeader>
        <ProductGrid>
          {isLoading && Array.from({ length: LATEST_PRODUCTS_COUNT }, (_, index) => <ProductCardSkeleton key={index} />)}
          {isError && <StateMessage kind="error">{t('catalog.error')}</StateMessage>}
          {!isLoading && !isError && latest?.items.length === 0 && <StateMessage kind="empty">{t('home.empty')}</StateMessage>}
          {latest?.items.map((product) => <ProductCard key={product.id} product={product} />)}
        </ProductGrid>
      </Section>
    </>
  )
}
