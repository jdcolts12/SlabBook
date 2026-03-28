import type { Card } from '../../types/card'
import { AI_VALUE_DISCLAIMER } from '../../lib/aiValueCopy'
import { formatLastUpdatedLine } from '../../lib/relativeTime'

type Props = {
  card: Card
  money: Intl.NumberFormat
  align?: 'left' | 'right'
  compactDisclaimer?: boolean
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
        Est. value
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

export function CardValueDisplay ({ card, money, align = 'left', compactDisclaimer = false }: Props) {
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
        <p className="mt-1 text-[10px] leading-snug text-zinc-600">{formatLastUpdatedLine(card.last_updated)}</p>
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
        <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-zinc-500 sm:max-w-none">
          <span
            className="cursor-help border-b border-dotted border-zinc-600"
            tabIndex={0}
            title={note}
          >
            Hover to see why
          </span>
        </p>
      )}
      <p className="mt-1 text-[10px] text-zinc-600">{formatLastUpdatedLine(card.last_updated)}</p>
      {(card.pricing_source === 'claude_estimate' || card.confidence) && (
        <p className="mt-0.5 text-[9px] text-zinc-600">Powered by Claude AI</p>
      )}
      <p className={compactDisclaimer ? 'mt-1 line-clamp-2 text-[9px] leading-snug text-zinc-600' : 'mt-1 text-[9px] leading-snug text-zinc-600'}>
        {AI_VALUE_DISCLAIMER}
      </p>
    </div>
  )
}
