import type { Card } from '../../types/card'
import { cardGainDollars, cardGainPercent, formatGradeLine } from '../../lib/cardMetrics'
import { formatRelativeTime } from '../../lib/relativeTime'
import { pctFormatter } from '../../lib/formatters'
import { CardThumbnail } from './CardThumbnail'
import { CardValueDisplay } from './CardValueDisplay'
import { SportsCardCompLinks } from './CardCompLinks'

type Props = {
  cards: Card[]
  money: Intl.NumberFormat
  refreshingIds: Record<string, boolean>
  estimateErrors?: Record<string, string | null>
  onRefresh: (c: Card) => void
  onEdit: (c: Card) => void
  onDelete: (c: Card) => void
  onViewImage: (c: Card) => void
  isFreeUser?: boolean
  onUpgradeRequest?: () => void
  showActions?: boolean
}

function GainCell ({ c, money }: { c: Card; money: Intl.NumberFormat }) {
  const d = cardGainDollars(c)
  const p = cardGainPercent(c)
  const paid = c.purchase_price != null ? Number(c.purchase_price) : null
  const est = c.current_value != null ? Number(c.current_value) : null

  if (paid != null && est != null && d != null) {
    const pos = d >= 0
    return (
      <div className="text-right text-[11px] leading-snug">
        <div className="text-zinc-500">
          Paid {money.format(paid)} → Est. {money.format(est)}
        </div>
        <div className={[pos ? 'text-slab-teal' : 'text-red-400', 'mt-0.5 tabular-nums font-medium'].join(' ')}>
          → {d >= 0 ? '+' : ''}
          {money.format(d)}
          {p != null && (
            <span className="ml-1 font-normal text-zinc-500 tabular-nums">{pctFormatter.format(p / 100)}</span>
          )}
        </div>
      </div>
    )
  }

  if (d == null && p == null) {
    return <span className="text-zinc-500">—</span>
  }
  const pos = d != null && d >= 0
  return (
    <div className="text-right">
      {d != null && (
        <div className={[pos ? 'text-slab-teal' : 'text-red-400', 'tabular-nums'].join(' ')}>
          {d >= 0 ? '+' : ''}
          {money.format(d)}
        </div>
      )}
      {p != null && (
        <div className="text-[11px] text-zinc-500 tabular-nums">{pctFormatter.format(p / 100)}</div>
      )}
    </div>
  )
}

export function CollectionTableView ({
  cards,
  money,
  refreshingIds,
  estimateErrors = {},
  onRefresh,
  onEdit,
  onDelete,
  onViewImage,
  isFreeUser = false,
  onUpgradeRequest,
  showActions = true,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-xs uppercase tracking-wider text-zinc-500">
              <th className="w-14 px-2 py-3 font-medium lg:px-3" scope="col">
                <span className="sr-only">Photo</span>
              </th>
              <th className="px-3 py-3 font-medium lg:px-4">Player</th>
              <th className="px-3 py-3 font-medium lg:px-4">Year</th>
              <th className="px-3 py-3 font-medium lg:px-4">Set</th>
              <th className="px-3 py-3 font-medium lg:px-4">Grade</th>
              <th className="px-3 py-3 text-right font-medium lg:px-4">Paid</th>
              <th className="px-3 py-3 text-right font-medium lg:px-4">Value</th>
              <th className="px-3 py-3 text-right font-medium lg:px-4">Gain / loss</th>
              <th className="px-3 py-3 font-medium lg:px-4">Updated</th>
              {showActions && (
                <th className="px-3 py-3 text-right font-medium lg:px-4"> </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {cards.map((c) => {
              const estErr = estimateErrors[c.id]
              const estimating = Boolean(refreshingIds[c.id])
              return (
              <tr
                key={c.id}
                className={[
                  'text-zinc-200 hover:bg-white/[0.03]',
                  estimating ? 'bg-slab-teal/[0.06] shadow-[inset_3px_0_0_0_rgba(45,212,191,0.55)]' : '',
                ].join(' ')}
              >
                <td className="px-2 py-2 align-middle lg:px-3">
                  <CardThumbnail
                    card={c}
                    variant="table"
                    onClick={() => onViewImage(c)}
                  />
                </td>
                <td className="px-3 py-3 font-medium text-white lg:px-4">{c.player_name}</td>
                <td className="px-3 py-3 tabular-nums text-zinc-400 lg:px-4">{c.year ?? '—'}</td>
                <td className="max-w-[140px] px-3 py-3 text-zinc-400 lg:max-w-[200px] lg:px-4">
                  <div className="truncate" title={c.set_name ?? undefined}>
                    {c.set_name ?? '—'}
                  </div>
                  {c.card_number && (
                    <div className="text-[11px] text-zinc-500">#{c.card_number}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-zinc-400 lg:px-4">{formatGradeLine(c)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-zinc-300 lg:px-4">
                  {c.purchase_price != null ? money.format(Number(c.purchase_price)) : '—'}
                </td>
                <td className="min-w-[200px] px-3 py-3 text-right lg:px-4">
                  <CardValueDisplay card={c} money={money} align="right" showLastUpdated={false} showAttribution={false} />
                  <SportsCardCompLinks card={c} className="mt-1.5 justify-end" />
                  {estErr && (
                    <p
                      className="mt-1 max-w-[min(100%,18rem)] text-left text-[11px] leading-snug text-red-400 break-words"
                      title={estErr}
                    >
                      {estErr.length > 220 ? `${estErr.slice(0, 220)}…` : estErr}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 lg:px-4">
                  <GainCell c={c} money={money} />
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500 lg:px-4">
                  {formatRelativeTime(c.last_updated)}
                </td>
                {showActions && (
                  <td className="whitespace-nowrap px-3 py-3 text-right lg:px-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (isFreeUser && c.current_value == null) {
                          onUpgradeRequest?.()
                          return
                        }
                        void onRefresh(c)
                      }}
                      disabled={estimating}
                      className="mr-1 inline-flex items-center justify-center rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                      title={c.current_value == null ? 'Get estimate' : 'Refresh estimate'}
                      aria-label={c.current_value == null ? 'Get estimate' : 'Refresh estimate'}
                    >
                      {estimating ? (
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-slab-teal"
                          aria-hidden
                        />
                      ) : (
                        '↻'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="mr-1 rounded-md px-2 py-1 text-slab-teal hover:bg-white/5 hover:text-slab-teal-light"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(c)}
                      className="rounded-md px-2 py-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
