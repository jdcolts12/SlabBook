import { useEffect, useState } from 'react'
import type { Card } from '../../types/card'
import { cardGainDollars, cardGainPercent, formatGradeLine } from '../../lib/cardMetrics'
import { pctFormatter } from '../../lib/formatters'
import { CardValueDisplay } from './CardValueDisplay'
import { SportsCardCompLinks } from './CardCompLinks'

type Props = {
  card: Card | null
  open: boolean
  onClose: () => void
  money: Intl.NumberFormat
  refreshing?: boolean
  isFreeUser?: boolean
  onRefreshValue?: (card: Card) => void
  onUpgrade?: () => void
}

export function CardImageModal ({
  card,
  open,
  onClose,
  money,
  refreshing = false,
  isFreeUser = false,
  onRefreshValue,
  onUpgrade,
}: Props) {
  const [side, setSide] = useState<'front' | 'back'>('front')

  useEffect(() => {
    if (open && card) {
      const hasFront = Boolean(card.image_front_url?.trim())
      const hasBack = Boolean(card.image_back_url?.trim())
      if (hasFront) setSide('front')
      else if (hasBack) setSide('back')
      else setSide('front')
    }
  }, [open, card?.id, card?.image_front_url, card?.image_back_url])

  useEffect(() => {
    if (!open) return
    function onKey (e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !card) return null

  const front = card.image_front_url?.trim() || null
  const back = card.image_back_url?.trim() || null
  const url = side === 'front' ? front : back
  const hasBoth = Boolean(front && back)
  const gain = cardGainDollars(card)
  const gainPct = cardGainPercent(card)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close image"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Card photos"
        className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{card.player_name}</p>
            <p className="truncate text-xs text-zinc-500">
              {[card.year, card.set_name].filter(Boolean).join(' · ') || 'Card image'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasBoth && (
              <div className="inline-flex rounded-lg border border-zinc-600/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setSide('front')}
                  className={[
                    'rounded-md px-3 py-1 text-xs font-medium',
                    side === 'front' ? 'bg-slab-teal/20 text-slab-teal-muted' : 'text-zinc-400',
                  ].join(' ')}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setSide('back')}
                  className={[
                    'rounded-md px-3 py-1 text-xs font-medium',
                    side === 'back' ? 'bg-slab-teal/20 text-slab-teal-muted' : 'text-zinc-400',
                  ].join(' ')}
                >
                  Back
                </button>
              </div>
            )}
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
        </div>
        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.2fr_0.9fr]">
          <div className="flex min-h-0 items-center justify-center bg-black/40 p-4">
            {url ? (
              <img
                src={url}
                alt={side === 'front' ? 'Front of card' : 'Back of card'}
                className="max-h-[min(75dvh,720px)] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            ) : (
              <p className="text-sm text-zinc-500">No {side} photo on file.</p>
            )}
          </div>
          <div className="overflow-y-auto border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)]/60 p-4 lg:border-l lg:border-t-0">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Card details</h3>
            <div className="mt-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3">
              <p className="text-xs text-zinc-500">{[card.year, card.set_name].filter(Boolean).join(' · ') || 'Card'}</p>
              <p className="mt-1 text-lg font-semibold text-white">{card.player_name}</p>
              <p className="mt-1 text-xs text-zinc-400">{formatGradeLine(card)}</p>
              {card.card_number && <p className="mt-1 text-xs text-zinc-500">Card #: {card.card_number}</p>}
              {card.variation && <p className="mt-1 text-xs text-zinc-500">Variation: {card.variation}</p>}
              <SportsCardCompLinks card={card} className="mt-3 border-t border-[var(--color-border-subtle)] pt-3" />
            </div>

            <div
              className={[
                'mt-4 rounded-lg border bg-[var(--color-surface-raised)] p-3 transition-colors',
                refreshing
                  ? 'border-slab-teal/40 shadow-[0_0_0_1px_rgba(45,212,191,0.12)]'
                  : 'border-[var(--color-border-subtle)]',
              ].join(' ')}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current value estimate</p>
              {isFreeUser && card.current_value == null ? (
                <div className="mt-2">
                  <p className="select-none text-2xl font-bold tracking-wide text-zinc-500 blur-[2px]">$0,000</p>
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="mt-2 rounded-lg bg-slab-teal px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-slab-teal-light"
                  >
                    Upgrade for values
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-1 text-xl font-bold">
                    <CardValueDisplay card={card} money={money} showDisclaimer={false} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRefreshValue?.(card)}
                    disabled={refreshing}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-slab-teal/30 bg-slab-teal/10 px-3 py-2 text-xs font-semibold text-slab-teal-light hover:bg-slab-teal/20 disabled:opacity-50"
                  >
                    {refreshing && (
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slab-teal/30 border-t-slab-teal-light"
                        aria-hidden
                      />
                    )}
                    {refreshing ? 'Working…' : (card.current_value == null ? 'Get value' : 'Refresh')}
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Gain / loss</p>
              {gain != null ? (
                <p className={['mt-1 font-semibold', gain >= 0 ? 'text-slab-teal' : 'text-red-400'].join(' ')}>
                  {gain >= 0 ? '+' : ''}{money.format(gain)}
                  {gainPct != null && <span className="ml-1 text-xs text-zinc-500">({pctFormatter.format(gainPct / 100)})</span>}
                </p>
              ) : (
                <p className="mt-1 text-zinc-500">No purchase price yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
