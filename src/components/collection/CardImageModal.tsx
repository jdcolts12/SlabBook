import { useEffect, useState } from 'react'
import type { Card } from '../../types/card'

type Props = {
  card: Card | null
  open: boolean
  onClose: () => void
}

export function CardImageModal ({ card, open, onClose }: Props) {
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
        className="relative z-10 flex max-h-[min(92dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-2xl"
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
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
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
      </div>
    </div>
  )
}
