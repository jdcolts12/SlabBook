import type { Card } from '../../types/card'
import { AI_VALUE_DISCLAIMER } from '../../lib/aiValueCopy'
import { formatLastUpdatedLine } from '../../lib/relativeTime'

type Props = {
  card: Card
  money: Intl.NumberFormat
  align?: 'left' | 'right'
  /** Rare: inline disclaimer (collection/market pages use a page-level note instead). */
  showDisclaimer?: boolean
  /** When false, omit “Updated …” (e.g. table has its own Updated column). Default true. */
  showLastUpdated?: boolean
  /** Pricing source sub-label (SCP web / Claude). Default false — use “How we estimated” details instead. */
  showAttribution?: boolean
}

function ConfidenceBadge ({ confidence }: { confidence: string | null }) {
  const c = (confidence ?? '').toLowerCase()
  if (c === 'high') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slab-teal-light">
        <span className="h-1.5 w-1.5 rounded-full bg-slab-teal" aria-hidden />
        High confidence
      </span>
    )
  }
  if (c === 'medium') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/90">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
        Medium confidence
      </span>
    )
  }
  if (c === 'low') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden />
        Rough estimate
      </span>
    )
  }
  return null
}

function TrendMark ({ trend }: { trend: string | null }) {
  const t = (trend ?? '').toLowerCase()
  if (t === 'rising') return <span className="text-slab-teal-light" title="Rising">↑</span>
  if (t === 'declining') return <span className="text-red-400" title="Declining">↓</span>
  if (t === 'stable') return <span className="text-zinc-500" title="Stable">→</span>
  return null
}

export function CardValueDisplay ({
  card,
  money,
  align = 'left',
  showDisclaimer = false,
  showLastUpdated = true,
  showAttribution = false,
}: Props) {
  const mid = card.current_value != null ? Number(card.current_value) : null
  const low = card.value_low != null ? Number(card.value_low) : null
  const high = card.value_high != null ? Number(card.value_high) : null
  const showRange = low != null && high != null && mid != null && (low !== high || low !== mid)
  const note = card.value_note?.trim() ?? ''
  const alignCls = align === 'right' ? 'text-right' : 'text-left'

  if (mid == null) {
    return (
      <div className={alignCls}>
        <span className="text-zinc-500">—</span>
        {showLastUpdated && (
          <p className="mt-1 text-[10px] leading-snug text-zinc-600">{formatLastUpdatedLine(card.last_updated)}</p>
        )}
      </div>
    )
  }

  const rowJustify = align === 'right' ? 'justify-end' : 'justify-start'

  return (
    <div className={alignCls}>
      <div className={['flex flex-wrap items-center gap-1.5', rowJustify].join(' ')}>
        <span className="text-lg font-semibold tabular-nums text-white sm:text-base">{money.format(mid)}</span>
        <TrendMark trend={card.trend} />
      </div>
      {showRange && (
        <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
          {money.format(low!)} — {money.format(high!)}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={card.confidence} />
      </div>
      {note && (
        <details className="mt-1 max-w-[min(100%,20rem)] text-[10px] leading-snug text-zinc-500 sm:max-w-none">
          <summary className="cursor-pointer list-none text-zinc-400 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="border-b border-dotted border-zinc-600 text-zinc-400 hover:text-zinc-300">
              How we estimated this
            </span>
          </summary>
          <p className="mt-1.5 pl-0 text-left text-zinc-500">{note}</p>
        </details>
      )}
      {showLastUpdated && (
        <p className="mt-1 text-[10px] text-zinc-600">{formatLastUpdatedLine(card.last_updated)}</p>
      )}
      {card.pricing_source === 'demo_mode' && (
        <p className="mt-0.5 text-[9px] text-amber-400/90">Demo estimate</p>
      )}
      {showAttribution &&
        (card.pricing_source === 'sportscardspro_web' || card.pricing_source === 'sportscardspro') && (
        <p className="mt-0.5 text-[9px] text-zinc-600">SportsCardsPro</p>
      )}
      {showAttribution && card.pricing_source === 'claude_estimate' && (
        <p className="mt-0.5 text-[9px] text-zinc-600">Model estimate (no web search)</p>
      )}
      {showDisclaimer && (
        <p className="mt-1 text-[9px] leading-snug text-zinc-600">{AI_VALUE_DISCLAIMER}</p>
      )}
    </div>
  )
}
