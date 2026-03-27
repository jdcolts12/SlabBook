import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Card } from '../../types/card'
import { getPlayersForSport } from '../../data/playersBySport'
import { SETS_BY_SPORT, type Sport, SPORTS } from '../../data/sports'
import {
  type CardFormValues,
  validateCardForm,
  variationFromFormValues,
} from '../../lib/cardForm'

type CardFormDialogProps = {
  open: boolean
  mode: 'add' | 'edit'
  initial: Card | null
  onClose: () => void
  onSubmit: (values: CardFormValues) => Promise<void>
}

const VARIATION_PRESETS = [
  'Base',
  'Prizm',
  'Optic',
  'Silver',
  'Holo',
  'Auto',
  'Patch',
  'Rookie',
  'Numbered /25',
  'Numbered /10',
  'Numbered /5',
  'Other',
] as const

const RAW_CONDITIONS = ['Poor', 'Good', 'Excellent', 'Near Mint', 'Mint'] as const

const GRADING_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC'] as const

const GRADE_OPTIONS = [
  '10',
  '9.5',
  '9',
  '8.5',
  '8',
  '7.5',
  '7',
  '6.5',
  '6',
  '5.5',
  '5',
  '4.5',
  '4',
  '3.5',
  '3',
  '2.5',
  '2',
  '1.5',
  '1',
] as const

const emptyForm: CardFormValues = {
  sport: 'NFL',
  player_name: '',
  year: '',
  set_name: '',
  card_number: '',
  variation_preset: '',
  variation_extra: '',
  condition: '',
  is_graded: false,
  grade: '',
  grading_company: '',
  purchase_price: '',
  purchase_date: '',
  current_value: '',
}

function parseSport (value: string | null): Sport {
  if (value === 'NFL' || value === 'NBA' || value === 'MLB' || value === 'NHL') return value
  return 'NFL'
}

