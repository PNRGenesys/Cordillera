import { styled } from '@linaria/react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { unitsToCents } from '../lib/format-price'
import { toResizedDataUrl } from '../lib/image-resize'
import { toSlug } from '../lib/slug'
import { useTranslation } from '../lib/use-translation'
import {
  useCreateAdminProductMutation,
  useGetCategoriesQuery,
  useGetCollectionsQuery,
  type ProductRelease,
  type ProductVariantCreate,
} from '../store/catalog-api'
import { Field, FieldRow, Input, PrimaryButton, Select, Textarea } from './primitives'
import { StateMessage } from './StateMessage'

/** The picture is served at 1200px at most, so there is nothing to gain from storing a larger one. */
const PRODUCT_IMAGE_MAX_SIDE = 1200

type VariantDraft = { sku: string; color: string; size: string; price: string; initialStock: string }

const emptyVariant: VariantDraft = { sku: '', color: '', size: '', price: '', initialStock: '0' }

const Card = styled.details`
  border: 1px solid var(--color-border);
  padding: 1.5rem;

  &[open] > summary {
    margin-bottom: 1.25rem;
  }
`
const Summary = styled.summary`
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`
const Form = styled.form`
  display: grid;
  gap: 1rem;
`
const VariantRow = styled.div`
  border-top: 1px solid var(--color-border);
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  padding-top: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr 1fr;
  }
`
const Legend = styled.p`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
`
const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-ink);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 800;
  justify-self: start;
  letter-spacing: 0.06em;
  padding: 0.6rem 1rem;
  text-transform: uppercase;
`
const Preview = styled.img`
  border: 1px solid var(--color-border);
  margin-top: 0.5rem;
  max-height: 200px;
  object-fit: contain;
`
const HelpButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  justify-self: start;
  letter-spacing: 0.06em;
  padding: 0.5rem 0.9rem;
  text-transform: uppercase;
`
const HelpPanel = styled.div`
  background: var(--color-surface-alt);
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
`
const HelpTitle = styled.p`
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
`
const HelpList = styled.ol`
  display: grid;
  font-size: 0.85rem;
  gap: 0.6rem;
  line-height: 1.5;
  margin: 0;
  padding-left: 1.2rem;
`

