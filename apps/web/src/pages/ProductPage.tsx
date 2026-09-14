import { styled } from '@linaria/react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Price } from '../components/Price'
import { QuantityStepper } from '../components/QuantityStepper'
import { Section } from '../components/primitives'
import { SizeGuideTable } from '../components/SizeGuideTable'
import { ProductDetailSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { VariantSelector } from '../components/VariantSelector'
import { isCustomDesignWindowOpen } from '../lib/business-hours'
import { useAccount } from '../lib/use-account'
import { useTranslation } from '../lib/use-translation'
import { toSrcSet } from '../lib/image'
import { sortVariantsBySizeGuide } from '../lib/variant-order'
import { selectSessionId } from '../store/cart-slice'
import { useAddCartItemMutation, useGetProductQuery, useRequestRestockMutation } from '../store/catalog-api'
import { useAppSelector } from '../store/hooks'

const LAST_STOCK_THRESHOLD = 3

const Layout = styled.div`
  display: grid;
  gap: clamp(2rem, 5vw, 4rem);
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
    /* Leaves room so the fixed mobile buy bar never covers the last field of the page. */
    padding-bottom: 5.5rem;
  }
`
const Gallery = styled.div`
  display: grid;
  gap: 0.6rem;
`
const ActiveImageWrapper = styled.div`
  aspect-ratio: 0.9;
  background: var(--color-surface);
  position: relative;
`
const GalleryImage = styled.img`
  height: 100%;
  object-fit: cover;
  width: 100%;
`
const GalleryNavButton = styled.button`
  align-items: center;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  font-size: 1.1rem;
  height: 2.25rem;
  justify-content: center;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2.25rem;
`
const PrevImageButton = styled(GalleryNavButton)`
  left: 0.6rem;
`
const NextImageButton = styled(GalleryNavButton)`
  right: 0.6rem;
`
const GalleryCounter = styled.p`
  color: var(--color-accent);
  font-size: 0.75rem;
  margin: 0;
  text-align: center;
`
const GalleryPlaceholder = styled.div`
  align-items: center;
  aspect-ratio: 0.9;
  background: var(--color-surface);
  color: var(--color-accent);
  display: flex;
  font-family: var(--font-display);
  font-size: 1.6rem;
  justify-content: center;
`
const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`
const ProductName = styled.h1`
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: var(--font-display-weight);
  letter-spacing: var(--font-display-tracking);
  margin: 0;
`
const ProductPrice = styled.p`
  font-size: 1.2rem;
  margin: 0;
`
const Description = styled.p`
  line-height: 1.6;
  margin: 0;
`
const Composition = styled.p`
  color: var(--color-accent);
  font-size: 0.8rem;
  margin: 0;
`
const AddButton = styled.button`
  background: var(--color-ink);
  border: 1px solid var(--color-ink);
  color: var(--color-background);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 1rem 1.5rem;
  text-transform: uppercase;

  &:disabled {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-border);
    cursor: not-allowed;
  }
`
const RestockForm = styled.form`
  display: flex;
  gap: 0.75rem;
`
const RestockInput = styled.input`
  border: 1px solid var(--color-border);
  flex: 1;
  padding: 0.6rem 0.75rem;
`
const Confirmation = styled.p`
  color: var(--color-accent);
  font-size: 0.8rem;
  margin: 0;
`
/** Quick add-to-cart access on mobile, where the button in `Info` may sit far below the fold. */
const MobileBuyBar = styled.div`
  display: none;

  @media (max-width: 800px) {
    align-items: center;
    background: var(--color-background);
    border-top: 1px solid var(--color-border);
    bottom: 0;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    left: 0;
    padding: 0.85rem clamp(1.25rem, 4vw, 4rem);
    position: fixed;
    right: 0;
    z-index: 3;
  }
`
const MobileBuyPrice = styled.p`
  font-size: 1rem;
  margin: 0;
