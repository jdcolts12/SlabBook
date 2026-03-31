import type { Card } from '../../types/card'
import { cardGainDollars, cardGainPercent, formatGradeLine } from '../../lib/cardMetrics'
import { pctFormatter } from '../../lib/formatters'
import { CardThumbnail } from './CardThumbnail'
import { CardValueDisplay } from './CardValueDisplay'

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

export function CollectionGridView ({
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const d = cardGainDollars(c)
        const p = cardGainPercent(c)
        const gainPositive = d != null && d >= 0
        const paid = c.purchase_price != null ? Number(c.purchase_price) : null
        const est = c.current_value != null ? Number(c.current_value) : null
        const setLine = [c.year != null ? String(c.year) : null, c.set_name?.trim() || null]
          .filter(Boolean)
          .join(' · ')
        return (
          <article
            key={c.id}
            className="flex flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] transition hover:border-zinc-600/80"
          >
            <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-t-xl">
              <CardThumbnail
                card={c}
                variant="fill"
                className="!rounded-none"
                onClick={() => onViewImage(c)}
              />
            </div>
            <div className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-white">{c.player_name}</h3>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">{setLine || '—'}</p>
                </div>
                {showActions && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isFreeUser && c.current_value == null) {
                        onUpgradeRequest?.()
                        return
                      }
                      void onRefresh(c)
                    }}
                    disabled={Boolean(refreshingIds[c.id])}
                    className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white disabled:opacity-50"
                    title={c.current_value == null ? 'Get value' : 'Refresh AI estimate'}
                    aria-label={c.current_value == null ? 'Get value' : 'Refresh AI estimate'}
                  >
                    {refreshingIds[c.id] ? '…' : c.current_value == null ? '◎' : '↻'}
                  </button>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium uppercase tracking-wide text-zinc-400">
                {formatGradeLine(c)}
              </p>
              <div className="mt-3 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Est. value</p>
                <div className="mt-1 text-2xl font-bold tabular-nums leading-tight text-white">
                  <CardValueDisplay card={c} money={money} align="left" showDisclaimer={false} />
                </div>
                {showActions && c.current_value == null && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isFreeUser) {
                        onUpgradeRequest?.()
                        return
                      }
                      void onRefresh(c)
                    }}
                    disabled={Boolean(refreshingIds[c.id])}
                    className="mt-2 rounded-lg border border-zinc-600/80 bg-zinc-800/40 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700/40 disabled:opacity-50"
                  >
                    {refreshingIds[c.id] ? 'Searching sales…' : 'Get Value'}
                  </button>
                )}
                {estimateErrors[c.id] && (
                  <p className="mt-1 text-[11px] text-red-400">
                    Unable to find comps. Retry.
                  </p>
                )}
              </div>
              <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Gain / loss</p>
                <div className="mt-1">
                  {paid != null && est != null && d != null ? (
                    <div className="text-sm leading-snug">
                      <p className="text-zinc-500">
                        Paid {money.format(paid)} → Est. {money.format(est)}
                      </p>
                      <p className={gainPositive ? 'text-slab-teal' : 'text-red-400'}>
                        → {d >= 0 ? '+' : ''}
                        {money.format(d)}
                        {p != null && (
                          <span className="ml-1 text-xs text-zinc-500 tabular-nums">
                            ({pctFormatter.format(p / 100)})
                          </span>
                        )}
                      </p>
                    </div>
                  ) : d == null && p == null ? (
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
                </div>
              </div>
              {showActions && (
                <div className="mt-4 flex gap-2">
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
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