function cardToForm (c: Card): CardFormValues {
  return {
    sport: parseSport(c.sport),
    player_name: c.player_name,
    year: c.year != null ? String(c.year) : '',
    set_name: c.set_name ?? '',
    card_number: c.card_number ?? '',
    variation_preset: '',
    variation_extra: c.variation ?? '',
    condition: c.condition ?? '',
    is_graded: c.is_graded,
    grade: c.grade ?? '',
    grading_company: c.grading_company ?? '',
    purchase_price: c.purchase_price != null ? String(c.purchase_price) : '',
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
  const [playerInput, setPlayerInput] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && initial) {
      const next = cardToForm(initial)
      setForm(next)
      setPlayerInput(next.player_name)
    } else {
      setForm(emptyForm)
      setPlayerInput('')
    }
  }, [open, mode, initial])

  const setOptions = useMemo(
    () => SETS_BY_SPORT[form.sport] ?? [],
    [form.sport],
  )

  const playerOptions = useMemo(
    () => getPlayersForSport(form.sport),
    [form.sport],
  )

  const preview = useMemo(() => {
    const variation = variationFromFormValues(form)
    return {
      sport: form.sport,
      player: form.player_name.trim() || '—',
      set: form.set_name.trim() || '—',
      year: form.year.trim() || '—',
      number: form.card_number.trim() || '—',
      variation: variation ?? '—',
      slab: form.is_graded
        ? `${form.grading_company || '—'} ${form.grade || ''}`.trim()
        : form.condition || 'Raw',
      purchase:
        form.purchase_price.trim() || '—',
      date: form.purchase_date || '—',
      value: form.current_value.trim() || '—',
    }
  }, [form])

  const datalistId = 'slabbook-player-suggestions'

  if (!open) return null

  const inputCls =
    'mt-1 w-full rounded-lg border border-zinc-700 bg-[var(--color-surface)] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

  async function handleSubmit (e: FormEvent) {
    e.preventDefault()
    setError(null)
    const v = validateCardForm(form)
    if (v) {
      setError(v)
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
        className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-t-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-2xl sm:rounded-2xl"
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

        <div className="max-h-[calc(92dvh-4rem)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="grid gap-0 lg:grid-cols-2">
            <div className="space-y-4 border-b border-[var(--color-border-subtle)] p-5 lg:border-b-0 lg:border-r">
              <div>
                <label htmlFor="sport" className="text-sm font-medium text-zinc-300">
                  Sport <span className="text-red-400">*</span>
                </label>
                <select
                  id="sport"
                  value={form.sport}
                  onChange={(e) => {
                    const sport = e.target.value as Sport
                    setForm((f) => ({
                      ...f,
                      sport,
                      set_name: '',
                    }))
                  }}
                  className={inputCls}
                >
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="player_name" className="text-sm font-medium text-zinc-300">
                  Player name <span className="text-red-400">*</span>
                </label>
                <input
                  id="player_name"
                  list={datalistId}
                  required
                  autoComplete="off"
                  value={playerInput}
                  onChange={(e) => {
                    const v = e.target.value
                    setPlayerInput(v)
                    setForm((f) => ({ ...f, player_name: v }))
                  }}
                  className={inputCls}
                  placeholder="Start typing — suggestions from top names"
                />
                <datalist id={datalistId}>
                  {playerOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
                    placeholder="2020"
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
                <select
                  id="set_name"
                  value={setOptions.includes(form.set_name) ? form.set_name : ''}
                  onChange={(e) => setForm((f) => ({ ...f, set_name: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select a set…</option>
                  {setOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">Filtered by sport. Override or enter a custom name below.</p>
                <input
                  type="text"
                  value={form.set_name}
                  onChange={(e) => setForm((f) => ({ ...f, set_name: e.target.value }))}
                  className={`${inputCls} mt-2`}
                  placeholder="Custom set name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="variation_preset" className="text-sm font-medium text-zinc-300">
                    Variation
                  </label>
                  <select
                    id="variation_preset"
                    value={form.variation_preset}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, variation_preset: e.target.value }))
                    }
                    className={inputCls}
                  >
                    <option value="">Common…</option>
                    {VARIATION_PRESETS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="variation_extra" className="text-sm font-medium text-zinc-300">
                    Extra detail
                  </label>
                  <input
                    id="variation_extra"
                    value={form.variation_extra}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, variation_extra: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="e.g. /99, color match"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                {form.variation_preset === 'Other'
                  ? 'Using Extra detail as the full variation text.'
                  : 'Combined: preset + extra (e.g. Silver + /25).'}
              </p>

              <fieldset className="rounded-lg border border-zinc-700/80 p-4">
                <legend className="px-1 text-sm font-medium text-zinc-300">Grading</legend>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.is_graded}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        is_graded: e.target.checked,
                        condition: e.target.checked ? '' : f.condition,
                        grade: e.target.checked ? f.grade : '',
                        grading_company: e.target.checked ? f.grading_company : '',
                      }))
                    }
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30"
                  />
                  <span className="text-sm text-zinc-200">Graded (slab)</span>
                </label>
                {form.is_graded ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="grading_company" className="text-sm text-zinc-400">
                        Company <span className="text-red-400">*</span>
                      </label>
                      <select
                        id="grading_company"
                        value={form.grading_company}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, grading_company: e.target.value }))
                        }
                        className={inputCls}
                        required={form.is_graded}
                      >
                        <option value="">Select…</option>
                        {GRADING_COMPANIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="grade" className="text-sm text-zinc-400">
                        Grade <span className="text-red-400">*</span>
                      </label>
                      <select
                        id="grade"
                        value={form.grade}
                        onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                        className={inputCls}
                        required={form.is_graded}
                      >
                        <option value="">Select…</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <label htmlFor="condition" className="text-sm text-zinc-400">
                      Condition <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="condition"
                      value={form.condition}
                      onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                      className={inputCls}
                      required={!form.is_graded}
                    >
                      <option value="">Select…</option>
                      {RAW_CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
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
                <p className="mt-0.5 text-xs text-zinc-500">Optional — use Refresh on collection for eBay comps.</p>
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
            </div>

            <div className="bg-[var(--color-surface)]/40 p-5 lg:min-h-[320px]">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Preview
              </h3>
              <div className="mt-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 text-sm">
                <dl className="space-y-2 text-zinc-300">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Sport</dt>
                    <dd className="text-right font-medium text-white">{preview.sport}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Player</dt>
                    <dd className="text-right font-medium text-white">{preview.player}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Set</dt>
                    <dd className="text-right">{preview.set}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Year / #</dt>
                    <dd className="text-right">
                      {preview.year} · {preview.number}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Variation</dt>
                    <dd className="max-w-[60%] text-right">{preview.variation}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Grading</dt>
                    <dd className="text-right">{preview.slab}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Purchase</dt>
                    <dd className="text-right">{preview.purchase}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Purchased</dt>
                    <dd className="text-right">{preview.date}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Value</dt>
                    <dd className="text-right text-emerald-300">{preview.value}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
