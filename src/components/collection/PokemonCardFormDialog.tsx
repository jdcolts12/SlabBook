import { useEffect, useMemo, useState } from 'react'
import type { PokemonCard } from '../../types/pokemonCard'
import { validateCardImageFile } from '../../lib/cardImageStorage'

export type PokemonFormSubmitPayload = {
  values: {
    pokemon_name: string
    language: 'en' | 'jp'
    set_name: string
    card_number: string
    variation: string
    is_graded: boolean
    grade: string
    grading_company: string
    condition: string
    purchase_price: string
    purchase_date: string
    current_value: string
  }
  draftCardId: string
  imageFront: File | null
  imageBack: File | null
  removeImageFront: boolean
  removeImageBack: boolean
}

type Props = {
  open: boolean
  mode: 'add' | 'edit'
  initial: PokemonCard | null
  onClose: () => void
  onSubmit: (payload: PokemonFormSubmitPayload) => Promise<void>
}

function emptyValues (): PokemonFormSubmitPayload['values'] {
  return {
    pokemon_name: '',
    language: 'en',
    set_name: '',
    card_number: '',
    variation: '',
    is_graded: true,
    grade: '',
    grading_company: '',
    condition: '',
    purchase_price: '',
    purchase_date: '',
    current_value: '',
  }
}

