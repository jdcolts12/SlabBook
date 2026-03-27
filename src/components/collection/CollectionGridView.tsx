import type { Card } from '../../types/card'
import { cardGainDollars, cardGainPercent, formatGradeLine } from '../../lib/cardMetrics'
import { formatRelativeTime } from '../../lib/relativeTime'
import { pctFormatter } from '../../lib/formatters'

type Props = {
  cards: Card[]
  money: Intl.NumberFormat
  refreshingIds: Record<string, boolean>
  onRefresh: (c: Card) => void
  onEdit: (c: Card) => void
  onDelete: (c: Card) => void
}

export function CollectionGridView ({
  cards,
  money,
  refreshingIds,
  onRefresh,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const d = cardGainDollars(c)
        const p = cardGainPercent(c)
        const gainPositive = d != null && d >= 0
        return (
          <article
            key={c.id}
            className="flex flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 transition hover:border-zinc-600/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-white">{c.player_name}</h3>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {[c.year, c.sport].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onRefresh(c)}
                disabled={Boolean(refreshingIds[c.id])}
                className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-50"
                title="Refresh value"
                aria-label="Refresh card value"
              >
                {refreshingIds[c.id] ? '…' : '↻'}
              </button>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-zinc-400">
              {c.set_name ?? 'No set'}
              {c.card_number ? ` · #${c.card_number}` : ''}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{formatGradeLine(c)}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Paid</dt>
                <dd className="mt-0.5 tabular-nums text-zinc-300">
                  {c.purchase_price != null ? money.format(Number(c.purchase_price)) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Value</dt>
                <dd className="mt-0.5 tabular-nums text-slab-teal-light">
                  {c.current_value != null ? money.format(Number(c.current_value)) : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-zinc-500">Gain / loss</dt>
                <dd className="mt-0.5">
                  {d == null && p == null ? (
                    <span className="text-zinc-500">—</span>
                  ) : (
                    <>
                      {d != null && (
                        <span
                          className={[
                            'tabular-nums font-medium',
                            gainPositive ? 'text-slab-teal' : 'text-red-400',
                          ].join(' ')}
                        >
                          {d >= 0 ? '+' : ''}
                          {money.format(d)}
                        </span>
                      )}
                      {p != null && (
                        <span className="ml-2 text-xs text-zinc-500 tabular-nums">
                          ({pctFormatter.format(p / 100)})
                        </span>
                      )}
                    </>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-600">Updated {formatRelativeTime(c.last_updated)}</p>
            <div className="mt-4 flex gap-2 border-t border-[var(--color-border-subtle)] pt-4">
              <button
                type="button"
                onClick={() => onEdit(c)}
                className="flex-1 rounded-lg border border-zinc-600/80 py-2 text-sm font-medium text-slab-teal transition hover:bg-white/5"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void onDelete(c)}
                className="rounded-lg border border-transparent py-2 px-3 text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