`
const MobileBuyButton = styled(AddButton)`
  padding: 0.75rem 1.25rem;
`
const CustomDesignSection = styled.div`
  border-top: 1px solid var(--color-border);
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 1.5rem;
`
const CustomDesignButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-ink);
  color: var(--color-ink);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  justify-self: start;
  letter-spacing: 0.08em;
  padding: 1rem 1.5rem;
  text-transform: uppercase;

  &:disabled {
    border-color: var(--color-border);
    color: var(--color-border);
    cursor: not-allowed;
  }
`
const CustomDesignHint = styled.p`
  color: var(--color-accent);
  font-size: 0.75rem;
  margin: 0;
`

export function ProductPage() {
  const { t, language } = useTranslation()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const sessionId = useAppSelector(selectSessionId)
  const { account } = useAccount()
  const isCustomDesignOpen = isCustomDesignWindowOpen()
  const { data: product, isLoading, isError } = useGetProductQuery({ slug: slug ?? '', lang: language }, { skip: !slug })
  const [addCartItem, addCartItemState] = useAddCartItemMutation()
  const [requestRestock, requestRestockState] = useRequestRestockMutation()
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [restockEmail, setRestockEmail] = useState('')
  const [imageIndex, setImageIndex] = useState(0)

  const variants = useMemo(
    () => (product ? sortVariantsBySizeGuide(product.variants, product.sizeGuideColumns, product.sizeGuideRows) : []),
    [product],
  )

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? variants[0],
    [variants, selectedVariantId],
  )

  if (isLoading) return <Section><ProductDetailSkeleton /></Section>
  if (isError || !product) return <Section><StateMessage kind="error">{t('product.notFound')}</StateMessage></Section>

  const isOutOfStock = (selectedVariant?.availableUnits ?? 0) <= 0
  const isLastStock = !isOutOfStock && (selectedVariant?.availableUnits ?? 0) <= LAST_STOCK_THRESHOLD
  const clampedImageIndex = product.images.length ? Math.min(imageIndex, product.images.length - 1) : 0
  const activeImage = product.images[clampedImageIndex]

  function showPreviousImage(): void {
    if (!product) return
    const imageCount = product.images.length
    setImageIndex((current) => (current - 1 + imageCount) % imageCount)
  }

  function showNextImage(): void {
    if (!product) return
    const imageCount = product.images.length
    setImageIndex((current) => (current + 1) % imageCount)
  }

  function addToCart(): void {
    if (!selectedVariant) return
    void addCartItem({ sessionId, variantId: selectedVariant.id, quantity, lang: language })
  }

  function selectVariant(variantId: string): void {
    setSelectedVariantId(variantId)
    setQuantity(1)
  }

  function submitRestockRequest(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!selectedVariant) return
    void requestRestock({ variantId: selectedVariant.id, email: account ? undefined : restockEmail })
  }

  function goToCustomDesign(): void {
    if (!product || !selectedVariant) return
    const target = `/custom-design/new?product=${product.slug}&variant=${selectedVariant.id}`
    void navigate(account ? target : `/account?next=${encodeURIComponent(target)}`)
  }

  return (
    <Section>
      <Layout>
        <Gallery>
          {activeImage ? (
            <>
              <ActiveImageWrapper>
                <GalleryImage
                  src={activeImage.url}
                  srcSet={toSrcSet(activeImage.url)}
                  sizes="(max-width: 800px) 100vw, 45vw"
                  alt={activeImage.alt ?? product.name}
                  decoding="async"
                />
                {product.images.length > 1 && (
                  <>
                    <PrevImageButton type="button" aria-label={t('product.previousImage')} onClick={showPreviousImage}>‹</PrevImageButton>
                    <NextImageButton type="button" aria-label={t('product.nextImage')} onClick={showNextImage}>›</NextImageButton>
                  </>
                )}
              </ActiveImageWrapper>
              {product.images.length > 1 && (
                <GalleryCounter>{t('product.imageCounter', { current: clampedImageIndex + 1, total: product.images.length })}</GalleryCounter>
              )}
            </>
          ) : (
            <GalleryPlaceholder>{product.name}</GalleryPlaceholder>
          )}
        </Gallery>
        <Info>
          <div>
            <ProductName>{product.name}</ProductName>
            {selectedVariant && (
              <ProductPrice>
                <Price minCents={selectedVariant.priceCents} maxCents={selectedVariant.priceCents} compareAtCents={selectedVariant.compareAtPriceCents} />
              </ProductPrice>
            )}
          </div>
          {product.description && <Description>{product.description}</Description>}
          {product.composition && <Composition>{product.composition}</Composition>}
          <VariantSelector variants={variants} selectedVariantId={selectedVariant?.id} onSelect={selectVariant} />
          {isOutOfStock && (
            <>
              <StateMessage kind="empty">{t('product.restockNotice')}</StateMessage>
              {requestRestockState.isSuccess ? (
                <Confirmation>{t('product.restockConfirmation')}</Confirmation>
              ) : (
                <RestockForm onSubmit={submitRestockRequest}>
                  {/* A signed in customer is already identified by the session, so the form does not ask again. */}
                  {account ? (
                    <Confirmation>{t('product.restockWithAccount', { email: account.email })}</Confirmation>
                  ) : (
                    <RestockInput
                      type="email"
                      required
                      placeholder={t('product.restockEmailPlaceholder')}
                      value={restockEmail}
                      onChange={(event) => setRestockEmail(event.target.value)}
                    />
                  )}
                  <AddButton type="submit" disabled={requestRestockState.isLoading}>
                    {t('product.notifyMe')}
                  </AddButton>
                </RestockForm>
              )}
            </>
          )}
          {!isOutOfStock && (
            <>
              {isLastStock && (
                <StateMessage kind="empty">{t('product.lastStockDetail', { units: selectedVariant?.availableUnits ?? 0 })}</StateMessage>
              )}
              <QuantityStepper value={quantity} max={selectedVariant?.availableUnits ?? 1} onChange={setQuantity} />
              <AddButton type="button" onClick={addToCart} disabled={addCartItemState.isLoading}>
                {addCartItemState.isSuccess ? t('product.addedToBag') : t('product.addToBag')}
              </AddButton>
              {addCartItemState.isError && <StateMessage kind="error">{t('product.addError')}</StateMessage>}
            </>
          )}
          {product.sizeGuideColumns && product.sizeGuideRows && product.sizeGuideUnit && (
            <SizeGuideTable
              name={product.sizeGuideName ?? t('product.sizeGuideDefaultName')}
              unit={product.sizeGuideUnit}
              columns={product.sizeGuideColumns}
              rows={product.sizeGuideRows}
            />
          )}
          <CustomDesignSection>
            <CustomDesignButton type="button" onClick={goToCustomDesign} disabled={!isCustomDesignOpen || !selectedVariant}>
              {t('customDesign.cta')}
            </CustomDesignButton>
            {!isCustomDesignOpen && <CustomDesignHint>{t('customDesign.outsideHours')}</CustomDesignHint>}
          </CustomDesignSection>
        </Info>
      </Layout>
      {!isOutOfStock && selectedVariant && (
        <MobileBuyBar>
          <MobileBuyPrice>
            <Price minCents={selectedVariant.priceCents} maxCents={selectedVariant.priceCents} compareAtCents={selectedVariant.compareAtPriceCents} />
          </MobileBuyPrice>
          <MobileBuyButton type="button" onClick={addToCart} disabled={addCartItemState.isLoading}>
            {addCartItemState.isSuccess ? t('product.addedToBag') : t('product.addToBag')}
          </MobileBuyButton>
        </MobileBuyBar>
      )}
    </Section>
  )
}
