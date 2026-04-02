import { useEffect, useState } from 'react'
import type { Card } from '../../types/card'
import { cardGainDollars, cardGainPercent, formatGradeLine } from '../../lib/cardMetrics'
import { pctFormatter } from '../../lib/formatters'
import { CardValueDisplay } from './CardValueDisplay'

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

  function scpSlugify (raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  function scpCardNumberSlug (raw: string | null | undefined): string {
    if (!raw) return ''
    const base = String(raw).split('/')[0] || ''
    const cleaned = base.replace(/^[#\s]+/, '').trim()
    return scpSlugify(cleaned)
  }

  const scpSportSlug =
    card.sport === 'NFL'
      ? 'football-cards'
      : card.sport === 'NBA'
        ? 'basketball-cards'
        : card.sport === 'MLB'
          ? 'baseball-cards'
          : card.sport === 'NHL'
            ? 'hockey-cards'
            : ''

  const scpYear = card.year != null ? String(card.year) : ''
  const scpSetSlug = card.set_name ? scpSlugify(card.set_name) : ''
  const scpPlayerSlug = scpSlugify(card.player_name)
  const scpCardNumber = scpCardNumberSlug(card.card_number)

  const sportsCardsProGameUrl =
    scpSportSlug && scpYear && scpSetSlug && scpPlayerSlug && scpCardNumber
      ? `https://www.sportscardspro.com/game/${scpSportSlug}-${scpYear}-${scpSetSlug}/${scpPlayerSlug}-${scpCardNumber}`
      : ''

  // Fallback: if we can't build the exact card URL, use a search that still leads to recent sales.
  const sportsCardsProQuery = [
    card.player_name,
    card.year != null ? String(card.year) : null,
    card.set_name,
    card.card_number,
    card.variation,
    card.sport,
  ]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join(' ')
    .trim()

  const sportsCardsProSearchUrl =
    sportsCardsProQuery.length > 0
      ? `https://www.sportscardspro.com/search-products?q=${encodeURIComponent(sportsCardsProQuery)}&type=prices`
      : ''

  const sportsCardsProUrl = sportsCardsProGameUrl || sportsCardsProSearchUrl

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
            </div>

            <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current value estimate</p>
              {isFreeUser && card.current_value == null ? (
                <div className="mt-2">
                  <p className="select-none text-2xl font-bold tracking-wide text-zinc-500 blur-[2px]">$0,000</p>
                  <p className="mt-1 text-xs text-zinc-400">Unlock instant valuations — Upgrade to Pro $5/mo</p>
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="mt-2 rounded-lg bg-slab-teal px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-slab-teal-light"
                  >
                    Upgrade to Pro
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
                    className="mt-2 rounded-lg border border-slab-teal/30 bg-slab-teal/10 px-3 py-2 text-xs font-semibold text-slab-teal-light hover:bg-slab-teal/20 disabled:opacity-50"
                  >
                    {refreshing ? 'Searching sales…' : (card.current_value == null ? 'Get Value' : 'Refresh Value')}
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
              <a
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${card.player_name} ${card.year ?? ''} ${card.set_name ?? ''} ${card.card_number ?? ''}`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-medium text-slab-teal hover:text-slab-teal-light"
              >
                View recent comps
              </a>

              {sportsCardsProUrl && (
                <a
                  href={sportsCardsProUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-4 mt-3 inline-block text-xs font-medium text-slab-teal hover:text-slab-teal-light"
                >
                  SportsCardsPro card
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