export function PokemonCardFormDialog ({ open, mode, initial, onClose, onSubmit }: Props) {
  const [draftCardId, setDraftCardId] = useState(() => crypto.randomUUID())
  const [values, setValues] = useState(emptyValues)
  const [imageFront, setImageFront] = useState<File | null>(null)
  const [imageBack, setImageBack] = useState<File | null>(null)
  const [removeImageFront, setRemoveImageFront] = useState(false)
  const [removeImageBack, setRemoveImageBack] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setImageFront(null)
    setImageBack(null)
    setRemoveImageFront(false)
    setRemoveImageBack(false)
    if (mode === 'edit' && initial) {
      setValues({
        pokemon_name: initial.pokemon_name,
        language: initial.language,
        set_name: initial.set_name ?? '',
        card_number: initial.card_number ?? '',
        variation: initial.variation ?? '',
        is_graded: initial.is_graded,
        grade: initial.grade ?? '',
        grading_company: initial.grading_company ?? '',
        condition: initial.condition ?? '',
        purchase_price:
          initial.purchase_price != null ? String(initial.purchase_price) : '',
        purchase_date: initial.purchase_date ?? '',
        current_value:
          initial.current_value != null ? String(initial.current_value) : '',
      })
    } else {
      setDraftCardId(crypto.randomUUID())
      setValues(emptyValues())
    }
  }, [open, mode, initial])

  const title = mode === 'add' ? 'Add Pokémon card' : 'Edit Pokémon card'

  const frontPreview = useMemo(() => {
    if (imageFront) return URL.createObjectURL(imageFront)
    if (!removeImageFront && initial?.image_front_url) return initial.image_front_url
    return null
  }, [imageFront, removeImageFront, initial?.image_front_url])

  const backPreview = useMemo(() => {
    if (imageBack) return URL.createObjectURL(imageBack)
    if (!removeImageBack && initial?.image_back_url) return initial.image_back_url
    return null
  }, [imageBack, removeImageBack, initial?.image_back_url])

  useEffect(() => {
    return () => {
      if (imageFront && frontPreview?.startsWith('blob:')) URL.revokeObjectURL(frontPreview)
      if (imageBack && backPreview?.startsWith('blob:')) URL.revokeObjectURL(backPreview)
    }
  }, [imageFront, imageBack, frontPreview, backPreview])

  if (!open) return null

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const name = values.pokemon_name.trim()
    if (!name) {
      setError('Pokémon name is required.')
      return
    }
    if (imageFront) {
      const v = validateCardImageFile(imageFront)
      if (v) {
        setError(v)
        return
      }
    }
    if (imageBack) {
      const v = validateCardImageFile(imageBack)
      if (v) {
        setError(v)
        return
      }
    }
    setSubmitting(true)
    try {
      const cardId = mode === 'edit' && initial ? initial.id : draftCardId
      await onSubmit({
        values,
        draftCardId: cardId,
        imageFront,
        imageBack,
        removeImageFront,
        removeImageBack,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={() => !submitting && onClose()}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="pokemon-form-title"
        className="relative z-10 flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
          <h2 id="pokemon-form-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 p-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-400">Pokémon name</label>
              <input
                required
                value={values.pokemon_name}
                onChange={(e) => setValues((v) => ({ ...v, pokemon_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                placeholder="e.g. Charizard"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Card language</label>
              <select
                value={values.language}
                onChange={(e) =>
                  setValues((v) => ({ ...v, language: e.target.value as 'en' | 'jp' }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
              >
                <option value="en">English</option>
                <option value="jp">Japanese</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400">Set</label>
                <input
                  value={values.set_name}
                  onChange={(e) => setValues((v) => ({ ...v, set_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                  placeholder="Set name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Number</label>
                <input
                  value={values.card_number}
                  onChange={(e) => setValues((v) => ({ ...v, card_number: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                  placeholder="e.g. 184/165"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Variant / notes</label>
              <input
                value={values.variation}
                onChange={(e) => setValues((v) => ({ ...v, variation: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                placeholder="Holo, alt art, etc."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="pk-graded"
                type="checkbox"
                checked={values.is_graded}
                onChange={(e) => setValues((v) => ({ ...v, is_graded: e.target.checked }))}
                className="rounded border-zinc-600"
              />
              <label htmlFor="pk-graded" className="text-sm text-zinc-300">
                Graded slab
              </label>
            </div>

            {values.is_graded ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Company</label>
                  <input
                    list="pokemon-grading-companies"
                    value={values.grading_company}
                    onChange={(e) => setValues((v) => ({ ...v, grading_company: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                    placeholder="PSA, CGC, BGS…"
                  />
                  <datalist id="pokemon-grading-companies">
                    <option value="PSA" />
                    <option value="CGC" />
                    <option value="BGS" />
                    <option value="SGC" />
                    <option value="TAG" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Grade</label>
                  <input
                    value={values.grade}
                    onChange={(e) => setValues((v) => ({ ...v, grade: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                    placeholder="10, 9.5, …"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-zinc-400">Condition</label>
                <input
                  value={values.condition}
                  onChange={(e) => setValues((v) => ({ ...v, condition: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                  placeholder="NM, LP, …"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400">Purchase price</label>
                <input
                  inputMode="decimal"
                  value={values.purchase_price}
                  onChange={(e) => setValues((v) => ({ ...v, purchase_price: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Est. value</label>
                <input
                  inputMode="decimal"
                  value={values.current_value}
                  onChange={(e) => setValues((v) => ({ ...v, current_value: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Purchase date</label>
              <input
                type="date"
                value={values.purchase_date}
                onChange={(e) => setValues((v) => ({ ...v, purchase_date: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400">Front image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setImageFront(e.target.files?.[0] ?? null)
                    setRemoveImageFront(false)
                  }}
                  className="mt-1 w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-slab-teal/20 file:px-2 file:py-1 file:text-slab-teal-muted"
                />
                {frontPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFront(null)
                      setRemoveImageFront(true)
                    }}
                    className="mt-1 text-xs text-red-400 hover:underline"
                  >
                    Remove front
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Back image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    setImageBack(e.target.files?.[0] ?? null)
                    setRemoveImageBack(false)
                  }}
                  className="mt-1 w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-slab-teal/20 file:px-2 file:py-1 file:text-slab-teal-muted"
                />
                {backPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageBack(null)
                      setRemoveImageBack(true)
                    }}
                    className="mt-1 text-xs text-red-400 hover:underline"
                  >
                    Remove back
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto flex gap-2 border-t border-[var(--color-border-subtle)] p-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-600 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-slab-teal py-2.5 text-sm font-semibold text-zinc-950 hover:bg-slab-teal-light disabled:opacity-50"
            >
              {submitting ? 'Saving…' : mode === 'add' ? 'Add card' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
