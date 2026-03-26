import { useEffect, useState, type FormEvent } from 'react'
import type { Card } from '../../types/card'

type CardFormDialogProps = {
  open: boolean
  mode: 'add' | 'edit'
  initial: Card | null
  onClose: () => void
  onSubmit: (values: CardFormValues) => Promise<void>
}

export type CardFormValues = {
  player_name: string
  year: string
  set_name: string
  card_number: string
  variation: string
  condition: string
  is_graded: boolean
  grade: string
  grading_company: string
  purchase_price: string
  purchase_date: string
  current_value: string
}

const emptyForm: CardFormValues = {
  player_name: '',
  year: '',
  set_name: '',
  card_number: '',
  variation: '',
  condition: '',
  is_graded: false,
  grade: '',
  grading_company: '',
  purchase_price: '',
  purchase_date: '',
  current_value: '',
}

function cardToForm (c: Card): CardFormValues {
  return {
    player_name: c.player_name,
    year: c.year != null ? String(c.year) : '',
    set_name: c.set_name ?? '',
    card_number: c.card_number ?? '',
    variation: c.variation ?? '',
    condition: c.condition ?? '',
    is_graded: c.is_graded,
    grade: c.grade ?? '',
    grading_company: c.grading_company ?? '',
    purchase_price:
      c.purchase_price != null ? String(c.purchase_price) : '',
    purchase_date: c.purchase_date ?? '',
    current_value: c.current_value != null ? String(c.current_value) : '',
  }
}

export function CardFormDialog ({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: CardFormDialogProps) {
  const [form, setForm] = useState<CardFormValues>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && initial) {
      setForm(cardToForm(initial))
    } else {
      setForm(emptyForm)
    }
  }, [open, mode, initial])

  if (!open) return null

  const inputCls =
    'mt-1 w-full rounded-lg border border-zinc-700 bg-[var(--color-surface)] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

  async function handleSubmit (e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.player_name.trim()) {
      setError('Player name is required.')
      return
    }
    setSaving(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="card-form-title"
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-2xl sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-5 py-4">
          <h2 id="card-form-title" className="text-lg font-semibold text-white">
            {mode === 'add' ? 'Add card' : 'Edit card'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label htmlFor="player_name" className="text-sm font-medium text-zinc-300">
              Player name <span className="text-red-400">*</span>
            </label>
            <input
              id="player_name"
              required
              value={form.player_name}
              onChange={(e) => setForm((f) => ({ ...f, player_name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Patrick Mahomes"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="year" className="text-sm font-medium text-zinc-300">
                Year
              </label>
              <input
                id="year"
                type="number"
                inputMode="numeric"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                className={inputCls}
                placeholder="2017"
                min={1800}
                max={2100}
              />
            </div>
            <div>
              <label htmlFor="card_number" className="text-sm font-medium text-zinc-300">
                Card #
              </label>
              <input
                id="card_number"
                value={form.card_number}
                onChange={(e) => setForm((f) => ({ ...f, card_number: e.target.value }))}
                className={inputCls}
                placeholder="#161"
              />
            </div>
          </div>

          <div>
            <label htmlFor="set_name" className="text-sm font-medium text-zinc-300">
              Set
            </label>
            <input
              id="set_name"
              value={form.set_name}
              onChange={(e) => setForm((f) => ({ ...f, set_name: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Prizm"
            />
          </div>

          <div>
            <label htmlFor="variation" className="text-sm font-medium text-zinc-300">
              Variation
            </label>
            <input
              id="variation"
              value={form.variation}
              onChange={(e) => setForm((f) => ({ ...f, variation: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Silver Prizm"
            />
          </div>

          <div>
            <label htmlFor="condition" className="text-sm font-medium text-zinc-300">
              Condition
            </label>
            <input
              id="condition"
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
              className={inputCls}
              placeholder="e.g. NM, PSA 10 candidate"
            />
          </div>

          <fieldset className="rounded-lg border border-zinc-700/80 p-4">
            <legend className="px-1 text-sm font-medium text-zinc-300">Grading</legend>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.is_graded}
                onChange={(e) => setForm((f) => ({ ...f, is_graded: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-zinc-200">Graded (slab)</span>
            </label>
            {form.is_graded && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="grading_company" className="text-sm text-zinc-400">
                    Company
                  </label>
                  <input
                    id="grading_company"
                    value={form.grading_company}
                    onChange={(e) => setForm((f) => ({ ...f, grading_company: e.target.value }))}
                    className={inputCls}
                    placeholder="PSA, BGS, SGC…"
                  />
                </div>
                <div>
                  <label htmlFor="grade" className="text-sm text-zinc-400">
                    Grade
                  </label>
                  <input
                    id="grade"
                    value={form.grade}
                    onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                    className={inputCls}
                    placeholder="10, 9.5…"
                  />
                </div>
              </div>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="purchase_price" className="text-sm font-medium text-zinc-300">
                Purchase price ($)
              </label>
              <input
                id="purchase_price"
                type="text"
                inputMode="decimal"
                value={form.purchase_price}
                onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="purchase_date" className="text-sm font-medium text-zinc-300">
                Purchase date
              </label>
              <input
                id="purchase_date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label htmlFor="current_value" className="text-sm font-medium text-zinc-300">
              Current value ($)
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">Manual for now; eBay comps will update this later.</p>
            <input
              id="current_value"
              type="text"
              inputMode="decimal"
              value={form.current_value}
              onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))}
              className={inputCls}
              placeholder="0.00"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border-subtle)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'add' ? 'Add card' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
