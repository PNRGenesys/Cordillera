import { styled } from '@linaria/react'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { toResizedDataUrl } from '../lib/image-resize'
import { toSlug } from '../lib/slug'
import { useTranslation } from '../lib/use-translation'
import { useCreateAdminCollectionMutation } from '../store/catalog-api'
import { Field, FieldRow, Input, PrimaryButton, Textarea } from './primitives'
import { StateMessage } from './StateMessage'

/** The hero image is served at 1200px at most, the same as a product picture. */
const COLLECTION_IMAGE_MAX_SIDE = 1200

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
const CheckboxField = styled.label`
  align-items: center;
  display: flex;
  font-size: 0.72rem;
  font-weight: 700;
  gap: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`
const Hint = styled.p`
  color: var(--color-accent);
  font-size: 0.78rem;
  line-height: 1.5;
  margin: 0;
`
const Preview = styled.img`
  border: 1px solid var(--color-border);
  margin-top: 0.5rem;
  max-height: 200px;
  object-fit: contain;
`

export function AdminCollectionCreateForm() {
  const { t } = useTranslation()
  const [createCollection, createState] = useCreateAdminCollectionMutation()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [featured, setFeatured] = useState(false)
  const [heroImage, setHeroImage] = useState<string | undefined>(undefined)
  const [photoFailed, setPhotoFailed] = useState(false)

  // The slug follows the name until the administrator writes their own, which is then left alone.
  function changeName(value: string): void {
    setName(value)
    if (!slugEdited) setSlug(toSlug(value))
  }

  function pickPhoto(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFailed(false)
    void toResizedDataUrl(file, { maxSide: COLLECTION_IMAGE_MAX_SIDE }).then(setHeroImage).catch(() => setPhotoFailed(true))
  }

  function reset(): void {
    setName('')
    setSlug('')
    setSlugEdited(false)
    setTagline('')
    setDescription('')
    setFeatured(false)
    setHeroImage(undefined)
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void createCollection({
      name: name.trim(),
      slug,
      tagline: tagline.trim() || undefined,
      description: description.trim() || undefined,
      featured,
      heroImage,
    }).unwrap().then(reset).catch(() => undefined)
  }

  return (
    <Card>
      <Summary>{t('admin.newCollection')}</Summary>
      <Form onSubmit={submit}>
        <Hint>{t('admin.collectionHint')}</Hint>
        <FieldRow>
          <Field>
            {t('admin.collectionName')}
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
          {t('admin.collectionTagline')}
          <Input value={tagline} onChange={(event) => setTagline(event.target.value)} />
        </Field>
        <Field>
          {t('admin.description')}
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>

        <Field>
          {t('admin.collectionHero')}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} />
        </Field>
        {photoFailed && <StateMessage kind="error">{t('account.photoError')}</StateMessage>}
        {heroImage && <Preview src={heroImage} alt="" />}

        <CheckboxField>
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
          {t('admin.collectionFeatured')}
        </CheckboxField>
        <Hint>{t('admin.collectionFeaturedHint')}</Hint>

        <PrimaryButton type="submit" disabled={createState.isLoading}>{t('admin.createCollection')}</PrimaryButton>
        {createState.isError && <StateMessage kind="error">{t('admin.createCollectionError')}</StateMessage>}
        {createState.isSuccess && <StateMessage kind="empty">{t('admin.createCollectionDone')}</StateMessage>}
      </Form>
    </Card>
  )
}