export function AdminProductCreateForm() {
  const { t, language } = useTranslation()
  const { data: categories } = useGetCategoriesQuery(language)
  const { data: collections } = useGetCollectionsQuery(language)
  const [createProduct, createState] = useCreateAdminProductMutation()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [composition, setComposition] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [release, setRelease] = useState<ProductRelease>('available')
  const [image, setImage] = useState<string | undefined>(undefined)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant])
  const [helpOpen, setHelpOpen] = useState(false)

  // The slug follows the name until the administrator writes their own, which is then left alone.
  function changeName(value: string): void {
    setName(value)
    if (!slugEdited) setSlug(toSlug(value))
  }

  function changeVariant(index: number, field: keyof VariantDraft, value: string): void {
    setVariants((current) => current.map((variant, position) => (position === index ? { ...variant, [field]: value } : variant)))
  }

  function pickPhoto(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFailed(false)
    void toResizedDataUrl(file, { maxSide: PRODUCT_IMAGE_MAX_SIDE }).then(setImage).catch(() => setPhotoFailed(true))
  }

  function reset(): void {
    setName('')
    setSlug('')
    setSlugEdited(false)
    setDescription('')
    setComposition('')
    setCategoryId('')
    setCollectionId('')
    setRelease('available')
    setImage(undefined)
    setVariants([emptyVariant])
  }

  /** A variant with no name of its own is called after the product and what makes it different. */
  function toVariant(draft: VariantDraft): ProductVariantCreate {
    return {
      sku: draft.sku.trim(),
      name: [name, draft.color, draft.size].filter(Boolean).join(' ').trim(),
      priceCents: unitsToCents(Number(draft.price)),
      color: draft.color.trim() || undefined,
      size: draft.size.trim() || undefined,
      initialStock: Number(draft.initialStock) || 0,
    }
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void createProduct({
      name: name.trim(),
      slug,
      description: description.trim() || undefined,
      composition: composition.trim() || undefined,
      categoryId: categoryId || undefined,
      collectionId: collectionId || undefined,
      release,
      image,
      variants: variants.map(toVariant),
    }).unwrap().then(reset).catch(() => undefined)
  }

  return (
    <Card>
      <Summary>{t('admin.newProduct')}</Summary>
      <Form onSubmit={submit}>
        <HelpButton type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>
          {helpOpen ? t('admin.helpHide') : t('admin.help')}
        </HelpButton>
        {helpOpen && (
          <HelpPanel>
            <HelpTitle>{t('admin.helpTitle')}</HelpTitle>
            <HelpList>
              <li>{t('admin.helpName')}</li>
              <li>{t('admin.helpCategory')}</li>
              <li>{t('admin.helpImage')}</li>
              <li>{t('admin.helpVariants')}</li>
              <li>{t('admin.helpPrice')}</li>
              <li>{t('admin.helpDraft')}</li>
            </HelpList>
            <HelpTitle>{t('admin.helpProblemsTitle')}</HelpTitle>
            <HelpList>
              <li>{t('admin.helpRepeated')}</li>
              <li>{t('admin.helpPhoto')}</li>
            </HelpList>
          </HelpPanel>
        )}
        <FieldRow>
          <Field>
            {t('admin.productName')}
            <Input required minLength={2} value={name} onChange={(event) => changeName(event.target.value)} />
          </Field>
          <Field>
            {t('admin.productSlug')}
            <Input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(event) => { setSlugEdited(true); setSlug(event.target.value) }}
            />
          </Field>
        </FieldRow>

        <Field>
          {t('admin.description')}
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field>
          {t('admin.composition')}
          <Input value={composition} onChange={(event) => setComposition(event.target.value)} />
        </Field>

        <FieldRow>
          <Field>
            {t('admin.productCategory')}
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{t('admin.withoutCategory')}</option>
              {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field>
            {t('admin.productCollection')}
            <Select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
              <option value="">{t('admin.withoutCollection')}</option>
              {collections?.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </Select>
          </Field>
        </FieldRow>

        <Field>
          {t('admin.release')}
          <Select value={release} onChange={(event) => setRelease(event.target.value as ProductRelease)}>
            <option value="available">{t('admin.releaseAvailable')}</option>
            <option value="preorder">{t('admin.releasePreorder')}</option>
            <option value="coming_soon">{t('admin.releaseComingSoon')}</option>
          </Select>
        </Field>

        <Field>
          {t('admin.productImage')}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} />
        </Field>
        {photoFailed && <StateMessage kind="error">{t('account.photoError')}</StateMessage>}
        {image && <Preview src={image} alt="" />}

        <Legend>{t('admin.variants')}</Legend>
        {variants.map((variant, index) => (
          <VariantRow key={index}>
            <Field>
              {t('admin.variantSku')}
              <Input required value={variant.sku} onChange={(event) => changeVariant(index, 'sku', event.target.value)} />
            </Field>
            <Field>
              {t('admin.variantColor')}
              <Input value={variant.color} onChange={(event) => changeVariant(index, 'color', event.target.value)} />
            </Field>
            <Field>
              {t('admin.variantSize')}
              <Input value={variant.size} onChange={(event) => changeVariant(index, 'size', event.target.value)} />
            </Field>
            <Field>
              {t('admin.price')}
              <Input required type="number" min="1" value={variant.price} onChange={(event) => changeVariant(index, 'price', event.target.value)} />
            </Field>
            <Field>
              {t('admin.initialStock')}
              <Input required type="number" min="0" value={variant.initialStock} onChange={(event) => changeVariant(index, 'initialStock', event.target.value)} />
            </Field>
          </VariantRow>
        ))}
        <SecondaryButton type="button" onClick={() => setVariants((current) => [...current, emptyVariant])}>
          {t('admin.addVariant')}
        </SecondaryButton>

        <PrimaryButton type="submit" disabled={createState.isLoading}>{t('admin.createProduct')}</PrimaryButton>
        {createState.isError && <StateMessage kind="error">{t('admin.createProductError')}</StateMessage>}
        {createState.isSuccess && <StateMessage kind="empty">{t('admin.createProductDone')}</StateMessage>}
      </Form>
    </Card>
  )
}
